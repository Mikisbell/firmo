# 🔄 FLUJO DE DEVOLUCIONES Y ANULACIONES — Diseño

> **Documento:** Diseño del sistema de devoluciones (no existe actualmente)  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Tipos de Devoluciones](#tipos-de-devoluciones)
3. [Escenarios Reales](#escenarios-reales)
4. [Diseño Propuesto](#diseño-propuesto)
5. [Eventos Necesarios](#eventos-necesarios)

---

## CONTEXTO DEL NEGOCIO

### ¿Por qué ocurren devoluciones en una pollería?

```
MOTIVOS COMUNES:
1. Producto defectuoso (pollo crudo, frío, quemado)
2. Error del cajero (cobró de más, producto equivocado)
3. Error del cliente (pidió algo que no quería)
4. Demora excesiva (cliente se va sin comer)
5. Insatisfacción general

FRECUENCIA ESTIMADA:
- 1-3% de las órdenes tienen algún tipo de devolución
- En pollería de 100 órdenes/día = 1-3 devoluciones diarias
```

### Regulación SUNAT (Perú)

```
NOTAS DE CRÉDITO:
- Obligatorias para anular facturas/boletas emitidas
- Deben referenciar el documento original
- Tienen numeración propia
- Deben emitirse en el mismo período tributario (idealmente)

TIPOS:
- NC por anulación total
- NC por devolución parcial
- NC por descuento posterior
```

---

## TIPOS DE DEVOLUCIONES

### Tipo 1: Anulación ANTES de Pago

```
SITUACIÓN:
Cliente pide 1/2 pollo, luego cancela antes de pagar.

FLUJO:
1. Orden creada con items
2. Cliente cancela
3. Cajero anula la orden completa
4. No hay movimiento de dinero
5. No hay documento fiscal

EVENTO: ORDER_CANCELLED
IMPACTO: Solo estadísticas (órdenes canceladas)
```

### Tipo 2: Anulación ANTES de Facturar (post-pago)

```
SITUACIÓN:
Cliente paga S/ 50, cajero se da cuenta que cobró de más.
Aún no emitió boleta.

FLUJO:
1. Orden pagada pero sin facturar
2. Cajero detecta error
3. Cajero anula el pago
4. Devuelve dinero al cliente
5. Registra nuevo pago correcto

EVENTO: PAYMENT_VOIDED + PAYMENT_ADDED
IMPACTO: Movimiento de caja (salida + entrada)
```

### Tipo 3: Devolución DESPUÉS de Facturar

```
SITUACIÓN:
Cliente pagó, recibió boleta, comió, pollo estaba crudo.
Pide devolución.

FLUJO:
1. Orden cerrada con boleta emitida
2. Cliente reclama
3. Administrador autoriza devolución
4. Cajero emite NOTA DE CRÉDITO
5. Cajero devuelve dinero
6. Se registra motivo

EVENTO: REFUND_ISSUED + CREDIT_NOTE_ISSUED
IMPACTO: Movimiento de caja + documento fiscal
```

### Tipo 4: Devolución Parcial

```
SITUACIÓN:
Cliente pidió 1/2 pollo + ensalada + gaseosa.
Ensalada estaba mala, pide devolución solo de ensalada.

FLUJO:
1. Orden cerrada con boleta por S/ 45
2. Cliente reclama ensalada (S/ 6)
3. Administrador autoriza
4. Cajero emite NC parcial por S/ 6
5. Cajero devuelve S/ 6
6. Boleta original sigue válida por S/ 39

EVENTO: PARTIAL_REFUND_ISSUED
IMPACTO: NC parcial + movimiento de caja
```

### Tipo 5: Cambio de Producto

```
SITUACIÓN:
Cliente pidió 1/4 pollo, quería 1/2 pollo.
Ya pagó y tiene boleta.

FLUJO:
1. Orden cerrada por S/ 18 (1/4)
2. Cliente quiere cambiar a S/ 32 (1/2)
3. Diferencia: S/ 14
4. Opciones:
   a) NC total + nueva boleta
   b) Cobrar diferencia (boleta adicional)

EVENTO: PRODUCT_EXCHANGED
IMPACTO: Depende de opción elegida
```

---

## ESCENARIOS REALES

### ESCENARIO D1: Pollo Crudo (Devolución Total)

```
SITUACIÓN:
- Cliente pidió 1/2 pollo + papas + gaseosa = S/ 43
- Pagó con Yape
- Recibió boleta #B001-00045
- Al comer, pollo estaba crudo por dentro
- Cliente furioso pide devolución total

FLUJO ESPERADO:
1. Mesero llama a administrador
2. Administrador verifica (ve el pollo)
3. Administrador autoriza devolución en sistema
4. Cajero busca orden #045
5. Cajero selecciona "Devolución Total"
6. Sistema pide:
   - Motivo: "Producto defectuoso - pollo crudo"
   - Autorizado por: [Admin selecciona su usuario]
   - Método de devolución: Efectivo (aunque pagó Yape)
7. Sistema genera:
   - REFUND_ISSUED (S/ 43)
   - CREDIT_NOTE_ISSUED (NC referencia B001-00045)
8. Cajero entrega S/ 43 en efectivo
9. Sistema registra salida de caja

ESTADO ACTUAL: ❌ NO EXISTE

EVENTOS NECESARIOS:
- REFUND_REQUESTED
- REFUND_AUTHORIZED
- REFUND_ISSUED
- CREDIT_NOTE_ISSUED
```

### ESCENARIO D2: Error de Cajero (Cobró de Más)

```
SITUACIÓN:
- Cliente pidió 1/4 pollo = S/ 18
- Cajero marcó 1/2 pollo = S/ 32
- Cliente pagó S/ 32 en efectivo
- Cajero emitió boleta
- Cliente revisa y reclama

FLUJO ESPERADO:
1. Cajero verifica el error
2. Cajero llama a supervisor (error > S/ 10)
3. Supervisor autoriza corrección
4. Cajero emite NC por S/ 32
5. Cajero crea nueva orden por S/ 18
6. Cajero emite nueva boleta por S/ 18
7. Cajero devuelve diferencia: S/ 14
8. Sistema registra:
   - NC por error de cajero
   - Nueva venta
   - Salida de caja S/ 14

ESTADO ACTUAL: ❌ NO EXISTE

COMPLEJIDAD:
- Requiere anular documento fiscal
- Requiere nueva venta
- Requiere autorización
- Afecta métricas del cajero
```

### ESCENARIO D3: Cliente Cancela Antes de Pagar

```
SITUACIÓN:
- Mesa 7 pidió: 2x 1/2 pollo, 4 gaseosas = S/ 78
- Cocina ya preparó los pollos
- Cliente recibe llamada urgente y se va
- No pagó nada

FLUJO ESPERADO:
1. Mesero informa a caja
2. Cajero busca orden de Mesa 7
3. Cajero selecciona "Anular Orden"
4. Sistema pide motivo: "Cliente se retiró"
5. Sistema genera ORDER_CANCELLED
6. Cocina recibe notificación (para no seguir preparando)
7. Producto preparado se registra como merma

ESTADO ACTUAL: ⚠️ PARCIAL
- Existe ORDER_CANCELLED en eventos
- NO hay flujo de merma
- NO hay notificación a cocina
```

### ESCENARIO D4: Devolución Parcial (Item Malo)

```
SITUACIÓN:
- Familia pidió:
  - 1 Pollo entero S/ 58
  - 2 Ensaladas S/ 12
  - 4 Gaseosas S/ 14
  - TOTAL: S/ 84
- Una ensalada estaba oxidada
- Piden devolución solo de esa ensalada (S/ 6)

FLUJO ESPERADO:
1. Mesero reporta problema
2. Administrador verifica
3. Administrador autoriza devolución parcial
4. Cajero busca orden
5. Cajero selecciona item "Ensalada"
6. Cajero marca "Devolución" en ese item
7. Sistema calcula: Devolución S/ 6
8. Sistema genera:
   - PARTIAL_REFUND_ISSUED
   - CREDIT_NOTE_ISSUED (NC parcial S/ 6)
9. Cajero devuelve S/ 6

ESTADO ACTUAL: ❌ NO EXISTE

COMPLEJIDAD:
- NC parcial debe referenciar boleta original
- Boleta original sigue válida por S/ 78
- Item devuelto debe marcarse en el sistema
```

### ESCENARIO D5: Devolución al Día Siguiente

```
SITUACIÓN:
- Cliente compró ayer a las 9 PM
- Hoy a las 11 AM regresa
- Dice que el pollo le cayó mal
- Quiere devolución

FLUJO ESPERADO:
1. Cliente muestra boleta de ayer
2. Administrador evalúa (política de devoluciones)
3. Si autoriza:
   - Buscar orden por número de boleta
   - Verificar que no tenga devolución previa
   - Procesar devolución normal
4. Si rechaza:
   - Registrar reclamo rechazado
   - Ofrecer alternativa (descuento futuro)

ESTADO ACTUAL: ❌ NO EXISTE

COMPLEJIDAD:
- Orden de ayer puede estar en otro turno
- Cajero de hoy no es el mismo
- NC en período diferente (contabilidad)
- Política de tiempo límite para devoluciones
```

### ESCENARIO D6: Devolución con Pago Mixto

```
SITUACIÓN:
- Cliente pagó S/ 100:
  - S/ 50 efectivo
  - S/ 50 Yape
- Pide devolución total

FLUJO ESPERADO:
1. Sistema muestra métodos de pago originales
2. Cajero decide método de devolución:
   - Opción A: Todo en efectivo (S/ 100)
   - Opción B: Proporcional (S/ 50 efectivo + S/ 50 Yape)
   - Opción C: Todo a Yape (si cliente prefiere)
3. Sistema registra método de devolución
4. Cajero ejecuta devolución

ESTADO ACTUAL: ❌ NO EXISTE

COMPLEJIDAD:
- Yape no tiene "devolución" automática
- Cajero debe hacer transferencia manual
- Registro debe indicar método de devolución
```

---

## DISEÑO PROPUESTO

### Modelo de Datos

```typescript
// Nuevo aggregate: REFUND
interface Refund {
  refund_id: string;
  tenant_id: string;
  order_id: string;           // Orden original
  check_id: string;           // Check original
  invoice_id?: string;        // Factura/boleta original
  
  type: "FULL" | "PARTIAL" | "VOID";
  status: "REQUESTED" | "AUTHORIZED" | "ISSUED" | "REJECTED";
  
  reason_code: RefundReasonCode;
  reason_detail?: string;
  
  requested_by: string;       // Actor que solicitó
  authorized_by?: string;     // Actor que autorizó
  
  original_amount_cents: number;
  refund_amount_cents: number;
  
  refund_method: PaymentMethod;
  refund_reference?: string;  // Ej: número de Yape
  
  items?: RefundItem[];       // Para devoluciones parciales
  
  credit_note_id?: string;    // NC emitida
  
  created_at: string;
  authorized_at?: string;
  issued_at?: string;
}

type RefundReasonCode = 
  | "PRODUCT_DEFECTIVE"      // Producto malo
  | "WRONG_PRODUCT"          // Producto equivocado
  | "CASHIER_ERROR"          // Error del cajero
  | "CUSTOMER_CANCELLED"     // Cliente canceló
  | "EXCESSIVE_WAIT"         // Demora excesiva
  | "CUSTOMER_DISSATISFIED"  // Insatisfacción
  | "DUPLICATE_CHARGE"       // Cobro duplicado
  | "OTHER";

interface RefundItem {
  line_id: string;
  qty: number;
  amount_cents: number;
  reason?: string;
}
```

### Eventos Necesarios

```typescript
// 1. Solicitud de devolución
interface RefundRequestedPayload {
  refund_id: string;
  order_id: string;
  check_id: string;
  type: "FULL" | "PARTIAL";
  reason_code: RefundReasonCode;
  reason_detail?: string;
  requested_amount_cents: number;
  items?: RefundItem[];
}

// 2. Autorización (si requiere)
interface RefundAuthorizedPayload {
  refund_id: string;
  authorized_by: string;
  authorized_amount_cents: number;
  notes?: string;
}

// 3. Rechazo
interface RefundRejectedPayload {
  refund_id: string;
  rejected_by: string;
  rejection_reason: string;
}

// 4. Emisión de devolución
interface RefundIssuedPayload {
  refund_id: string;
  order_id: string;
  refund_amount_cents: number;
  refund_method: PaymentMethod;
  refund_reference?: string;
}

// 5. Nota de crédito
interface CreditNoteIssuedPayload {
  credit_note_id: string;
  refund_id: string;
  order_id: string;
  original_invoice_id: string;
  series: string;
  number: number;
  amount_cents: number;
  reason: string;
}
```

### Flujo de Estados

```
                    ┌─────────────┐
                    │  REQUESTED  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            │            ▼
       ┌──────────┐        │     ┌──────────┐
       │ REJECTED │        │     │AUTO-AUTH │ (monto < límite)
       └──────────┘        │     └────┬─────┘
                           │          │
                           ▼          │
                    ┌─────────────┐   │
                    │ AUTHORIZED  │<──┘
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   ISSUED    │
                    └─────────────┘
```

### Reglas de Autorización

```typescript
const REFUND_RULES = {
  // Devoluciones que NO requieren autorización
  auto_approve: {
    max_amount_cents: 2000,        // Hasta S/ 20
    allowed_reasons: [
      "CASHIER_ERROR",
      "DUPLICATE_CHARGE"
    ],
    max_per_shift: 3,              // Máximo 3 auto-aprobadas por turno
  },
  
  // Devoluciones que requieren supervisor
  supervisor_required: {
    min_amount_cents: 2001,
    max_amount_cents: 10000,       // S/ 20 - S/ 100
  },
  
  // Devoluciones que requieren administrador
  admin_required: {
    min_amount_cents: 10001,       // > S/ 100
    reasons: ["CUSTOMER_DISSATISFIED", "OTHER"],
  },
  
  // Límites globales
  limits: {
    max_refund_age_hours: 72,      // Máximo 3 días después
    max_refunds_per_order: 1,      // Solo 1 devolución por orden
    daily_refund_limit_cents: 50000, // S/ 500/día máximo
  }
};
```

### UI Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESAR DEVOLUCIÓN                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Orden: #045                    Fecha: 05/01/2026 14:30     │
│  Cliente: Mesa 7                Cajero: María               │
│  Boleta: B001-00045                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ITEMS DE LA ORDEN                                    │   │
│  │ ☑ 1/2 Pollo c/papas          S/ 32.00    [DEVOLVER] │   │
│  │ ☐ Gaseosa 1.5L               S/  8.00               │   │
│  │ ☐ Ensalada                   S/  6.00               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TOTAL ORDEN:        S/ 46.00                               │
│  A DEVOLVER:         S/ 32.00                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MOTIVO DE DEVOLUCIÓN                                 │   │
│  │ ○ Producto defectuoso                                │   │
│  │ ● Error del cajero                                   │   │
│  │ ○ Cliente canceló                                    │   │
│  │ ○ Otro: [________________]                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MÉTODO DE DEVOLUCIÓN                                 │   │
│  │ ● Efectivo                                           │   │
│  │ ○ Yape (requiere número)                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ Requiere autorización de SUPERVISOR (monto > S/ 20)    │
│                                                             │
│  [CANCELAR]                    [SOLICITAR AUTORIZACIÓN]     │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPACTO EN OTROS MÓDULOS

### Turno/Caja

```typescript
// shift.reducer.ts debe manejar:
case "REFUND_ISSUED": {
  const { refund_amount_cents, refund_method } = payload;
  
  if (refund_method === "CASH") {
    shift.cash_refunds_out_cents += refund_amount_cents;
    shift.expected_cash_cents = recomputeExpected(shift);
  }
  
  shift.refunds_count++;
  shift.refunds_total_cents += refund_amount_cents;
}
```

### Reportes

```
REPORTE DE CIERRE DE TURNO:
- Ventas brutas: S/ 2,500
- Devoluciones: -S/ 45 (2 devoluciones)
- Ventas netas: S/ 2,455

REPORTE DE DEVOLUCIONES:
| Hora  | Orden | Monto | Motivo           | Autorizado |
|-------|-------|-------|------------------|------------|
| 13:45 | #045  | S/ 32 | Producto malo    | Admin      |
| 16:20 | #078  | S/ 13 | Error cajero     | Auto       |
```

### Inventario (Futuro)

```
Si se devuelve producto:
- ¿Vuelve a inventario? (gaseosa cerrada)
- ¿Se registra como merma? (pollo preparado)
- ¿Se descuenta de producción?
```

---

## PRIORIDADES DE IMPLEMENTACIÓN

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Anulación pre-pago | Alto | 2h | 🔴 P0 |
| 2 | Devolución total post-factura | Alto | 8h | 🔴 P0 |
| 3 | Autorización por niveles | Medio | 4h | 🟡 P1 |
| 4 | Devolución parcial | Medio | 6h | 🟡 P1 |
| 5 | Nota de crédito SUNAT | Alto | 8h | 🟡 P1 |
| 6 | Reportes de devoluciones | Bajo | 4h | 🟢 P2 |

---

**Documento creado:** Enero 2026
