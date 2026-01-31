# Implementation Plan: Branded Types Migration

## Overview

Migración gradual de tipos planos a Branded Types en PARK POS. Enfoque inside-out: core domain → services → APIs.

## Tasks

### Fase 1: Core Domain - Projections (Prioridad Alta)

- [x] 1. Migrar `projections/types.ts` a Branded Types
  - [x] 1.1 Importar Branded Types de shared.ts
    - Agregar import de `Centavos`, `OrderId`, `ShiftId` de `@/src/core/types/shared`
    - _Requirements: FR-1.1, FR-2.1, FR-2.2_

  - [x] 1.2 Migrar campos de dinero en SaleLine
    - Cambiar `unit_price_cents: number` → `unit_price_cents: Centavos`
    - Cambiar `line_total_cents: number` → `line_total_cents: Centavos`
    - _Requirements: FR-1.1_

  - [x] 1.3 Migrar campos de dinero en SalePayment
    - Cambiar `amount_cents: number` → `amount_cents: Centavos`
    - Cambiar `change_given_cents: number` → `change_given_cents: Centavos`
    - _Requirements: FR-1.1_

  - [x] 1.4 Migrar campos de dinero en CheckProjection
    - Cambiar `subtotal_cents`, `discount_cents`, `tip_cents`, `total_cents` → `Centavos`
    - Cambiar `payments[].amount_cents` → `Centavos`
    - _Requirements: FR-1.1_

  - [x] 1.5 Migrar campos de dinero en SaleProjection
    - Cambiar `subtotal_cents`, `paid_cents`, `change_cents` → `Centavos`
    - Cambiar `total_cents: number | null` → `Centavos | null`
    - _Requirements: FR-1.1_

  - [x] 1.6 Migrar IDs en SaleProjection
    - Cambiar `order_id: string` → `order_id: OrderId`
    - Cambiar `sale_id: string` → `sale_id: OrderId`
    - _Requirements: FR-2.1_

  - [x] 1.7 Migrar campos de dinero en ShiftProjection
    - Cambiar `opening_cash_cents`, `cash_sales_in_cents`, etc. → `Centavos`
    - _Requirements: FR-1.1_

  - [x] 1.8 Migrar IDs en ShiftProjection
    - Cambiar `shift_id: string` → `shift_id: ShiftId`
    - _Requirements: FR-2.2_

  - [x] 1.9 Migrar CashMovement
    - Cambiar `amount_cents: number` → `amount_cents: Centavos`
    - _Requirements: FR-1.1_

- [x] 2. Actualizar `sale.reducer.ts` para usar Branded Types
  - [x] 2.1 Importar helpers de shared.ts
    - Agregar import de `unsafeCentavos`, `asOrderId`
    - _Requirements: FR-1.2_

  - [x] 2.2 Actualizar initialSaleState
    - Usar `unsafeCentavos(0)` para campos de dinero
    - _Requirements: FR-1.2_

  - [x] 2.3 Actualizar cálculos de totales
    - Re-brandear resultados de sumas: `unsafeCentavos(a + b)`
    - _Requirements: FR-1.2_

  - [x] 2.4 Actualizar handlers de eventos
    - Convertir valores de eventos a Centavos con `unsafeCentavos()`
    - _Requirements: FR-1.2_

- [x] 3. Actualizar `shift.reducer.ts` para usar Branded Types
  - [x] 3.1 Importar helpers de shared.ts
    - Agregar import de `unsafeCentavos`, `asShiftId`
    - _Requirements: FR-1.2_

  - [x] 3.2 Actualizar initialShiftState
    - Usar `unsafeCentavos(0)` para campos de dinero
    - _Requirements: FR-1.2_

  - [x] 3.3 Actualizar cálculos de cash
    - Re-brandear resultados de operaciones
    - _Requirements: FR-1.2_

- [x] 4. Verificar tests de projections
  - [x] 4.1 Ejecutar tests existentes
    - `npm test -- src/core/projections`
    - Verificar que todos pasan sin cambios
    - _Requirements: FR-4.1_

  - [x] 4.2 Agregar tests de type safety
    - Test que verifica tipos en compile-time
    - Test de validación de Centavos
    - _Requirements: FR-1.3_

### Fase 2: Services (Prioridad Media)

- [x] 5. Migrar `analytics.service.ts`
  - [x] 5.1 Actualizar tipos de retorno
    - Funciones que retornan dinero deben retornar `Centavos`
    - _Requirements: FR-1.2_

  - [x] 5.2 Actualizar parámetros
    - Funciones que reciben dinero deben aceptar `Centavos`
    - _Requirements: FR-1.3_

- [x] 6. Migrar `inventory.service.ts`
  - [x] 6.1 Actualizar tipos de costo
    - Campos de costo deben usar `Centavos`
    - _Requirements: FR-1.1_

- [x] 7. Migrar `delivery.service.ts`
  - [x] 7.1 Actualizar tipos de delivery fee
    - Campos de fee deben usar `Centavos`
    - _Requirements: FR-1.1_

- [x] 8. Verificar tests de services
  - [x] 8.1 Ejecutar tests de analytics
    - `npm test -- src/core/analytics`
    - _Requirements: FR-4.1_

  - [x] 8.2 Ejecutar tests de inventory
    - `npm test -- src/core/inventory`
    - _Requirements: FR-4.1_

  - [x] 8.3 Ejecutar tests de delivery
    - `npm test -- src/core/delivery`
    - _Requirements: FR-4.1_

### Fase 3: Validation & APIs (SKIPPED - Bajo Valor)

> **Decisión:** Fase 3 omitida porque:
> - `business-rules.ts` recibe datos de Prisma/eventos (ya `number`)
> - API ingest deserializa JSON a `number` (Zod ya valida)
> - Convertir a `Centavos` solo para comparaciones no agrega type safety
> - Los Branded Types son "opt-in" y el valor está en los tipos de dominio (Fase 1-2)

- [~] 9. Migrar `business-rules.ts` — SKIPPED
- [~] 10. Migrar API de ingest — SKIPPED
- [~] 11. Verificar tests de validation — SKIPPED

### Fase 4: Checkpoint Final

- [x] 12. Ejecutar suite completa de tests
  - [x] 12.1 Unit tests
    - `npm test` — 620 tests passing ✅
    - _Requirements: FR-4.1_

  - [ ] 12.2 E2E tests
    - `npx playwright test`
    - Pendiente (requiere servidor)
    - _Requirements: FR-4.1_

- [x] 13. Verificar diagnósticos
  - [x] 13.1 Ejecutar getDiagnostics en archivos modificados
    - 0 errores de tipo ✅
    - _Requirements: NFR-1_

- [x] 14. Documentar migración
  - [x] 14.1 Actualizar CHANGELOG.md
    - Documentado en versión 1.7.2 ✅
    - _Requirements: NFR-3_

  - [x] 14.2 Actualizar MASTER.md
    - Branded Types ya marcado como completado ✅
    - _Requirements: NFR-3_

## Notes

### Orden de Migración
1. **types.ts primero** - Define los tipos que otros archivos usan
2. **Reducers segundo** - Implementan la lógica con los tipos
3. **Services tercero** - Consumen los tipos de projections
4. **APIs último** - Boundaries de entrada

### Patrones de Conversión

```typescript
// Datos de Prisma (ya validados)
const total: Centavos = unsafeCentavos(order.total_cents);

// Input de usuario (necesita validación)
const amount: Centavos = asCentavos(parseInt(input));

// Resultado de cálculo (re-brandear)
const sum: Centavos = unsafeCentavos(a + b);
```

### Archivos que NO migrar
- `events.ts` - Zod schemas ya validan, JSON sigue siendo number
- UI components - Bajo valor, alto esfuerzo
- Prisma queries - Acepta number implícitamente

### Rollback
Si algo falla, revertir es trivial:
- Cambiar `Centavos` → `number`
- Cambiar `OrderId` → `string`
- Eliminar imports de shared.ts

## Success Metrics

- [x] 100% tests pasan después de cada fase — 620/620 ✅
- [x] 0 errores de diagnóstico ✅
- [x] Campos de dinero en projections usan `Centavos` ✅
- [x] IDs principales usan Branded Types (`OrderId`, `ShiftId`) ✅

## Resumen Final

**Migración completada:** Fases 1-2 implementadas + revisión adicional, Fase 3 omitida por bajo valor.

**Archivos migrados (Fases 1-2):**
- `src/core/projections/types.ts` — Todos los campos `*_cents` usan `Centavos`
- `src/core/projections/sale.reducer.ts` — Usa `unsafeCentavos()` y `asOrderId()`
- `src/core/projections/shift.reducer.ts` — Usa `unsafeCentavos()` y `asShiftId()`
- `src/core/analytics/types.ts` — `RealtimeMetrics`, `TopProduct`, `HourlySales`
- `src/core/analytics/analytics.service.ts` — Cálculos de métricas
- `src/core/inventory/stock-types.ts` — `costCents`, `totalValueCents`
- `src/core/delivery/types.ts` — `delivery_fee`, `deliveryFee`

**Archivos migrados (Revisión adicional - Enero 2026):**
- `src/core/printing/utils.ts` — `OrderLineInput.unit_price_cents`, `line_total_cents`, `PrintLine.total`
- `src/core/catalog/service.ts` — `CatalogItem.price_cents`
- `src/core/inventory/waste.service.ts` — `cost_cents`, `unit_cost_cents`
- `src/core/inventory/goods-receipt.service.ts` — `unit_cost_cents`
- `src/core/inventory/inventory-count.service.ts` — `total_difference_cents`
- `src/core/inventory/audit.service.ts` — Campos de costo en payloads de auditoría
- `src/app/api/admin/analytics/history/route.ts` — Conversión a `Centavos` con `asCentavos()`

**Archivos NO migrados (decisión intencional):**
- `src/core/db/schema.ts` — Dexie/IndexedDB almacena `number`, bajo valor
- `src/core/validation/business-rules.ts` — Recibe datos de Prisma/eventos (ya `number`)
- `src/core/actions/pos.actions.ts` — Funciones de acción que reciben input de UI
- `src/app/api/admin/reports/route.ts` — Casts internos para JSON de Prisma
- Archivos de test (`.test.ts`) — No son código de producción
- `events.ts` — Zod schemas ya validan, JSON sigue siendo `number`
- UI components — Bajo valor, alto esfuerzo
- Prisma queries — Acepta `number` implícitamente

**Tests agregados:**
- `src/core/projections/__tests__/branded-types.test.ts` — 10 tests de type safety

**Nota importante:** Cuando se usan tipos que incluyen `Centavos` (como `RealtimeMetrics`), 
los valores deben convertirse usando `asCentavos()` o `unsafeCentavos()`. Esto aplica especialmente
en APIs que retornan estos tipos.
