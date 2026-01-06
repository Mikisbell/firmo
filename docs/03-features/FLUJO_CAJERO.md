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
- 3-5 meseros
- 2-3 cocineros
- 1 administrador (supervisa ambos turnos)

VOLUMEN DIARIO:
- 80-150 órdenes/día
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
