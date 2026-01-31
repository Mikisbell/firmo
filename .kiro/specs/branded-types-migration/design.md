# Design: Branded Types Migration

## Architecture Overview

La migración sigue un enfoque "inside-out": comenzando desde el core domain (projections) y expandiendo hacia services, APIs, y finalmente UI.

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  (Fase 4 - Opcional, bajo valor)                            │
├─────────────────────────────────────────────────────────────┤
│                        API Layer                             │
│  (Fase 3 - Boundaries, conversión de input)                 │
├─────────────────────────────────────────────────────────────┤
│                      Services Layer                          │
│  (Fase 2 - Analytics, Inventory, Delivery)                  │
├─────────────────────────────────────────────────────────────┤
│                    Core Domain Layer                         │
│  (Fase 1 - Projections, Reducers, Validation)               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  shared.ts (Branded Types) ← YA EXISTE              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

### DD-1: Usar `unsafeCentavos()` para datos de Prisma

**Contexto:** Datos de Prisma ya están validados por el schema (Int).

**Decisión:** Usar `unsafeCentavos()` sin validación para datos de DB.

**Razón:** Evita overhead de validación redundante.

```typescript
// ✅ Correcto - datos de Prisma
const order = await prisma.orders.findUnique({ where: { id } });
const total: Centavos = unsafeCentavos(order.total_cents);

// ✅ Correcto - input de usuario
const userInput = asCentavos(parseInt(req.body.amount)); // Valida
```

### DD-2: Re-brandear después de operaciones aritméticas

**Contexto:** TypeScript pierde el brand en operaciones matemáticas.

**Decisión:** Siempre re-brandear resultados de cálculos.

```typescript
// ❌ Incorrecto - pierde el brand
const subtotal: Centavos = asCentavos(1000);
const tax: Centavos = asCentavos(180);
const total = subtotal + tax; // tipo: number

// ✅ Correcto - re-brandear
const total: Centavos = unsafeCentavos(subtotal + tax);
```

### DD-3: IDs Branded son opcionales

**Contexto:** En PARK POS, el contexto de uso ya distingue los IDs.

**Decisión:** Migrar IDs solo en projections, no en todo el código.

**Razón:** Bajo valor vs esfuerzo. El contexto ya previene errores.

### DD-4: BusinessDate solo para queries

**Contexto:** `BusinessDate` es útil para queries de Prisma.

**Decisión:** Usar `BusinessDate` en filtros, no en toda la app.

```typescript
// ✅ Útil - query de Prisma
const date: BusinessDate = getBusinessDate();
await prisma.orders.findMany({ where: { business_date: date } });
```

## Migration Strategy

### Fase 1: Core Domain (Projections)

**Archivos a migrar:**
- `src/core/projections/types.ts` - Definiciones de tipos
- `src/core/projections/sale.reducer.ts` - Reducer de ventas
- `src/core/projections/shift.reducer.ts` - Reducer de turnos

**Cambios en types.ts:**
```typescript
// ANTES
export type SaleLine = {
  unit_price_cents: number;
  line_total_cents: number;
};

// DESPUÉS
import { Centavos, OrderId } from '@/src/core/types/shared';

export type SaleLine = {
  unit_price_cents: Centavos;
  line_total_cents: Centavos;
};
```

### Fase 2: Services

**Archivos a migrar:**
- `src/core/analytics/analytics.service.ts`
- `src/core/inventory/inventory.service.ts`
- `src/core/delivery/delivery.service.ts`

**Patrón de conversión en boundaries:**
```typescript
// Service recibe Centavos, no number
async function recordSale(amount: Centavos): Promise<void> {
  // Internamente usa Centavos
}

// API convierte en el boundary
const amount = asCentavos(parseInt(req.body.amount));
await recordSale(amount);
```

### Fase 3: APIs (Boundaries)

**Archivos a migrar:**
- `src/app/api/events/ingest/route.ts`
- `src/app/api/admin/*/route.ts`

**Patrón:**
```typescript
// Validar y convertir en el boundary
const payload = EventSchema.parse(await req.json());
const amount: Centavos = asCentavos(payload.amount_cents);
```

### Fase 4: UI (Opcional)

**Bajo valor** - UI ya muestra valores formateados.
Solo migrar si hay beneficio claro.

## Testing Strategy

### Tests de Tipo (Compile-time)

```typescript
// Este código NO debe compilar
const orderId: OrderId = asOrderId('abc');
const shiftId: ShiftId = orderId; // ❌ Error de tipo
```

### Tests de Runtime

```typescript
describe('Centavos validation', () => {
  it('rejects float values', () => {
    expect(() => asCentavos(10.5)).toThrow();
  });
  
  it('rejects negative values', () => {
    expect(() => asCentavos(-100)).toThrow();
  });
  
  it('accepts valid integers', () => {
    expect(asCentavos(1000)).toBe(1000);
  });
});
```

### Tests de Integración

Verificar que projections funcionan con Branded Types:
```typescript
it('calculates totals correctly with Centavos', () => {
  const sale = saleReducer(initialState, orderCreatedEvent);
  expect(sale.subtotal_cents).toBe(unsafeCentavos(2500));
});
```

## Rollback Plan

Si algo falla:
1. Los Branded Types son aliases - revertir a `number`/`string` es trivial
2. No hay cambios de runtime - solo compile-time
3. Tests existentes validan comportamiento

## Files to Modify

### Fase 1
- `src/core/projections/types.ts`
- `src/core/projections/sale.reducer.ts`
- `src/core/projections/shift.reducer.ts`
- `src/core/projections/__tests__/*.test.ts`

### Fase 2
- `src/core/analytics/analytics.service.ts`
- `src/core/inventory/inventory.service.ts`
- `src/core/delivery/delivery.service.ts`

### Fase 3
- `src/app/api/events/ingest/route.ts`
- `src/core/validation/business-rules.ts`
