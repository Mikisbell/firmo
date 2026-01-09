# Design Document: Schema Completeness

## Overview

Este documento describe el diseño técnico para completar el schema de PARK POS, agregando campos críticos a entidades existentes y nuevas tablas para el módulo de inventario enterprise. El diseño sigue los principios de Event Sourcing del proyecto y mantiene compatibilidad con el sistema offline-first.

## Architecture

### Diagrama de Componentes Afectados

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCHEMA COMPLETENESS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Prisma     │    │   Events     │    │   Reducers   │              │
│  │   Schema     │    │   (Zod)      │    │              │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                    FASE 1: Order/Event               │              │
│  │  • Order: +shift_id, +waiter_id, +table_id, etc.    │              │
│  │  • Event: +shift_id, +business_date                  │              │
│  │  • OrderLine: +timestamps                            │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                    FASE 2: Compras                   │              │
│  │  • PurchaseOrder + PurchaseOrderItem                 │              │
│  │  • SupplierProduct                                   │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                    FASE 3: Recepción                 │              │
│  │  • GoodsReceipt + GoodsReceiptItem                   │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                    FASE 4: Control                   │              │
│  │  • InventoryCount + InventoryCountItem               │              │
│  │  • WasteLog (detallado)                              │              │
│  │  • Inventory: +location_id, +expiry_date, etc.       │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                    FASE 5: Deducción                 │              │
│  │  • inventory.deduction.ts                            │              │
│  │  • Eventos: INVENTORY_DEDUCTED, etc.                 │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Fase 1: Cambios en Order y Event

#### 1.1 Prisma Schema - Order (Modificación)

```prisma
model Order {
  // Campos existentes...
  
  // NUEVOS CAMPOS
  shift_id       String?   @db.Uuid
  waiter_id      String?   @db.Uuid
  table_id       String?   @db.Uuid
  customer_id    String?   @db.Uuid
  location_id    String    @db.Uuid
  business_date  DateTime  @db.Date
  
  // Relaciones
  shift    Shift?    @relation(fields: [shift_id], references: [id])
  waiter   Employee? @relation("OrderWaiter", fields: [waiter_id], references: [id])
  table    Table?    @relation("OrderTable", fields: [table_id], references: [id])
  customer Customer? @relation(fields: [customer_id], references: [id])
  
  @@index([tenant_id, shift_id])
  @@index([tenant_id, waiter_id])
  @@index([tenant_id, business_date])
}
```

#### 1.2 Events Schema - BaseEnvelope (Modificación)

```typescript
// src/core/domain/events.ts
export const BaseEnvelopeSchema = z.object({
  // Campos existentes...
  
  // NUEVOS CAMPOS
  shift_id: uuidSchema.nullish(),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});
```

#### 1.3 OrderLine Schema (Modificación)

```typescript
export const OrderLineSchema = z.object({
  // Campos existentes...
  
  // NUEVOS CAMPOS - Timestamps
  created_at: isoDateSchema,
  started_cooking_at: isoDateSchema.nullish(),
  ready_at: isoDateSchema.nullish(),
  served_at: isoDateSchema.nullish(),
});
```

#### 1.4 Business Date Calculator

```typescript
// src/core/utils/business-date.ts
const CUTOFF_HOUR = 6; // 6 AM

export function getBusinessDate(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  
  // Si es antes de las 6 AM, pertenece al día anterior
  if (hour < CUTOFF_HOUR) {
    date.setDate(date.getDate() - 1);
  }
  
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}
```

### Fase 2: Módulo de Compras

#### 2.1 Prisma Schema - PurchaseOrder

```prisma
model PurchaseOrder {
  id                     String    @id @default(uuid()) @db.Uuid
  tenant_id              String    @db.Uuid
  location_id            String    @db.Uuid
  supplier_id            String    @db.Uuid
  order_number           Int
  status                 String    @default("DRAFT") // DRAFT|SENT|PARTIAL_RECEIVED|RECEIVED|CANCELLED
  subtotal_cents         Int       @default(0)
  tax_cents              Int       @default(0)
  total_cents            Int       @default(0)
  expected_delivery_date DateTime? @db.Date
  notes                  String?
  created_by             String    @db.Uuid
  created_at             DateTime  @default(now()) @db.Timestamptz
  updated_at             DateTime  @default(now()) @db.Timestamptz
  
  // Relations
  supplier Supplier            @relation(fields: [supplier_id], references: [id])
  items    PurchaseOrderItem[]
  receipts GoodsReceipt[]
  
  @@unique([tenant_id, location_id, order_number])
  @@index([tenant_id, location_id, status])
  @@index([tenant_id, supplier_id])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id                String  @id @default(uuid()) @db.Uuid
  purchase_order_id String  @db.Uuid
  inventory_code    String
  quantity_ordered  Decimal @db.Decimal(10, 3)
  unit              String
  unit_cost_cents   Int
  total_cents       Int
  
  // Relations
  purchase_order PurchaseOrder @relation(fields: [purchase_order_id], references: [id])
  
  @@index([purchase_order_id])
  @@map("purchase_order_items")
}

model SupplierProduct {
  id             String  @id @default(uuid()) @db.Uuid
  tenant_id      String  @db.Uuid
  supplier_id    String  @db.Uuid
  inventory_code String
  supplier_sku   String?
  unit_cost_cents Int
  min_order_qty  Decimal @default(1) @db.Decimal(10, 3)
  lead_time_days Int     @default(1)
  is_active      Boolean @default(true)
  
  // Relations
  supplier Supplier @relation(fields: [supplier_id], references: [id])
  
  @@unique([tenant_id, supplier_id, inventory_code])
  @@index([tenant_id, supplier_id, is_active])
  @@map("supplier_products")
}
```

### Fase 3: Módulo de Recepción

#### 3.1 Prisma Schema - GoodsReceipt

```prisma
model GoodsReceipt {
  id                String    @id @default(uuid()) @db.Uuid
  tenant_id         String    @db.Uuid
  location_id       String    @db.Uuid
  purchase_order_id String?   @db.Uuid
  receipt_number    String
  status            String    @default("DRAFT") // DRAFT|CONFIRMED|CANCELLED
  received_by       String    @db.Uuid
  received_at       DateTime  @default(now()) @db.Timestamptz
  notes             String?
  created_at        DateTime  @default(now()) @db.Timestamptz
  
  // Relations
  purchase_order PurchaseOrder?     @relation(fields: [purchase_order_id], references: [id])
  items          GoodsReceiptItem[]
  
  @@unique([tenant_id, location_id, receipt_number])
  @@index([tenant_id, location_id, received_at(sort: Desc)])
  @@map("goods_receipts")
}

model GoodsReceiptItem {
  id                String    @id @default(uuid()) @db.Uuid
  goods_receipt_id  String    @db.Uuid
  inventory_code    String
  quantity_ordered  Decimal   @db.Decimal(10, 3)
  quantity_received Decimal   @db.Decimal(10, 3)
  quantity_rejected Decimal   @default(0) @db.Decimal(10, 3)
  rejection_reason  String?
  unit_cost_cents   Int
  lot_number        String?
  expiry_date       DateTime? @db.Date
  
  // Relations
  goods_receipt GoodsReceipt @relation(fields: [goods_receipt_id], references: [id])
  
  @@index([goods_receipt_id])
  @@map("goods_receipt_items")
}
```

### Fase 4: Módulo de Control

#### 4.1 Prisma Schema - InventoryCount

```prisma
model InventoryCount {
  id          String    @id @default(uuid()) @db.Uuid
  tenant_id   String    @db.Uuid
  location_id String    @db.Uuid
  count_date  DateTime  @db.Date
  count_type  String    @default("FULL") // FULL|PARTIAL|SPOT
  status      String    @default("IN_PROGRESS") // IN_PROGRESS|PENDING_APPROVAL|APPROVED|CANCELLED
  counted_by  String    @db.Uuid
  approved_by String?   @db.Uuid
  approved_at DateTime? @db.Timestamptz
  notes       String?
  created_at  DateTime  @default(now()) @db.Timestamptz
  
  // Relations
  items InventoryCountItem[]
  
  @@index([tenant_id, location_id, count_date(sort: Desc)])
  @@map("inventory_counts")
}

model InventoryCountItem {
  id                    String  @id @default(uuid()) @db.Uuid
  inventory_count_id    String  @db.Uuid
  inventory_code        String
  expected_qty          Decimal @db.Decimal(10, 3)
  counted_qty           Decimal @db.Decimal(10, 3)
  difference_qty        Decimal @db.Decimal(10, 3) // counted - expected
  unit_cost_cents       Int
  difference_value_cents Int    // difference_qty * unit_cost
  notes                 String?
  
  // Relations
  inventory_count InventoryCount @relation(fields: [inventory_count_id], references: [id])
  
  @@index([inventory_count_id])
  @@map("inventory_count_items")
}
```

#### 4.2 Prisma Schema - WasteLog (Detallado)

```prisma
model WasteLog {
  id            String    @id @default(uuid()) @db.Uuid
  tenant_id     String    @db.Uuid
  location_id   String    @db.Uuid
  shift_id      String?   @db.Uuid
  inventory_code String
  quantity      Decimal   @db.Decimal(10, 3)
  unit          String
  reason_code   String    // EXPIRED|DAMAGED|THEFT|PRODUCTION_LOSS|REJECTED_ON_RECEIPT|COUNT_ADJUSTMENT|OTHER
  reason_detail String?
  cost_cents    Int
  reported_by   String    @db.Uuid
  approved_by   String?   @db.Uuid
  approved_at   DateTime? @db.Timestamptz
  photo_url     String?
  reference_type String?  // GOODS_RECEIPT|INVENTORY_COUNT|MANUAL
  reference_id  String?   @db.Uuid
  created_at    DateTime  @default(now()) @db.Timestamptz
  
  @@index([tenant_id, location_id, created_at(sort: Desc)])
  @@index([tenant_id, reason_code])
  @@map("waste_logs")
}
```

#### 4.3 Prisma Schema - Inventory (Modificación)

```prisma
model Inventory {
  // Campos existentes...
  
  // NUEVOS CAMPOS
  location_id       String    @db.Uuid
  expiry_date       DateTime? @db.Date
  lot_number        String?
  last_count_at     DateTime? @db.Timestamptz
  theoretical_stock Decimal   @default(0) @db.Decimal(10, 3)
  
  @@unique([tenant_id, location_id, code])
  @@index([tenant_id, location_id, code])
  @@index([tenant_id, expiry_date])
}
```

### Fase 5: Deducción Automática

#### 5.1 Inventory Deduction Service

```typescript
// src/core/inventory/deduction.service.ts
import { PrismaClient } from "@prisma/client";

interface DeductionResult {
  success: boolean;
  deductions: Array<{
    inventory_code: string;
    quantity: number;
    new_stock: number;
  }>;
  alerts: Array<{
    type: "LOW_STOCK" | "NEGATIVE_STOCK";
    inventory_code: string;
    current_stock: number;
  }>;
}

export async function deductInventoryForOrder(
  prisma: PrismaClient,
  tenantId: string,
  locationId: string,
  orderId: string,
  lineId: string,
  productId: string,
  quantity: number
): Promise<DeductionResult> {
  // 1. Buscar receta del producto
  const recipe = await prisma.recipe.findUnique({
    where: { tenant_id_product_id: { tenant_id: tenantId, product_id: productId } }
  });
  
  if (!recipe) {
    return { success: true, deductions: [], alerts: [] };
  }
  
  const ingredients = recipe.ingredients as Array<{
    inventory_code: string;
    quantity: number;
    unit: string;
  }>;
  
  const deductions: DeductionResult["deductions"] = [];
  const alerts: DeductionResult["alerts"] = [];
  
  // 2. Procesar cada ingrediente
  for (const ingredient of ingredients) {
    const deductQty = ingredient.quantity * quantity;
    
    // 3. Actualizar stock
    const inventory = await prisma.inventory.update({
      where: {
        tenant_id_location_id_code: {
          tenant_id: tenantId,
          location_id: locationId,
          code: ingredient.inventory_code
        }
      },
      data: {
        stock: { decrement: deductQty },
        theoretical_stock: { decrement: deductQty }
      }
    });
    
    // 4. Crear log
    await prisma.inventoryLog.create({
      data: {
        tenant_id: tenantId,
        inventory_id: inventory.id,
        movement_type: "OUT",
        quantity: -deductQty,
        reference_id: orderId,
        reason: `Venta: Orden ${orderId}, Item ${lineId}`
      }
    });
    
    deductions.push({
      inventory_code: ingredient.inventory_code,
      quantity: deductQty,
      new_stock: Number(inventory.stock)
    });
    
    // 5. Verificar alertas
    if (Number(inventory.stock) < 0) {
      alerts.push({
        type: "NEGATIVE_STOCK",
        inventory_code: ingredient.inventory_code,
        current_stock: Number(inventory.stock)
      });
    } else if (inventory.min_stock && Number(inventory.stock) < Number(inventory.min_stock)) {
      alerts.push({
        type: "LOW_STOCK",
        inventory_code: ingredient.inventory_code,
        current_stock: Number(inventory.stock)
      });
    }
  }
  
  return { success: true, deductions, alerts };
}
```

#### 5.2 Eventos de Inventario

```typescript
// src/core/domain/inventory-events.ts

// Evento: Orden de compra creada
const PurchaseOrderCreatedPayload = z.object({
  purchase_order_id: uuidSchema,
  supplier_id: uuidSchema,
  order_number: z.number().int().positive(),
  items: z.array(z.object({
    inventory_code: z.string(),
    quantity: z.number().positive(),
    unit_cost_cents: positiveCentsSchema
  })),
  total_cents: positiveCentsSchema
});

// Evento: Estado de OC cambió
const PurchaseOrderStatusChangedPayload = z.object({
  purchase_order_id: uuidSchema,
  from_status: z.enum(["DRAFT", "SENT", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"]),
  to_status: z.enum(["DRAFT", "SENT", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"])
});

// Evento: Mercadería recibida
const GoodsReceivedPayload = z.object({
  goods_receipt_id: uuidSchema,
  purchase_order_id: uuidSchema.nullish(),
  items: z.array(z.object({
    inventory_code: z.string(),
    quantity_received: z.number(),
    quantity_rejected: z.number().default(0),
    lot_number: z.string().nullish(),
    expiry_date: z.string().nullish()
  }))
});

// Evento: Inventario ajustado
const InventoryAdjustedPayload = z.object({
  inventory_code: z.string(),
  from_qty: z.number(),
  to_qty: z.number(),
  reason: z.string(),
  reference_type: z.enum(["INVENTORY_COUNT", "MANUAL"]).nullish(),
  reference_id: uuidSchema.nullish()
});

// Evento: Inventario deducido por venta
const InventoryDeductedPayload = z.object({
  order_id: uuidSchema,
  line_id: z.string(),
  product_id: uuidSchema,
  ingredients: z.array(z.object({
    inventory_code: z.string(),
    quantity_deducted: z.number(),
    new_stock: z.number()
  }))
});

// Evento: Merma registrada
const WasteRecordedPayload = z.object({
  waste_log_id: uuidSchema,
  inventory_code: z.string(),
  quantity: z.number(),
  reason_code: z.enum([
    "EXPIRED", "DAMAGED", "THEFT", "PRODUCTION_LOSS",
    "REJECTED_ON_RECEIPT", "COUNT_ADJUSTMENT", "OTHER"
  ]),
  cost_cents: positiveCentsSchema
});

// Evento: Conteo de inventario completado
const InventoryCountCompletedPayload = z.object({
  inventory_count_id: uuidSchema,
  items: z.array(z.object({
    inventory_code: z.string(),
    expected_qty: z.number(),
    counted_qty: z.number(),
    difference_qty: z.number()
  })),
  total_difference_cents: centsSchema
});
```

## Data Models

### Diagrama ER Simplificado

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Supplier   │────▶│ SupplierProduct │◀────│  Inventory  │
└─────────────┘     └─────────────────┘     └──────┬──────┘
      │                                            │
      ▼                                            ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│PurchaseOrder│────▶│PurchaseOrderItem│     │InventoryLog │
└──────┬──────┘     └─────────────────┘     └─────────────┘
       │                                           ▲
       ▼                                           │
┌─────────────┐     ┌─────────────────┐            │
│GoodsReceipt │────▶│GoodsReceiptItem │────────────┘
└─────────────┘     └─────────────────┘
                                                   ▲
┌─────────────┐     ┌─────────────────┐            │
│InventoryCount────▶│InventoryCountItem────────────┘
└─────────────┘     └─────────────────┘
                                                   ▲
┌─────────────┐                                    │
│  WasteLog   │────────────────────────────────────┘
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Order    │────▶│   Recipe    │────▶│  Inventory  │
│ (con nuevos │     │             │     │ (deducción) │
│   campos)   │     └─────────────┘     └─────────────┘
└─────────────┘
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Order Fields Completeness

*For any* Order created during an active shift, the Order SHALL have a valid `shift_id`, `location_id`, and `business_date`. If order_type is DINE_IN, `table_id` SHALL also be present.

**Validates: Requirements 1.1, 1.3, 1.5, 1.6**

### Property 2: Business Date Calculation

*For any* timestamp, `getBusinessDate()` SHALL return the previous calendar day if the hour is before 6 AM, otherwise the same calendar day.

**Validates: Requirements 1.6, 2.2**

### Property 3: Item Timestamps by Status

*For any* OrderLine, if status is COOKING then `started_cooking_at` SHALL be non-null; if status is READY then `ready_at` SHALL be non-null; if status is DONE then `served_at` SHALL be non-null.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: PurchaseOrder Status Transitions

*For any* PurchaseOrder status change, the transition SHALL be valid according to the state machine: DRAFT → SENT → PARTIAL_RECEIVED → RECEIVED, or any state → CANCELLED.

**Validates: Requirements 4.5**

### Property 5: GoodsReceipt Creates Inventory Movement

*For any* confirmed GoodsReceipt, for each GoodsReceiptItem there SHALL exist an InventoryLog with movement_type='IN' and quantity equal to quantity_received.

**Validates: Requirements 5.5, 5.6**

### Property 6: GoodsReceipt Rejection Creates WasteLog

*For any* GoodsReceiptItem with quantity_rejected > 0, there SHALL exist a WasteLog with reason_code='REJECTED_ON_RECEIPT' and quantity equal to quantity_rejected.

**Validates: Requirements 5.7**

### Property 7: InventoryCount Updates Stock

*For any* approved InventoryCount, for each InventoryCountItem the corresponding Inventory.stock SHALL equal counted_qty.

**Validates: Requirements 6.6, 6.7**

### Property 8: InventoryCount Difference Requires Notes

*For any* InventoryCountItem with difference_qty != 0, the notes field SHALL be non-null and non-empty.

**Validates: Requirements 6.5**

### Property 9: WasteLog Creates InventoryLog

*For any* WasteLog, there SHALL exist an InventoryLog with movement_type='WASTE' and quantity equal to the negative of WasteLog.quantity.

**Validates: Requirements 6.9**

### Property 10: Deduction Calculates Correctly

*For any* inventory deduction for a product with recipe, the total quantity deducted for each ingredient SHALL equal (order_line.qty * recipe.ingredient.quantity).

**Validates: Requirements 8.2**

### Property 11: Deduction Creates InventoryLog

*For any* inventory deduction, for each ingredient deducted there SHALL exist an InventoryLog with movement_type='OUT' and reference_id equal to order_id.

**Validates: Requirements 8.3, 8.4**

### Property 12: Low Stock Alert Generation

*For any* Inventory where stock < min_stock after a deduction, there SHALL exist a StockAlert with alert_type='LOW_STOCK'.

**Validates: Requirements 8.7**

### Property 13: Event Round-Trip

*For any* valid inventory event (PURCHASE_ORDER_CREATED, GOODS_RECEIVED, INVENTORY_DEDUCTED, etc.), serializing then deserializing SHALL produce an equivalent event.

**Validates: Requirements 9.1-9.7**

## Error Handling

### Errores de Validación

| Código | Descripción | Acción |
|--------|-------------|--------|
| `INVALID_STATUS_TRANSITION` | Transición de estado no permitida | Rechazar operación, retornar estado actual |
| `INSUFFICIENT_STOCK` | Stock insuficiente para deducción | Permitir operación, generar alerta |
| `MISSING_RECIPE` | Producto sin receta definida | Omitir deducción, log warning |
| `INVENTORY_NOT_FOUND` | Código de inventario no existe | Rechazar operación |
| `DUPLICATE_RECEIPT_NUMBER` | Número de recepción duplicado | Rechazar operación |

### Manejo de Stock Negativo

El sistema PERMITE stock negativo para no bloquear ventas, pero:
1. Genera alerta `NEGATIVE_STOCK`
2. Registra en log de auditoría
3. Notifica a administrador

## Testing Strategy

### Unit Tests

- Validación de schemas Zod para nuevos eventos
- Cálculo de `business_date` con diferentes timestamps
- Validación de transiciones de estado en PurchaseOrder
- Cálculo de diferencias en InventoryCount

### Property-Based Tests

Se usará **fast-check** para validar las 13 propiedades definidas:

```typescript
// Ejemplo: Property 2 - Business Date Calculation
import fc from 'fast-check';
import { getBusinessDate } from '../utils/business-date';

describe('Business Date Properties', () => {
  it('returns previous day for timestamps before 6 AM', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (date) => {
          // Forzar hora antes de 6 AM
          date.setHours(Math.floor(Math.random() * 6));
          const businessDate = getBusinessDate(date);
          const expectedDate = new Date(date);
          expectedDate.setDate(expectedDate.getDate() - 1);
          return businessDate === expectedDate.toISOString().split('T')[0];
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

- Flujo completo: PurchaseOrder → GoodsReceipt → Inventory update
- Flujo completo: Order DONE → Recipe lookup → Inventory deduction
- Flujo completo: InventoryCount → Approval → Stock adjustment

## Migration Strategy

### Fase 1: Schema Changes (Non-Breaking)

1. Agregar nuevas columnas como NULLABLE
2. Crear nuevas tablas
3. Crear índices

### Fase 2: Data Migration

1. Calcular `business_date` para órdenes existentes
2. Asignar `location_id` default para inventario existente

### Fase 3: Code Updates

1. Actualizar eventos para incluir nuevos campos
2. Actualizar reducers para manejar timestamps
3. Implementar deducción automática

### Fase 4: Validation

1. Hacer campos requeridos donde corresponda
2. Activar validaciones estrictas
