# 🧑‍💼 FLUJO DEL CAJERO — Análisis Detallado

> **Documento:** Análisis profundo del módulo de caja con escenarios reales de pollería  
> **Fecha:** Enero 2026  
> **Estado:** Análisis pre-implementación

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Flujo Actual vs Esperado](#flujo-actual-vs-esperado)
3. [Escenarios Reales](#escenarios-reales)
4. [Problemas Detectados](#problemas-detectados)
5. [Soluciones Propuestas](#soluciones-propuestas)

---

## CONTEXTO DEL NEGOCIO

### Perfil de una Pollería Típica

```
HORARIO: 11:00 AM - 11:00 PM (12 horas)
TURNOS:  2 turnos de 6 horas cada uno
         - Turno 1: 11:00 - 17:00 (almuerzo)
         - Turno 2: 17:00 - 23:00 (cena)

PERSONAL:
- 1 cajero por turno
- 3-15 meseros
- 2-6 cocineros
- 1 administrador (supervisa ambos turnos)

VOLUMEN DIARIO:
- 80-350 órdenes/día
- Ticket promedio: S/ 45-80
- Pico: 12:00-14:00 y 19:00-21:00

MÉTODOS DE PAGO:
- Efectivo: 60%
- Yape/Plin: 30%
- Tarjeta: 10%
```

### Productos Típicos

| Producto | Precio | Frecuencia |
|----------|--------|------------|
| 1/4 Pollo + papas | S/ 18.00 | Alta |
| 1/2 Pollo + papas | S/ 32.00 | Alta |
| Pollo entero + papas | S/ 58.00 | Media |
| Gaseosa personal | S/ 3.50 | Alta |
| Gaseosa 1.5L | S/ 8.00 | Media |
| Ensalada | S/ 6.00 | Baja |
| Ají/Cremas extra | S/ 1.00 | Alta |

---

## FLUJO ACTUAL VS ESPERADO

### Flujo del Día Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DÍA OPERATIVO                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  10:45 AM                                                           │
│  ┌──────────────────┐                                               │
│  │ APERTURA TURNO 1 │                                               │
│  │ Cajero: María    │                                               │
│  │ Fondo: S/ 200    │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  11:00 - 17:00: OPERACIÓN TURNO 1                                   │
│  ├── Ventas                                                         │
│  ├── Cobros (efectivo, Yape, tarjeta)                               │
│  ├── Movimientos de caja (cambio, gastos menores)                   │
│  └── Anulaciones/Devoluciones                                       │
│           │                                                         │
│           ▼                                                         │
│  17:00                                                              │
│  ┌──────────────────┐                                               │
│  │ CIERRE TURNO 1   │                                               │
│  │ Arqueo de caja   │                                               │
│  │ Entrega a T2     │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │ APERTURA TURNO 2 │                                               │
│  │ Cajero: Pedro    │                                               │
│  │ Recibe de T1     │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  17:00 - 23:00: OPERACIÓN TURNO 2                                   │
│           │                                                         │
│           ▼                                                         │
│  23:00                                                              │
│  ┌──────────────────┐                                               │
│  │ CIERRE TURNO 2   │                                               │
│  │ Arqueo final     │                                               │
│  │ Depósito/Caja    │                                               │
│  └──────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ESCENARIOS REALES

### ESCENARIO 1: Apertura de Turno Normal

**Contexto:** María llega a las 10:45 AM para abrir el turno de almuerzo.

```
PASOS ESPERADOS:
1. María se identifica en el sistema (login)
2. Sistema verifica que no hay turno abierto en este terminal
3. María cuenta el fondo de caja: S/ 200.00
4. María ingresa el monto en el sistema
5. Sistema genera evento SHIFT_OPENED
6. Sistema muestra: "Turno abierto - Fondo: S/ 200.00"

ESTADO ACTUAL DEL CÓDIGO:
✅ Modal de apertura existe (ShiftModal.tsx)
✅ Evento SHIFT_OPENED se genera
❌ NO hay login de cajero (ACTOR_ID hardcodeado)
❌ NO verifica si ya hay turno abierto en OTRO terminal
❌ NO hay confirmación visual del fondo ingresado
```

**Problema Real:**
```
María abre turno con S/ 200
Pedro (en otro terminal) también abre turno con S/ 200
→ Sistema tiene 2 turnos abiertos simultáneos
→ Al cerrar, ¿cuál es el correcto?
→ Arqueo imposible de cuadrar
```

---

### ESCENARIO 2: Venta Simple con Efectivo

**Contexto:** Cliente pide 1/2 pollo + gaseosa. Paga con S/ 50.

```
FLUJO ESPERADO:
1. Cajero selecciona: 1/2 Pollo (S/ 32.00)
2. Cajero selecciona: Gaseosa 1.5L (S/ 8.00)
3. Sistema muestra: Total S/ 40.00
4. Cajero presiona COBRAR
5. Cajero selecciona EFECTIVO
6. Cajero ingresa: S/ 50.00
7. Sistema calcula: Cambio S/ 10.00
8. Sistema muestra: "Entregar S/ 10.00 de cambio"
9. Cajero confirma entrega de cambio
10. Sistema genera: CHECK_PAYMENT_ADDED + CHECK_MARKED_PAID
11. Sistema actualiza turno: +S/ 50 ventas, -S/ 10 cambio
12. Cajero emite boleta

ESTADO ACTUAL DEL CÓDIGO:
✅ Selección de productos funciona
✅ Modal de pago existe
✅ Evento CHECK_PAYMENT_ADDED se genera
❌ CAMBIO SIEMPRE ES 0 (bug crítico en page.tsx línea ~100)
❌ NO hay pantalla de "entregar cambio"
❌ NO hay confirmación de cambio entregado
```

**Código Problemático:**
```typescript
// src/app/(pos)/page.tsx - línea ~100
await POSActions.markCheckPaid(
  TENANT_ID, TERM_ID, ACTOR_ID, 
  activeSale.order_id, 
  activeCheck.check_id
  // change_cents NO SE PASA! Default = 0
);
```

**Impacto en Arqueo:**
```
ESCENARIO: 10 ventas de S/ 40, todas pagadas con S/ 50

REAL:
- Ventas en efectivo: S/ 400
- Cambio entregado: S/ 100
- Efectivo en caja: S/ 200 (fondo) + S/ 400 - S/ 100 = S/ 500

SISTEMA (BUG):
- Ventas en efectivo: S/ 500 (registra lo que recibe, no lo que cobra)
- Cambio entregado: S/ 0
- Esperado en caja: S/ 200 + S/ 500 = S/ 700

DIFERENCIA: -S/ 200 (¡FALTANTE FALSO!)
```

---

### ESCENARIO 3: Venta con Pago Mixto

**Contexto:** Grupo de 4 personas. Total S/ 120. Pagan S/ 50 efectivo + S/ 70 Yape.

```
FLUJO ESPERADO:
1. Cajero agrega items, total S/ 120.00
2. Cajero presiona COBRAR
3. Primer pago: EFECTIVO S/ 50.00
4. Sistema muestra: Pagado S/ 50, Resta S/ 70
5. Segundo pago: YAPE S/ 70.00
6. Sistema muestra: Pagado S/ 120, Resta S/ 0
7. Sistema marca como PAGADO automáticamente
8. Cajero emite boleta

ESTADO ACTUAL:
✅ Pagos parciales funcionan
✅ Barra de progreso muestra avance
✅ Se puede pagar con múltiples métodos
⚠️ NO hay validación de referencia Yape (número de operación)
⚠️ NO hay límite de pagos por orden
```

**Problema Potencial:**
```
Cajero malicioso:
1. Cobra S/ 120 en efectivo al cliente
2. Registra S/ 120 como YAPE (no entra a caja)
3. Se queda con S/ 120

→ Sin referencia de Yape, no hay forma de auditar
```

---

### ESCENARIO 4: División de Cuenta (Split Bill)

**Contexto:** Mesa de 4 amigos quiere pagar por separado.

```
PEDIDO TOTAL:
- 4x 1/4 Pollo (S/ 18 c/u) = S/ 72
- 4x Gaseosa (S/ 3.50 c/u) = S/ 14
- 1x Ensalada (S/ 6) = S/ 6
TOTAL: S/ 92

DIVISIÓN DESEADA:
- Persona 1: 1/4 pollo + gaseosa = S/ 21.50
- Persona 2: 1/4 pollo + gaseosa = S/ 21.50
- Persona 3: 1/4 pollo + gaseosa + ensalada = S/ 27.50
- Persona 4: 1/4 pollo + gaseosa = S/ 21.50

FLUJO ESPERADO:
1. Cajero abre modal DIVIDIR
2. Cajero crea 3 sub-cuentas adicionales
3. Cajero arrastra items a cada cuenta
4. Cada persona paga su cuenta
5. Sistema emite 4 boletas separadas

ESTADO ACTUAL:
✅ SplitBillModal existe y funciona básicamente
✅ Se pueden crear sub-cuentas
✅ Se pueden mover items entre cuentas
⚠️ UI confusa (botones pequeños para mover)
⚠️ NO hay opción "dividir equitativamente"
⚠️ NO hay vista previa de totales por cuenta
❌ NO se puede dividir un item (ej: 1 pollo entre 2)
```

---

### ESCENARIO 5: Anulación de Item (UNDO)

**Contexto:** Cajero agregó pollo por error, cliente solo quería gaseosa.

```
FLUJO ESPERADO:
1. Cajero tiene: Pollo S/ 32 + Gaseosa S/ 8 = S/ 40
2. Cajero presiona UNDO
3. Sistema elimina último item (Gaseosa)
4. Cajero presiona UNDO otra vez
5. Sistema elimina Pollo
6. Cajero agrega solo Gaseosa
7. Total: S/ 8

ESTADO ACTUAL:
✅ Botón UNDO existe
✅ Evento ORDER_ITEM_VOIDED se genera
✅ Item se elimina de la orden
⚠️ UNDO elimina el ÚLTIMO item, no el incorrecto
⚠️ NO hay forma de seleccionar qué item anular
⚠️ NO hay confirmación antes de anular
```

**Problema Real:**
```
Orden: Pollo, Gaseosa, Ensalada, Ají
Cajero quiere anular Gaseosa (error)

Con UNDO actual:
- Click 1: Elimina Ají
- Click 2: Elimina Ensalada
- Click 3: Elimina Gaseosa ✓
- Pero ya eliminó 2 items correctos!

Solución necesaria: Click en item específico → Anular
```

---

### ESCENARIO 6: Cierre de Turno con Descuadre

**Contexto:** María cierra turno. Esperado S/ 850, cuenta S/ 820.

```
FLUJO ESPERADO:
1. María presiona "Cerrar Turno"
2. Sistema muestra resumen:
   - Fondo inicial: S/ 200
   - Ventas efectivo: S/ 680
   - Cambios dados: -S/ 45
   - Movimientos: +S/ 15 (ingreso) -S/ 0 (salidas)
   - ESPERADO: S/ 850
3. María cuenta físicamente: S/ 820
4. María ingresa S/ 820
5. Sistema muestra: DIFERENCIA -S/ 30 (FALTANTE)
6. Sistema pide: "Ingrese motivo del descuadre"
7. María escribe: "Posible error en cambio mesa 5"
8. Sistema genera SHIFT_CLOSED con variance_cents = -3000
9. Sistema notifica a administrador

ESTADO ACTUAL:
✅ Modal de cierre existe
✅ Muestra esperado vs contado
✅ Calcula diferencia
❌ NO muestra desglose de ventas
❌ NO muestra movimientos del turno
❌ NO requiere motivo si hay descuadre
❌ NO notifica a administrador
❌ Esperado está MAL por bug del cambio
```

---

### ESCENARIO 7: Devolución/Reembolso

**Contexto:** Cliente regresa, pollo estaba crudo. Pide devolución.

```
FLUJO ESPERADO:
1. Administrador autoriza devolución
2. Cajero busca la orden original (#045)
3. Cajero selecciona "Devolución"
4. Sistema pide: Motivo + Autorización
5. Cajero ingresa: "Pollo crudo" + PIN admin
6. Sistema genera: REFUND_ISSUED
7. Sistema registra salida de caja: -S/ 32
8. Sistema imprime comprobante de devolución

ESTADO ACTUAL:
❌ NO existe flujo de devolución
❌ NO hay búsqueda de órdenes anteriores
❌ NO hay evento REFUND_ISSUED
❌ NO hay autorización de admin
```

---

### ESCENARIO 8: Corte de Luz / Caída del Sistema

**Contexto:** Se va la luz en medio de una venta.

```
SITUACIÓN:
- Orden #067 tiene 3 items (S/ 58)
- Cliente ya entregó S/ 60 en efectivo
- Cajero iba a dar cambio cuando se fue la luz

FLUJO ESPERADO:
1. Sistema guarda estado en IndexedDB (offline-first)
2. Luz regresa, sistema se reinicia
3. Sistema recupera orden #067 en estado "PAGO PENDIENTE"
4. Cajero completa la transacción
5. Sistema sincroniza cuando hay conexión

ESTADO ACTUAL:
✅ IndexedDB guarda eventos localmente
✅ Eventos se sincronizan al reconectar
⚠️ orderNumberCounter se reinicia a 1 (COLISIÓN)
⚠️ Estado de UI no persiste (currentOrder = null)
❌ NO hay indicador de "orden recuperada"
```

**Problema Crítico:**
```
ANTES de corte:
- Orden #067 creada
- orderNumberCounter = 68

DESPUÉS de reinicio:
- orderNumberCounter = 1 (variable en memoria)
- Nueva orden = #001
- COLISIÓN con orden #001 del inicio del día
```

---

### ESCENARIO 9: Hora Pico (Estrés del Sistema)

**Contexto:** 12:30 PM, cola de 15 personas, 3 meseros enviando pedidos.

```
SITUACIÓN SIMULTÁNEA:
- Terminal Caja: Cobrando orden #045
- Terminal Mesero 1: Enviando orden #046
- Terminal Mesero 2: Modificando orden #043
- Terminal Mesero 3: Enviando orden #047
- KDS: Marcando items listos de #040, #041, #042

PROBLEMAS POTENCIALES:
1. Números de orden: ¿Quién asigna #046 vs #047?
2. Sincronización: ¿Eventos llegan en orden?
3. Conflictos: ¿Qué pasa si 2 modifican #043?
4. Performance: ¿IndexedDB aguanta?

ESTADO ACTUAL:
❌ Order numbers en memoria por terminal = COLISIONES
❌ Sin conflict resolution
⚠️ Sync es eventual, no garantiza orden
⚠️ Sin rate limiting, servidor puede saturarse
```

---

### ESCENARIO 10: Descuento Autorizado

**Contexto:** Cliente frecuente, gerente autoriza 15% de descuento.

```
FLUJO ESPERADO:
1. Orden total: S/ 80
2. Cajero presiona "Aplicar Descuento"
3. Cajero selecciona: 15%
4. Sistema detecta: > 10% requiere autorización
5. Sistema pide: PIN de gerente
6. Gerente ingresa PIN
7. Sistema aplica descuento: -S/ 12
8. Nuevo total: S/ 68
9. Evento: ORDER_DISCOUNT_APPLIED con authorized_by

ESTADO ACTUAL:
❌ NO hay UI para descuentos
❌ NO hay evento ORDER_DISCOUNT_APPLIED
❌ NO hay sistema de autorización
❌ NO hay límites configurables
```

---

## PROBLEMAS DETECTADOS

### Críticos (Pérdida de Dinero) 🔴

| # | Problema | Impacto | Archivo |
|---|----------|---------|---------|
| 1 | Cambio siempre = 0 | Arqueo incorrecto | page.tsx:100 |
| 2 | Order numbers en memoria | Colisiones | page.tsx:15 |
| 3 | IDs hardcodeados | Sin trazabilidad | page.tsx:10-12 |
| 4 | Sin validación server | Fraude posible | ingest/route.ts |

### Importantes (Operación) 🟡

| # | Problema | Impacto | Archivo |
|---|----------|---------|---------|
| 5 | Sin login cajero | Sin auditoría | page.tsx |
| 6 | Sin devoluciones | Proceso manual | - |
| 7 | Sin descuentos | Proceso manual | - |
| 8 | UNDO no selectivo | UX pobre | page.tsx:150 |
| 9 | Sin resumen cierre | Arqueo difícil | ShiftModal.tsx |

### Menores (UX) 🟢

| # | Problema | Impacto | Archivo |
|---|----------|---------|---------|
| 10 | Sin búsqueda productos | Lento en pico | CatalogGrid.tsx |
| 11 | Sin reimpresión | Soporte manual | - |
| 12 | Split sin división | Limitado | SplitBillModal.tsx |

---

## SOLUCIONES PROPUESTAS

### Solución 1: Cálculo de Cambio

```typescript
// ANTES (page.tsx)
const handlePayment = async (method, amountCents) => {
  await POSActions.addPayment(...);
  await POSActions.markCheckPaid(...); // change_cents = 0
};

// DESPUÉS
const handlePayment = async (method, amountCents) => {
  await POSActions.addPayment(...);
  
  const newPaidTotal = currentPaid + amountCents;
  const changeCents = Math.max(0, newPaidTotal - check.total_cents);
  
  if (newPaidTotal >= check.total_cents) {
    // Mostrar modal de cambio si es efectivo
    if (method === 'CASH' && changeCents > 0) {
      setChangeToGive(changeCents);
      setShowChangeModal(true);
      // markCheckPaid se llama después de confirmar cambio
    } else {
      await POSActions.markCheckPaid(..., changeCents);
    }
  }
};
```

### Solución 2: Order Numbers con Range Allocation

Ver `IMPLEMENTACION_PASO_A_PASO.md` Fase 4.

### Solución 3: Identificación de Terminal/Cajero

```typescript
// Obtener de localStorage o contexto de sesión
const getTerminalConfig = () => {
  const config = localStorage.getItem('terminal_config');
  if (!config) {
    // Redirigir a setup
    window.location.href = '/setup';
    return null;
  }
  return JSON.parse(config);
};

// En page.tsx
const config = getTerminalConfig();
const TENANT_ID = config.tenant_id;
const TERM_ID = config.terminal_id;
const ACTOR_ID = session?.user?.id; // De auth
```

### Solución 4: Anulación Selectiva

```typescript
// Agregar a CheckDetail.tsx
const handleVoidItem = async (lineId: string) => {
  const confirmed = await showConfirm(
    '¿Anular este item?',
    `Se eliminará ${getItemName(lineId)} de la orden`
  );
  
  if (confirmed) {
    await POSActions.voidItem(
      tenantId, terminalId, actorId,
      order.order_id, lineId, 'MANUAL_VOID'
    );
    toast.success('Item anulado');
  }
};

// En el render de cada item, agregar botón de anular
<button onClick={() => handleVoidItem(line.line_id)}>
  <Trash2 size={14} />
</button>
```

---

## PRÓXIMOS PASOS

1. **Inmediato:** Corregir bug de cambio (1 hora)
2. **Corto plazo:** Implementar Range Allocation para order numbers (4 horas)
3. **Medio plazo:** Sistema de login/autenticación de cajero (8 horas)
4. **Largo plazo:** Flujo completo de devoluciones y descuentos (16 horas)

---

**Documento creado:** Enero 2026  
**Última actualización:** Enero 2026


---

# 🍽️ FLUJO DEL MESERO — Análisis

## Contexto

El mesero usa una tablet/celular para:
1. Ver estado de mesas
2. Tomar pedidos
3. Enviar a cocina
4. Modificar pedidos
5. Solicitar cuenta

## Escenarios Reales

### ESCENARIO M1: Tomar Pedido Nueva Mesa

```
FLUJO ESPERADO:
1. Mesero ve mapa de mesas (Piso 1, 2, Terraza)
2. Mesa 4 está verde (disponible)
3. Mesero toca Mesa 4
4. Sistema abre pantalla de pedido
5. Mesero agrega: 2x 1/2 Pollo, 2x Gaseosa
6. Mesero presiona "Enviar a Cocina"
7. Sistema genera ORDER_CREATED + ORDER_ITEM_ADDED
8. KDS recibe el pedido
9. Mesa 4 cambia a azul (ocupada)

ESTADO ACTUAL:
✅ Mapa de mesas existe
✅ Navegación a /waiter/order/[tableId]
✅ useTableStatus detecta mesas ocupadas
⚠️ Terminal ID hardcodeado (T-01)
⚠️ Sin identificación de mesero
❌ No vi la página de tomar pedido (/waiter/order/[tableId])
```

### ESCENARIO M2: Modificar Pedido Existente

```
FLUJO ESPERADO:
1. Cliente en Mesa 4 pide agregar ensalada
2. Mesero toca Mesa 4 (azul/ocupada)
3. Sistema muestra pedido actual
4. Mesero agrega: 1x Ensalada
5. Sistema genera ORDER_ITEM_ADDED
6. KDS recibe nuevo item
7. Total de mesa se actualiza

ESTADO ACTUAL:
✅ useOrder.ts reconstruye estado de orden
⚠️ Depende de aggregate_id index (no existe en schema)
⚠️ Reconstruye TODA la orden cada vez (lento)
```

### ESCENARIO M3: Cliente Pide la Cuenta

```
FLUJO ESPERADO:
1. Mesero presiona "Pedir Cuenta" en Mesa 4
2. Sistema notifica a Caja
3. Cajero ve alerta: "Mesa 4 solicita cuenta"
4. Cajero prepara pre-cuenta
5. Mesero lleva pre-cuenta a mesa

ESTADO ACTUAL:
❌ NO hay botón "Pedir Cuenta"
❌ NO hay notificación a Caja
❌ NO hay evento REQUEST_CHECK
```

## Problemas del Mesero

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Sin login mesero | Sin comisiones/propinas |
| 2 | Terminal hardcodeado | Todos son "T-01" |
| 3 | Sin notificación a caja | Proceso manual |
| 4 | Query lenta (full scan) | Lag en hora pico |

---

# 👨‍🍳 FLUJO DEL KDS (COCINA) — Análisis

## Contexto

El KDS (Kitchen Display System) muestra pedidos a cocina:
1. Tickets con items pendientes
2. Estados: PENDING → COOKING → READY → DONE
3. Filtro por estación (Cocina, Parrilla, Bar)
4. Tiempo transcurrido

## Escenarios Reales

### ESCENARIO K1: Nuevo Pedido Llega

```
FLUJO ESPERADO:
1. Mesero envía pedido Mesa 4
2. KDS muestra nuevo ticket #067
3. Ticket tiene: 2x 1/2 Pollo, 2x Gaseosa
4. Items en estado PENDING (gris)
5. Cocinero toca "1/2 Pollo"
6. Estado cambia a COOKING (verde animado)
7. Timer empieza a contar

ESTADO ACTUAL:
✅ Tickets se muestran correctamente
✅ Estados visuales funcionan
✅ Click cambia estado
✅ Filtro por estación
⚠️ Timer no funciona (getElapsedTime recibe null)
⚠️ IDs hardcodeados (kds_1, actor chef)
```

### ESCENARIO K2: Item Listo para Servir

```
FLUJO ESPERADO:
1. Cocinero termina 1/2 Pollo
2. Cocinero toca item (estado COOKING)
3. Estado cambia a READY
4. Sistema notifica a Mesero: "Mesa 4 - 1/2 Pollo listo"
5. Mesero recoge y sirve
6. Mesero marca como DONE (o automático)

ESTADO ACTUAL:
✅ Cambio a READY funciona
❌ NO hay notificación a mesero
❌ NO hay forma de marcar DONE desde mesero
⚠️ DONE solo desde KDS
```

### ESCENARIO K3: Hora Pico - Múltiples Pedidos

```
SITUACIÓN:
- 10 tickets activos
- 30+ items pendientes
- 3 cocineros trabajando

PROBLEMAS POTENCIALES:
1. Performance: useKitchenTickets hace full scan de eventos
2. Memoria: Reconstruye TODAS las órdenes cada render
3. Sin priorización: No distingue pedidos urgentes
4. Sin asignación: No sabe qué cocinero hace qué

ESTADO ACTUAL:
⚠️ Full scan de eventos ORDER (O(n) donde n = todos los eventos)
⚠️ Reconstruye estado de CADA orden
⚠️ Sin filtro por fecha (carga histórico)
❌ Sin priorización
❌ Sin asignación de cocinero
```

**Código Problemático:**
```typescript
// useKitchenTickets.ts
const events = await db.events
  .where("aggregate_type")
  .equals("ORDER")
  .toArray(); // TODOS los eventos ORDER de la historia!

// Luego reconstruye CADA orden
for (const orderId in eventsByOrder) {
  // Replay completo...
}
```

### ESCENARIO K4: Item Agotado

```
FLUJO ESPERADO:
1. Cocinero ve que no hay ensalada
2. Cocinero marca "Ensalada" como AGOTADO
3. Sistema notifica a Mesero
4. Mesero informa a cliente
5. Cliente decide: cambiar o cancelar item
6. Sistema actualiza orden

ESTADO ACTUAL:
❌ NO hay estado "AGOTADO" / "86'd"
❌ NO hay notificación de agotados
❌ NO hay flujo de sustitución
```

## Problemas del KDS

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Full scan eventos | Lento con historial |
| 2 | Sin filtro fecha | Carga todo |
| 3 | Timer roto | UX incompleta |
| 4 | Sin notificaciones | Comunicación manual |
| 5 | Sin priorización | Caos en pico |
| 6 | Sin "agotado" | Proceso manual |

---

# 🔄 INTERACCIÓN ENTRE ACTORES

## Flujo Completo de una Orden

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ MESERO  │     │   KDS   │     │ MESERO  │     │  CAJA   │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ ORDER_CREATED │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │ ITEM_ADDED    │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ STATUS→COOKING               │
     │               │───────────────│               │
     │               │               │               │
     │               │ STATUS→READY  │               │
     │               │──────────────>│ (notificación)│
     │               │               │               │
     │               │               │ ITEM→DONE     │
     │               │<──────────────│               │
     │               │               │               │
     │               │               │ REQUEST_CHECK │
     │               │               │──────────────>│
     │               │               │               │
     │               │               │               │ PAYMENT
     │               │               │               │────┐
     │               │               │               │    │
     │               │               │               │<───┘
     │               │               │               │
     │               │               │               │ INVOICE
     │               │               │               │────┐
     │               │               │               │<───┘
```

## Eventos Faltantes

| Evento | Propósito | Estado |
|--------|-----------|--------|
| REQUEST_CHECK | Mesero pide cuenta | ❌ No existe |
| ITEM_OUT_OF_STOCK | Cocina marca agotado | ❌ No existe |
| WAITER_NOTIFIED | KDS notifica mesero | ❌ No existe |
| ORDER_TRANSFERRED | Cambio de mesero | ❌ No existe |

---

# 📊 RESUMEN DE GAPS POR ACTOR

## Cajero (Caja)
- 🔴 Cambio siempre 0
- 🔴 Order numbers colisionan
- 🔴 Sin login
- 🟡 Sin descuentos
- 🟡 Sin devoluciones

## Mesero
- 🔴 Sin identificación
- 🟡 Sin "pedir cuenta"
- 🟡 Query lenta
- 🟢 Flujo básico funciona

## KDS (Cocina)
- 🔴 Full scan (performance)
- 🟡 Timer roto
- 🟡 Sin notificaciones
- 🟡 Sin "agotado"
- 🟢 Estados funcionan

## Comunicación
- 🔴 Sin notificaciones entre actores
- 🔴 Sin eventos de coordinación
- 🟡 Depende de polling/liveQuery

---

**Documento actualizado:** Enero 2026


---

# 💳 SPLIT BILL (División de Cuenta) — Análisis Profundo

## Contexto del Negocio

En pollerías peruanas, dividir la cuenta es MUY común:
- Grupos de amigos (cada uno paga lo suyo)
- Familias (papá paga comida, hijo paga bebidas)
- Reuniones de trabajo (algunos con factura, otros con boleta)
- Parejas (él invita la comida, ella las bebidas)

**Frecuencia estimada:** 20-30% de las mesas piden dividir cuenta.

---

## Modos de División en la Industria

### Modo 1: Por Items (Actual)
```
Cada persona paga los items que consumió.

Mesa pide:
- 2x 1/4 Pollo (S/ 18 c/u)
- 2x Gaseosa (S/ 3.50 c/u)
- 1x Ensalada (S/ 6)

División:
- Persona A: 1/4 Pollo + Gaseosa = S/ 21.50
- Persona B: 1/4 Pollo + Gaseosa + Ensalada = S/ 27.50

✅ PARK POS soporta esto
```

### Modo 2: Equitativo (NO soportado)
```
Total ÷ N personas

Mesa pide: Total S/ 72
4 personas

División:
- Cada uno paga: S/ 72 ÷ 4 = S/ 18.00

❌ PARK POS NO soporta esto
```

### Modo 3: Por Porcentaje (NO soportado)
```
Cada persona paga un % del total.

Total: S/ 100
- Persona A: 60% = S/ 60
- Persona B: 40% = S/ 40

❌ PARK POS NO soporta esto
```

### Modo 4: División de Item (NO soportado)
```
Un item se divide entre varias personas.

1 Pollo entero S/ 58, 4 personas

División:
- Cada uno paga: S/ 58 ÷ 4 = S/ 14.50

❌ PARK POS NO soporta esto
```

### Modo 5: Mixto (NO soportado)
```
Combinación de modos.

Mesa pide:
- 1 Pollo entero S/ 58 (dividir entre 4)
- 4 Gaseosas S/ 3.50 c/u (cada uno la suya)

División:
- Persona A: S/ 14.50 (pollo) + S/ 3.50 (gaseosa) = S/ 18.00
- Persona B: S/ 14.50 (pollo) + S/ 3.50 (gaseosa) = S/ 18.00
- etc.

❌ PARK POS NO soporta esto
```

---

## Análisis del Código Actual

### Estructura de Datos

```typescript
// types.ts - CheckProjection
interface CheckProjection {
  check_id: string;
  name: string;           // "Principal", "Cuenta 2", etc.
  mode: "ITEMS" | "PERCENT" | "EQUAL";  // Solo ITEMS implementado
  lines: { line_id: string; qty: number }[];  // Referencias a items
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  total_cents: number;
  payment: {
    status: "UNPAID" | "PARTIAL" | "PAID";
    payments: Payment[];
  };
}
```

**Observación:** El modelo tiene `mode` con opciones PERCENT y EQUAL, pero NO están implementadas.

### Flujo de Crear Sub-Cuenta

```typescript
// SplitBillModal.tsx
async function handleCreateCheck() {
  const nextIdx = subChecks.length + 2;
  await POSActions.createCheck(
    currentTenantId,
    currentTerminalId,
    actorId,
    order.order_id,
    `Cuenta ${nextIdx}`  // Solo nombre, sin modo
  );
}
```

**Problema:** No se puede especificar el modo (EQUAL, PERCENT).

### Flujo de Mover Items

```typescript
// SplitBillModal.tsx
async function handleMoveItem(lineId: string, qty: number, targetCheckId: string) {
  await POSActions.moveCheckItems(
    currentTenantId,
    currentTerminalId,
    actorId,
    order.order_id,
    sourceCheck.check_id,
    targetCheck.check_id,
    [{ line_id: lineId, qty }]  // Mueve qty unidades
  );
}
```

**Observación:** Técnicamente puede mover cantidades parciales (qty), pero la UI solo pasa `qty: 1`.

### Reducer de Movimiento

```typescript
// sale.reducer.ts - CHECK_ITEMS_MOVED
case "CHECK_ITEMS_MOVED": {
  const { from_check_id, to_check_id, lines } = e.payload;
  
  for (const itemToMove of lines) {
    const { line_id, qty } = itemToMove;
    
    // 1. Restar de origen
    if (sourceLine.qty <= qty) {
      sourceCheck.lines.splice(sourceLineIdx, 1);  // Eliminar completo
    } else {
      sourceLine.qty -= qty;  // Restar parcial
    }
    
    // 2. Sumar a destino
    if (targetLineIdx !== -1) {
      targetCheck.lines[targetLineIdx].qty += qty;  // Incrementar
    } else {
      targetCheck.lines.push({ line_id, qty });  // Agregar nuevo
    }
  }
  
  // 3. Recalcular totales
  // ...
}
```

**Observación:** El reducer SÍ soporta movimiento parcial, pero la UI no lo expone.

---

## Escenarios Reales Detallados

### ESCENARIO S1: División Simple por Items

```
SITUACIÓN:
Pareja en Mesa 3:
- Él pidió: 1/2 Pollo S/ 32 + Chicha S/ 5 = S/ 37
- Ella pidió: 1/4 Pollo S/ 18 + Limonada S/ 6 = S/ 24
TOTAL: S/ 61

FLUJO ACTUAL:
1. Cajero abre Split Bill
2. Cajero crea "Cuenta 2"
3. Cajero mueve 1/4 Pollo a Cuenta 2 (click en "2")
4. Cajero mueve Limonada a Cuenta 2 (click en "2")
5. Resultado:
   - Cuenta Principal: S/ 37
   - Cuenta 2: S/ 24
6. Cada uno paga su cuenta

ESTADO: ✅ FUNCIONA
```

### ESCENARIO S2: División Equitativa (Problema)

```
SITUACIÓN:
4 amigos comparten todo:
- 1 Pollo entero S/ 58
- 1 Gaseosa 3L S/ 12
- 1 Porción papas extra S/ 8
TOTAL: S/ 78

DIVISIÓN DESEADA: S/ 78 ÷ 4 = S/ 19.50 cada uno

FLUJO ACTUAL:
1. Cajero abre Split Bill
2. Cajero crea Cuenta 2, 3, 4
3. Cajero intenta mover... ¿qué?
   - El pollo es 1 unidad, no se puede dividir
   - La gaseosa es 1 unidad
   - Las papas son 1 unidad
4. IMPOSIBLE dividir equitativamente

WORKAROUND ACTUAL:
- Cajero hace cálculo mental: S/ 78 ÷ 4 = S/ 19.50
- Cobra S/ 19.50 a cada uno en la MISMA cuenta
- Registra 4 pagos de S/ 19.50
- Problema: Solo 1 boleta, no 4

ESTADO: ❌ NO FUNCIONA CORRECTAMENTE
```

### ESCENARIO S3: Item Compartido (Problema)

```
SITUACIÓN:
2 personas comparten 1 pollo:
- 1 Pollo entero S/ 58
- 2 Gaseosas S/ 3.50 c/u = S/ 7
TOTAL: S/ 65

DIVISIÓN DESEADA:
- Persona A: 1/2 pollo (S/ 29) + gaseosa (S/ 3.50) = S/ 32.50
- Persona B: 1/2 pollo (S/ 29) + gaseosa (S/ 3.50) = S/ 32.50

FLUJO ACTUAL:
1. Cajero abre Split Bill
2. Cajero crea Cuenta 2
3. Cajero puede mover 1 gaseosa a Cuenta 2 ✓
4. Cajero NO puede dividir el pollo
5. Resultado:
   - Cuenta Principal: Pollo S/ 58 + Gaseosa S/ 3.50 = S/ 61.50
   - Cuenta 2: Gaseosa S/ 3.50
   
ESTADO: ❌ NO FUNCIONA
```

### ESCENARIO S4: Múltiples Cantidades (Parcialmente)

```
SITUACIÓN:
Mesa pidió:
- 4x 1/4 Pollo S/ 18 c/u = S/ 72
- 4x Gaseosa S/ 3.50 c/u = S/ 14
TOTAL: S/ 86

DIVISIÓN DESEADA: 4 cuentas de S/ 21.50 cada una

FLUJO ACTUAL:
1. Cajero abre Split Bill
2. Cajero crea Cuenta 2, 3, 4
3. Para mover 1/4 Pollo a Cuenta 2:
   - Click en botón "2" → Mueve 1 unidad ✓
4. Repetir para cada item...
5. Problema: 4 items × 3 cuentas = 12 clicks mínimo

UI ACTUAL:
- Botones pequeños "2", "3", "4" junto a cada item
- No hay "mover todo" o "distribuir equitativamente"
- Proceso tedioso y propenso a errores

ESTADO: ⚠️ FUNCIONA PERO UX TERRIBLE
```

### ESCENARIO S5: Factura + Boleta (Problema)

```
SITUACIÓN:
Almuerzo de trabajo:
- Jefe quiere FACTURA para la empresa
- Empleado quiere BOLETA personal
- Total: S/ 120

DIVISIÓN DESEADA:
- Cuenta 1 (Jefe): S/ 80 → FACTURA con RUC
- Cuenta 2 (Empleado): S/ 40 → BOLETA

FLUJO ACTUAL:
1. Cajero divide items entre cuentas ✓
2. Jefe paga su cuenta ✓
3. Cajero emite... ¿FACTURA o BOLETA?
   - InvoiceModal solo pregunta tipo
   - NO pregunta datos de factura (RUC, razón social)
4. Empleado paga su cuenta ✓
5. Cajero emite BOLETA ✓

PROBLEMA:
- No hay campo para RUC/razón social
- No hay validación de datos fiscales
- No hay integración con SUNAT

ESTADO: ⚠️ PARCIAL (falta datos fiscales)
```

---

## Problemas de UX Identificados

### 1. Botones de Destino Confusos
```
ACTUAL:
[Item: 1/4 Pollo]  [2] [3] [4]  ← ¿Qué significan estos números?

MEJOR:
[Item: 1/4 Pollo]  [→ Cuenta 2 ▼]  ← Dropdown claro
```

### 2. Sin Feedback Visual de Totales
```
ACTUAL:
Al mover items, no se ve el total actualizado de cada cuenta
hasta que se cierra el modal.

MEJOR:
Mostrar totales en tiempo real:
┌─────────────────┬─────────────────┐
│ Cuenta 1: S/ 45 │ Cuenta 2: S/ 33 │
└─────────────────┴─────────────────┘
```

### 3. Sin Opción de Deshacer
```
ACTUAL:
Si mueves item equivocado, debes moverlo de vuelta manualmente.

MEJOR:
Botón "Deshacer último movimiento" o historial de cambios.
```

### 4. Sin División Rápida
```
ACTUAL:
Para dividir en 4, crear 3 cuentas manualmente.

MEJOR:
"Dividir en [4] partes iguales" → Crea cuentas automáticamente.
```

### 5. Sin Previsualización
```
ACTUAL:
No hay forma de ver cómo quedará antes de confirmar.

MEJOR:
Vista previa con totales y opción de ajustar antes de guardar.
```

---

## Solución Propuesta: Split Bill v2

### Nuevos Modos

```typescript
// Agregar a CHECK_CREATED payload
interface CreateCheckPayload {
  check_id: string;
  name: string;
  mode: "ITEMS" | "EQUAL" | "PERCENT" | "AMOUNT";
  
  // Para modo EQUAL
  split_count?: number;  // Dividir entre N personas
  
  // Para modo PERCENT
  percent?: number;  // % del total
  
  // Para modo AMOUNT
  fixed_amount_cents?: number;  // Monto fijo
}
```

### Nuevo Evento: ITEM_SPLIT

```typescript
// Para dividir un item entre cuentas
interface ItemSplitPayload {
  order_id: string;
  line_id: string;
  splits: Array<{
    check_id: string;
    qty: number;      // Puede ser decimal para división
    amount_cents: number;  // O monto fijo
  }>;
}

// Ejemplo: Dividir 1 pollo S/ 58 entre 2 personas
{
  order_id: "...",
  line_id: "pollo-123",
  splits: [
    { check_id: "check-1", qty: 0.5, amount_cents: 2900 },
    { check_id: "check-2", qty: 0.5, amount_cents: 2900 }
  ]
}
```

### UI Mejorada

```
┌─────────────────────────────────────────────────────────────┐
│                    DIVIDIR CUENTA                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MODO DE DIVISIÓN                                     │   │
│  │ ○ Por items (cada uno paga lo suyo)                 │   │
│  │ ○ Equitativo (total ÷ personas)                     │   │
│  │ ○ Personalizado (montos específicos)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DIVIDIR EN: [4] PARTES                              │   │
│  │                                                      │   │
│  │ Total: S/ 78.00                                     │   │
│  │ Cada uno: S/ 19.50                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┬─────────────┬─────────────┬───────────┐   │
│  │ Cuenta 1    │ Cuenta 2    │ Cuenta 3    │ Cuenta 4  │   │
│  │ S/ 19.50    │ S/ 19.50    │ S/ 19.50    │ S/ 19.50  │   │
│  │ [Ajustar]   │ [Ajustar]   │ [Ajustar]   │ [Ajustar] │   │
│  └─────────────┴─────────────┴─────────────┴───────────┘   │
│                                                             │
│  [CANCELAR]                              [APLICAR DIVISIÓN] │
└─────────────────────────────────────────────────────────────┘
```

---

## Prioridad de Implementación

| Feature | Impacto | Esfuerzo | Prioridad |
|---------|---------|----------|-----------|
| División equitativa | Alto | 4h | 🔴 P0 |
| UI mejorada (totales en tiempo real) | Alto | 2h | 🔴 P0 |
| División de item individual | Medio | 6h | 🟡 P1 |
| Datos fiscales (RUC) | Medio | 4h | 🟡 P1 |
| Modo porcentaje | Bajo | 3h | 🟢 P2 |

---

## Resumen

**Lo que funciona:**
- ✅ Crear múltiples cuentas
- ✅ Mover items completos entre cuentas
- ✅ Pagar cada cuenta por separado
- ✅ Emitir comprobante por cuenta

**Lo que falta (crítico):**
- ❌ División equitativa (total ÷ N)
- ❌ División de item individual
- ❌ UI clara con totales en tiempo real

**Lo que falta (importante):**
- ❌ Datos fiscales para factura
- ❌ Previsualización antes de confirmar
- ❌ Deshacer movimientos

---

**Documento actualizado:** Enero 2026


---

# 🍽️ FLUJO DEL MESERO — Análisis Profundo

## Contexto del Negocio

### Perfil del Mesero en Pollería

```
RESPONSABILIDADES:
- Atender 4-6 mesas simultáneamente
- Tomar pedidos rápidamente
- Comunicar con cocina
- Servir cuando está listo
- Cobrar (en algunos casos)
- Limpiar mesa para siguiente cliente

HERRAMIENTA:
- Tablet o celular con app de mesero
- Debe funcionar offline (WiFi inestable)
- Interfaz táctil, rápida

MÉTRICAS CLAVE:
- Tiempo desde pedido hasta servir
- Órdenes por hora
- Propinas (si aplica)
```

### Mapa de Mesas Típico

```
┌─────────────────────────────────────────────────────────────┐
│                      PISO 1 (Principal)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────┐   ┌─────┐   ┌─────┐                              │
│   │ M1  │   │ M2  │   │ M3  │     ← Mesas 4 personas       │
│   └─────┘   └─────┘   └─────┘                              │
│                                                             │
│   ┌─────────────┐   ┌─────────────┐                        │
│   │     M4      │   │     M5      │  ← Mesas 6 personas    │
│   └─────────────┘   └─────────────┘                        │
│                                                             │
│   ┌───────────────────────────────┐                        │
│   │            M6                 │  ← Mesa 10 personas    │
│   └───────────────────────────────┘                        │
│                                                             │
│   [BARRA]  ○ ○ ○ ○ ○ ○ ○ ○        ← 8 asientos barra      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      PISO 2 (Terraza)                       │
├─────────────────────────────────────────────────────────────┤
│   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                    │
│   │ M7  │   │ M8  │   │ M9  │   │ M10 │                    │
│   └─────┘   └─────┘   └─────┘   └─────┘                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Escenarios Reales del Mesero

### ESCENARIO M1: Tomar Pedido Completo

```
SITUACIÓN:
- Familia de 4 llega a Mesa 3
- Mesero los atiende

FLUJO ESPERADO:
1. Mesero abre app, ve mapa de mesas
2. Mesa 3 está verde (disponible)
3. Mesero toca Mesa 3
4. Sistema abre pantalla de pedido
5. Mesero pregunta y agrega:
   - 1x Pollo entero
   - 2x 1/4 Pollo
   - 4x Gaseosa personal
   - 1x Ensalada
6. Mesero confirma: "¿Algo más?"
7. Mesero presiona "Enviar a Cocina"
8. Sistema genera eventos:
   - ORDER_CREATED
   - ORDER_ITEM_ADDED x5
9. KDS recibe pedido inmediatamente
10. Mesa 3 cambia a azul (ocupada)
11. Mesero ve: "Pedido #067 enviado ✓"

ESTADO ACTUAL:
✅ Mapa de mesas existe
✅ Navegación a orden funciona
⚠️ No vi la pantalla de tomar pedido
⚠️ Sin confirmación visual de envío
❌ Sin tiempo estimado de preparación
```

### ESCENARIO M2: Modificar Pedido (Agregar)

```
SITUACIÓN:
- Mesa 3 ya tiene pedido en cocina
- Cliente quiere agregar otra gaseosa

FLUJO ESPERADO:
1. Mesero toca Mesa 3 (azul/ocupada)
2. Sistema muestra pedido actual con estados:
   - Pollo entero: 🔥 COCINANDO
   - 1/4 Pollo x2: 🔥 COCINANDO
   - Gaseosas x4: ✅ LISTO
   - Ensalada: ✅ LISTO
3. Mesero presiona "Agregar Item"
4. Agrega: 1x Gaseosa personal
5. Sistema genera ORDER_ITEM_ADDED
6. Nuevo item aparece como PENDIENTE
7. KDS recibe solo el nuevo item

ESTADO ACTUAL:
⚠️ useOrder.ts reconstruye toda la orden
⚠️ No hay UI para ver estados de items
❌ No hay "Agregar Item" en orden existente
```

### ESCENARIO M3: Modificar Pedido (Quitar)

```
SITUACIÓN:
- Mesa 3 pidió ensalada
- Cocina aún no la prepara
- Cliente cambia de opinión

FLUJO ESPERADO:
1. Mesero ve pedido de Mesa 3
2. Ensalada está en estado PENDIENTE
3. Mesero toca ensalada → "Quitar"
4. Sistema pregunta: "¿Motivo?"
5. Mesero selecciona: "Cliente canceló"
6. Sistema genera ORDER_ITEM_VOIDED
7. KDS elimina ensalada de su lista
8. Total se actualiza

RESTRICCIÓN:
- Solo se puede quitar si estado = PENDIENTE
- Si ya está COCINANDO, requiere autorización

ESTADO ACTUAL:
❌ No hay UI para quitar items desde mesero
❌ No hay validación de estado
```

### ESCENARIO M4: Item Listo - Notificación

```
SITUACIÓN:
- Cocina terminó el pollo de Mesa 3
- Mesero está atendiendo Mesa 7

FLUJO ESPERADO:
1. Cocinero marca pollo como READY en KDS
2. Sistema genera ORDER_ITEM_STATUS_CHANGED
3. App de mesero recibe notificación:
   "🍗 Mesa 3 - Pollo entero LISTO"
4. Mesero ve badge en Mesa 3: "1 listo"
5. Mesero va a cocina, recoge, sirve
6. Mesero marca como SERVIDO (opcional)

ESTADO ACTUAL:
❌ No hay notificaciones al mesero
❌ No hay badge de items listos
❌ No hay estado SERVIDO
```

### ESCENARIO M5: Pedir la Cuenta

```
SITUACIÓN:
- Mesa 3 terminó de comer
- Piden la cuenta

FLUJO ESPERADO:
1. Mesero toca Mesa 3
2. Mesero presiona "Pedir Cuenta"
3. Sistema genera REQUEST_CHECK
4. Caja recibe notificación:
   "Mesa 3 solicita cuenta - S/ 89.00"
5. Cajero prepara pre-cuenta
6. Mesero lleva pre-cuenta a mesa
7. Cliente revisa y decide pagar

OPCIONES DE PAGO:
a) Cliente va a caja
b) Mesero cobra en mesa (si tiene permiso)
c) Cliente paga con QR (Yape/Plin)

ESTADO ACTUAL:
❌ No hay botón "Pedir Cuenta"
❌ No hay evento REQUEST_CHECK
❌ No hay notificación a caja
```

### ESCENARIO M6: Cambio de Mesa

```
SITUACIÓN:
- Mesa 3 tiene pedido en curso
- Cliente quiere moverse a Mesa 6 (más grande)

FLUJO ESPERADO:
1. Mesero selecciona Mesa 3
2. Mesero presiona "Cambiar Mesa"
3. Sistema muestra mesas disponibles
4. Mesero selecciona Mesa 6
5. Sistema genera TABLE_CHANGED
6. Pedido se asocia a Mesa 6
7. Mesa 3 queda libre (verde)
8. Mesa 6 queda ocupada (azul)

ESTADO ACTUAL:
❌ No existe esta funcionalidad
```

### ESCENARIO M7: Mesero Offline

```
SITUACIÓN:
- WiFi se cae mientras mesero toma pedido
- Mesero no se da cuenta

FLUJO ESPERADO:
1. Mesero toma pedido normalmente
2. Eventos se guardan en IndexedDB local
3. App muestra indicador: "📴 Offline"
4. Mesero presiona "Enviar"
5. App muestra: "Pedido guardado, se enviará al reconectar"
6. WiFi regresa
7. SyncClient envía eventos automáticamente
8. KDS recibe pedido (con delay)

ESTADO ACTUAL:
✅ Eventos se guardan localmente
✅ Sync automático al reconectar
⚠️ Indicador offline existe pero básico
❌ No hay confirmación clara de "pendiente de envío"
```

### ESCENARIO M8: Dos Meseros, Misma Mesa

```
SITUACIÓN:
- Mesero A tomó pedido inicial de Mesa 5
- Mesero B (relevo) quiere agregar postre

FLUJO ESPERADO:
1. Mesero B abre Mesa 5
2. Ve pedido existente (tomado por Mesero A)
3. Puede agregar items
4. Sistema registra que Mesero B agregó el postre
5. Propina/comisión se puede dividir

ESTADO ACTUAL:
⚠️ Cualquier mesero puede modificar cualquier mesa
❌ No hay tracking de quién agregó qué
❌ No hay sistema de propinas
```

---

## Problemas del Módulo Mesero

### Críticos 🔴

| # | Problema | Impacto |
|---|----------|---------|
| 1 | No hay pantalla de tomar pedido | Funcionalidad core |
| 2 | No hay notificaciones de cocina | Comunicación rota |
| 3 | Terminal ID hardcodeado | Sin trazabilidad |

### Importantes 🟡

| # | Problema | Impacto |
|---|----------|---------|
| 4 | No hay "Pedir Cuenta" | Proceso manual |
| 5 | No hay modificación de pedido | UX limitada |
| 6 | Query lenta (full rebuild) | Performance |
| 7 | No hay cambio de mesa | Flexibilidad |

### Menores 🟢

| # | Problema | Impacto |
|---|----------|---------|
| 8 | Sin tiempo estimado | UX |
| 9 | Sin tracking de mesero | Métricas |
| 10 | Sin propinas | Funcionalidad |

---

# 👨‍🍳 FLUJO DEL KDS (COCINA) — Análisis Profundo

## Contexto del Negocio

### Perfil de la Cocina en Pollería

```
ESTACIONES TÍPICAS:
1. PARRILLA - Pollos al carbón/horno
2. FREIDORA - Papas, extras fritos
3. FRÍOS - Ensaladas, bebidas
4. ARMADO - Platos completos

PERSONAL:
- 1-2 parrilleros
- 1 ayudante de freidora
- 1 armador/despachador

FLUJO DE TRABAJO:
1. Pedido llega a KDS
2. Cada estación ve SUS items
3. Parrillero empieza pollo (más lento)
4. Freidora prepara papas
5. Fríos prepara ensalada/bebidas
6. Armador junta todo cuando está listo
7. Armador marca como READY
8. Mesero recoge
```

### Tiempos de Preparación Típicos

| Item | Tiempo | Estación |
|------|--------|----------|
| Pollo entero | 25-30 min | Parrilla |
| 1/2 Pollo | 20-25 min | Parrilla |
| 1/4 Pollo | 15-20 min | Parrilla |
| Papas fritas | 8-10 min | Freidora |
| Ensalada | 3-5 min | Fríos |
| Gaseosa | 1 min | Fríos |

---

## Escenarios Reales del KDS

### ESCENARIO K1: Pedido Normal Llega

```
SITUACIÓN:
- Mesa 3 pidió:
  - 1x Pollo entero
  - 2x Porción papas
  - 1x Ensalada
  - 4x Gaseosa

FLUJO ESPERADO:
1. Pedido llega al KDS central
2. Sistema distribuye por estación:
   - PARRILLA: 1x Pollo entero
   - FREIDORA: 2x Porción papas
   - FRÍOS: 1x Ensalada, 4x Gaseosa
3. Cada pantalla muestra solo sus items
4. Timer empieza a contar
5. Parrillero toca "Pollo" → COOKING
6. Freidora toca "Papas" → COOKING
7. Fríos prepara y marca READY
8. Cuando todo está READY → Notificar mesero

ESTADO ACTUAL:
✅ Pedidos llegan al KDS
✅ Filtro por estación existe
✅ Estados PENDING → COOKING → READY
⚠️ Timer no funciona (bug)
❌ No hay distribución automática por estación
❌ No hay notificación cuando todo está listo
```

### ESCENARIO K2: Hora Pico (10+ Pedidos)

```
SITUACIÓN:
- 12:30 PM, hora pico de almuerzo
- 10 pedidos activos simultáneos
- 25+ items en preparación

FLUJO ESPERADO:
1. KDS muestra tickets ordenados por antigüedad
2. Items más antiguos resaltados en rojo
3. Cocinero prioriza los rojos
4. Sistema sugiere orden de preparación
5. Tickets completados desaparecen

PROBLEMAS ACTUALES:
1. useKitchenTickets hace FULL SCAN de eventos
2. Reconstruye TODAS las órdenes cada render
3. Sin filtro por fecha (carga histórico)
4. Performance degrada con volumen

CÓDIGO PROBLEMÁTICO:
```typescript
// useKitchenTickets.ts - O(n) donde n = TODOS los eventos
const events = await db.events
  .where("aggregate_type")
  .equals("ORDER")
  .toArray();  // Miles de eventos!

// Luego reconstruye cada orden
for (const orderId in eventsByOrder) {
  // Replay completo de cada orden
}
```

SOLUCIÓN NECESARIA:
- Filtrar por fecha (solo hoy)
- Usar proyecciones pre-calculadas
- Índice en occurred_at
```

### ESCENARIO K3: Item Agotado (86'd)

```
SITUACIÓN:
- Se acabó la ensalada
- Hay 3 pedidos con ensalada pendiente

FLUJO ESPERADO:
1. Cocinero detecta que no hay ensalada
2. Cocinero marca "Ensalada" como AGOTADO en sistema
3. Sistema:
   - Notifica a meseros de mesas afectadas
   - Bloquea ensalada en catálogo
   - Muestra alerta en POS
4. Meseros informan a clientes
5. Clientes deciden: cambiar o quitar
6. Al reponer, cocinero desbloquea

ESTADO ACTUAL:
❌ No existe estado AGOTADO
❌ No hay notificación a meseros
❌ No hay bloqueo en catálogo
```

### ESCENARIO K4: Pedido Urgente (VIP/Delivery)

```
SITUACIÓN:
- Pedido de delivery con tiempo límite
- O cliente VIP que tiene prisa

FLUJO ESPERADO:
1. Cajero/Mesero marca pedido como URGENTE
2. KDS muestra ticket con borde rojo + 🔥
3. Ticket sube al inicio de la cola
4. Timer más agresivo (alerta antes)
5. Cocineros priorizan

ESTADO ACTUAL:
❌ No hay flag de urgente
❌ No hay priorización
```

### ESCENARIO K5: Error de Cocina (Rehacer)

```
SITUACIÓN:
- Pollo se quemó
- Hay que rehacer

FLUJO ESPERADO:
1. Cocinero marca item como FAILED/REDO
2. Sistema registra motivo: "Quemado"
3. Item vuelve a PENDING
4. Timer se reinicia
5. Se registra para métricas de merma

ESTADO ACTUAL:
❌ No hay estado FAILED
❌ No hay tracking de merma
```

### ESCENARIO K6: Pedido Parcialmente Listo

```
SITUACIÓN:
- Mesa 3: Pollo listo, papas listas, ensalada pendiente
- ¿Se sirve parcial o se espera?

POLÍTICA TÍPICA:
- Opción A: Servir todo junto (esperar)
- Opción B: Servir caliente primero (parcial)

FLUJO ESPERADO (Opción A):
1. Pollo y papas en READY
2. Sistema NO notifica aún
3. Ensalada pasa a READY
4. Sistema notifica: "Mesa 3 COMPLETO"
5. Mesero recoge todo junto

FLUJO ESPERADO (Opción B):
1. Pollo y papas en READY
2. Sistema notifica: "Mesa 3 - Pollo y Papas LISTOS"
3. Mesero decide si llevar o esperar
4. Ensalada se notifica después

ESTADO ACTUAL:
❌ No hay configuración de política
❌ Notifica item por item (si existiera)
```

### ESCENARIO K7: Múltiples KDS (Por Estación)

```
SITUACIÓN:
- KDS 1: Parrilla
- KDS 2: Freidora + Fríos
- KDS 3: Despacho (ve todo)

FLUJO ESPERADO:
1. Pedido llega
2. KDS 1 ve solo items de parrilla
3. KDS 2 ve items de freidora y fríos
4. KDS 3 ve todos los items
5. Cada KDS puede marcar sus items
6. KDS 3 marca pedido completo como READY

ESTADO ACTUAL:
✅ Filtro por estación existe
⚠️ Estación se infiere del nombre del producto (frágil)
❌ No hay KDS de despacho
❌ No hay configuración de qué estación ve qué
```

---

## Problemas del Módulo KDS

### Críticos 🔴

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Full scan de eventos | Performance crítica |
| 2 | Sin filtro por fecha | Carga histórico |
| 3 | Timer roto | UX incompleta |

### Importantes 🟡

| # | Problema | Impacto |
|---|----------|---------|
| 4 | Sin notificación a mesero | Comunicación |
| 5 | Sin estado AGOTADO | Operación |
| 6 | Sin priorización | Eficiencia |
| 7 | Estación por nombre | Frágil |

### Menores 🟢

| # | Problema | Impacto |
|---|----------|---------|
| 8 | Sin métricas de tiempo | Análisis |
| 9 | Sin tracking de merma | Costos |
| 10 | Sin KDS de despacho | Organización |

---

## Soluciones Propuestas

### Para Mesero

```typescript
// 1. Crear página de tomar pedido
// src/app/waiter/order/[tableId]/page.tsx

// 2. Agregar evento REQUEST_CHECK
interface RequestCheckPayload {
  order_id: string;
  table_id: string;
  requested_by: string;  // mesero
  total_cents: number;
}

// 3. Sistema de notificaciones
// Usar SSE existente para push a meseros
```

### Para KDS

```typescript
// 1. Optimizar query - filtrar por fecha
const today = new Date();
today.setHours(0, 0, 0, 0);

const events = await db.events
  .where("aggregate_type").equals("ORDER")
  .and(e => new Date(e.occurred_at) >= today)
  .toArray();

// 2. Usar proyecciones pre-calculadas
// En lugar de reconstruir, leer de tabla orders

// 3. Agregar estado AGOTADO
type ItemStatus = "PENDING" | "COOKING" | "READY" | "DONE" | "OUT_OF_STOCK";
```

---

## Prioridades de Implementación

### Mesero

| # | Feature | Esfuerzo | Prioridad |
|---|---------|----------|-----------|
| 1 | Pantalla tomar pedido | 8h | 🔴 P0 |
| 2 | Notificaciones de cocina | 6h | 🔴 P0 |
| 3 | Botón "Pedir Cuenta" | 4h | 🟡 P1 |
| 4 | Modificar pedido | 6h | 🟡 P1 |
| 5 | Cambio de mesa | 4h | 🟢 P2 |

### KDS

| # | Feature | Esfuerzo | Prioridad |
|---|---------|----------|-----------|
| 1 | Optimizar query | 4h | 🔴 P0 |
| 2 | Arreglar timer | 2h | 🔴 P0 |
| 3 | Notificar a mesero | 4h | 🟡 P1 |
| 4 | Estado AGOTADO | 4h | 🟡 P1 |
| 5 | Priorización | 4h | 🟢 P2 |

---

**Documento actualizado:** Enero 2026
