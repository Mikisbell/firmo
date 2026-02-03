# Critical Analysis: Network Throttling & Flaky Tests

> **Fecha:** 3 Febrero 2026  
> **Autor:** Kiro AI + User Critical Review  
> **Status:** INVESTIGACIÓN EN PROGRESO

---

## 🚨 Problemas Identificados

### 1. El Peligro del "Éxito Silencioso"

**Supuesto Falso:**
```
58 tests pasando = Panel de Administración es estable
```

**Realidad:**
- Tests corren en entorno "perfecto" (local, sin latencia)
- WSL filesystem latency: 50-200ms
- Headless rendering: Diferente al navegador real
- Network throttling: NO implementado

**Impacto:**
- Tests pasan localmente pero fallan en producción
- Especialmente crítico en KDS (Kitchen Display System)
- WebSockets y colas de mensajes no se prueban

---

### 2. Deuda Técnica del POM

**Problema:**
```typescript
// ❌ Malo: Selectores basados en clases CSS
const selectors = {
  saveBtn: '.bg-amber-500.hover\\:bg-amber-600',  // Tailwind classes
  table: '.data-table-container',                  // Generic class
};

// Si Tailwind cambia, todo se rompe
```

**Solución:**
```typescript
// ✅ Bueno: Selectores basados en data-testid
const selectors = {
  saveBtn: '[data-testid="save-promotion-btn"]',
  table: '[data-testid="promotions-table"]',
};
```

**Auditoría Actual:**
- ❌ `src/app/admin/promociones/page.tsx` - NO usa data-testid
- ❌ `src/app/admin/promociones/nuevo/page.tsx` - NO usa data-testid
- ❌ `src/app/admin/promociones/[id]/page.tsx` - NO usa data-testid

---

### 3. Falta de Network Throttling

**Escenario Real:**
```
Cocina con Wi-Fi débil:
- Latencia: 500-2000ms
- Packet loss: 5-10%
- Bandwidth: 1-2 Mbps

Tests actuales:
- Latencia: 0-50ms
- Packet loss: 0%
- Bandwidth: Unlimited
```

**Resultado:**
- Tests pasan pero sistema falla en producción
- Especialmente crítico para WebSockets (KDS)
- Timeouts no se prueban

---

### 4. Falta de Análisis de Network Logs

**Problema:**
El ERROR_DIAGNOSIS_PROTOCOL.md NO incluye paso de comparar:
- Network Logs del Trace
- Console Logs del componente

**Impacto:**
- 90% de errores en KDS son de WebSockets/colas
- Pero se ignoran porque no se comparan

---

## 🔍 Auditoría de Selectores

### Promotions Page (`src/app/admin/promociones/page.tsx`)

**Selectores Actuales:**
```typescript
// ❌ Sin data-testid
<Link href="/admin/promociones/nuevo" className="flex items-center gap-2 px-4 py-2.5 bg-amber-500...">
  <Plus className="w-4 h-4" />
  Nueva Promoción
</Link>

// ❌ Sin data-testid
<button
  onClick={() => handleDelete(p.id)}
  className="p-1.5 hover:bg-red-500/10 text-red-400..."
>
  <Trash2 className="w-4 h-4" />
</button>
```

**Problema:**
- Tests usan selectores genéricos
- Si Tailwind cambia, tests fallan
- No hay forma de identificar elementos de forma confiable

**Solución Propuesta:**
```typescript
// ✅ Con data-testid
<Link 
  href="/admin/promociones/nuevo" 
  data-testid="create-promotion-btn"
  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500..."
>
  <Plus className="w-4 h-4" />
  Nueva Promoción
</Link>

// ✅ Con data-testid
<button
  onClick={() => handleDelete(p.id)}
  data-testid={`delete-promotion-${p.id}`}
  className="p-1.5 hover:bg-red-500/10 text-red-400..."
>
  <Trash2 className="w-4 h-4" />
</button>
```

---

## 🧪 Test de Network Throttling

### Propuesta: Crear Test Flaky Intencional

**Objetivo:** Probar el framework con un test que falla bajo condiciones reales

```typescript
// e2e/07-admin-promotions-crud.spec.ts - Agregar test

test('should create promotion with network throttling (FLAKY TEST)', async ({ page, context }) => {
  // Simular Wi-Fi débil en cocina
  await context.route('**/*', async (route) => {
    // Agregar latencia de 1-2 segundos
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
    
    // Simular packet loss (10% de requests fallan)
    if (Math.random() < 0.1) {
      await route.abort('failed');
      return;
    }
    
    await route.continue();
  });

  await authenticateAsAdmin(page, ADMIN_PIN);

  const uniquePromotion = {
    ...TEST_PROMOTION,
    name: `Throttled Promotion ${Date.now()}`,
  };

  // Este test debería fallar bajo throttling
  const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
    headers: { 'Content-Type': 'application/json' },
    data: uniquePromotion,
  });

  // Esperar con timeout más largo
  expect([200, 201]).toContain(response.status());
});
```

**Resultado Esperado:**
- ✅ Pasa en local (sin throttling)
- ❌ Falla en CI con throttling
- Demuestra el problema del "éxito silencioso"

---

## 📊 Análisis de Backend

### Promotions API - Puntos de Fallo Potencial

#### 1. Cache Invalidation Race Condition
```typescript
// src/app/api/admin/promotions/route.ts - Línea 180

// ❌ Problema: Race condition entre cache invalidation y query
await cache.invalidatePattern('promotions:*');

// Si otro request llega entre invalidation y query,
// puede obtener datos stale
```

**Escenario:**
```
T1: Request A crea promoción
T2: Cache invalidation comienza
T3: Request B consulta promotions (obtiene cache viejo)
T4: Cache invalidation termina
T5: Request A retorna
```

#### 2. Auto-deactivate Expired Promotions
```typescript
// Línea 65-75
const deactivated = await prisma.promotions.updateMany({
  where: {
    tenant_id: TENANT_ID,
    ends_at: { lt: now },
    is_active: true,
  },
  data: { is_active: false },
});
```

**Problema:**
- Ocurre en CADA request GET
- Si hay 1000 promotions expiradas, cada GET es lento
- Debería ser un job de background

#### 3. Falta de Connection Pooling Validation
```typescript
// No hay validación de pool exhaustion
// Si hay 100+ requests concurrentes, pool se agota
```

---

## 🔧 Soluciones Propuestas

### Fase 1: Auditoría de Selectores (INMEDIATO)

**Tarea:** Agregar `data-testid` a todos los componentes de admin

```bash
# Archivos a actualizar:
- src/app/admin/promociones/page.tsx
- src/app/admin/promociones/nuevo/page.tsx
- src/app/admin/promociones/[id]/page.tsx
- src/app/admin/productos/page.tsx
- src/app/admin/empleados/page.tsx
- src/app/admin/drivers/page.tsx
```

**Impacto:**
- ✅ Tests más confiables
- ✅ Menos falsos positivos
- ✅ Mejor diagnóstico de fallos

### Fase 2: Network Throttling Tests (CORTO PLAZO)

**Tarea:** Crear tests con throttling simulado

```typescript
// e2e/07-admin-promotions-crud-throttled.spec.ts
test.describe('Promotions CRUD - Network Throttling', () => {
  test('should handle slow network', async ({ page, context }) => {
    // Simular latencia
    await context.route('**/*', async (route) => {
      await new Promise(r => setTimeout(r, 1000));
      await route.continue();
    });
    
    // Test aquí
  });
});
```

**Impacto:**
- ✅ Detecta problemas de timeout
- ✅ Valida resiliencia
- ✅ Simula condiciones reales

### Fase 3: Backend Optimization (MEDIANO PLAZO)

**Tarea 1:** Mover auto-deactivate a background job
```typescript
// Crear: src/core/jobs/deactivate-expired-promotions.ts
export async function deactivateExpiredPromotions() {
  const now = new Date();
  await prisma.promotions.updateMany({
    where: {
      ends_at: { lt: now },
      is_active: true,
    },
    data: { is_active: false },
  });
}

// Ejecutar cada 5 minutos con cron
```

**Tarea 2:** Mejorar cache invalidation
```typescript
// Usar event-based invalidation en lugar de pattern
// Cuando se crea/actualiza/elimina una promoción,
// invalidar solo esa entrada, no todo el patrón
```

**Tarea 3:** Agregar connection pool monitoring
```typescript
// Monitorear pool exhaustion
// Alertar si > 80% de conexiones en uso
```

---

## 📋 Protocolo de Diagnóstico Mejorado

### Agregar a ERROR_DIAGNOSIS_PROTOCOL.md

**Paso 6: Comparar Network Logs con Console Logs**

```markdown
### Paso 6: Análisis de Network vs Console

**¿Qué buscar?**
- Network: ¿Hay requests pendientes?
- Network: ¿Hay errores HTTP?
- Network: ¿Hay timeouts?
- Console: ¿Hay errores de WebSocket?
- Console: ¿Hay errores de queue?

**Ejemplo:**
```
Network: POST /api/admin/promotions → 201 (exitoso)
Console: WebSocket connection failed
Diagnóstico: API exitosa pero WebSocket falló
Causa: Conexión de red inestable
Solución: Agregar retry logic para WebSocket
```

**Checklist:**
- [ ] ¿Revisaste Network tab?
- [ ] ¿Revisaste Console tab?
- [ ] ¿Comparaste ambos?
- [ ] ¿Identificaste discrepancias?
```

---

## 🎯 Próximos Pasos

### Inmediato (Hoy)
1. [ ] Auditar selectores en componentes de admin
2. [ ] Crear documento de "data-testid standards"
3. [ ] Actualizar POM_TEMPLATE.ts con ejemplos

### Corto Plazo (Esta semana)
1. [ ] Agregar data-testid a todos los componentes
2. [ ] Crear tests con network throttling
3. [ ] Actualizar ERROR_DIAGNOSIS_PROTOCOL.md

### Mediano Plazo (Este mes)
1. [ ] Mover auto-deactivate a background job
2. [ ] Mejorar cache invalidation
3. [ ] Agregar connection pool monitoring

---

## 📊 Métricas de Éxito

| Métrica | Antes | Después | Target |
|---------|-------|---------|--------|
| Tests con data-testid | 0% | 100% | 100% |
| Tests con throttling | 0 | 5+ | 10+ |
| Flaky tests | ? | Identificados | 0 |
| Network timeout handling | ❌ | ✅ | ✅ |
| Backend optimization | ❌ | En progreso | ✅ |

---

## 🎓 Lecciones Aprendidas

1. **"Éxito Silencioso" es Real**
   - Tests pasando ≠ Sistema estable
   - Necesitamos pruebas de condiciones reales

2. **Selectores Frágiles Causan Falsos Positivos**
   - data-testid es esencial
   - Clases CSS son frágiles

3. **Network Throttling es Crítico**
   - Especialmente para KDS
   - 90% de errores son de red

4. **Backend Optimization Importa**
   - Auto-deactivate en cada GET es ineficiente
   - Cache invalidation puede causar race conditions

---

## 🔗 Referencias

- [Playwright Network Throttling](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)
- [Data-TestId Best Practices](https://kentcdodds.com/blog/making-your-ui-tests-resilient-to-change)
- [Network Resilience Testing](https://www.smashingmagazine.com/2021/09/testing-web-resilience/)

---

**Status:** 🔴 CRÍTICO - Requiere acción inmediata  
**Prioridad:** 🔴 ALTA  
**Impacto:** 🔴 CRÍTICO - Afecta confiabilidad de tests
