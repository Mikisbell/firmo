# 🍳 FLUJO DEL KDS (Kitchen Display System) — Análisis Profundo

> **Documento:** Sistema de pantallas de cocina y bar  
> **Fecha:** Enero 2026  
> **Estado:** Análisis del código actual + diseño de mejoras

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Estaciones de Preparación](#estaciones-de-preparación)
3. [Estado Actual del Código](#estado-actual-del-código)
4. [Escenarios Reales](#escenarios-reales)
5. [Problemas Detectados](#problemas-detectados)
6. [Diseño Propuesto](#diseño-propuesto)

---

## CONTEXTO DEL NEGOCIO

### ¿Qué es el KDS?

```
KDS = Kitchen Display System

PROPÓSITO:
- Reemplazar comandas de papel
- Mostrar pedidos en tiempo real
- Organizar trabajo por estación
- Medir tiempos de preparación
- Coordinar entre cocina y salón

BENEFICIOS:
- Menos errores (no hay letra ilegible)
- Mejor organización (por estación)
- Métricas de tiempo
- Comunicación instantánea
```

### Estaciones en una Pollería

```
POLLERÍA TÍPICA:

┌─────────────────────────────────────────────────────────────────┐
│                         COCINA                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  PARRILLA   │  │  FREIDORA   │  │   COCINA    │             │
│  │             │  │             │  │   FRÍA      │             │
│  │  - Pollos   │  │  - Papas    │  │  - Ensaladas│             │
│  │  - Carnes   │  │  - Yucas    │  │  - Cremas   │             │
│  │             │  │  - Camotes  │  │  - Aderezos │             │
│  │  [PANTALLA] │  │  [PANTALLA] │  │  [PANTALLA] │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          BAR                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                        BAR                               │   │
│  │                                                          │   │
│  │  - Gaseosas          - Cervezas        - Cócteles       │   │
│  │  - Jugos             - Vinos           - Shots          │   │
│  │  - Refrescos         - Pisco           - Chilcanos      │   │
│  │  - Chicha            - Sangría                          │   │
│  │                                                          │   │
│  │                      [PANTALLA]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Estados de Items

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PENDING  │────>│ COOKING  │────>│  READY   │────>│   DONE   │
│ (Gris)   │     │ (Verde)  │     │ (Amarillo)│    │ (Tachado)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                   │
     │              ┌──────────┐                         │
     └─────────────>│  VOIDED  │<────────────────────────┘
                    │  (Rojo)  │
                    └──────────┘
```

---

## ESTACIONES DE PREPARACIÓN

### Estación 1: PARRILLA

```
PRODUCTOS:
- Pollo a la brasa (1/4, 1/2, entero)
- Pollo broaster
- Anticuchos
- Chuletas
- Costillas

CARACTERÍSTICAS:
- Tiempo de preparación: 15-25 min
- Requiere atención constante
- Prioridad alta (producto principal)
- 1-2 parrilleros por turno

PANTALLA KDS:
- Mostrar tiempo desde que entró
- Alertar si > 20 min
- Agrupar por tipo de pollo
```

### Estación 2: FREIDORA

```
PRODUCTOS:
- Papas fritas
- Yucas fritas
- Camotes fritos
- Chicharrón
- Nuggets

CARACTERÍSTICAS:
- Tiempo de preparación: 5-10 min
- Puede preparar en batch
- Sincronizar con parrilla
- 1 freidorista por turno

PANTALLA KDS:
- Mostrar cantidad total de papas
- Agrupar pedidos cercanos
- Alertar cuando pollo casi listo
```

### Estación 3: COCINA FRÍA

```
PRODUCTOS:
- Ensaladas
- Cremas y aderezos
- Ají
- Sarsa criolla
- Vinagreta

CARACTERÍSTICAS:
- Tiempo de preparación: 2-5 min
- Puede preparar con anticipación
- Menor prioridad
- 1 ayudante por turno

PANTALLA KDS:
- Mostrar solo cuando orden casi lista
- Agrupar por tipo de ensalada
```

### Estación 4: BAR 🍺

```
PRODUCTOS:
- Gaseosas (personal, 1.5L, 3L)
- Cervezas (personal, grande, jarra)
- Jugos naturales
- Chicha morada
- Refrescos
- Cócteles (pisco sour, chilcano)
- Vinos
- Shots

CARACTERÍSTICAS:
- Tiempo de preparación: 1-5 min
- Alta rotación
- Puede servir antes que comida
- 1-2 barman por turno

PANTALLA KDS:
- Prioridad alta (cliente espera)
- Mostrar inmediatamente
- Separar bebidas simples de cócteles
```

---

## ESTADO ACTUAL DEL CÓDIGO

### Archivos Relevantes

```
src/app/kds/
├── page.tsx                    # Pantalla principal KDS
├── layout.tsx                  # Layout
└── hooks/
    └── useKitchenTickets.ts    # Obtener tickets
```

### Constantes Hardcodeadas

```typescript
// src/app/kds/page.tsx - Líneas 13-16
const TENANT_ID = "00000000-0000-0000-0000-000000000001";  // ❌
const TERM_ID = "kds_1";                                   // ❌ Solo 1 KDS
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";   // ❌ "Chef"
```

### Estaciones Hardcodeadas

```typescript
// src/app/kds/page.tsx - Línea 18
const STATIONS = ["All", "Cocina", "Parrilla", "Bar"];
// ⚠️ Falta "Freidora" y "Cocina Fría"
```

### Problema de Performance (CRÍTICO)

```typescript
// src/app/kds/hooks/useKitchenTickets.ts - Líneas 15-20
const events = await db.events
    .where("aggregate_type")
    .equals("ORDER")
    .toArray() as ParkEvent[];  // ❌ CARGA TODOS LOS EVENTOS ORDER

// Luego reconstruye CADA orden
for (const orderId in eventsByOrder) {
    // Replay completo de cada orden...
}
```

**Impacto:**
- Con 1000 órdenes históricas = 1000 replays
- Cada render recarga todo
- UI se congela en hora pico

### Filtro de Estación Incorrecto

```typescript
// src/app/kds/hooks/useKitchenTickets.ts - Líneas 48-51
const relevantLines = Object.values(state.lines).filter(l =>
    (stationFilter === "All" || 
     l.name.toLowerCase().includes(stationFilter.toLowerCase()) ||  // ❌ Busca en nombre
     (l as any).station === stationFilter)  // ✅ Correcto pero cast feo
    && l.status !== "DONE" && l.status !== "VOIDED"
);
```

**Problema:** Busca "Cocina" en el nombre del producto, no en la estación.

### Funcionalidad Actual

| Feature | Estado | Código |
|---------|--------|--------|
| Ver tickets | ✅ Funciona | `page.tsx` |
| Filtrar por estación | ⚠️ Parcial | `useKitchenTickets.ts` |
| Cambiar estado | ✅ Funciona | `handleStatusClick()` |
| Timer de tiempo | ❌ Roto | `getElapsedTime()` |
| Notificar mesero | ❌ No existe | - |
| Marcar agotado | ❌ No existe | - |
| Priorizar pedidos | ❌ No existe | - |
| Múltiples pantallas | ❌ Solo 1 | - |


---

## ESCENARIOS REALES

### ESCENARIO K1: Pedido Nuevo Llega a Cocina

```
SITUACIÓN:
- Mesero envía pedido de Mesa 12:
  - 1x Pollo entero (PARRILLA)
  - 2x Papas grandes (FREIDORA)
  - 1x Ensalada (COCINA FRÍA)
  - 4x Gaseosa (BAR)

FLUJO ESPERADO:
1. Sistema recibe ORDER_CREATED + ORDER_ITEM_ADDED x4
2. Cada estación ve SOLO sus items:
   - KDS Parrilla: "Mesa 12 - 1x Pollo entero"
   - KDS Freidora: "Mesa 12 - 2x Papas grandes"
   - KDS Cocina Fría: "Mesa 12 - 1x Ensalada"
   - KDS Bar: "Mesa 12 - 4x Gaseosa"
3. Timer empieza en cada estación
4. Sonido de alerta en cada pantalla

ESTADO ACTUAL: ⚠️ PARCIAL
- Tickets llegan a KDS
- ❌ No hay sonido
- ❌ Timer no funciona
- ⚠️ Filtro de estación impreciso
```

### ESCENARIO K2: Barman Prepara Bebidas (BAR)

```
SITUACIÓN:
- KDS Bar muestra: "Mesa 12 - 4x Gaseosa"
- Barman las prepara

FLUJO ESPERADO:
1. Barman ve ticket en pantalla BAR
2. Barman toca "4x Gaseosa"
3. Estado cambia: PENDING → COOKING
4. Barman sirve las gaseosas
5. Barman toca de nuevo
6. Estado cambia: COOKING → READY
7. Sistema notifica a Mesero:
   🔔 "Mesa 12 - Bebidas listas en BAR"
8. Mesero recoge y sirve
9. Mesero marca DONE (o automático)

ESTADO ACTUAL: ⚠️ PARCIAL
- Cambio de estado funciona
- ❌ No hay notificación a mesero
- ❌ No hay sonido
```

### ESCENARIO K3: Parrillero Prepara Pollo

```
SITUACIÓN:
- KDS Parrilla muestra: "Mesa 12 - 1x Pollo entero"
- Tiempo estimado: 20 minutos

FLUJO ESPERADO:
1. Parrillero ve ticket
2. Parrillero toca para marcar COOKING
3. Timer empieza a contar
4. A los 15 min, parrillero verifica
5. A los 18 min, pollo listo
6. Parrillero marca READY
7. Sistema notifica:
   - A Freidora: "Pollo Mesa 12 casi listo, preparar papas"
   - A Mesero: "Mesa 12 - Pollo listo en PARRILLA"
8. Freidora sincroniza papas

ESTADO ACTUAL: ❌ NO EXISTE
- No hay sincronización entre estaciones
- No hay notificación a freidora
- Timer roto
```

### ESCENARIO K4: Sincronización Parrilla-Freidora

```
SITUACIÓN:
- Pollo tarda 20 min
- Papas tardan 5 min
- Deben salir juntos

FLUJO ESPERADO:
1. Pedido llega a ambas estaciones
2. Parrilla empieza inmediatamente
3. Freidora ve: "Esperar - Pollo en 15 min"
4. A los 15 min, Freidora recibe alerta:
   🔔 "Iniciar papas para Mesa 12"
5. Freidora empieza papas
6. A los 20 min, ambos listos
7. Mesero recoge todo junto

ESTADO ACTUAL: ❌ NO EXISTE
- Cada estación trabaja independiente
- No hay coordinación
- Comida sale desincronizada
```

### ESCENARIO K5: Producto Agotado (86'd)

```
SITUACIÓN:
- Se acabó la Chicha Morada
- Barman debe marcar como agotado

FLUJO ESPERADO:
1. Barman accede a "Productos"
2. Barman busca "Chicha Morada"
3. Barman marca "AGOTADO"
4. Sistema genera PRODUCT_OUT_OF_STOCK
5. Todos los terminales reciben:
   - Meseros: Chicha aparece tachada/gris
   - Caja: Chicha no se puede agregar
6. Si hay pedidos pendientes con Chicha:
   - Notificar a meseros afectados
   - Ofrecer sustitución

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO K6: Hora Pico - 20 Tickets Simultáneos

```
SITUACIÓN:
- Sábado 8 PM
- 20 pedidos activos
- 3 cocineros en parrilla
- 1 en freidora
- 1 en bar

PROBLEMAS POTENCIALES:
1. Performance: useKitchenTickets hace full scan
2. Priorización: ¿Cuál pedido primero?
3. Asignación: ¿Quién hace qué?
4. Overflow: Pantalla no cabe todo

ESTADO ACTUAL: ❌ NO PREPARADO
- Full scan de eventos (O(n))
- Sin priorización
- Sin asignación de cocinero
- Sin scroll/paginación
```

### ESCENARIO K7: Pedido Urgente (VIP/Delivery)

```
SITUACIÓN:
- Pedido de Delivery con tiempo límite
- Debe salir en 15 minutos

FLUJO ESPERADO:
1. Pedido llega marcado como URGENTE
2. KDS muestra con borde rojo
3. Aparece al inicio de la cola
4. Timer más agresivo (alerta a los 10 min)
5. Sonido diferente
6. Cocineros priorizan

ESTADO ACTUAL: ❌ NO EXISTE
- No hay prioridades
- No hay marcado de urgente
- Todos los pedidos iguales
```

### ESCENARIO K8: Anulación desde Cocina

```
SITUACIÓN:
- Cocinero ve que no hay ingrediente para ensalada especial
- Debe anular el item

FLUJO ESPERADO:
1. Cocinero toca item "Ensalada Especial"
2. Cocinero presiona "No disponible"
3. Sistema genera ORDER_ITEM_VOIDED
4. Mesero recibe notificación:
   🔔 "Mesa 12 - Ensalada no disponible"
5. Mesero informa a cliente
6. Cliente decide: cambiar o quitar

ESTADO ACTUAL: ❌ NO EXISTE
- Cocinero no puede anular
- Solo puede cambiar estado
```

### ESCENARIO K9: Múltiples Pantallas KDS

```
SITUACIÓN:
- Cocina tiene 4 pantallas:
  - Pantalla 1: Parrilla
  - Pantalla 2: Freidora
  - Pantalla 3: Cocina Fría
  - Pantalla 4: Expedición (todo)

FLUJO ESPERADO:
1. Cada pantalla se configura con su estación
2. Cada pantalla muestra solo sus items
3. Pantalla de Expedición muestra todo
4. Cuando todo READY, Expedición alerta

ESTADO ACTUAL: ⚠️ PARCIAL
- Filtro por estación existe
- ❌ Solo 1 terminal_id
- ❌ No hay pantalla de expedición
```

### ESCENARIO K10: Reimpresión de Comanda

```
SITUACIÓN:
- Comanda se manchó/perdió
- Cocinero necesita reimprimir

FLUJO ESPERADO:
1. Cocinero toca ticket
2. Cocinero presiona "Reimprimir"
3. Impresora de cocina imprime comanda
4. Comanda tiene:
   - Número de orden
   - Mesa
   - Items con cantidades
   - Hora del pedido
   - Tiempo transcurrido

ESTADO ACTUAL: ❌ NO EXISTE
- No hay impresión
- No hay integración con impresora
```

### ESCENARIO K11: Modificación de Pedido en Curso

```
SITUACIÓN:
- Mesa 12 ya tiene pedido en cocina
- Cliente agrega 1 postre

FLUJO ESPERADO:
1. Mesero agrega postre
2. Sistema genera ORDER_ITEM_ADDED
3. KDS muestra:
   - Ticket existente se actualiza
   - Nuevo item aparece como PENDING
   - Indicador "MODIFICADO" en ticket
4. Cocinero ve el cambio claramente

ESTADO ACTUAL: ✅ FUNCIONA
- Items nuevos aparecen
- ⚠️ No hay indicador de modificación
```

### ESCENARIO K12: Cierre de Cocina

```
SITUACIÓN:
- Son las 10:30 PM
- Cocina cierra a las 11 PM
- Quedan 5 pedidos pendientes

FLUJO ESPERADO:
1. Admin marca "Último pedido" a las 10:30
2. Meseros ven: "Cocina cierra en 30 min"
3. No se pueden crear nuevos pedidos de cocina
4. Bar sigue abierto
5. Cocina termina pedidos pendientes
6. A las 11 PM, KDS Cocina se apaga

ESTADO ACTUAL: ❌ NO EXISTE
```

---

## PROBLEMAS DETECTADOS

### Críticos 🔴

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 1 | Full scan de eventos | Performance terrible | `useKitchenTickets.ts:15` |
| 2 | Timer roto | No muestra tiempo real | `getElapsedTime()` |
| 3 | Solo 1 terminal KDS | No hay múltiples pantallas | `page.tsx:14` |
| 4 | Sin notificación a mesero | Comunicación manual | - |
| 5 | Faltan estaciones | Solo 4, faltan 2 | `page.tsx:18` |

### Importantes 🟡

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 6 | Sin sincronización | Comida descoordinada | - |
| 7 | Sin priorización | Todos iguales | - |
| 8 | Sin "agotado" | Proceso manual | - |
| 9 | Sin sonidos | No hay alertas | - |
| 10 | Filtro impreciso | Busca en nombre | `useKitchenTickets.ts:48` |

### Menores 🟢

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 11 | Sin impresión | Backup manual | - |
| 12 | Sin métricas | No hay tiempos promedio | - |
| 13 | Sin asignación | Cocineros no asignados | - |

---

## DISEÑO PROPUESTO

### Configuración de Estaciones

```typescript
const KDS_STATIONS = [
  { 
    id: "PARRILLA", 
    name: "Parrilla",
    terminal_id: "kds_parrilla",
    color: "#EF4444",  // Rojo
    avg_time_min: 20,
    alert_time_min: 25,
    products: ["pollo", "anticucho", "chuleta", "costilla"]
  },
  { 
    id: "FREIDORA", 
    name: "Freidora",
    terminal_id: "kds_freidora",
    color: "#F59E0B",  // Amarillo
    avg_time_min: 8,
    alert_time_min: 12,
    sync_with: "PARRILLA",  // Sincronizar con parrilla
    products: ["papas", "yuca", "camote", "chicharron"]
  },
  { 
    id: "COCINA_FRIA", 
    name: "Cocina Fría",
    terminal_id: "kds_fria",
    color: "#3B82F6",  // Azul
    avg_time_min: 3,
    alert_time_min: 5,
    products: ["ensalada", "crema", "aji", "sarsa"]
  },
  { 
    id: "BAR", 
    name: "Bar",
    terminal_id: "kds_bar",
    color: "#8B5CF6",  // Púrpura
    avg_time_min: 2,
    alert_time_min: 5,
    products: ["gaseosa", "cerveza", "jugo", "chicha", "pisco", "vino"]
  },
  { 
    id: "EXPEDICION", 
    name: "Expedición",
    terminal_id: "kds_expedicion",
    color: "#10B981",  // Verde
    show_all: true,  // Muestra todo
    alert_when_ready: true
  }
];
```

### Eventos Nuevos Necesarios

```typescript
// Producto agotado
interface ProductOutOfStockPayload {
  product_id: string;
  station: string;
  reported_by: string;
  estimated_restock?: string;
}

// Producto disponible de nuevo
interface ProductRestockedPayload {
  product_id: string;
  station: string;
  reported_by: string;
}

// Item listo para servir
interface ItemReadyToServePayload {
  order_id: string;
  line_id: string;
  station: string;
  prepared_by: string;
}

// Sincronización de estaciones
interface StationSyncRequestPayload {
  order_id: string;
  from_station: string;
  to_station: string;
  message: string;  // "Pollo casi listo, preparar papas"
}
```

### Optimización de Performance

```typescript
// ANTES: Full scan
const events = await db.events
    .where("aggregate_type")
    .equals("ORDER")
    .toArray();

// DESPUÉS: Filtrar por fecha + estado
const today = new Date();
today.setHours(0, 0, 0, 0);

const events = await db.events
    .where("aggregate_type")
    .equals("ORDER")
    .and(e => new Date(e.occurred_at) >= today)
    .toArray();

// MEJOR AÚN: Usar proyección materializada
const activeOrders = await db.activeOrders
    .where("status")
    .anyOf(["OPEN", "IN_PROGRESS"])
    .toArray();
```

### UI de KDS Mejorada

```
┌─────────────────────────────────────────────────────────────────┐
│  🍳 KDS PARRILLA                              ⏱️ 19:45  🔊 ON   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ #067        │  │ #068        │  │ #069        │             │
│  │ Mesa 12     │  │ Mesa 8      │  │ DELIVERY    │             │
│  │ ⏱️ 12:34    │  │ ⏱️ 08:21    │  │ ⏱️ 05:12 🔴 │             │
│  │─────────────│  │─────────────│  │─────────────│             │
│  │             │  │             │  │             │             │
│  │ 1x Pollo    │  │ 2x 1/2 Pollo│  │ 1x Pollo    │             │
│  │    entero   │  │             │  │    broaster │             │
│  │ [COOKING 🔥]│  │ [PENDING]   │  │ [COOKING 🔥]│             │
│  │             │  │             │  │             │             │
│  │ 1x Anticucho│  │             │  │ 2x Anticucho│             │
│  │ [PENDING]   │  │             │  │ [PENDING]   │             │
│  │             │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  📊 Promedio: 18 min | Pendientes: 5 | Listos: 3 | Hoy: 45     │
└─────────────────────────────────────────────────────────────────┘
```

---

## PRIORIDADES DE IMPLEMENTACIÓN

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Optimizar query (filtro fecha) | Alto | 2h | 🔴 P0 |
| 2 | Arreglar timer | Alto | 1h | 🔴 P0 |
| 3 | Agregar estaciones faltantes | Medio | 1h | 🔴 P0 |
| 4 | Múltiples terminales KDS | Alto | 4h | 🔴 P0 |
| 5 | Notificación a mesero | Alto | 6h | 🟡 P1 |
| 6 | Sonidos de alerta | Medio | 2h | 🟡 P1 |
| 7 | Sincronización estaciones | Alto | 8h | 🟡 P1 |
| 8 | Producto agotado | Medio | 4h | 🟡 P1 |
| 9 | Priorización de pedidos | Medio | 4h | 🟡 P1 |
| 10 | Métricas de tiempo | Bajo | 4h | 🟢 P2 |

---

**Documento creado:** Enero 2026
