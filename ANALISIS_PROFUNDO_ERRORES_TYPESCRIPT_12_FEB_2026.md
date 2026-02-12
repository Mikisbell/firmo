# Análisis Profundo de Errores TypeScript - 12 Febrero 2026

## Resumen Ejecutivo

Se identificaron 48 errores TypeScript en 16 archivos de test. Este documento analiza cada categoría de error y propone soluciones reales.

---

## Categoría 1: Errores de Arbitraries en Fast-Check (16 errores)

### Archivos Afectados
- `src/core/__tests__/properties-compatibility.test.ts` (1 error)
- `src/core/__tests__/properties-security.test.ts` (4 errores)
- `src/core/auth/__tests__/audit-logger.test.ts` (4 errores)
- `src/core/delivery/__tests__/push.property.test.ts` (3 errores)
- `src/core/projection/__tests__/order.property.test.ts` (10 errores)

### Problema Root Cause

Los arbitraries de fast-check están siendo usados incorrectamente. Fast-check retorna `Arbitrary<T>`, no `T` directamente.

**Ejemplo del error:**
```typescript
// ❌ INCORRECTO
fc.asyncProperty(
  productData,  // Arbitrary<Product>
  async (product) => {
    // product es de tipo 'any' o 'never'
  }
)
```

### Solución

Los arbitraries ya están correctamente definidos en `./arbitraries`. El problema es que fast-check necesita que los arbitraries se usen dentro de `fc.asyncProperty` o `fc.property`.

**Solución correcta:**
```typescript
// ✅ CORRECTO
fc.assert(
  fc.asyncProperty(
    productData,  // Arbitrary<Product>
    async (product) => {
      // product es de tipo Product
      expect(product.id).toBeDefined();
    }
  ),
  { numRuns: 100 }
);
```

---

## Categoría 2: Errores de Prisma Naming Convention (8 errores)

### Archivos Afectados
- `src/core/observability/__tests__/log-config.unit.test.ts` (8 errores)

### Problema Root Cause

El código usa `camelCase` pero Prisma schema usa `snake_case`.

**Errores específicos:**
1. `log_configurationChange` → debe ser `log_configuration_change`
2. `updatedAt` → debe ser `updated_at`

### Solución

Actualizar todos los nombres para coincidir con el schema de Prisma:

```typescript
// ❌ INCORRECTO
prisma.log_configurationChange.findMany()
const config = { updatedAt: new Date() }

// ✅ CORRECTO
prisma.log_configuration_change.findMany()
const config = { updated_at: new Date() }
```

---

## Categoría 3: Errores de Inventory Schema Mismatch (5 errores)

### Archivos Afectados
- `src/core/inventory/__tests__/inventory.property.test.ts` (5 errores)

### Problema Root Cause

El test espera campos que no existen en el schema de Prisma:
- `current_qty` → no existe
- `unit_cost_cents` → debe ser `cost_cents`
- `weighted_avg_cost_cents` → no existe
- `reorder_level` → no existe

### Solución

Actualizar el test para usar los campos correctos del schema:

```typescript
// ❌ INCORRECTO
expect(stock.current_qty).toBeDefined();
expect(stock.unit_cost_cents).toBe(1000);
expect(stock.weighted_avg_cost_cents).toBe(1000);
expect(stock.reorder_level).toBe(10);

// ✅ CORRECTO
expect(stock.quantity).toBeDefined();
expect(stock.cost_cents).toBe(1000);
// Eliminar campos que no existen en el schema
```

---

## Categoría 4: Errores de Block-Scoped Variables (6 errores)

### Archivos Afectados
- `src/core/middleware/__tests__/rate-limit.test.ts` (6 errores)

### Problema Root Cause

Variables declaradas después de su uso en el mismo bloque.

**Ejemplo:**
```typescript
// ❌ INCORRECTO
expect(result).toBeDefined();  // línea 12
const result = await rateLimiter.check();  // línea 15
```

### Solución

Declarar variables antes de usarlas:

```typescript
// ✅ CORRECTO
const result = await rateLimiter.check();  // línea 12
expect(result).toBeDefined();  // línea 15
```

---

## Categoría 5: Errores de Read-Only Properties (3 errores)

### Archivos Afectados
- `src/core/observability/__tests__/observability-flow.integration.test.ts` (1 error)
- `src/core/observability/__tests__/structured-logger.property.test.ts` (2 errores)

### Problema Root Cause

Intentando modificar `process.env.NODE_ENV` que es read-only en TypeScript.

### Solución

Usar `vi.stubEnv()` de Vitest en lugar de asignación directa:

```typescript
// ❌ INCORRECTO
process.env.NODE_ENV = 'production';

// ✅ CORRECTO
vi.stubEnv('NODE_ENV', 'production');
```

---

## Categoría 6: Errores de Fast-Check Overload (2 errores)

### Archivos Afectados
- `src/core/observability/__tests__/metrics.property.test.ts` (1 error)
- `src/core/observability/__tests__/structured-logger.property.test.ts` (1 error)

### Problema Root Cause

Llamada incorrecta a `fc.assert()` con argumentos que no coinciden con ninguna sobrecarga.

### Solución

Verificar que `fc.assert()` recibe `fc.property()` o `fc.asyncProperty()` correctamente:

```typescript
// ❌ INCORRECTO
fc.assert(
  someArbitrary,  // No es una property
  { numRuns: 100 }
);

// ✅ CORRECTO
fc.assert(
  fc.property(
    someArbitrary,
    (value) => {
      // test logic
      return true;
    }
  ),
  { numRuns: 100 }
);
```

---

## Categoría 7: Errores de Missing Exports (1 error)

### Archivos Afectados
- `src/core/projection/__tests__/order.property.test.ts` (1 error)

### Problema Root Cause

Importando `expectValidOrderLine` que no existe en `@/src/test-utils`.

### Solución

Verificar exports en `src/test-utils.ts` y agregar la función faltante o usar la correcta:

```typescript
// ❌ INCORRECTO
import { expectValidOrderLine } from '@/src/test-utils';

// ✅ CORRECTO
import { expectValidOrder } from '@/src/test-utils';
// O agregar expectValidOrderLine a test-utils.ts
```

---

## Categoría 8: Errores de Branded Types (1 error)

### Archivos Afectados
- `src/core/domain/__tests__/branded-types.property.test.ts` (1 error)

### Problema Root Cause

Función llamada con 3 argumentos cuando espera 2.

### Solución

Verificar la firma de la función y ajustar la llamada:

```typescript
// Verificar en src/core/types/shared.ts la firma correcta
// y ajustar la llamada en el test
```

---

## Plan de Corrección

### Fase 1: Correcciones Simples (15 minutos)
1. ✅ Prisma naming convention (8 errores)
2. ✅ Block-scoped variables (6 errores)
3. ✅ Read-only properties (3 errores)
4. ✅ Missing exports (1 error)
5. ✅ Branded types (1 error)

**Total:** 19 errores corregidos

### Fase 2: Correcciones de Schema (10 minutos)
1. ✅ Inventory schema mismatch (5 errores)

**Total:** 5 errores corregidos

### Fase 3: Correcciones de Fast-Check (20 minutos)
1. ✅ Arbitraries usage (16 errores)
2. ✅ Fast-check overload (2 errores)

**Total:** 18 errores corregidos

### Fase 4: Verificación (5 minutos)
1. ✅ Ejecutar `npx tsc --noEmit`
2. ✅ Ejecutar `npm run build`
3. ✅ Commit y push

---

## Tiempo Estimado Total

**50 minutos** para corregir todos los 48 errores de forma real y verificada.

---

## Próximos Pasos

1. Empezar con Fase 1 (correcciones simples)
2. Continuar con Fase 2 (schema fixes)
3. Finalizar con Fase 3 (fast-check fixes)
4. Verificar y commit

---

**Fecha:** 12 Febrero 2026  
**Status:** 📋 ANÁLISIS COMPLETO - Listo para implementación
