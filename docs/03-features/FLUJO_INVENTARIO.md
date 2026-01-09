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
| **Estado** | ✅ Schema completo, servicios implementados (Enero 2026) |

---

## 🏗️ Estado de Implementación (Enero 2026)

### ✅ Implementado
- **Schema completo**: 13 tablas de inventario en Prisma
- **Eventos**: 7 tipos de eventos de inventario con validación Zod
- **Servicios**: 4 servicios core (goods-receipt, waste, inventory-count, deduction)
- **Admin Panel**: `/admin/inventario` con autenticación PIN
- **Tests**: 12 tests unitarios para servicios de inventario

### ⚠️ Pendiente
- Regenerar Prisma Client (`npx prisma generate`)
- Transferencias entre locales (solo schema, sin servicio)
- Alertas automáticas (solo tabla, sin worker)
- UI completa de inventario

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

## 🐔 Control Total para Pollería - Proceso Detallado

> **Objetivo**: Cero pérdida de dinero, trazabilidad completa, prevención de fraude

### Flujo Completo: ENTRADA → VENTA → MERMA → VERIFICACIÓN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CICLO DE VIDA DEL INVENTARIO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 ENTRADA                    📤 SALIDA                   🗑️ MERMA         │
│  ─────────                    ─────────                   ─────────        │
│  • Recepción proveedor        • Venta (automático)        • Vencimiento    │
│  • Compra emergencia          • Transferencia             • Daño           │
│  • Devolución cliente         • Consumo interno           • Robo           │
│                                                           • Ajuste conteo  │
│                                                                             │
│                         ↓                ↓                      ↓           │
│                    ┌─────────────────────────────────────────────┐          │
│                    │           KARDEX (InventoryLog)             │          │
│                    │  Registro inmutable de cada movimiento      │          │
│                    │  con: actor, timestamp, lote, costo, motivo │          │
│                    └─────────────────────────────────────────────┘          │
│                                        ↓                                    │
│                    ┌─────────────────────────────────────────────┐          │
│                    │         CONTEO FÍSICO (Semanal)             │          │
│                    │  Stock teórico vs Stock real = Diferencia   │          │
│                    │  Diferencia requiere explicación + evidencia│          │
│                    └─────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1️⃣ ENTRADA: Recepción del Proveedor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Llega camión de Avícola San Fernando con 100 pollos                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Almacenero abre modal de recepción                                 │
│          └─ Escanea código de barras o busca producto                       │
│                                                                             │
│  PASO 2: Sistema OBLIGA ingresar (campos requeridos):                       │
│          ├─ Cantidad recibida: 100 pollos                                   │
│          ├─ Lote del proveedor: LOT-2026-0107                               │
│          ├─ Fecha de vencimiento: 10/01/2026 (3 días)                       │
│          ├─ Costo unitario: S/25.00 (2500 centavos)                         │
│          ├─ Proveedor: Avícola San Fernando                                 │
│          ├─ Número de factura: F001-00234                                   │
│          └─ Foto de guía (opcional pero recomendado)                        │
│                                                                             │
│  PASO 3: Sistema genera evento GOODS_RECEIVED inmutable                     │
│          └─ Incluye: actor_id, timestamp, terminal_id, IP                   │
│                                                                             │
│  PASO 4: Stock se actualiza: 0 → 100 pollos                                 │
│          └─ Costo promedio se recalcula automáticamente                     │
│                                                                             │
│  PASO 5: Si hay diferencia con factura (ej: factura dice 105):              │
│          └─ Sistema registra discrepancia para reclamo a proveedor          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evento generado:**
```typescript
{
  type: 'GOODS_RECEIVED',
  payload: {
    goods_receipt_id: 'uuid',
    location_id: 'uuid',
    receipt_number: 'REC-2026-0107',
    items: [{
      inventory_code: 'POL-001',
      quantity_received: 100,
      unit_cost_cents: 2500,
      lot_number: 'LOT-2026-0107',
      expiry_date: '2026-01-10'
    }],
    received_by: 'uuid-almacenero',
    supplier_id: 'uuid-san-fernando',
    invoice_number: 'F001-00234'
  },
  actor_id: 'uuid-almacenero',
  timestamp: '2026-01-07T08:30:00Z',
  terminal_id: 'TERM-001'
}
```

### 2️⃣ SALIDA AUTOMÁTICA: Por Ventas (FEFO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Cliente pide "1 Pollo a la Brasa"                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Mozo registra pedido en terminal                                   │
│          └─ Orden #1234: 1x Pollo a la Brasa                                │
│                                                                             │
│  PASO 2: Cocina prepara el pedido                                           │
│          └─ KDS muestra ticket                                              │
│                                                                             │
│  PASO 3: Caja cobra al cliente (PAYMENT_COMPLETED)                          │
│                                                                             │
│  PASO 4: Sistema AUTOMÁTICAMENTE deduce según receta:                       │
│          ├─ 1 pollo entero (del lote LOT-2026-0105 - vence primero)         │
│          ├─ 200g papas                                                      │
│          ├─ 50ml aceite                                                     │
│          └─ 1 porción ensalada                                              │
│                                                                             │
│  PASO 5: Sistema usa FEFO (First Expired, First Out):                       │
│          ├─ Lote LOT-2026-0105 vence 08/01 → SE USA PRIMERO                 │
│          └─ Lote LOT-2026-0107 vence 10/01 → Se reserva                     │
│                                                                             │
│  PASO 6: Stock se actualiza: 100 → 99 pollos                                │
│          └─ Se registra qué lote se usó para trazabilidad                   │
│                                                                             │
│  PASO 7: Si stock llega a 0 o mínimo:                                       │
│          └─ Sistema genera alerta STOCK_DEPLETED inmediatamente             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evento generado:**
```typescript
{
  type: 'INVENTORY_DEDUCTED',
  payload: {
    order_id: 'uuid-orden-1234',
    line_id: 'line-001',
    product_id: 'uuid-pollo-brasa',
    location_id: 'uuid-local-centro',
    ingredients: [
      { inventory_code: 'POL-001', quantity_deducted: 1, lot_used: 'LOT-2026-0105', new_stock: 99 },
      { inventory_code: 'PAP-001', quantity_deducted: 0.2, new_stock: 24.8 },
      { inventory_code: 'ACE-001', quantity_deducted: 0.05, new_stock: 2.95 },
      { inventory_code: 'ENS-001', quantity_deducted: 1, new_stock: 49 }
    ]
  },
  timestamp: '2026-01-07T13:45:00Z'
}
```

### 3️⃣ MERMA: Registro de Pérdidas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5 pollos del lote LOT-2026-0105 se vencieron sin vender                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Almacenero abre modal de merma [-]                                 │
│          └─ Selecciona producto: Pollo Entero (POL-001)                     │
│                                                                             │
│  PASO 2: Sistema OBLIGA ingresar:                                           │
│          ├─ Cantidad: 5 pollos                                              │
│          ├─ Lote específico: LOT-2026-0105 (selector de lotes disponibles)  │
│          ├─ Motivo: EXPIRED (vencimiento)                                   │
│          │   └─ Opciones: EXPIRED|DAMAGED|THEFT|PRODUCTION_LOSS|OTHER       │
│          ├─ Detalle: "5 pollos vencidos del lote del lunes"                 │
│          └─ Foto: OBLIGATORIA (monto > S/50)                                │
│                                                                             │
│  PASO 3: Sistema calcula pérdida automáticamente:                           │
│          └─ 5 pollos × S/25.00 = S/125.00 (12500 centavos)                  │
│                                                                             │
│  PASO 4: Sistema muestra confirmación:                                      │
│          └─ "¿Confirmar merma de 5 pollos? Pérdida: S/ 125.00"              │
│                                                                             │
│  PASO 5: Se genera evento WASTE_RECORDED inmutable                          │
│          └─ Stock: 99 → 94 pollos                                           │
│                                                                             │
│  PASO 6: Si motivo = THEFT (robo):                                          │
│          ├─ Requiere PIN de administrador                                   │
│          ├─ Foto OBLIGATORIA                                                │
│          ├─ Detalle de circunstancias OBLIGATORIO                           │
│          └─ Se marca para revisión de admin                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evento generado:**
```typescript
{
  type: 'WASTE_RECORDED',
  payload: {
    waste_log_id: 'uuid',
    inventory_code: 'POL-001',
    location_id: 'uuid-local-centro',
    quantity: 5,
    unit: 'UND',
    lot_number: 'LOT-2026-0105',
    reason_code: 'EXPIRED',
    reason_detail: '5 pollos vencidos del lote del lunes',
    cost_cents: 12500,
    reported_by: 'uuid-almacenero',
    photo_url: 'https://storage/waste/2026-01-08/photo.jpg'
  },
  actor_id: 'uuid-almacenero',
  timestamp: '2026-01-08T06:30:00Z'
}
```

### 4️⃣ CONTEO FÍSICO: Verificación Semanal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Domingo 6AM - Día de inventario semanal                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Admin inicia conteo físico                                         │
│          └─ Sistema bloquea operaciones de inventario durante conteo        │
│                                                                             │
│  PASO 2: Sistema muestra lista de productos SIN mostrar stock teórico       │
│          └─ Evita sesgo del contador                                        │
│                                                                             │
│  PASO 3: Almacenero cuenta físicamente cada producto:                       │
│          ├─ Pollo Entero: cuenta 91 unidades                                │
│          ├─ Papas: cuenta 24 kg                                             │
│          ├─ Aceite: cuenta 2.5 litros                                       │
│          └─ ... (todos los productos)                                       │
│                                                                             │
│  PASO 4: Sistema calcula diferencias:                                       │
│          ┌─────────────────────────────────────────────────────────────┐    │
│          │ Producto     │ Teórico │ Contado │ Diferencia │ Pérdida     │    │
│          ├──────────────┼─────────┼─────────┼────────────┼─────────────┤    │
│          │ Pollo Entero │   94    │   91    │    -3      │ S/ 75.00    │    │
│          │ Papas (kg)   │   24.8  │   24    │   -0.8     │ S/ 4.00     │    │
│          │ Aceite (L)   │   2.95  │   2.5   │   -0.45    │ S/ 9.00     │    │
│          └─────────────────────────────────────────────────────────────┘    │
│          Varianza Total: -S/ 88.00                                          │
│                                                                             │
│  PASO 5: Para cada diferencia negativa, sistema OBLIGA explicar:            │
│          ├─ Motivo: THEFT | UNREGISTERED_WASTE | COUNT_ERROR | OTHER        │
│          ├─ Detalle: Explicación obligatoria                                │
│          └─ Si pérdida > S/50: Foto + PIN de admin                          │
│                                                                             │
│  PASO 6: Admin aprueba el conteo                                            │
│          └─ Se generan eventos INVENTORY_ADJUSTED para cada diferencia      │
│                                                                             │
│  PASO 7: Stock teórico se ajusta al contado                                 │
│          └─ Diferencias quedan registradas para análisis de tendencias      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5️⃣ ALERTAS PROACTIVAS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sistema monitorea constantemente y genera alertas automáticas               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 CRÍTICO (Acción inmediata requerida)                                    │
│  ────────────────────────────────────────                                   │
│  • Stock = 0: "Se acabó el pollo"                                           │
│  • Producto vencido: "10 pollos vencieron hoy"                              │
│  • Stock < 50% del mínimo: "Solo quedan 5 pollos (mínimo: 15)"              │
│                                                                             │
│  🟠 URGENTE (Acción en las próximas horas)                                  │
│  ────────────────────────────────────────                                   │
│  • Stock < mínimo: "Quedan 8 pollos, mínimo es 15"                          │
│    └─ Sugerencia: "Pedir 50 a San Fernando (llegan mañana)"                 │
│    └─ Días de stock restante: 1.5 días (basado en consumo promedio)         │
│  • Vence en 2 días: "10 pollos del lote X vencen el 10/01"                  │
│    └─ Sugerencia: "Promoción 2x1 o registrar merma preventiva"              │
│                                                                             │
│  🟡 ATENCIÓN (Revisar cuando sea posible)                                   │
│  ────────────────────────────────────────                                   │
│  • Stock < 1.5x mínimo: "Stock de aceite en nivel de atención"              │
│  • Vence en 7 días: "20 pollos vencen la próxima semana"                    │
│  • Anomalía detectada: "Consumo de pollo 3x mayor que promedio"             │
│    └─ Posibles causas: Evento especial, error de registro, robo             │
│    └─ Sugerencia: "Verificar con conteo físico spot"                        │
│                                                                             │
│  Acciones disponibles en cada alerta:                                       │
│  ├─ [📞 Llamar Proveedor] - Abre teléfono del proveedor preferido           │
│  ├─ [📝 Crear Pedido] - Abre formulario de orden de compra                  │
│  ├─ [🗑️ Registrar Merma] - Abre modal de merma                              │
│  ├─ [📋 Iniciar Conteo] - Inicia conteo físico spot                         │
│  ├─ [⏰ Snooze] - Posponer alerta (1h, 4h, mañana)                           │
│  └─ [✓ Reconocer] - Marcar como vista                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6️⃣ TRAZABILIDAD: Reclamo de Cliente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Cliente reclama: "El pollo que compré ayer estaba malo"                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Admin busca la venta                                               │
│          ├─ Por número de orden: #1234                                      │
│          ├─ Por fecha/hora: 07/01/2026 13:45                                │
│          └─ Por mesa/cliente: Mesa 5                                        │
│                                                                             │
│  PASO 2: Sistema muestra trazabilidad completa:                             │
│          ┌─────────────────────────────────────────────────────────────┐    │
│          │ TRAZABILIDAD DE ORDEN #1234                                 │    │
│          ├─────────────────────────────────────────────────────────────┤    │
│          │ Producto: 1 Pollo a la Brasa                                │    │
│          │ Fecha venta: 07/01/2026 13:45                               │    │
│          │ Atendido por: Juan Pérez (Mozo)                             │    │
│          │ Cobrado por: María García (Cajera)                          │    │
│          ├─────────────────────────────────────────────────────────────┤    │
│          │ LOTE USADO: LOT-2026-0105                                   │    │
│          │ ├─ Proveedor: Avícola San Fernando                          │    │
│          │ ├─ Fecha recepción: 05/01/2026 08:00                        │    │
│          │ ├─ Recibido por: Carlos López (Almacenero)                  │    │
│          │ ├─ Factura: F001-00230                                      │    │
│          │ ├─ Fecha vencimiento: 08/01/2026                            │    │
│          │ └─ Costo unitario: S/25.00                                  │    │
│          ├─────────────────────────────────────────────────────────────┤    │
│          │ OTRAS VENTAS CON ESTE LOTE: 45 pedidos                      │    │
│          │ └─ [Ver lista completa]                                     │    │
│          └─────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  PASO 3: Admin puede:                                                       │
│          ├─ Contactar a otros clientes afectados (si es necesario)          │
│          ├─ Registrar reclamo al proveedor                                  │
│          ├─ Generar reporte para DIGESA (si es grave)                       │
│          └─ Registrar devolución/compensación al cliente                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 Puntos de Fuga de Dinero y Controles

| Punto de Fuga | Cómo se Pierde | Control del Sistema | Evidencia Requerida |
|---------------|----------------|---------------------|---------------------|
| **Robo de empleados** | Empleado se lleva producto sin registrar | PIN de admin para ajustes > S/50, alertas de anomalía | Foto + detalle + PIN |
| **Vencimiento** | Producto vence antes de venderse | FEFO automático + alertas 3 días antes | Foto de productos vencidos |
| **Error de conteo** | Se cuenta mal y no se detecta | Conteo físico semanal obligatorio | Firma digital del contador |
| **Proveedor entrega menos** | Factura dice 100, llegan 95 | Comparar factura vs recibido al momento | Foto de guía de remisión |
| **Recetas mal calculadas** | Se usa más ingrediente del necesario | Deducción automática por receta estándar | Logs de deducción |
| **Descuentos no autorizados** | Se regala producto sin registrar | Auditoría de quién hizo cada movimiento | Actor_id en cada evento |
| **Consumo fantasma** | Desaparece producto sin explicación | Alerta de anomalía (>2x promedio) | Reporte de consumo diario |
| **Transferencias sin registro** | Se mueve producto entre locales sin registrar | Transferencias requieren confirmación en destino | Evento en origen y destino |

### 🔒 Reglas de Seguridad Financiera

```typescript
// Reglas implementadas en el sistema

const SECURITY_RULES = {
  // Mermas
  WASTE_PHOTO_THRESHOLD_CENTS: 5000,      // Foto obligatoria si merma > S/50
  WASTE_ADMIN_PIN_THRESHOLD_CENTS: 5000,  // PIN admin si merma > S/50
  WASTE_THEFT_REQUIRES_ADMIN: true,       // Robo siempre requiere admin
  
  // Conteos
  COUNT_VARIANCE_ALERT_PERCENT: 5,        // Alerta si varianza > 5%
  COUNT_PHOTO_THRESHOLD_CENTS: 5000,      // Foto si diferencia > S/50
  COUNT_FREQUENCY_DAYS: 7,                // Conteo semanal obligatorio
  
  // Alertas
  STOCK_CRITICAL_PERCENT: 50,             // Crítico si stock < 50% del mínimo
  EXPIRY_ALERT_DAYS: 3,                   // Alerta 3 días antes de vencer
  ANOMALY_THRESHOLD_MULTIPLIER: 2,        // Anomalía si consumo > 2x promedio
  
  // Auditoría
  ALL_EVENTS_IMMUTABLE: true,             // Eventos nunca se modifican
  ALL_EVENTS_REQUIRE_ACTOR: true,         // Todo evento tiene actor_id
  ALL_EVENTS_REQUIRE_TIMESTAMP: true,     // Todo evento tiene timestamp UTC
  AUDIT_LOG_RETENTION_DAYS: 365 * 5,      // Retención 5 años
};
```

---

## 🧠 Inteligencia del Sistema - Lo que lo hace SMART

> **No es solo un kardex, es un sistema que APRENDE y PREDICE**

### 1️⃣ Predicción de Demanda (Cuánto Pedir)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PREDICCIÓN INTELIGENTE DE REPOSICIÓN                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema analiza:                                                        │
│  ├─ Consumo promedio últimos 7 días                                         │
│  ├─ Consumo promedio mismo día de semana (ej: sábados venden más)           │
│  ├─ Tendencia mensual (¿está subiendo o bajando?)                           │
│  ├─ Eventos especiales (feriados, partidos, etc.)                           │
│  └─ Lead time del proveedor (cuánto demora en llegar)                       │
│                                                                             │
│  EJEMPLO:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🐔 POLLO ENTERO - Sugerencia de Pedido                              │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ Stock actual:           8 unidades                                  │    │
│  │ Consumo promedio/día:   12 unidades                                 │    │
│  │ Días de stock:          0.7 días (⚠️ CRÍTICO)                       │    │
│  │                                                                     │    │
│  │ Consumo proyectado próximos 3 días:                                 │    │
│  │ ├─ Jueves (normal):     12 unidades                                 │    │
│  │ ├─ Viernes (alto):      18 unidades (+50% histórico)                │    │
│  │ └─ Sábado (pico):       25 unidades (+108% histórico)               │    │
│  │ Total proyectado:       55 unidades                                 │    │
│  │                                                                     │    │
│  │ Lead time proveedor:    1 día                                       │    │
│  │ Stock de seguridad:     15 unidades (1.25 días)                     │    │
│  │                                                                     │    │
│  │ 📦 CANTIDAD SUGERIDA:   62 unidades                                 │    │
│  │    (55 proyectado + 15 seguridad - 8 actual)                        │    │
│  │                                                                     │    │
│  │ 💰 Costo estimado:      S/ 1,550.00                                 │    │
│  │ 📅 Pedir antes de:      HOY 2PM (para recibir mañana 8AM)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Algoritmo:**
```typescript
function calculateSuggestedOrder(inventoryCode: string): SuggestedOrder {
  // 1. Obtener consumo histórico
  const dailyAvg = getAverageConsumption(inventoryCode, 7); // últimos 7 días
  const dayOfWeekMultiplier = getDayOfWeekMultiplier(inventoryCode); // ej: sábado = 2.08x
  const trendMultiplier = getMonthlyTrend(inventoryCode); // ej: 1.05 si está subiendo
  
  // 2. Proyectar demanda para período de cobertura
  const coverageDays = supplier.leadTimeDays + SAFETY_STOCK_DAYS;
  let projectedDemand = 0;
  for (let i = 0; i < coverageDays; i++) {
    const dayMultiplier = getDayOfWeekMultiplier(inventoryCode, addDays(today, i));
    projectedDemand += dailyAvg * dayMultiplier * trendMultiplier;
  }
  
  // 3. Considerar eventos especiales
  const specialEvents = getUpcomingEvents(coverageDays);
  projectedDemand *= specialEvents.demandMultiplier; // ej: partido Perú = 1.3x
  
  // 4. Calcular cantidad a pedir
  const currentStock = getCurrentStock(inventoryCode);
  const safetyStock = dailyAvg * SAFETY_STOCK_DAYS;
  const suggestedQty = Math.ceil(projectedDemand + safetyStock - currentStock);
  
  // 5. Ajustar a múltiplos del proveedor (ej: cajas de 10)
  const orderMultiple = supplier.orderMultiple || 1;
  const finalQty = Math.ceil(suggestedQty / orderMultiple) * orderMultiple;
  
  return {
    quantity: finalQty,
    estimatedCost: finalQty * getAverageCost(inventoryCode),
    orderByDate: calculateOrderDeadline(supplier),
    reasoning: generateExplanation(...)
  };
}
```

### 2️⃣ Detección de Anomalías (Algo Raro Está Pasando)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DETECCIÓN INTELIGENTE DE ANOMALÍAS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema detecta automáticamente:                                        │
│                                                                             │
│  🔴 CONSUMO ANORMAL                                                         │
│  ─────────────────                                                          │
│  "Hoy se consumieron 35 pollos, el promedio es 12"                          │
│  Posibles causas:                                                           │
│  ├─ ✅ Evento especial (verificar calendario)                               │
│  ├─ ⚠️ Error de registro (verificar órdenes)                                │
│  ├─ 🔴 Posible robo (verificar con conteo spot)                             │
│  └─ ⚠️ Merma no registrada (verificar cámara fría)                          │
│  Acción sugerida: [📋 Conteo Spot] [📊 Ver Órdenes del Día]                 │
│                                                                             │
│  🟠 PATRÓN DE MERMA SOSPECHOSO                                              │
│  ────────────────────────────────                                           │
│  "Carlos López ha registrado 8 mermas esta semana (promedio: 2)"            │
│  Análisis:                                                                  │
│  ├─ Turno: Noche (18:00-23:00)                                              │
│  ├─ Productos: 80% pollo, 20% papas                                         │
│  ├─ Motivos: 60% "daño", 40% "vencimiento"                                  │
│  └─ Costo total: S/ 450.00                                                  │
│  Acción sugerida: [👁️ Revisar Detalle] [📞 Hablar con Empleado]            │
│                                                                             │
│  🟡 DISCREPANCIA EN CONTEO                                                  │
│  ─────────────────────────────                                              │
│  "Últimos 3 conteos muestran faltante consistente de pollo (-2 a -4)"       │
│  Análisis:                                                                  │
│  ├─ No correlaciona con mermas registradas                                  │
│  ├─ No correlaciona con ventas                                              │
│  └─ Patrón: Siempre en turno noche                                          │
│  Acción sugerida: [🎥 Revisar Cámaras] [📋 Conteo Sorpresa]                 │
│                                                                             │
│  🟡 PROVEEDOR CON PROBLEMAS                                                 │
│  ───────────────────────────                                                │
│  "San Fernando: 3 de últimas 5 entregas con diferencias"                    │
│  Historial:                                                                 │
│  ├─ 05/01: Factura 100, Recibido 98 (-2)                                    │
│  ├─ 03/01: Factura 80, Recibido 80 (OK)                                     │
│  ├─ 01/01: Factura 90, Recibido 87 (-3)                                     │
│  └─ Pérdida acumulada: S/ 125.00                                            │
│  Acción sugerida: [📞 Reclamar] [🔄 Buscar Alternativa]                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Algoritmo de detección:**
```typescript
interface AnomalyDetector {
  // Detectar consumo anormal
  detectConsumptionAnomaly(inventoryCode: string): Anomaly | null {
    const todayConsumption = getTodayConsumption(inventoryCode);
    const avgConsumption = getAverageConsumption(inventoryCode, 30);
    const stdDev = getStandardDeviation(inventoryCode, 30);
    
    // Z-score > 2 = anomalía
    const zScore = (todayConsumption - avgConsumption) / stdDev;
    if (zScore > 2) {
      return {
        type: 'CONSUMPTION_ANOMALY',
        severity: zScore > 3 ? 'CRITICAL' : 'WARNING',
        value: todayConsumption,
        expected: avgConsumption,
        deviation: `${((todayConsumption / avgConsumption - 1) * 100).toFixed(0)}%`,
        possibleCauses: analyzePossibleCauses(inventoryCode, todayConsumption)
      };
    }
    return null;
  }
  
  // Detectar patrón de merma sospechoso
  detectWastePattern(actorId: string): Anomaly | null {
    const recentWastes = getWastesByActor(actorId, 7); // última semana
    const avgWastesPerWeek = getAverageWastesPerActor(7);
    
    if (recentWastes.length > avgWastesPerWeek * 2) {
      return {
        type: 'SUSPICIOUS_WASTE_PATTERN',
        severity: 'WARNING',
        actor: getActorName(actorId),
        wasteCount: recentWastes.length,
        expectedCount: avgWastesPerWeek,
        totalCost: sumCosts(recentWastes),
        breakdown: analyzeWasteBreakdown(recentWastes)
      };
    }
    return null;
  }
  
  // Detectar discrepancia sistemática en conteos
  detectCountDiscrepancy(inventoryCode: string): Anomaly | null {
    const lastCounts = getLastCounts(inventoryCode, 5);
    const discrepancies = lastCounts.filter(c => c.difference < 0);
    
    if (discrepancies.length >= 3) {
      return {
        type: 'SYSTEMATIC_DISCREPANCY',
        severity: 'WARNING',
        pattern: analyzeDiscrepancyPattern(discrepancies),
        totalLoss: sumLosses(discrepancies),
        correlations: findCorrelations(discrepancies) // turno, día, actor
      };
    }
    return null;
  }
}
```

### 3️⃣ Optimización de Vencimientos (Minimizar Merma)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GESTIÓN INTELIGENTE DE VENCIMIENTOS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema sugiere acciones ANTES de que el producto venza:                │
│                                                                             │
│  📅 PRÓXIMOS VENCIMIENTOS                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Producto      │ Lote          │ Cant │ Vence    │ Acción Sugerida   │    │
│  ├───────────────┼───────────────┼──────┼──────────┼───────────────────┤    │
│  │ Pollo Entero  │ LOT-2026-0105 │  10  │ MAÑANA   │ 🏷️ Promo 2x1      │    │
│  │ Pollo Entero  │ LOT-2026-0107 │  45  │ 3 días   │ ✅ OK (se vende)  │    │
│  │ Ensalada      │ LOT-2026-0108 │  20  │ 2 días   │ 🍽️ Menú del día   │    │
│  │ Crema         │ LOT-2026-0102 │   5  │ HOY      │ 🗑️ Registrar merma│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  🧮 ANÁLISIS DE PROBABILIDAD DE VENTA                                       │
│  ─────────────────────────────────────                                      │
│  Lote LOT-2026-0105 (10 pollos, vence mañana):                              │
│  ├─ Consumo promedio/día: 12 pollos                                         │
│  ├─ Probabilidad de vender todo: 85%                                        │
│  ├─ Probabilidad de merma: 15% (~1.5 pollos)                                │
│  └─ Pérdida esperada: S/ 37.50                                              │
│                                                                             │
│  💡 SUGERENCIA INTELIGENTE:                                                 │
│  "Activar promoción '2x1 en Pollo' reducirá merma esperada a 0"             │
│  ├─ Costo de promoción: S/ 125.00 (descuento)                               │
│  ├─ Costo de merma evitada: S/ 37.50                                        │
│  └─ Beneficio neto: -S/ 87.50 PERO fideliza clientes                        │
│                                                                             │
│  Alternativa: "Incluir en Menú Ejecutivo del día"                           │
│  ├─ Incremento esperado de ventas: +5 pollos                                │
│  ├─ Probabilidad de merma: 5% (~0.5 pollos)                                 │
│  └─ Pérdida esperada: S/ 12.50                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4️⃣ Aprendizaje de Patrones (El Sistema Mejora Solo)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ APRENDIZAJE AUTOMÁTICO DE PATRONES                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema aprende de los datos históricos:                                │
│                                                                             │
│  📊 PATRONES DESCUBIERTOS                                                   │
│  ─────────────────────────                                                  │
│  1. "Los sábados se vende 2.1x más pollo que días normales"                 │
│     → Ajusta predicción de demanda automáticamente                          │
│                                                                             │
│  2. "Cuando hay partido de Perú, ventas suben 35%"                          │
│     → Integra calendario deportivo en predicciones                          │
│                                                                             │
│  3. "Fin de mes (25-30) las ventas bajan 15%"                               │
│     → Reduce pedidos automáticamente esos días                              │
│                                                                             │
│  4. "Proveedor X entrega 3% menos de lo facturado en promedio"              │
│     → Alerta al recibir para verificar cantidad                             │
│                                                                             │
│  5. "Turno noche tiene 2x más mermas que turno día"                         │
│     → Sugiere supervisión adicional                                         │
│                                                                             │
│  6. "Pollo de lote con >2 días de antigüedad tiene 3x más reclamos"         │
│     → Prioriza FEFO más agresivamente                                       │
│                                                                             │
│  📈 MÉTRICAS DE MEJORA                                                      │
│  ─────────────────────                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Métrica                    │ Antes │ Después │ Mejora              │    │
│  ├────────────────────────────┼───────┼─────────┼─────────────────────┤    │
│  │ Merma por vencimiento      │ 5.2%  │  1.8%   │ -65% 🎉             │    │
│  │ Precisión de predicción    │ 72%   │  91%    │ +26% 📈             │    │
│  │ Stockouts (quedarse sin)   │ 8/mes │  1/mes  │ -87% ✅             │    │
│  │ Diferencia en conteos      │ 4.1%  │  1.2%   │ -71% 🔒             │    │
│  │ Tiempo de reposición       │ 2 días│  0.5 día│ -75% ⚡             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5️⃣ Dashboard de Salud del Inventario

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏥 SALUD DEL INVENTARIO - Enero 2026                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCORE GENERAL: 87/100 ⭐⭐⭐⭐☆                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Indicador              │ Valor   │ Meta    │ Estado │ Tendencia    │    │
│  ├────────────────────────┼─────────┼─────────┼────────┼──────────────┤    │
│  │ % Merma vs Compras     │  2.1%   │  <3%    │ 🟢 OK  │ ↓ mejorando  │    │
│  │ Precisión de Stock     │  98.2%  │  >95%   │ 🟢 OK  │ → estable    │    │
│  │ Días sin Stockout      │  23     │  >20    │ 🟢 OK  │ ↑ mejorando  │    │
│  │ Rotación (días)        │  3.2    │  <5     │ 🟢 OK  │ → estable    │    │
│  │ Valor Inmovilizado     │ S/2,100 │ <S/3,000│ 🟢 OK  │ ↓ mejorando  │    │
│  │ Alertas sin Resolver   │  2      │  0      │ 🟡 ATN │ → estable    │    │
│  │ Conteos Pendientes     │  0      │  0      │ 🟢 OK  │ ✓            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  💡 RECOMENDACIONES DEL SISTEMA:                                            │
│  ├─ "Reducir pedido de ensaladas 20% - rotación lenta últimas 2 semanas"    │
│  ├─ "Negociar mejor precio con San Fernando - volumen subió 15%"            │
│  └─ "Programar conteo spot de aceite - 3 anomalías detectadas"              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

---

## 🚀 Características Avanzadas 2026 (Basado en Investigación de Industria)

> **Fuentes**: Supy.io, Push Operations, Railwaymen, MobiDev, Barmetrix - Tendencias Restaurant Tech 2025-2026

### 6️⃣ Sensores IoT para Monitoreo Automático

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🌡️ MONITOREO IOT EN TIEMPO REAL                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Sensores conectados que monitorean 24/7 sin intervención humana:           │
│                                                                             │
│  🧊 SENSORES DE TEMPERATURA (Cámaras frías)                                 │
│  ─────────────────────────────────────────                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Cámara Fría #1 (Pollos)                                             │    │
│  │ ├─ Temperatura actual: 2.3°C ✅                                      │    │
│  │ ├─ Rango permitido: 0°C - 4°C                                       │    │
│  │ ├─ Última lectura: hace 5 min                                       │    │
│  │ └─ Estado: NORMAL                                                   │    │
│  │                                                                     │    │
│  │ Cámara Fría #2 (Verduras)                                           │    │
│  │ ├─ Temperatura actual: 6.8°C ⚠️ ALERTA                              │    │
│  │ ├─ Rango permitido: 2°C - 6°C                                       │    │
│  │ ├─ Desviación detectada: hace 15 min                                │    │
│  │ └─ Acción: Notificación enviada a Carlos (Almacenero)               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚖️ BALANZAS INTELIGENTES (Smart Scales)                                   │
│  ────────────────────────────────────────                                   │
│  • Pesan automáticamente ingredientes al usarlos                            │
│  • Registran consumo real vs teórico por receta                             │
│  • Detectan porciones inconsistentes (ej: "Hoy usaste 20% más pollo")       │
│  • Alertan si el peso no coincide con la receta estándar                    │
│                                                                             │
│  📦 ESTANTES INTELIGENTES (Smart Shelves)                                   │
│  ─────────────────────────────────────────                                  │
│  • Sensores de peso detectan cuando se retira producto                      │
│  • Actualizan stock automáticamente sin escaneo                             │
│  • Alertan cuando el estante está casi vacío                                │
│  • Registran hora exacta de cada movimiento                                 │
│                                                                             │
│  💡 BENEFICIO: Un restaurante redujo pérdidas por falla de refrigeración    │
│     de S/3,000/mes a S/0 con alertas instantáneas de temperatura            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7️⃣ Computer Vision para Conteo Automático

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👁️ VISIÓN POR COMPUTADORA - CONTEO SIN MANOS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Cámaras con IA que cuentan y monitorean automáticamente:                   │
│                                                                             │
│  📸 CONTEO VISUAL AUTOMÁTICO                                                │
│  ───────────────────────────                                                │
│  • Cámara sobre el área de almacenamiento cuenta pollos automáticamente     │
│  • Reconoce productos por forma/color sin código de barras                  │
│  • Actualiza stock en tiempo real cuando se mueve producto                  │
│  • Precisión: 98% (mejor que conteo manual humano)                          │
│                                                                             │
│  📅 LECTURA DE FECHAS DE VENCIMIENTO                                        │
│  ────────────────────────────────────                                       │
│  • OCR lee etiquetas de vencimiento automáticamente                         │
│  • Alerta cuando detecta producto próximo a vencer                          │
│  • Prioriza FEFO sin intervención humana                                    │
│  • Registra lote y fecha de cada producto que entra                         │
│                                                                             │
│  🍽️ ANÁLISIS DE PLATOS DEVUELTOS (Plate Waste Analysis)                    │
│  ─────────────────────────────────────────────────────                      │
│  • Cámara analiza platos que regresan a cocina                              │
│  • Identifica qué se deja sin comer consistentemente                        │
│  • Sugiere ajustes de porción: "Clientes dejan 30% de la ensalada"          │
│  • Calcula desperdicio real por plato                                       │
│                                                                             │
│  🔒 DETECCIÓN DE COMPORTAMIENTO SOSPECHOSO                                  │
│  ──────────────────────────────────────────                                 │
│  • Detecta si alguien saca producto sin registrar                           │
│  • Alerta de movimientos fuera de horario                                   │
│  • Registra video de cada acceso al almacén                                 │
│  • Correlaciona con discrepancias de inventario                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8️⃣ Integración con Clima y Eventos Externos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🌤️ PREDICCIÓN CONTEXTUAL - EL SISTEMA SABE LO QUE VA A PASAR              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema integra datos externos para predecir demanda:                   │
│                                                                             │
│  ☀️ INTEGRACIÓN CON CLIMA                                                   │
│  ─────────────────────────                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Pronóstico: Viernes 10/01 - Lluvia fuerte 🌧️                        │    │
│  │                                                                     │    │
│  │ Impacto histórico de lluvia en tu negocio:                          │    │
│  │ ├─ Ventas en local: -25% (menos gente sale)                         │    │
│  │ ├─ Delivery: +40% (piden más a domicilio)                           │    │
│  │ ├─ Sopas/caldos: +60%                                               │    │
│  │ └─ Ensaladas: -30%                                                  │    │
│  │                                                                     │    │
│  │ 📦 Ajuste sugerido de pedido:                                       │    │
│  │ ├─ Pollo: Normal (se compensa delivery vs local)                    │    │
│  │ ├─ Verduras para sopa: +50%                                         │    │
│  │ └─ Lechuga: -30%                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚽ INTEGRACIÓN CON EVENTOS                                                 │
│  ──────────────────────────                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Evento detectado: Perú vs Chile - Domingo 12/01 3PM                 │    │
│  │                                                                     │    │
│  │ Impacto histórico de partidos de Perú:                              │    │
│  │ ├─ Ventas 2h antes: +15%                                            │    │
│  │ ├─ Ventas durante partido: -40% (todos viendo TV)                   │    │
│  │ ├─ Ventas post-partido (si gana): +80% 🎉                           │    │
│  │ └─ Ventas post-partido (si pierde): +20%                            │    │
│  │                                                                     │    │
│  │ 📦 Ajuste sugerido:                                                 │    │
│  │ ├─ Pollo: +30% (preparar para celebración)                          │    │
│  │ ├─ Cerveza: +50%                                                    │    │
│  │ └─ Personal: Reforzar turno 5PM-9PM                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  📅 INTEGRACIÓN CON CALENDARIO                                              │
│  ─────────────────────────────                                              │
│  • Feriados: Ajusta automáticamente (Día de la Madre = +200%)               │
│  • Quincena/fin de mes: Detecta patrones de gasto                           │
│  • Vacaciones escolares: Más familias, más menú infantil                    │
│  • Eventos locales: Ferias, conciertos, maratones                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9️⃣ Precios Dinámicos para Reducir Merma

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 PRECIOS DINÁMICOS - COMO LAS AEROLÍNEAS, PERO PARA COMIDA               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema ajusta precios automáticamente según contexto:                  │
│                                                                             │
│  🏷️ DESCUENTOS AUTOMÁTICOS POR VENCIMIENTO                                 │
│  ──────────────────────────────────────────                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Producto: Pollo a la Brasa                                          │    │
│  │ Lote: LOT-2026-0105 (10 unidades)                                   │    │
│  │ Vence: MAÑANA                                                       │    │
│  │                                                                     │    │
│  │ Probabilidad de venta a precio normal: 60%                          │    │
│  │ Merma esperada: 4 pollos = S/100                                    │    │
│  │                                                                     │    │
│  │ 💡 ESTRATEGIA SUGERIDA:                                             │    │
│  │ ├─ Opción A: Descuento 20% → Prob. venta 95% → Merma S/12.50        │    │
│  │ ├─ Opción B: 2x1 después 8PM → Prob. venta 100% → Merma S/0         │    │
│  │ └─ Opción C: No hacer nada → Merma esperada S/100                   │    │
│  │                                                                     │    │
│  │ Sistema recomienda: Opción A (mejor balance margen/merma)           │    │
│  │ [Activar Descuento] [Activar 2x1] [Ignorar]                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⏰ HAPPY HOUR INTELIGENTE                                                  │
│  ─────────────────────────                                                  │
│  • Sistema detecta horas de baja demanda automáticamente                    │
│  • Sugiere promociones específicas para esas horas                          │
│  • Ajusta según día de semana y clima                                       │
│  • Mide efectividad y aprende qué funciona                                  │
│                                                                             │
│  📊 EJEMPLO REAL:                                                           │
│  "Un café redujo desperdicio de pasteles 30% con descuentos                 │
│   automáticos después de las 6PM, aumentando ingresos 12%"                  │
│   - Fuente: Push Operations 2025                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🔟 Integración con Proveedores (Pedidos Automáticos)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🤝 PEDIDOS AUTOMÁTICOS A PROVEEDORES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema puede pedir solo, sin intervención humana:                      │
│                                                                             │
│  🔄 FLUJO AUTOMATIZADO                                                      │
│  ─────────────────────                                                      │
│  1. Sistema detecta: "Stock de pollo llegará a 0 en 1.5 días"               │
│  2. Calcula cantidad óptima: 62 unidades                                    │
│  3. Verifica precio con proveedor (API o email automático)                  │
│  4. Si precio OK → Genera orden de compra automáticamente                   │
│  5. Envía orden al proveedor por email/WhatsApp/API                         │
│  6. Confirma recepción cuando llega                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📧 ORDEN AUTOMÁTICA GENERADA                                        │    │
│  │                                                                     │    │
│  │ Para: Avícola San Fernando                                          │    │
│  │ Fecha: 07/01/2026 14:00                                             │    │
│  │                                                                     │    │
│  │ Estimados,                                                          │    │
│  │                                                                     │    │
│  │ Solicitamos el siguiente pedido para entrega mañana 08/01:          │    │
│  │ • 62 Pollos Enteros - S/25.00 c/u = S/1,550.00                      │    │
│  │                                                                     │    │
│  │ Dirección: Av. Principal 123, Local Centro                          │    │
│  │ Contacto: Carlos López - 999-888-777                                │    │
│  │                                                                     │    │
│  │ Por favor confirmar disponibilidad.                                 │    │
│  │                                                                     │    │
│  │ [Generado automáticamente por PARK POS]                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚙️ CONFIGURACIÓN POR PROVEEDOR                                            │
│  ───────────────────────────────                                            │
│  • San Fernando: Pedido automático habilitado ✅                            │
│  • Mercado Local: Solo sugerencia (requiere aprobación) ⚠️                  │
│  • Nuevo Proveedor: Deshabilitado (primero evaluar) ❌                      │
│                                                                             │
│  📊 COMPARACIÓN DE PRECIOS AUTOMÁTICA                                       │
│  ─────────────────────────────────────                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Producto: Pollo Entero (62 unidades)                                │    │
│  │                                                                     │    │
│  │ Proveedor          │ Precio Unit │ Total    │ Entrega │ Calidad    │    │
│  │ ───────────────────┼─────────────┼──────────┼─────────┼────────────│    │
│  │ San Fernando       │ S/25.00     │ S/1,550  │ Mañana  │ ⭐⭐⭐⭐⭐  │    │
│  │ Avícola del Norte  │ S/24.00     │ S/1,488  │ 2 días  │ ⭐⭐⭐⭐    │    │
│  │ Mercado Local      │ S/26.00     │ S/1,612  │ Hoy     │ ⭐⭐⭐      │    │
│  │                                                                     │    │
│  │ 💡 Recomendación: San Fernando (mejor balance precio/calidad/tiempo)│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1️⃣1️⃣ Análisis de Fraude con IA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 DETECCIÓN DE FRAUDE CON INTELIGENCIA ARTIFICIAL                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  El sistema detecta patrones sospechosos que humanos no ven:                │
│                                                                             │
│  🚨 TIPOS DE FRAUDE DETECTADOS                                              │
│  ─────────────────────────────                                              │
│                                                                             │
│  1. ROBO HORMIGA (Pequeñas cantidades frecuentes)                           │
│     ├─ Patrón: Faltantes pequeños pero consistentes                         │
│     ├─ Detección: Correlación con turnos/empleados específicos              │
│     └─ Ejemplo: "Siempre faltan 2-3 pollos en turno noche de Juan"          │
│                                                                             │
│  2. VOID FRAUD (Anular ventas y quedarse el dinero)                         │
│     ├─ Patrón: Empleado anula ventas después de cobrar                      │
│     ├─ Detección: Tasa de anulación > promedio + correlación con caja       │
│     └─ Ejemplo: "María anula 3x más ventas que otros cajeros"               │
│                                                                             │
│  3. SWEET-HEARTING (Regalar a amigos/familia)                               │
│     ├─ Patrón: Descuentos frecuentes sin autorización                       │
│     ├─ Detección: Descuentos manuales + mismos clientes                     │
│     └─ Ejemplo: "Pedro aplica descuento 50% a misma persona 3x/semana"      │
│                                                                             │
│  4. COLUSIÓN CON PROVEEDOR                                                  │
│     ├─ Patrón: Siempre falta producto de mismo proveedor                    │
│     ├─ Detección: Discrepancia factura vs recibido sistemática              │
│     └─ Ejemplo: "San Fernando entrega 5% menos consistentemente"            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🚨 ALERTA DE FRAUDE DETECTADA                                       │    │
│  │                                                                     │    │
│  │ Tipo: Posible robo hormiga                                          │    │
│  │ Confianza: 87%                                                      │    │
│  │                                                                     │    │
│  │ Evidencia:                                                          │    │
│  │ ├─ Últimos 30 días: Faltante promedio 2.3 pollos/día                │    │
│  │ ├─ Correlación con turno noche: 94%                                 │    │
│  │ ├─ Correlación con empleado Juan Pérez: 89%                         │    │
│  │ ├─ Pérdida estimada: S/1,725/mes                                    │    │
│  │ └─ No hay mermas registradas que expliquen                          │    │
│  │                                                                     │    │
│  │ Acciones sugeridas:                                                 │    │
│  │ ├─ [📋 Conteo sorpresa en turno noche]                              │    │
│  │ ├─ [🎥 Revisar cámaras 8PM-10PM]                                    │    │
│  │ └─ [👤 Hablar con supervisor de turno]                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1️⃣2️⃣ Asistente de Voz para Inventario

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎤 ASISTENTE DE VOZ - MANOS LIBRES EN LA COCINA                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Comandos de voz para cuando tienes las manos ocupadas:                     │
│                                                                             │
│  🗣️ COMANDOS DISPONIBLES                                                   │
│  ────────────────────────                                                   │
│                                                                             │
│  "Hey Park, ¿cuántos pollos tenemos?"                                       │
│  → "Tienes 45 pollos. 10 vencen mañana."                                    │
│                                                                             │
│  "Hey Park, registra entrada de 50 pollos"                                  │
│  → "¿De qué proveedor? San Fernando o Mercado Local?"                       │
│  "San Fernando"                                                             │
│  → "Registrado: 50 pollos de San Fernando. ¿Número de factura?"             │
│                                                                             │
│  "Hey Park, registra merma de 3 pollos vencidos"                            │
│  → "Registrado: 3 pollos, motivo vencimiento. Pérdida: S/75.                │
│     Necesito foto para confirmar. ¿La tomas ahora?"                         │
│                                                                             │
│  "Hey Park, ¿qué debo pedir hoy?"                                           │
│  → "Recomiendo pedir: 50 pollos, 20kg papas, 10L aceite.                    │
│     ¿Quieres que genere la orden?"                                          │
│                                                                             │
│  "Hey Park, ¿cómo va el inventario esta semana?"                            │
│  → "Merma 2.1%, dentro del objetivo. Rotación 3.2 días.                     │
│     Tienes 2 alertas pendientes de stock bajo."                             │
│                                                                             │
│  💡 BENEFICIO: Almacenero puede trabajar sin soltar productos               │
│     ni tocar pantallas con manos sucias                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 Resumen: Nivel de Madurez del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 NIVELES DE MADUREZ - ¿DÓNDE ESTAMOS?                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NIVEL 1: BÁSICO (Kardex tradicional) ✅ YA TENEMOS                         │
│  ├─ Registro manual de entradas/salidas                                     │
│  ├─ Historial de movimientos                                                │
│  └─ Alertas de stock bajo                                                   │
│                                                                             │
│  NIVEL 2: AUTOMATIZADO ✅ YA TENEMOS                                        │
│  ├─ Deducción automática por ventas                                         │
│  ├─ FEFO automático                                                         │
│  ├─ Eventos inmutables (Event Sourcing)                                     │
│  └─ Offline-first                                                           │
│                                                                             │
│  NIVEL 3: INTELIGENTE 🔄 EN PROGRESO                                        │
│  ├─ Predicción de demanda                                                   │
│  ├─ Detección de anomalías                                                  │
│  ├─ Sugerencias de reposición                                               │
│  └─ Alertas proactivas                                                      │
│                                                                             │
│  NIVEL 4: PREDICTIVO 📋 PLANIFICADO                                         │
│  ├─ Integración con clima/eventos                                           │
│  ├─ Precios dinámicos                                                       │
│  ├─ Pedidos automáticos a proveedores                                       │
│  └─ Detección de fraude con IA                                              │
│                                                                             │
│  NIVEL 5: AUTÓNOMO 🔮 FUTURO                                                │
│  ├─ Sensores IoT (temperatura, peso)                                        │
│  ├─ Computer Vision (conteo automático)                                     │
│  ├─ Asistente de voz                                                        │
│  └─ Sistema completamente autogestionado                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Modelo de Datos (Schema Prisma)

> **Archivo**: `prisma/schema.prisma`

### Tablas de Inventario Implementadas (13 tablas)

| Tabla | Descripción | Estado |
|-------|-------------|--------|
| `Inventory` | Stock actual por producto | ✅ |
| `InventoryLog` | Historial de movimientos | ✅ |
| `Supplier` | Proveedores | ✅ |
| `SupplierProduct` | Productos por proveedor | ✅ |
| `Recipe` | Recetas (ingredientes por producto) | ✅ |
| `StockAlert` | Alertas de stock | ✅ |
| `StockTransfer` | Transferencias entre locales | ✅ |
| `PurchaseOrder` | Órdenes de compra | ✅ |
| `PurchaseOrderItem` | Items de orden de compra | ✅ |
| `GoodsReceipt` | Recepciones de mercadería | ✅ |
| `GoodsReceiptItem` | Items de recepción | ✅ |
| `InventoryCount` | Conteos de inventario | ✅ |
| `InventoryCountItem` | Items de conteo | ✅ |
| `WasteLog` | Registro de mermas | ✅ |

### Tabla: Inventory
```prisma
model Inventory {
  id                String    @id @default(uuid()) @db.Uuid
  tenant_id         String    @db.Uuid
  code              String                    // SKU/código único
  name              String
  unit              String                    // UND|KG|LITRO|GRAMO
  stock             Decimal   @db.Decimal(10, 3)  // Stock actual
  min_stock         Decimal?  @db.Decimal(10, 3)  // Alerta cuando llega aquí
  cost_cents        Int?                      // Costo unitario (centavos)
  location_id       String?   @db.Uuid        // Local/ubicación
  expiry_date       DateTime? @db.Date        // Fecha de vencimiento
  lot_number        String?                   // Número de lote
  last_count_at     DateTime? @db.Timestamptz // Último conteo
  theoretical_stock Decimal   @db.Decimal(10, 3)  // Stock teórico

  @@unique([tenant_id, code])
  @@index([tenant_id, location_id, code])
  @@map("inventory")
}
```

### Tabla: InventoryLog
```prisma
model InventoryLog {
  id            String   @id @default(uuid()) @db.Uuid
  tenant_id     String   @db.Uuid
  inventory_id  String   @db.Uuid
  movement_type String   // IN|OUT|ADJUST|WASTE
  quantity      Decimal  @db.Decimal(10, 3)
  reference_id  String?  @db.Uuid
  reason        String?
  actor_id      String?  @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz

  @@index([tenant_id, inventory_id, created_at(sort: Desc)])
  @@map("inventory_log")
}
```

### Tabla: Supplier
```prisma
model Supplier {
  id              String   @id @default(uuid()) @db.Uuid
  tenant_id       String   @db.Uuid
  name            String
  ruc             String?                   // RUC peruano
  contact_name    String?
  phone           String?
  email           String?
  address         String?
  payment_terms   Int      @default(0)      // Días de crédito
  min_order_cents Int      @default(0)      // Pedido mínimo
  delivery_days   String[] @default([])     // ["LUNES", "MIERCOLES"]
  lead_time_days  Int      @default(1)      // Días hasta entrega
  is_active       Boolean  @default(true)

  @@index([tenant_id, is_active])
  @@map("suppliers")
}
```

### Tabla: Recipe
```prisma
model Recipe {
  id           String   @id @default(uuid()) @db.Uuid
  tenant_id    String   @db.Uuid
  product_id   String   @db.Uuid
  ingredients  Json     // Array de {inventory_code, quantity, unit, is_optional}
  yield_qty    Decimal  @default(1) @db.Decimal(10, 3)
  is_active    Boolean  @default(true)

  @@unique([tenant_id, product_id])
  @@map("recipes")
}
```

### Tabla: WasteLog
```prisma
model WasteLog {
  id             String    @id @default(uuid()) @db.Uuid
  tenant_id      String    @db.Uuid
  location_id    String    @db.Uuid
  shift_id       String?   @db.Uuid
  inventory_code String
  quantity       Decimal   @db.Decimal(10, 3)
  unit           String
  reason_code    String    // EXPIRED|DAMAGED|THEFT|PRODUCTION_LOSS|...
  reason_detail  String?
  cost_cents     Int
  reported_by    String    @db.Uuid
  approved_by    String?   @db.Uuid
  photo_url      String?
  reference_type String?   // GOODS_RECEIPT|INVENTORY_COUNT|MANUAL
  reference_id   String?   @db.Uuid

  @@index([tenant_id, location_id, created_at(sort: Desc)])
  @@map("waste_logs")
}
```

### Tabla: PurchaseOrder
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

  @@unique([tenant_id, location_id, order_number])
  @@map("purchase_orders")
}
```

### Tabla: GoodsReceipt
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

  @@unique([tenant_id, location_id, receipt_number])
  @@map("goods_receipts")
}
```

### Tabla: InventoryCount
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

  @@index([tenant_id, location_id, count_date(sort: Desc)])
  @@map("inventory_counts")
}
```

---

## 📡 Eventos de Dominio (Implementados)

> **Archivo**: `src/core/domain/inventory-events.ts`

```typescript
// ============================================================================
// Purchase Order Events (Fase 2)
// ============================================================================

// Orden de compra creada
interface PurchaseOrderCreatedPayload {
  purchase_order_id: string;     // UUID
  supplier_id: string;           // UUID
  location_id: string;           // UUID
  order_number: number;
  items: Array<{
    inventory_code: string;
    quantity: number;
    unit: string;
    unit_cost_cents: number;
  }>;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  expected_delivery_date?: string; // YYYY-MM-DD
  notes?: string;
}

// Cambio de estado de orden de compra
interface PurchaseOrderStatusChangedPayload {
  purchase_order_id: string;
  from_status: 'DRAFT' | 'SENT' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  to_status: 'DRAFT' | 'SENT' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';
}

// ============================================================================
// Goods Receipt Events (Fase 3)
// ============================================================================

// Recepción de mercadería
interface GoodsReceivedPayload {
  goods_receipt_id: string;      // UUID
  purchase_order_id?: string;    // UUID (opcional)
  location_id: string;           // UUID
  receipt_number: string;
  items: Array<{
    inventory_code: string;
    quantity_ordered: number;
    quantity_received: number;
    quantity_rejected: number;
    rejection_reason?: string;
    unit_cost_cents: number;
    lot_number?: string;
    expiry_date?: string;        // YYYY-MM-DD
  }>;
  received_by: string;           // UUID
  notes?: string;
}

// ============================================================================
// Inventory Control Events (Fase 4)
// ============================================================================

// Ajuste de inventario
interface InventoryAdjustedPayload {
  inventory_code: string;
  location_id: string;           // UUID
  from_qty: number;
  to_qty: number;
  reason: string;
  reference_type?: 'INVENTORY_COUNT' | 'MANUAL';
  reference_id?: string;         // UUID
}

// Registro de merma
interface WasteRecordedPayload {
  waste_log_id: string;          // UUID
  inventory_code: string;
  location_id: string;           // UUID
  quantity: number;
  unit: string;
  reason_code: 'EXPIRED' | 'DAMAGED' | 'THEFT' | 'PRODUCTION_LOSS' | 
               'REJECTED_ON_RECEIPT' | 'COUNT_ADJUSTMENT' | 'OTHER';
  reason_detail?: string;
  cost_cents: number;
  reported_by: string;           // UUID
  reference_type?: string;
  reference_id?: string;         // UUID
}

// Conteo de inventario completado
interface InventoryCountCompletedPayload {
  inventory_count_id: string;    // UUID
  location_id: string;           // UUID
  count_date: string;            // YYYY-MM-DD
  count_type: 'FULL' | 'PARTIAL' | 'SPOT';
  items: Array<{
    inventory_code: string;
    expected_qty: number;
    counted_qty: number;
    difference_qty: number;
    unit_cost_cents: number;
    notes?: string;
  }>;
  total_difference_cents: number;
  counted_by: string;            // UUID
  approved_by?: string;          // UUID
}

// ============================================================================
// Inventory Deduction Events (Fase 5)
// ============================================================================

// Deducción automática por venta
interface InventoryDeductedPayload {
  order_id: string;              // UUID
  line_id: string;
  product_id: string;
  location_id: string;           // UUID
  ingredients: Array<{
    inventory_code: string;
    quantity_deducted: number;
    new_stock: number;
  }>;
}
```

### Validación de Transiciones de Estado

```typescript
// Transiciones válidas para órdenes de compra
const VALID_PO_TRANSITIONS = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIAL_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],      // Estado terminal
  CANCELLED: [],     // Estado terminal
};
```

---

## 🔧 Servicios Implementados

> **Directorio**: `src/core/inventory/`

### 1. goods-receipt.service.ts
Maneja la recepción de mercadería.

```typescript
// Crear recepción (borrador)
createGoodsReceipt(prisma, {
  tenant_id, location_id, purchase_order_id?,
  receipt_number, received_by, items, notes?
}): Promise<{ success, goods_receipt_id?, error? }>

// Confirmar recepción (actualiza stock)
confirmGoodsReceipt(prisma, {
  tenant_id, location_id, goods_receipt_id, received_by
}): Promise<{ success, inventory_logs_created, waste_logs_created, errors }>
```

### 2. waste.service.ts
Registra mermas y pérdidas.

```typescript
// Registrar merma
recordWaste(prisma, {
  tenant_id, location_id, shift_id?, inventory_code,
  quantity, unit, reason_code, reason_detail?,
  reported_by, photo_url?, reference_type?, reference_id?
}): Promise<{ success, waste_log_id?, cost_cents?, error? }>

// Resumen de mermas por período
getWasteSummary(prisma, tenant_id, location_id, from_date, to_date)
  : Promise<{ total_cost_cents, by_reason, top_items }>
```

### 3. inventory-count.service.ts
Gestiona conteos físicos de inventario.

```typescript
// Iniciar conteo
startInventoryCount(prisma, {
  tenant_id, location_id, count_type, counted_by, inventory_codes?
}): Promise<{ success, inventory_count_id?, items_count?, error? }>

// Actualizar cantidades contadas
updateCountItems(prisma, inventory_count_id, items)
  : Promise<{ success, error? }>

// Enviar para aprobación
submitCountForApproval(prisma, inventory_count_id)
  : Promise<{ success, error? }>

// Aprobar conteo (ajusta stock)
approveInventoryCount(prisma, {
  tenant_id, inventory_count_id, approved_by
}): Promise<{ success, adjustments_made, total_difference_cents, errors }>
```

### 4. deduction.service.ts
Deduce inventario automáticamente por ventas.

```typescript
// Deducir por venta de producto
deductInventoryForOrder(prisma, tenantId, locationId, orderId, lineId, productId, quantity)
  : Promise<{ success, deductions, alerts, error? }>

// Deducción batch para múltiples items
deductInventoryForOrderItems(prisma, tenantId, locationId, orderId, items)
  : Promise<{ success, results }>

// Revertir deducción (para items anulados)
reverseDeduction(prisma, tenantId, orderId, lineId, productId, quantity)
  : Promise<{ success, error? }>
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

| Fase | Alcance | Estado |
|------|---------|--------|
| **1** | Modelo de datos + eventos básicos | ✅ Completado |
| **2** | Órdenes de compra (PurchaseOrder) | ✅ Schema + Eventos |
| **3** | Recepción de mercadería (GoodsReceipt) | ✅ Schema + Servicio |
| **4** | Conteo físico + ajustes + mermas | ✅ Schema + Servicios |
| **5** | Deducción automática por ventas | ✅ Servicio |
| **6** | Alertas y notificaciones | ⚠️ Solo schema |
| **7** | Transferencias entre locales | ⚠️ Solo schema |
| **8** | Reportes y COGS | ❌ Pendiente |
| **9** | Offline sync + conflictos | ❌ Pendiente |

### Archivos Implementados

```
src/core/inventory/
├── goods-receipt.service.ts     # Recepción de mercadería
├── waste.service.ts             # Registro de mermas
├── inventory-count.service.ts   # Conteos físicos
├── deduction.service.ts         # Deducción por ventas
└── __tests__/
    └── inventory-services.test.ts  # 12 tests unitarios

src/core/domain/
├── inventory-events.ts          # 7 tipos de eventos Zod
└── __tests__/
    └── inventory-events.test.ts # Tests de validación

src/app/admin/inventario/
└── page.tsx                     # Panel de administración
```

---

## ⚠️ Consideraciones Críticas

1. **Precisión decimal**: Usar `Decimal` de Prisma para cantidades fraccionarias (0.25 pollo)
2. **Costos en centavos**: SIEMPRE enteros, nunca float
3. **Timezone**: Corte de día a las 6AM para coincidir con turno
4. **Auditoría**: Todo movimiento debe tener actor_id
5. **Fotos de merma**: Obligatorias para ajustes > S/50

---

*Última actualización: 7 Enero 2026*
