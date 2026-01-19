# 👨‍🍳 FLUJO DEL MESERO — Análisis Profundo

> **Documento:** Sistema de meseros (15 terminales)  
> **Fecha:** Enero 2026  
> **Estado:** Análisis del código actual + diseño de mejoras

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Estado Actual del Código](#estado-actual-del-código)
3. [Escenarios Reales (15 Meseros)](#escenarios-reales)
4. [Problemas Detectados](#problemas-detectados)
5. [Diseño Propuesto](#diseño-propuesto)

---

## CONTEXTO DEL NEGOCIO

### Perfil de Meseros en Pollería

```
CANTIDAD: 3-15 meseros por turno (según tamaño)
DISPOSITIVO: Tablet Android o iPad
TURNOS: Rotativos, 2 turnos de 6 horas

RESPONSABILIDADES:
- Atender mesas asignadas (zona)
- Tomar pedidos
- Enviar a cocina/bar
- Servir cuando está listo
- Solicitar cuenta
- Cobrar (en algunos casos)

COMPENSACIÓN:
- Sueldo base + propinas
- Propinas por mesa atendida
- Comisión por ventas (opcional)
```

### Distribución de Mesas por Zona

```
POLLERÍA TÍPICA (50 mesas):

PISO 1 (Interior):
├── Zona A: Mesas 1-8 (Mesero 1-2)
├── Zona B: Mesas 9-16 (Mesero 3-4)
└── Zona C: Mesas 17-24 (Mesero 5-6)

PISO 2 (Segundo nivel):
├── Zona D: Mesas 25-32 (Mesero 7-8)
└── Zona E: Mesas 33-40 (Mesero 9-10)

TERRAZA:
├── Zona F: Mesas 41-46 (Mesero 11-12)
└── Zona G: Mesas 47-50 (Mesero 13-14)

BARRA:
└── Zona H: Barra 1-10 (Mesero 15 / Barman)
```

### Flujo de Trabajo del Mesero

```
┌─────────────────────────────────────────────────────────────────┐
│                    CICLO DE ATENCIÓN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. RECIBIR          2. TOMAR           3. ENVIAR               │
│  ┌─────────┐         ┌─────────┐        ┌─────────┐             │
│  │ Cliente │────────>│ Pedido  │───────>│ Cocina  │             │
│  │ llega   │         │ en app  │        │ + Bar   │             │
│  └─────────┘         └─────────┘        └─────────┘             │
│                                               │                 │
│                                               ▼                 │
│  6. COBRAR           5. SERVIR          4. LISTO                │
│  ┌─────────┐         ┌─────────┐        ┌─────────┐             │
│  │ Cuenta  │<────────│ Llevar  │<───────│ KDS     │             │
│  │ + pago  │         │ a mesa  │        │ notifica│             │
│  └─────────┘         └─────────┘        └─────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ESTADO ACTUAL DEL CÓDIGO

### Archivos Relevantes

```
src/app/waiter/
├── page.tsx                    # Mapa de mesas
├── layout.tsx                  # Layout del módulo
├── order/
│   └── [tableId]/
│       └── page.tsx            # Tomar pedido
└── hooks/
    ├── useOrder.ts             # Estado de orden
    └── useTableStatus.ts       # Estado de mesas
```

### Constantes Hardcodeadas

```typescript
// src/app/waiter/order/[tableId]/page.tsx - Líneas 16-19
const TENANT_ID = "00000000-0000-0000-0000-000000000001";  // ❌
const TERMINAL_ID = "waiter_1";                            // ❌ Solo 1 mesero
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";   // ❌
```

### Mesas Hardcodeadas

```typescript
// src/app/waiter/hooks/useTableStatus.ts - Línea 77
const ALL_TABLES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];  // ❌ Solo 9 mesas
```

### Pisos Hardcodeados

```typescript
// src/app/waiter/page.tsx - Líneas 10-14
const PISOS = [
    { id: "P1", name: "Piso 1" },
    { id: "P2", name: "Piso 2" },
    { id: "P3", name: "Terraza" },
];
// ❌ Falta Barra
```

### Funcionalidad Actual

| Feature | Estado | Código |
|---------|--------|--------|
| Ver mapa de mesas | ✅ Funciona | `page.tsx` |
| Ver estado de mesa | ✅ Funciona | `useTableStatus.ts` |
| Crear orden | ✅ Funciona | `order/[tableId]/page.tsx` |
| Agregar items | ✅ Funciona | `handleAddItem()` |
| Enviar a cocina | ✅ **FIXED** | `handleSendToKitchen()` + reducer |
| Modificar cantidad | ✅ Funciona | Botones con handler |
| Eliminar item | ✅ Funciona | Botón con handler |
| Pedir cuenta | ✅ Funciona | `handleCallBill()` |
| Ver items listos | ❌ No existe | - |
| Notificaciones | ❌ No existe | - |


---

## ESCENARIOS REALES (15 Meseros)

### ESCENARIO M1: Mesero Inicia Turno

```
SITUACIÓN:
- Pedro (Mesero 3) llega a las 5 PM
- Le asignan Zona B (Mesas 9-16)
- Toma tablet #3

FLUJO ESPERADO:
1. Pedro enciende tablet
2. Sistema muestra login
3. Pedro ingresa PIN: 3456
4. Sistema valida:
   - Usuario activo
   - Rol = WAITER
5. Sistema muestra mapa de mesas
6. Pedro ve SOLO sus mesas (Zona B)
7. Mesas de otros meseros en gris/bloqueadas

ESTADO ACTUAL: ❌ NO EXISTE
- No hay login
- No hay zonas
- Todos ven todas las mesas
- No hay asignación de mesero
```

### ESCENARIO M2: Tomar Pedido Nueva Mesa

```
SITUACIÓN:
- Familia de 4 llega a Mesa 12
- Pedro los atiende

FLUJO ESPERADO:
1. Pedro toca Mesa 12 (verde = disponible)
2. Sistema abre pantalla de pedido
3. Pedro pregunta y agrega:
   - 1x Pollo entero (S/ 58) → Cocina
   - 4x Gaseosa personal (S/ 14) → Bar
   - 1x Ensalada (S/ 6) → Cocina
4. Pedro confirma pedido
5. Sistema genera:
   - ORDER_CREATED (mesa 12, mesero Pedro)
   - ORDER_ITEM_ADDED x 3
6. Sistema envía a:
   - KDS Cocina: Pollo + Ensalada
   - KDS Bar: 4 Gaseosas
7. Mesa 12 cambia a azul (ocupada)
8. Timer empieza a contar

ESTADO ACTUAL: ✅ **FIXED (19 Enero 2026)**
- Crear orden funciona
- Agregar items funciona
- ✅ Evento ORDER_SUBMITTED procesado por reducer
- ✅ Items llegan a KDS automáticamente por estación
- ✅ Caja ve órdenes en lista de pendientes
- ⚠️ Timer no funciona (pendiente)
```

### ESCENARIO M3: Modificar Pedido Existente

```
SITUACIÓN:
- Mesa 12 ya tiene pedido
- Cliente quiere agregar postre

FLUJO ESPERADO:
1. Pedro toca Mesa 12 (azul = ocupada)
2. Sistema muestra pedido actual:
   - Pollo entero (COOKING)
   - 4x Gaseosa (READY)
   - Ensalada (PENDING)
3. Pedro agrega: 1x Helado (S/ 8)
4. Sistema genera ORDER_ITEM_ADDED
5. KDS recibe nuevo item

ESTADO ACTUAL: ✅ FUNCIONA
- useOrder() reconstruye estado
- Puede agregar más items
```

### ESCENARIO M4: Item Listo - Notificación

```
SITUACIÓN:
- Cocina terminó el Pollo de Mesa 12
- Pedro debe ir a recoger

FLUJO ESPERADO:
1. Cocinero marca Pollo como READY en KDS
2. Sistema genera ORDER_ITEM_STATUS_CHANGED
3. Tablet de Pedro recibe notificación:
   🔔 "Mesa 12 - Pollo entero LISTO"
4. Pedro ve badge en Mesa 12
5. Pedro va a cocina, recoge, sirve
6. Pedro marca como DONE (o automático)

ESTADO ACTUAL: ❌ NO EXISTE
- No hay notificaciones push
- No hay badge de items listos
- Mesero debe revisar manualmente
```

### ESCENARIO M5: Cliente Pide la Cuenta

```
SITUACIÓN:
- Mesa 12 terminó de comer
- Piden la cuenta

FLUJO ESPERADO:
1. Pedro toca Mesa 12
2. Pedro presiona "PEDIR CUENTA"
3. Sistema genera REQUEST_CHECK event
4. Caja recibe notificación:
   🔔 "Mesa 12 solicita cuenta - S/ 86"
5. Cajero prepara pre-cuenta
6. Pedro puede:
   - Imprimir pre-cuenta en tablet
   - Mostrar QR para pago
7. Cliente decide método de pago

ESTADO ACTUAL: ❌ NO EXISTE
- No hay botón "Pedir Cuenta"
- No hay evento REQUEST_CHECK
- No hay notificación a caja
```

### ESCENARIO M6: Cobro por Mesero (Opcional)

```
SITUACIÓN:
- Pollería permite que meseros cobren
- Cliente de Mesa 12 paga con Yape

FLUJO ESPERADO:
1. Pedro muestra QR de Yape
2. Cliente paga S/ 86
3. Pedro confirma pago recibido
4. Sistema genera:
   - CHECK_PAYMENT_ADDED (Yape, S/ 86)
   - CHECK_MARKED_PAID
5. Pedro puede emitir boleta desde tablet
6. Mesa 12 cambia a verde (disponible)

ESTADO ACTUAL: ❌ NO EXISTE
- Mesero no puede cobrar
- Solo caja puede procesar pagos
```

### ESCENARIO M7: Anular Item (Error)

```
SITUACIÓN:
- Pedro agregó Ensalada por error
- Cliente no la pidió

FLUJO ESPERADO:
1. Pedro toca Mesa 12
2. Pedro ve lista de items
3. Pedro toca Ensalada
4. Pedro presiona "Anular"
5. Si item está PENDING:
   - Anulación directa
6. Si item está COOKING/READY:
   - Requiere autorización de supervisor
7. Sistema genera ORDER_ITEM_VOIDED
8. KDS recibe notificación de anulación

ESTADO ACTUAL: ❌ NO EXISTE
- Botón de eliminar no funciona
- No hay lógica de anulación
- No hay autorización
```

### ESCENARIO M8: Transferir Mesa a Otro Mesero

```
SITUACIÓN:
- Pedro termina su turno
- Mesa 12 sigue ocupada
- Juan (Mesero 4) toma el relevo

FLUJO ESPERADO:
1. Pedro abre Mesa 12
2. Pedro presiona "Transferir"
3. Sistema muestra lista de meseros activos
4. Pedro selecciona "Juan"
5. Sistema genera ORDER_TRANSFERRED
6. Juan recibe notificación
7. Mesa 12 aparece en zona de Juan
8. Propina se divide o transfiere

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO M9: Mesa Dividida (Grupos Separados)

```
SITUACIÓN:
- Mesa 12 tiene 2 grupos que quieren cuentas separadas
- Grupo A: Pollo + 2 gaseosas
- Grupo B: Ensalada + 2 gaseosas

FLUJO ESPERADO:
1. Pedro abre Mesa 12
2. Pedro presiona "Dividir Cuenta"
3. Sistema abre SplitBillModal
4. Pedro crea 2 cuentas
5. Pedro asigna items a cada cuenta
6. Cada grupo paga por separado

ESTADO ACTUAL: ⚠️ PARCIAL
- SplitBillModal existe en POS
- No está integrado en Waiter
```

### ESCENARIO M10: Hora Pico - 15 Meseros Simultáneos

```
SITUACIÓN:
- Sábado 8 PM, restaurante lleno
- 15 meseros trabajando
- 50 mesas ocupadas

PROBLEMAS POTENCIALES:
1. Order numbers: ¿Colisiones entre meseros?
2. Sync: ¿Eventos llegan en orden?
3. Performance: ¿IndexedDB aguanta?
4. Notificaciones: ¿Todos reciben todo?

ESTADO ACTUAL: ❌ NO PREPARADO
- Solo 1 terminal_id hardcodeado
- Sin range allocation
- Sin filtro de notificaciones
```

### ESCENARIO M11: Mesero Offline

```
SITUACIÓN:
- WiFi se cae en terraza
- Mesero 11 sigue tomando pedidos

FLUJO ESPERADO:
1. Tablet detecta offline
2. Muestra indicador "OFFLINE"
3. Mesero puede seguir:
   - Creando órdenes
   - Agregando items
4. Eventos se guardan en IndexedDB
5. Cuando reconecta:
   - Sync automático
   - KDS recibe pedidos atrasados

ESTADO ACTUAL: ✅ FUNCIONA (Event Sourcing)
- Eventos se guardan localmente
- Sync al reconectar
- ⚠️ Order numbers pueden colisionar
```

### ESCENARIO M12: Producto Agotado

```
SITUACIÓN:
- Mesero intenta agregar "Chicha Morada"
- Cocina ya marcó como agotado

FLUJO ESPERADO:
1. Pedro selecciona Chicha Morada
2. Sistema detecta: producto agotado
3. Muestra mensaje: "Chicha Morada no disponible"
4. Sugiere alternativas: "¿Limonada? ¿Maracuyá?"
5. Pedro informa al cliente

ESTADO ACTUAL: ❌ NO EXISTE
- No hay estado de inventario
- No hay productos agotados
- No hay sugerencias
```

### ESCENARIO M13: Pedido para Llevar desde Mesa

```
SITUACIÓN:
- Cliente en Mesa 12 quiere pedir algo para llevar
- Además de lo que consume en mesa

FLUJO ESPERADO:
1. Pedro tiene orden de Mesa 12 (DINE_IN)
2. Cliente pide pollo adicional para llevar
3. Pedro presiona "Agregar Para Llevar"
4. Sistema crea orden separada (TAKEOUT)
5. Ambas órdenes vinculadas a Mesa 12
6. Cliente paga ambas juntas o separadas

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO M14: Reserva con Pedido Anticipado

```
SITUACIÓN:
- Cliente llamó y reservó Mesa 5 para 8 PM
- Ya dejó su pedido por teléfono

FLUJO ESPERADO:
1. Admin crea reserva en sistema
2. Reserva incluye pedido anticipado
3. A las 7:45 PM, sistema notifica a cocina
4. Cocina empieza a preparar
5. Cliente llega a las 8 PM
6. Mesero lo lleva a Mesa 5
7. Comida lista en 5 minutos

ESTADO ACTUAL: ❌ NO EXISTE
- No hay sistema de reservas
- No hay pedidos anticipados
```

### ESCENARIO M15: Propinas por Mesero

```
SITUACIÓN:
- Fin de turno
- Pedro quiere ver sus propinas

FLUJO ESPERADO:
1. Pedro accede a "Mi Resumen"
2. Sistema muestra:
   - Mesas atendidas: 12
   - Ventas totales: S/ 850
   - Propinas recibidas: S/ 45
   - Propinas pendientes: S/ 12
3. Pedro puede ver detalle por mesa

ESTADO ACTUAL: ❌ NO EXISTE
- No hay tracking de propinas
- No hay resumen por mesero
```

---

## PROBLEMAS DETECTADOS

### Críticos 🔴

| # | Problema | Impacto | Código | Estado |
|---|----------|---------|--------|--------|
| 1 | Solo 1 terminal_id | 15 meseros = 1 ID | `order/[tableId]/page.tsx:17` | ⚠️ Pendiente |
| 2 | Solo 9 mesas | Pollería tiene 50 | `useTableStatus.ts:77` | ⚠️ Pendiente |
| 3 | Sin notificaciones | Mesero no sabe qué está listo | - | ⚠️ Pendiente |
| 4 | ~~Pedidos no llegan a KDS~~ | ~~Cocina no ve pedidos~~ | ~~reducer~~ | ✅ **FIXED** |
| 5 | ~~Pedidos no llegan a Caja~~ | ~~Caja no ve pendientes~~ | ~~reducer~~ | ✅ **FIXED** |

### Importantes 🟡

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 6 | Sin zonas de mesero | Todos ven todo | - |
| 7 | Sin login | Sin auditoría | - |
| 8 | Sin transferencia | Cambio de turno manual | - |
| 9 | Sin propinas | Sin tracking | - |
| 10 | Falta Barra | Solo 3 pisos | `page.tsx:10` |

### Menores 🟢

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 11 | Timer no funciona | UX incompleta | `getElapsedTime()` |
| 12 | Sin búsqueda | Lento en catálogo grande | - |
| 13 | Sin favoritos | Mesero no puede guardar | - |

---

## DISEÑO PROPUESTO

### Configuración de 15 Terminales de Mesero

```typescript
// Configuración de terminales de mesero
const WAITER_TERMINALS = [
  { id: "waiter_01", name: "Mesero 1", zone: "A", tables: [1,2,3,4] },
  { id: "waiter_02", name: "Mesero 2", zone: "A", tables: [5,6,7,8] },
  { id: "waiter_03", name: "Mesero 3", zone: "B", tables: [9,10,11,12] },
  { id: "waiter_04", name: "Mesero 4", zone: "B", tables: [13,14,15,16] },
  { id: "waiter_05", name: "Mesero 5", zone: "C", tables: [17,18,19,20] },
  { id: "waiter_06", name: "Mesero 6", zone: "C", tables: [21,22,23,24] },
  { id: "waiter_07", name: "Mesero 7", zone: "D", tables: [25,26,27,28] },
  { id: "waiter_08", name: "Mesero 8", zone: "D", tables: [29,30,31,32] },
  { id: "waiter_09", name: "Mesero 9", zone: "E", tables: [33,34,35,36] },
  { id: "waiter_10", name: "Mesero 10", zone: "E", tables: [37,38,39,40] },
  { id: "waiter_11", name: "Mesero 11", zone: "F", tables: [41,42,43] },
  { id: "waiter_12", name: "Mesero 12", zone: "F", tables: [44,45,46] },
  { id: "waiter_13", name: "Mesero 13", zone: "G", tables: [47,48] },
  { id: "waiter_14", name: "Mesero 14", zone: "G", tables: [49,50] },
  { id: "waiter_15", name: "Barman", zone: "H", tables: ["B1","B2","B3","B4","B5"] },
];
```

### Eventos Nuevos Necesarios

```typescript
// Solicitar cuenta
interface RequestCheckPayload {
  order_id: string;
  requested_by: string;  // waiter actor_id
  requested_at: string;
}

// Transferir orden
interface OrderTransferredPayload {
  order_id: string;
  from_waiter_id: string;
  to_waiter_id: string;
  reason?: string;
}

// Item listo notificación
interface ItemReadyNotificationPayload {
  order_id: string;
  line_id: string;
  table_number: string;
  item_name: string;
  waiter_id: string;
}
```

### UI de Notificaciones

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 NOTIFICACIONES                                    [Limpiar] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🍗 Mesa 12 - Pollo entero LISTO          hace 2 min     │   │
│  │    Recoger en COCINA                      [IR]          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🍺 Mesa 12 - 4x Gaseosa LISTO            hace 5 min     │   │
│  │    Recoger en BAR                         [IR]          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💰 Mesa 8 - Cuenta solicitada            hace 1 min     │   │
│  │    Total: S/ 125.00                       [VER]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PRIORIDADES DE IMPLEMENTACIÓN

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | 15 terminal_ids | Alto | 2h | 🔴 P0 |
| 2 | 50 mesas configurables | Alto | 2h | 🔴 P0 |
| 3 | Botones +/- funcionales | Alto | 2h | 🔴 P0 |
| 4 | Botón "Pedir Cuenta" | Alto | 4h | 🔴 P0 |
| 5 | Agregar Barra como zona | Medio | 1h | 🔴 P0 |
| 6 | Notificaciones de items listos | Alto | 8h | 🟡 P1 |
| 7 | Zonas por mesero | Medio | 4h | 🟡 P1 |
| 8 | Login de mesero | Alto | 4h | 🟡 P1 |
| 9 | Transferencia de mesa | Medio | 4h | 🟡 P1 |
| 10 | Tracking de propinas | Bajo | 6h | 🟢 P2 |

---

## FIXES RECIENTES

### ✅ Fix: Pedidos no llegaban a KDS ni Caja (19 Enero 2026)

**Problema:** Los pedidos creados por meseros no aparecían en las pantallas KDS ni en la lista de órdenes pendientes de caja.

**Causa raíz:** El evento `ORDER_SUBMITTED` se generaba correctamente pero el reducer `sale.reducer.ts` no lo procesaba.

**Solución implementada:**
1. Agregado case `ORDER_SUBMITTED` en el reducer
2. Agregado campo `submitted_at` a `SaleLine` para tracking
3. Items mantienen status `PENDING` para que KDS los vea
4. Implementación idempotente (replay-safe)

**Archivos modificados:**
- `src/core/projections/sale.reducer.ts` - Case ORDER_SUBMITTED
- `src/core/projections/types.ts` - Campo submitted_at
- `src/core/projections/__tests__/sale.reducer.order-submitted.test.ts` - 7 tests
- `e2e/waiter-to-kds.spec.ts` - 5 tests E2E

**Flujo completo ahora funciona:**
```
Mesero → Enviar a Cocina → ORDER_SUBMITTED → Reducer procesa → 
  ├─> KDS Parrilla ve items de PARRILLA
  ├─> KDS Cocina ve items de COCINA
  ├─> KDS Bar ve items de BAR
  └─> Caja ve orden en "Órdenes Pendientes"
```

**Tests:** 7 unit tests + 5 E2E tests ✅  
**Documentación:** `.kiro/specs/kds-order-submission-fix/`  
**Status:** ✅ FIXED - Listo para producción

---

**Documento creado:** Enero 2026  
**Última actualización:** 19 Enero 2026
