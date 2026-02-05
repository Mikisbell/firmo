# Diagnóstico de Problemas Reales - Auditoría Completa

**Fecha:** 5 Febrero 2026  
**Objetivo:** Identificar y documentar qué está realmente roto

---

## 🔴 PROBLEMA 1: RLS Isolation Tests Fallan (4/10)

### Síntoma
```
❌ RLS Isolation: Tenant 1 no ve datos de Tenant 2
   Esperado: 0 órdenes
   Obtenido: 10 órdenes
```

### Causa Raíz
El script `test-multi-tenant-integration.ts` **NO verifica que RLS funciona realmente**.

**Lo que hace actualmente:**
```typescript
// Verifica que las políticas EXISTEN
const policies = await prisma.$queryRaw`
  SELECT policyname FROM pg_policies WHERE tablename = 'orders'
`;
```

**Lo que debería hacer:**
```typescript
// Verificar que RLS AÍSLA REALMENTE los datos
// 1. Crear Tenant A con datos
// 2. Crear Tenant B con datos
// 3. Conectar como Tenant A
// 4. Verificar que NO ve datos de Tenant B
```

### Problema Específico
El script usa `prisma` (que es el usuario `postgres` con `bypassrls = true`), así que **SIEMPRE ve todos los datos**, sin importar si RLS funciona o no.

### Solución Requerida
1. Crear conexión con usuario `app_user` (que tiene RLS habilitado)
2. Configurar contexto de tenant: `SET app.current_tenant_id = 'tenant-id'`
3. Verificar que solo ve datos de su tenant

### Código Necesario
```typescript
// Crear conexión con app_user
const appUserPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_APP_USER, // Usuario con RLS
    },
  },
});

// Configurar contexto
await appUserPrisma.$executeRaw`
  SELECT set_config('app.current_tenant_id', ${tenantId}::text, false)
`;

// Ahora verificar que solo ve datos de su tenant
const orders = await appUserPrisma.orders.findMany();
// Debe estar vacío si no hay órdenes de este tenant
```

---

## 🔴 PROBLEMA 2: E2E Tests Fallan (0/20)

### Síntoma
```
❌ Flujo completo: Provisionar nuevo tenant
   Error: element(s) not found
   Locator: text=Provision New Tenant
   Timeout: 5000ms
```

### Causa Raíz
El test busca `text=Provision New Tenant` pero la página probablemente tiene otro texto.

**Verificación manual:**
```bash
curl http://localhost:3000/admin/tenant/provisioning
# Buscar qué texto realmente tiene la página
```

### Problema Específico
1. El selector de Playwright es incorrecto
2. O la página no está renderizando el contenido esperado
3. O hay un problema de autenticación

### Solución Requerida
1. Navegar manualmente a la página
2. Inspeccionar el HTML real
3. Actualizar los selectores de Playwright

### Código Necesario
```typescript
// En el test, agregar debug
await page.goto(`${baseURL}/admin/tenant/provisioning`);

// Esperar a que cargue
await page.waitForLoadState('networkidle');

// Tomar screenshot para ver qué hay
await page.screenshot({ path: 'debug.png' });

// Imprimir el HTML
console.log(await page.content());

// Luego buscar el texto correcto
```

---

## 🔴 PROBLEMA 3: Tests Completos Timeout (180+ segundos)

### Síntoma
```
npm test -- --run
# Timeout después de 180 segundos
# No termina nunca
```

### Causa Raíz
Hay tests que se quedan esperando indefinidamente.

**Posibles causas:**
1. Tests que no limpian recursos (conexiones abiertas)
2. Tests que esperan eventos que nunca llegan
3. Tests con `beforeEach` o `afterEach` que no terminan

### Problema Específico
No sé cuál es el test que se queda colgado.

### Solución Requerida
1. Ejecutar tests con timeout más corto
2. Identificar cuál se queda colgado
3. Arreglarlo

### Código Necesario
```bash
# Ejecutar con timeout de 10 segundos por test
npm test -- --run --testTimeout=10000 2>&1 | tee test-output.txt

# Luego buscar cuál se queda colgado
grep -A 5 "TIMEOUT" test-output.txt
```

---

## 📊 RESUMEN DE PROBLEMAS

| Problema | Severidad | Causa | Solución |
|----------|-----------|-------|----------|
| RLS Isolation Falla | 🔴 CRÍTICA | Script no verifica RLS realmente | Usar app_user + set_config |
| E2E Tests Fallan | 🔴 CRÍTICA | Selectores incorrectos | Actualizar selectores |
| Tests Timeout | 🔴 CRÍTICA | Test se queda colgado | Identificar y arreglar |

---

## 🎯 PLAN DE ACCIÓN

### Paso 1: Identificar el test que se queda colgado
```bash
npm test -- --run --testTimeout=10000 2>&1 | tee test-output.txt
```

### Paso 2: Arreglar RLS Isolation
1. Crear conexión con `app_user`
2. Configurar contexto de tenant
3. Verificar que RLS funciona

### Paso 3: Arreglar E2E Tests
1. Navegar manualmente a la página
2. Inspeccionar HTML
3. Actualizar selectores

### Paso 4: Ejecutar tests nuevamente
```bash
npm test -- --run
```

---

## 💡 LECCIONES

1. **No asumir que las políticas existen = funcionan**
   - Necesito verificar que realmente aíslan datos
   - Usar usuario con RLS habilitado

2. **No asumir que los selectores de Playwright son correctos**
   - Necesito verificar manualmente qué texto tiene la página
   - Usar screenshots y console.log para debug

3. **No asumir que los tests terminan**
   - Necesito ejecutarlos con timeout
   - Identificar cuál se queda colgado

---

**Creado:** 5 Febrero 2026  
**Status:** Diagnóstico completado  
**Próximo paso:** Ejecutar plan de acción
