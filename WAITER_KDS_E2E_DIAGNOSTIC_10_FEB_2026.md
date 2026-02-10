# Diagnóstico: Tests E2E Mesero → KDS Fallando

**Fecha:** 10 Febrero 2026  
**Tests Afectados:** 4/5 tests en `e2e/waiter-to-kds.spec.ts`  
**Status:** ❌ FALLANDO

## 🔴 Problema Identificado

Los tests están fallando porque el botón "Enviar" está deshabilitado (`disabled`). El botón permanece deshabilitado porque **no se están agregando items al carrito**.

### Error Específico
```
TimeoutError: locator.click: Timeout 15000ms exceeded.
- locator resolved to <button disabled class="...">
- element is not enabled
```

## 🔍 Análisis de Causa Raíz

### 1. Productos No Encontrados
El test busca productos por texto:
```typescript
const polloButton = page.locator('button:has-text("Pollo")').first();
const papasButton = page.locator('button:has-text("Papas")').first();
const gaseosaButton = page.locator('button:has-text("Gaseosa")').first();
```

**Problema:** Estos productos pueden no existir en la base de datos de test o tener nombres diferentes.

### 2. Flujo de Agregado de Items
En `src/app/mozo/mesa/[tableId]/page.tsx`:
- El componente usa `CatalogGrid` para mostrar productos
- Los productos vienen de la base de datos IndexedDB
- Si no hay productos o los nombres no coinciden, los botones no se encuentran
- Sin items agregados, el botón "Enviar" permanece deshabilitado

### 3. Condición de Habilitación del Botón
En `src/components/shared/OrderPanel.tsx` (inferido):
- El botón "Enviar" solo se habilita cuando `items.length > 0`
- Si no se agregan items, el botón permanece `disabled`

## 📊 Tests Afectados

| Test | Status | Razón |
|------|--------|-------|
| waiter creates order and submits to kitchen | ❌ FALLA | No puede hacer clic en "Enviar" (disabled) |
| KDS can change item status | ❌ FALLA | No puede hacer clic en "Enviar" (disabled) |
| multiple waiters submit simultaneously | ❌ FALLA | No puede hacer clic en "Enviar" (disabled) |
| submitted items remain visible | ❌ FALLA | No puede hacer clic en "Enviar" (disabled) |
| order with no items cannot be submitted | ✅ PASA | Test correcto (verifica que botón esté disabled) |

## 🎯 Soluciones Propuestas

### Opción 1: Usar data-testid en lugar de texto (RECOMENDADO)
Modificar el catálogo para agregar `data-testid` a los productos:
```typescript
<button data-testid={`product-${product.id}`}>
  {product.name}
</button>
```

Modificar el test para usar IDs conocidos:
```typescript
await page.click('[data-testid="product-pollo-entero"]');
await page.click('[data-testid="product-papas-fritas"]');
```

### Opción 2: Seed de Datos Específico para E2E
Crear un seed script que garantice productos específicos para tests:
```typescript
// scripts/seed-e2e-products.ts
const E2E_PRODUCTS = [
  { id: "e2e-pollo", name: "Pollo", station: "PARRILLA", price: 3500 },
  { id: "e2e-papas", name: "Papas", station: "COCINA", price: 800 },
  { id: "e2e-gaseosa", name: "Gaseosa", station: "BAR", price: 500 },
];
```

### Opción 3: Esperar y Verificar Productos Antes de Hacer Clic
Modificar el test para verificar que los productos existen:
```typescript
// Esperar a que el catálogo cargue
await page.waitForSelector('[data-testid="catalog-grid"]');

// Obtener el primer producto disponible
const firstProduct = page.locator('[data-testid^="product-"]').first();
await expect(firstProduct).toBeVisible();
await firstProduct.click();
```

## 🔧 Plan de Acción Recomendado

1. **Inmediato:** Agregar `data-testid` a los productos en `CatalogGrid`
2. **Corto plazo:** Crear seed de productos E2E garantizados
3. **Mediano plazo:** Refactorizar tests para ser más resilientes

## 📝 Archivos a Modificar

1. `src/app/pos/components/CatalogGrid.tsx` - Agregar data-testid
2. `e2e/waiter-to-kds.spec.ts` - Usar data-testid en lugar de texto
3. `scripts/seed-e2e-products.ts` - Crear seed específico (nuevo)
4. `e2e/helpers/product-helpers.ts` - Helpers para productos (nuevo)

## 🎬 Próximos Pasos

1. Revisar `CatalogGrid.tsx` para ver estructura actual
2. Agregar `data-testid` a productos
3. Actualizar tests para usar selectores más robustos
4. Ejecutar tests nuevamente

---

**Prioridad:** 🔴 ALTA - Bloquea validación de flujo crítico Mesero → KDS  
**Impacto:** 🟡 MEDIO - Funcionalidad existe, solo tests fallan  
**Esfuerzo:** 🟢 BAJO - 1-2 horas de trabajo
