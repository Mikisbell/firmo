# Multi-Tenant E2E Tests - Análisis del Bloqueador

## Resumen Ejecutivo

**Estado:** 🔴 BLOQUEADO - Autenticación falla consistentemente  
**Progreso Real:** 15/35 tests (43%) - Unit + Integration tests pasando, E2E bloqueados  
**Bloqueador Crítico:** PIN authentication failing con "Error al validar PIN"

## Trabajo Completado ✅

### 1. Infraestructura de Tests
- ✅ Función `authenticateAsAdmin()` con navegación UI completa
- ✅ Data-testids en TODAS las páginas admin
- ✅ Script de provisioning corregido (upsert con tenant_id_sku)
- ✅ 2 tenants provisionados exitosamente

### 2. Redirección Post-Login
- ✅ Agregado `router.push('/admin/dashboard')` en PinModal.tsx (línea ~112)
- ✅ Agregado `router.push('/admin/dashboard')` en AdminLayout.tsx (línea ~72)
- ✅ Ambas redirecciones con logging para debugging

### 3. Datos de Prueba
```bash
✅ Tenant 1: ID 11111111-1111-1111-1111-111111111111, PIN 1111
✅ Tenant 2: ID 22222222-2222-2222-2222-222222222222, PIN 2222
✅ 3 empleados por tenant
✅ 2 productos por tenant
```

## Problema Actual 🔴

### Síntoma
```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
waiting for navigation to "**/admin/**" until "load"
```

### Error en UI
```yaml
- paragraph [ref=e24]: Error al validar PIN
```

### Causa Raíz
El PIN "1111" NO está siendo validado correctamente. Posibles causas:

1. **PIN Salt Mismatch**: El salt usado en provisioning no coincide con el salt del servidor
2. **Tenant Context Missing**: La autenticación no tiene contexto del tenant
3. **Cookie/Session Issue**: La sesión no se está estableciendo correctamente

## Análisis Detallado

### 1. PIN Hashing
**Script de Provisioning:**
```typescript
function hashPin(pin: string): string {
  const SALT = 'PARK_POS_2026_';
  return createHash('sha256').update(SALT + pin).digest('hex');
}
```

**Servidor (.env.local):**
```
PIN_SALT="PARK_POS_2026_"
```

✅ Salt coincide - NO es el problema

### 2. Tenant Context
**Problema Potencial:** La API `/api/auth/session` necesita saber a qué tenant pertenece el empleado.

**Flujo Actual:**
```
1. Usuario ingresa PIN "1111"
2. Frontend llama POST /api/auth/session { pin: "1111", allowedRoles: [...] }
3. Backend busca empleado con ese PIN hash
4. ❌ PROBLEMA: ¿Cómo sabe el backend qué tenant?
```

**Solución Necesaria:**
- Agregar `tenant_id` al request body
- O usar subdomain/header para identificar tenant
- O buscar en TODOS los tenants (menos seguro)

### 3. Código de Autenticación

**API Route:** `src/app/api/auth/session/route.ts`
```typescript
// ¿Cómo obtiene el tenant_id?
const employee = await prisma.employees.findFirst({
  where: {
    pin_hash: hashedPin,
    is_active: true,
    // ❌ FALTA: tenant_id filter?
  },
});
```

## Soluciones Propuestas

### Opción A: Agregar tenant_id al Request (RECOMENDADO)
**Ventaja:** Explícito, seguro, escalable  
**Desventaja:** Requiere modificar tests y UI

```typescript
// e2e/helpers/test-utils.ts
export async function authenticateAsAdmin(page: Page, pin: string, tenantId: string): Promise<void> {
    await page.goto('http://localhost:3000/admin');
    
    // Set tenant context BEFORE authentication
    await page.evaluate((tid) => {
        localStorage.setItem('tenant_id', tid);
    }, tenantId);
    
    await page.waitForSelector('[data-testid="pin-pad"]');
    
    for (const digit of pin) {
        await page.click(`button:has-text("${digit}")`);
        await page.waitForTimeout(100);
    }
    
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
}
```

```typescript
// src/components/inventory/PinModal.tsx
const handlePinSubmit = async (pin: string) => {
    const tenantId = localStorage.getItem('tenant_id') || DEFAULT_TENANT_ID;
    
    const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            pin, 
            allowedRoles,
            tenant_id: tenantId  // ← AGREGAR
        }),
        credentials: 'include',
    });
    // ...
};
```

```typescript
// src/app/api/auth/session/route.ts
export async function POST(request: Request) {
    const { pin, allowedRoles, tenant_id } = await request.json();
    
    const employee = await prisma.employees.findFirst({
        where: {
            tenant_id,  // ← AGREGAR
            pin_hash: hashedPin,
            is_active: true,
            role: { in: allowedRoles },
        },
    });
    // ...
}
```

### Opción B: Buscar en Todos los Tenants
**Ventaja:** No requiere cambios en UI/tests  
**Desventaja:** Menos seguro, más lento

```typescript
// src/app/api/auth/session/route.ts
const employee = await prisma.employees.findFirst({
    where: {
        pin_hash: hashedPin,
        is_active: true,
        role: { in: allowedRoles },
    },
    include: {
        tenant: true,
    },
});
```

### Opción C: Subdomain-based Tenant Resolution
**Ventaja:** Más "enterprise", escalable  
**Desventaja:** Requiere configuración de DNS/hosts

```
tenant1.localhost:3000 → tenant_id: 11111111-...
tenant2.localhost:3000 → tenant_id: 22222222-...
```

## Recomendación Final

**Implementar Opción A** (tenant_id explícito) porque:
1. ✅ Más seguro - No hay ambigüedad
2. ✅ Más rápido - Query directo con tenant_id
3. ✅ Más claro - Intención explícita
4. ✅ Fácil de testear - Tests controlan el tenant

## Próximos Pasos

1. **Modificar API `/api/auth/session`:**
   - Aceptar `tenant_id` en request body
   - Agregar `tenant_id` al where clause

2. **Modificar PinModal:**
   - Leer `tenant_id` de localStorage
   - Incluir en request body

3. **Modificar Tests:**
   - Agregar `tenant_id` a localStorage antes de auth
   - Actualizar función `authenticateAsAdmin()`

4. **Ejecutar Tests:**
   ```bash
   npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts
   ```

5. **Iterar sobre Fallos:**
   - Ajustar según sea necesario
   - Validar 100% coverage

## Archivos a Modificar

1. `src/app/api/auth/session/route.ts` - Agregar tenant_id filter
2. `src/components/inventory/PinModal.tsx` - Incluir tenant_id en request
3. `e2e/helpers/test-utils.ts` - Set tenant_id en localStorage
4. `e2e/multi-tenant-rls-isolation.spec.ts` - Pasar tenant_id a authenticateAsAdmin

## Tiempo Estimado

- Modificaciones de código: 15-20 minutos
- Ejecución de tests: 10-15 minutos
- Iteración sobre fallos: 20-30 minutos
- **Total: 45-65 minutos**

---

**Última actualización:** 6 Febrero 2026  
**Estado:** 🔴 BLOQUEADO - Requiere implementación de Opción A  
**Bloqueador:** PIN authentication failing - tenant context missing  
**Solución:** Agregar tenant_id explícito al flujo de autenticación
