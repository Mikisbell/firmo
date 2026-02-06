# Vercel Build Fixes - 5 Febrero 2026

## Resumen

Corrección de **11 errores de build pre-existentes** en Vercel que bloqueaban el deploy del sistema de notificaciones para mesero.

**Status:** ✅ Build exitoso - 143 páginas generadas, 0 errores

---

## Errores Corregidos

### 1. Imports Incorrectos de OpenAPI Generator (3 errores)

**Problema:** Archivos importaban desde `@/lib/openapi/generator` pero debía ser `@/src/lib/openapi/generator`

**Archivos afectados:**
- `src/app/api/docs/openapi.json/route.ts`
- `src/app/api/docs/postman/route.ts`

**Fix:**
```typescript
// Antes
import { generateOpenAPISpec } from '@/lib/openapi/generator';

// Después
import { generateOpenAPISpec } from '@/src/lib/openapi/generator';
```

---

### 2. Export Faltante: `MetricNames` (1 error)

**Problema:** No existía el export en `src/core/observability/metrics.ts`

**Fix:** Agregado objeto `MetricNames` con todas las constantes de métricas:
```typescript
export const MetricNames = {
  EMPLOYEES_CREATED_TOTAL: 'employees_created_total',
  EMPLOYEES_ACTIVE: 'employees_active',
  ORDERS_CREATED_TOTAL: 'orders_created_total',
  CACHE_HITS_TOTAL: 'cache_hits_total',
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  // ... 20+ métricas más
} as const;
```

---

### 3. Export Faltante: `metricsHelpers` (2 errores)

**Problema:** No existía el export en `src/core/observability/metrics.ts`

**Fix:** Agregado objeto `metricsHelpers` con funciones helper:
```typescript
export const metricsHelpers = {
  recordCacheHit: (key: string) => { ... },
  recordCacheMiss: (key: string) => { ... },
  recordHttpRequest: (method, pathname, status, durationMs) => { ... },
  recordApiError: (pathname, errorType) => { ... },
  // ... funciones de saga metrics
};
```

---

### 4. Método `metrics.set()` Faltante

**Problema:** Código llamaba a `metrics.set()` pero el método no existía

**Fix:** Agregado método `set()` como alias de `gauge()`:
```typescript
set(metric: string, value: number, tags?: MetricTags): void {
  this.gauge(metric, value, tags);
}
```

---

### 5. Error de Tipo en Delivery Route

**Problema:** Array readonly causaba error de tipo en Prisma query

**Fix:** Cambiado a `string[]` mutable:
```typescript
// Antes
const statuses: readonly string[] = ['PENDING', 'ASSIGNED'];

// Después
const statuses: string[] = ['PENDING', 'ASSIGNED'];
```

**Archivo:** `src/app/api/delivery/route.ts`

---

### 6. Campos Inexistentes en Modelo `drivers`

**Problema:** Select incluía campos que no existen en el schema Prisma

**Fix:** Eliminados campos inexistentes:
```typescript
// Antes
select: {
  id: true,
  current_location: true,  // ❌ No existe
  created_at: true,         // ❌ No existe
  updated_at: true,         // ❌ No existe
}

// Después
select: {
  id: true,
  name: true,
  phone: true,
  status: true,
}
```

**Archivo:** `src/app/api/drivers/route.ts`

---

### 7. Error de Tipo en `TerminalConfig`

**Problema:** Campo `activated_at` no existe, debe ser `registered_at`

**Fix:** Corregida estructura del tipo:
```typescript
// Antes
activated_at: Date | null;

// Después
registered_at: Date | null;
device_name: string;
location_id: string;
is_allowed: boolean;
```

**Archivo:** `src/app/mozo/mesa/[tableId]/page.tsx`

---

### 8. Error de Tipo en `SecureSession` (E2E Mock)

**Problema:** Mock session tenía estructura incorrecta

**Fix:** Corregido para usar estructura completa de `session-v2.ts`:
```typescript
const mockSession: SecureSession = {
  session_id: 'test-session',
  employee_id: 'test-employee',
  terminal_id: 'MOZO_01',
  terminal_role: 'MOZO',  // Mapeado de 'WAITER'
  tenant_id: 'test-tenant',
  location_id: 'test-location',
  // ... campos completos
};
```

**Archivo:** `src/components/auth/AuthProvider.tsx`

---

### 9. Llamadas Incorrectas a Logger (3 parámetros en vez de 2)

**Problema:** `logger.info()`, `logger.warn()` solo aceptan 2 parámetros: `(message, context)`

**Fix:** Corregidas todas las llamadas:
```typescript
// Antes
logger.info('message', 'extra', { context });

// Después
logger.info('message', { context });
```

**Archivo:** `src/core/auth/terminal-registry.ts`

---

### 10. Llamadas Incorrectas a `logger.error` (4 parámetros en vez de 3)

**Problema:** `logger.error()` acepta 3 parámetros: `(message, error, context)`

**Fix:** Corregidas todas las llamadas:
```typescript
// Antes
logger.error('message', error, 'extra', { context });

// Después
logger.error('message', error as Error, { context });
```

**Archivo:** `src/core/auth/terminal-registry.ts`

---

### 11. Prisma Middleware Deprecado

**Problema:** Método `$use` ya no existe en Prisma 5+

**Fix:** Migrado a Prisma 6 extension API:
```typescript
// Antes (Prisma 4)
prisma.$use(async (params, next) => { ... });

// Después (Prisma 6)
const extendedClient = baseClient.$extends({
  name: 'slow-query-logger',
  query: {
    async $allOperations({ operation, model, args, query }) {
      // Middleware logic
    }
  }
});
```

**Archivo:** `src/core/db/prisma.ts`

---

## Resultado Final

✅ **Build exitoso en Vercel**
- TypeScript compilation: ✅ Passed
- 143 páginas estáticas generadas
- 0 errores de compilación
- 0 warnings críticos

---

## Archivos Modificados

1. `src/app/api/docs/openapi.json/route.ts` - Import path fix
2. `src/app/api/docs/postman/route.ts` - Import path fix
3. `src/core/observability/metrics.ts` - Exports agregados (MetricNames, metricsHelpers, set())
4. `src/app/api/delivery/route.ts` - Array type fix
5. `src/app/api/drivers/route.ts` - Schema fields fix
6. `src/app/mozo/mesa/[tableId]/page.tsx` - TerminalConfig type fix
7. `src/components/auth/AuthProvider.tsx` - Mock session fix
8. `src/core/auth/terminal-registry.ts` - Logger calls fix (9 llamadas corregidas)
9. `src/core/db/prisma.ts` - Prisma 6 extension API migration

---

## Lecciones Aprendidas

1. **Probar localmente SIEMPRE antes de push** - `npm run build` hubiera encontrado todos estos errores en 1 minuto
2. **Errores pre-existentes** - Estos errores NO estaban relacionados con las notificaciones, eran bugs latentes
3. **TypeScript strict mode** - Ayuda a encontrar estos problemas antes del build
4. **Prisma versioning** - Importante mantener código actualizado con la versión de Prisma

---

**Fecha:** 5 Febrero 2026  
**Impacto:** 🔴 CRÍTICO - Bloqueaba deploy en Vercel  
**Status:** ✅ RESUELTO - Build pasando exitosamente
