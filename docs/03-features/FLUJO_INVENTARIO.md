# 📦 FLUJO_INVENTARIO — Gestión de Stock

> Control de inventario para pollería con 4-5 locales, offline-first, Event Sourcing

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Sin control de stock, no sabes cuánto pollo tienes hasta que se acaba |
| **Solución** | Inventario automático por ventas + conteos manuales + alertas |
| **Complejidad** | Media-Alta (integra con ventas, compras, mermas) |
| **Prioridad** | 🔴 CRÍTICA - Bloquea producción |

---

## 🎯 Escenarios de Uso

### Escenario 1: Recepción de Mercadería
```
DADO que llega el proveedor con 50 pollos
CUANDO el almacenero registra la recepción
ENTONCES el stock aumenta en 50 unidades
Y se registra el costo unitario (ej: 2500 centavos = S/25.00)
Y se genera evento STOCK_RECEIVED
```

### Escenario 2: Descuento Automático por Venta
```
DADO que se vende 1 Pollo a la Brasa
CUANDO se confirma el pago (PAYMENT_COMPLETED)
ENTONCES se descuentan los insumos de la receta:
  - 1 pollo entero
  - 200g papas
  - 50ml aceite
  - 1 porción ensalada
Y se generan eventos STOCK_CONSUMED para cada insumo
```

### Escenario 3: Alerta de Stock Bajo
```
DADO que el stock de pollos llega a 10 unidades
Y el mínimo configurado es 15 unidades
CUANDO el sistema detecta el umbral
ENTONCES genera STOCK_ALERT_TRIGGERED
Y envía notificación push al administrador
Y muestra alerta en dashboard
```

### Escenario 4: Conteo Físico (Inventario)
```
DADO que es domingo 6AM (día de inventario)
CUANDO el almacenero cuenta 47 pollos
Y el sistema dice que debería haber 50
ENTONCES se registra diferencia de -3 unidades
Y se genera STOCK_ADJUSTED con razón "CONTEO_FISICO"
Y se marca para investigación de merma
```

### Escenario 5: Merma por Vencimiento
```
DADO que 5 pollos vencen hoy
CUANDO el almacenero los registra como merma
ENTONCES se genera STOCK_ADJUSTED con razón "VENCIMIENTO"
Y se calcula pérdida: 5 × 2500 = 12500 centavos (S/125.00)
Y aparece en reporte de mermas
```

### Escenario 6: Transferencia Entre Locales
```
DADO que Local A tiene exceso de papas (100kg)
Y Local B necesita papas urgente
CUANDO admin autoriza transferencia de 30kg
ENTONCES Local A: STOCK_TRANSFERRED_OUT (-30kg)
Y Local B: STOCK_TRANSFERRED_IN (+30kg)
Y se registra costo de transporte si aplica
```

### Escenario 7: Receta con Variantes
```
DADO que "1/4 Pollo" usa 0.25 pollos
Y "1/2 Pollo" usa 0.50 pollos
Y "Pollo Entero" usa 1.00 pollo
CUANDO se vende cada variante
ENTONCES se descuenta la fracción correcta del stock
```

### Escenario 8: Compra de Emergencia
```
DADO que se acabaron las papas a las 7PM
Y el proveedor no puede entregar hasta mañana
CUANDO el admin autoriza compra de emergencia
ENTONCES se registra STOCK_RECEIVED con proveedor "MERCADO_LOCAL"
Y se marca como "compra_emergencia" para análisis
```

### Escenario 9: Inventario Offline
```
DADO que no hay internet durante el conteo
CUANDO el almacenero registra cantidades
ENTONCES se guardan en IndexedDB local
Y se sincronizan cuando vuelve la conexión
Y se resuelven conflictos por timestamp
```

### Escenario 10: Costo Promedio Ponderado
```
DADO que tengo 20 pollos a S/25.00 c/u
Y llegan 30 pollos a S/27.00 c/u
CUANDO calculo el costo promedio
ENTONCES: (20×2500 + 30×2700) / 50 = 2620 centavos
Y este costo se usa para calcular COGS
```

---

## 📊 Modelo de Datos

### Tabla: Product_Stock
```typescript
interface ProductStock {
  id: string;                    // UUID
  tenant_id: string;             // Multi-tenant
  location_id: string;           // Local específico
  sku: string;                   // Código único producto
  name: string;                  // "Pollo Entero"
  category: StockCategory;       // INSUMO | PRODUCTO_FINAL | DESCARTABLE
  unit: StockUnit;               // UNIDAD | KG | LITRO | GRAMO
  
  // Cantidades (decimales para fracciones)
  quantity_on_hand: number;      // Stock actual
  quantity_reserved: number;     // Reservado para pedidos en curso
  quantity_available: number;    // on_hand - reserved
  
  // Umbrales
  min_stock: number;             // Alerta cuando llega aquí
  max_stock: number;             // Capacidad máxima
  reorder_point: number;         // Punto de reorden
  reorder_quantity: number;      // Cantidad a pedir
  
  // Costos (en centavos)
  unit_cost: number;             // Costo unitario actual
  avg_cost: number;              // Costo promedio ponderado
  last_purchase_cost: number;    // Último costo de compra
  
  // Metadata
  supplier_id?: string;          // Proveedor principal
  barcode?: string;              // Código de barras
  expiry_days?: number;          // Días hasta vencimiento típico
  
  created_at: Date;
  updated_at: Date;
}

type StockCategory = 'INSUMO' | 'PRODUCTO_FINAL' | 'DESCARTABLE' | 'LIMPIEZA';
type StockUnit = 'UNIDAD' | 'KG' | 'GRAMO' | 'LITRO' | 'ML';
```

### Tabla: Stock_Movement
```typescript
interface StockMovement {
  id: string;                    // UUID
  tenant_id: string;
  location_id: string;
  sku: string;
  
  movement_type: MovementType;
  quantity: number;              // Positivo o negativo
  unit_cost: number;             // Costo al momento (centavos)
  total_cost: number;            // quantity × unit_cost
  
  // Referencias
  reference_type?: 'SALE' | 'PURCHASE' | 'TRANSFER' | 'ADJUSTMENT' | 'WASTE';
  reference_id?: string;         // order_id, purchase_id, etc.
  
  // Para transferencias
  from_location_id?: string;
  to_location_id?: string;
  
  // Para ajustes
  adjustment_reason?: AdjustmentReason;
  notes?: string;
  
  // Auditoría
  actor_id: string;              // Quién lo hizo
  created_at: Date;
}

type MovementType = 
  | 'RECEIVED'           // Entrada por compra
  | 'CONSUMED'           // Salida por venta
  | 'TRANSFERRED_IN'     // Entrada por transferencia
  | 'TRANSFERRED_OUT'    // Salida por transferencia
  | 'ADJUSTED_UP'        // Ajuste positivo
  | 'ADJUSTED_DOWN'      // Ajuste negativo
  | 'WASTE'              // Merma
  | 'RETURNED';          // Devolución a proveedor

type AdjustmentReason = 
  | 'CONTEO_FISICO'      // Diferencia en inventario
  | 'VENCIMIENTO'        // Producto vencido
  | 'DANO'               // Producto dañado
  | 'ROBO'               // Robo detectado
  | 'ERROR_SISTEMA'      // Corrección de error
  | 'PROMOCION'          // Producto regalado
  | 'CONSUMO_INTERNO';   // Comida de empleados
```

### Tabla: Recipe (Recetas)
```typescript
interface Recipe {
  id: string;
  tenant_id: string;
  product_id: string;            // Producto final (ej: "Pollo a la Brasa")
  
  ingredients: RecipeIngredient[];
  yield_quantity: number;        // Cuántas porciones produce
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RecipeIngredient {
  sku: string;                   // Insumo
  quantity: number;              // Cantidad necesaria
  unit: StockUnit;               // Unidad
  is_optional: boolean;          // ¿Se puede omitir?
  substitutes?: string[];        // SKUs alternativos
}
```

### Tabla: Supplier (Proveedores)
```typescript
interface Supplier {
  id: string;
  tenant_id: string;
  
  name: string;                  // "Avícola San Fernando"
  ruc: string;                   // RUC peruano
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  
  // Términos comerciales
  payment_terms: number;         // Días de crédito
  min_order_amount: number;      // Pedido mínimo (centavos)
  delivery_days: string[];       // ['LUNES', 'MIERCOLES', 'VIERNES']
  lead_time_days: number;        // Días desde pedido hasta entrega
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### Tabla: Stock_Alert
```typescript
interface StockAlert {
  id: string;
  tenant_id: string;
  location_id: string;
  sku: string;
  
  alert_type: AlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  current_quantity: number;
  threshold_quantity: number;
  
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  
  created_at: Date;
}

type AlertType = 
  | 'LOW_STOCK'          // Bajo mínimo
  | 'OUT_OF_STOCK'       // Agotado
  | 'EXPIRING_SOON'      // Por vencer
  | 'OVERSTOCK'          // Exceso de stock
  | 'NEGATIVE_STOCK';    // Error: stock negativo
```

---

## 📡 Eventos de Dominio

```typescript
// Recepción de mercadería
interface StockReceivedEvent {
  type: 'STOCK_RECEIVED';
  payload: {
    sku: string;
    quantity: number;
    unit_cost: number;           // centavos
    supplier_id?: string;
    purchase_order_id?: string;
    batch_number?: string;
    expiry_date?: string;        // ISO date
    notes?: string;
  };
}

// Consumo por venta
interface StockConsumedEvent {
  type: 'STOCK_CONSUMED';
  payload: {
    sku: string;
    quantity: number;
    order_id: string;
    order_item_id: string;
    unit_cost: number;           // Para COGS
  };
}

// Ajuste de inventario
interface StockAdjustedEvent {
  type: 'STOCK_ADJUSTED';
  payload: {
    sku: string;
    previous_quantity: number;
    new_quantity: number;
    adjustment_reason: AdjustmentReason;
    notes?: string;
    evidence_photo_url?: string; // Foto de merma
  };
}

// Transferencia entre locales
interface StockTransferredEvent {
  type: 'STOCK_TRANSFERRED';
  payload: {
    sku: string;
    quantity: number;
    from_location_id: string;
    to_location_id: string;
    transfer_id: string;
    transport_cost?: number;     // centavos
    authorized_by: string;
  };
}

// Alerta disparada
interface StockAlertTriggeredEvent {
  type: 'STOCK_ALERT_TRIGGERED';
  payload: {
    sku: string;
    alert_type: AlertType;
    current_quantity: number;
    threshold_quantity: number;
    suggested_action: string;
  };
}

// Conteo físico iniciado
interface StockCountStartedEvent {
  type: 'STOCK_COUNT_STARTED';
  payload: {
    count_id: string;
    location_id: string;
    categories?: StockCategory[]; // Si es conteo parcial
    started_by: string;
  };
}

// Conteo físico completado
interface StockCountCompletedEvent {
  type: 'STOCK_COUNT_COMPLETED';
  payload: {
    count_id: string;
    items: Array<{
      sku: string;
      system_quantity: number;
      counted_quantity: number;
      variance: number;
      variance_cost: number;     // centavos
    }>;
    total_variance_cost: number;
    completed_by: string;
  };
}
```

---

## 🔌 API Endpoints

```typescript
// GET /api/inventory/stock
// Lista stock actual con filtros
interface GetStockParams {
  location_id?: string;
  category?: StockCategory;
  low_stock_only?: boolean;
  search?: string;
}

// POST /api/inventory/receive
// Registrar recepción de mercadería
interface ReceiveStockBody {
  items: Array<{
    sku: string;
    quantity: number;
    unit_cost: number;
    batch_number?: string;
    expiry_date?: string;
  }>;
  supplier_id?: string;
  purchase_order_id?: string;
  notes?: string;
}

// POST /api/inventory/adjust
// Ajustar stock (conteo, merma, etc.)
interface AdjustStockBody {
  sku: string;
  new_quantity: number;
  reason: AdjustmentReason;
  notes?: string;
  evidence_photo?: string;       // Base64
}

// POST /api/inventory/transfer
// Transferir entre locales
interface TransferStockBody {
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  from_location_id: string;
  to_location_id: string;
  notes?: string;
}

// POST /api/inventory/count/start
// Iniciar conteo físico
interface StartCountBody {
  location_id: string;
  categories?: StockCategory[];
}

// POST /api/inventory/count/:id/submit
// Enviar resultados de conteo
interface SubmitCountBody {
  items: Array<{
    sku: string;
    counted_quantity: number;
  }>;
}

// GET /api/inventory/alerts
// Obtener alertas activas
interface GetAlertsParams {
  location_id?: string;
  severity?: string;
  acknowledged?: boolean;
}

// GET /api/inventory/movements
// Historial de movimientos
interface GetMovementsParams {
  sku?: string;
  location_id?: string;
  movement_type?: MovementType;
  from_date?: string;
  to_date?: string;
}
```

---

## 🖥️ UI Mockups

### Dashboard de Inventario
```
┌─────────────────────────────────────────────────────────────┐
│  📦 INVENTARIO - Local Centro                    [🔄] [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 🔴 3    │  │ 🟡 8    │  │ 🟢 45   │  │ 📊 S/   │        │
│  │ Crítico │  │ Bajo    │  │ Normal  │  │ 125,430 │        │
│  │ Stock   │  │ Stock   │  │         │  │ Valor   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  🔍 [Buscar producto...                    ] [Categoría ▼] │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ SKU      │ Producto        │ Stock │ Mín │ Estado │ ⚡  ││
│  ├──────────┼─────────────────┼───────┼─────┼────────┼─────┤│
│  │ POL-001  │ Pollo Entero    │   8   │ 15  │ 🔴 BAJO│ [+] ││
│  │ PAP-001  │ Papas (kg)      │  25   │ 20  │ 🟢 OK  │ [+] ││
│  │ ACE-001  │ Aceite (L)      │   3   │ 10  │ 🔴 BAJO│ [+] ││
│  │ GAS-001  │ Gas (balón)     │   2   │  3  │ 🟡 BAJO│ [+] ││
│  │ ENS-001  │ Ensalada (porc) │  50   │ 30  │ 🟢 OK  │ [+] ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [📥 Recibir] [📋 Contar] [🔄 Transferir] [📊 Reportes]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Formulario de Recepción
```
┌─────────────────────────────────────────────────────────────┐
│  📥 RECEPCIÓN DE MERCADERÍA                         [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Proveedor: [Avícola San Fernando          ▼]              │
│  Fecha:     [05/01/2026]  Factura: [F001-00234    ]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Producto          │ Cant │ Unidad │ Costo Unit │ Total  ││
│  ├───────────────────┼──────┼────────┼────────────┼────────┤│
│  │ Pollo Entero      │  50  │ UNIDAD │  S/ 25.00  │ 1,250  ││
│  │ [+ Agregar línea]                                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Lote: [LOT-2026-001    ]  Vence: [15/01/2026]             │
│                                                             │
│  Notas: [________________________________]                  │
│                                                             │
│                              Total: S/ 1,250.00             │
│                                                             │
│            [Cancelar]              [✓ Confirmar Recepción]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Pantalla de Conteo Físico
```
┌─────────────────────────────────────────────────────────────┐
│  📋 CONTEO FÍSICO - Domingo 05/01/2026              [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Progreso: ████████████░░░░░░░░ 60% (30/50 items)          │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🔍 [Escanear código o buscar...]                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Producto          │ Sistema │ Contado │ Diferencia      ││
│  ├───────────────────┼─────────┼─────────┼─────────────────┤│
│  │ Pollo Entero      │   50    │ [  47 ] │ 🔴 -3 (-S/75)   ││
│  │ Papas (kg)        │   25    │ [  25 ] │ ✓ OK            ││
│  │ Aceite (L)        │   10    │ [   8 ] │ 🔴 -2 (-S/40)   ││
│  │ Gas (balón)       │    5    │ [   5 ] │ ✓ OK            ││
│  │ Ensalada (porc)   │   50    │ [    ] │ ⏳ Pendiente     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Varianza Total: -S/ 115.00                                 │
│                                                             │
│  [Pausar]  [Agregar Nota]           [✓ Finalizar Conteo]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Panel de Alertas
```
┌─────────────────────────────────────────────────────────────┐
│  🚨 ALERTAS DE INVENTARIO                    [Marcar leídas]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🔴 CRÍTICO - Hace 2 horas                               ││
│  │ Pollo Entero: Stock en 8 unidades (mínimo: 15)          ││
│  │ Acción sugerida: Pedir 50 unidades a San Fernando       ││
│  │ [📞 Llamar Proveedor] [📝 Crear Pedido] [✓ Reconocer]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟡 ADVERTENCIA - Hace 5 horas                           ││
│  │ Aceite: Stock en 3 litros (mínimo: 10)                  ││
│  │ [📝 Crear Pedido] [✓ Reconocer]                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟠 VENCIMIENTO - Mañana                                 ││
│  │ 5 pollos vencen el 06/01/2026                           ││
│  │ [🗑️ Registrar Merma] [🏷️ Aplicar Descuento]            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Comportamiento Offline

### Operaciones Soportadas Offline
| Operación | Offline | Notas |
|-----------|---------|-------|
| Ver stock actual | ✅ | Desde IndexedDB |
| Recibir mercadería | ✅ | Se sincroniza después |
| Conteo físico | ✅ | Se sincroniza después |
| Ajustes | ✅ | Se sincroniza después |
| Transferencias | ⚠️ | Solo origen, destino necesita sync |
| Ver alertas | ✅ | Alertas locales |
| Crear pedido | ❌ | Necesita conexión |

### Resolución de Conflictos
```typescript
// Si dos locales ajustan el mismo SKU offline:
// 1. Gana el evento con timestamp más reciente
// 2. Se genera STOCK_CONFLICT_DETECTED para revisión manual
// 3. Admin debe reconciliar en 24 horas

interface StockConflictEvent {
  type: 'STOCK_CONFLICT_DETECTED';
  payload: {
    sku: string;
    event_a: { timestamp: string; quantity: number; actor_id: string };
    event_b: { timestamp: string; quantity: number; actor_id: string };
    auto_resolved_to: number;
    requires_review: boolean;
  };
}
```

---

## 💰 Cálculo de COGS (Costo de Ventas)

### Método: Costo Promedio Ponderado
```typescript
function calculateWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,  // centavos
  receivedQty: number,
  receivedCost: number     // centavos
): number {
  const totalQty = currentQty + receivedQty;
  if (totalQty === 0) return 0;
  
  const totalValue = (currentQty * currentAvgCost) + (receivedQty * receivedCost);
  return Math.round(totalValue / totalQty); // Siempre entero (centavos)
}

// Ejemplo:
// 20 pollos a 2500 centavos + 30 pollos a 2700 centavos
// = (20*2500 + 30*2700) / 50 = 131000 / 50 = 2620 centavos
```

### Reporte de COGS Diario
```typescript
interface DailyCOGSReport {
  date: string;
  location_id: string;
  
  items: Array<{
    sku: string;
    name: string;
    quantity_sold: number;
    avg_cost: number;           // centavos
    total_cogs: number;         // centavos
  }>;
  
  total_cogs: number;           // centavos
  total_revenue: number;        // centavos
  gross_margin: number;         // porcentaje
}
```

---

## 📊 Reportes de Inventario

### 1. Valorización de Inventario
- Stock actual × costo promedio por SKU
- Agrupado por categoría
- Comparativo mes anterior

### 2. Rotación de Inventario
- Días de inventario por SKU
- Productos de lenta rotación (>30 días)
- Productos de alta rotación (<3 días)

### 3. Análisis de Mermas
- Mermas por tipo (vencimiento, daño, robo)
- Costo total de mermas
- % de merma sobre compras
- Tendencia mensual

### 4. Kardex por Producto
- Historial completo de movimientos
- Saldo después de cada movimiento
- Exportable a Excel

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + eventos básicos | 2 días |
| **2** | Recepción de mercadería | 2 días |
| **3** | Descuento automático por ventas | 3 días |
| **4** | Conteo físico + ajustes | 2 días |
| **5** | Alertas y notificaciones | 1 día |
| **6** | Transferencias entre locales | 2 días |
| **7** | Reportes y COGS | 2 días |
| **8** | Offline sync + conflictos | 2 días |

**Total estimado: 16 días de desarrollo**

---

## ⚠️ Consideraciones Críticas

1. **Precisión decimal**: Usar `Decimal` de Prisma para cantidades fraccionarias (0.25 pollo)
2. **Costos en centavos**: SIEMPRE enteros, nunca float
3. **Timezone**: Corte de día a las 6AM para coincidir con turno
4. **Auditoría**: Todo movimiento debe tener actor_id
5. **Fotos de merma**: Obligatorias para ajustes > S/50

---

*Última actualización: Enero 2026*
