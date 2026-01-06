# 🪑 FLUJO_MESAS_LAYOUT — Gestión Visual de Mesas

> Mapa interactivo de 50 mesas en tiempo real, zonas A-H + Bar + Terraza

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Sin mapa visual, meseros no saben qué mesas están libres |
| **Solución** | Floor plan interactivo con estados en tiempo real |
| **Complejidad** | Media |
| **Prioridad** | 🟡 Alta - Mejora operación significativamente |

---

## 🎯 Escenarios de Uso

### Escenario 1: Ver Estado del Local
```
DADO que el host/anfitrión recibe clientes
CUANDO abre la app de mesas
ENTONCES ve el mapa completo del local
Y cada mesa muestra su estado (libre/ocupada/reservada)
Y puede asignar mesa con un tap
```

### Escenario 2: Unir Mesas (Grupo Grande)
```
DADO que llega un grupo de 12 personas
Y las mesas 5, 6 y 7 están libres (4 personas c/u)
CUANDO el host selecciona las 3 mesas
Y elige "Unir mesas"
ENTONCES se crea mesa virtual "5-6-7"
Y aparece como una sola unidad en el mapa
Y el pedido se asocia a la mesa unida
```

### Escenario 3: Dividir Mesa (Grupo se Separa)
```
DADO que la mesa unida "5-6-7" quiere pagar por separado
CUANDO el cajero elige "Dividir mesa"
ENTONCES puede asignar items a cada mesa original
Y genera cuentas separadas
Y las mesas vuelven a su estado individual
```

### Escenario 4: Cambiar de Mesa
```
DADO que la mesa 12 pide moverse a terraza (mesa 45)
CUANDO el mesero transfiere la mesa
ENTONCES el pedido se mueve a mesa 45
Y mesa 12 queda libre
Y el historial mantiene el cambio
```

### Escenario 5: Mesa Reservada
```
DADO que hay reserva para las 8PM en mesa 10
CUANDO son las 7:30PM
ENTONCES mesa 10 aparece en amarillo "RESERVADA"
Y muestra "Reserva: García - 8PM - 6 personas"
Y no se puede asignar a walk-ins
```

### Escenario 6: Editor de Layout (Admin)
```
DADO que el admin quiere reorganizar el local
CUANDO abre el editor de layout
ENTONCES puede arrastrar mesas
Y cambiar capacidad
Y crear/eliminar zonas
Y los cambios se sincronizan a todos los terminales
```

---

## 📊 Modelo de Datos

### Tabla: Table
```typescript
interface Table {
  id: string;
  tenant_id: string;
  location_id: string;
  
  number: string;                // "5", "5-6-7" (unida), "T1" (terraza)
  display_name?: string;         // Nombre personalizado
  
  zone_id: string;               // Zona donde está
  capacity: number;              // Personas máximo
  
  // Posición en el mapa (pixeles o %)
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;              // Grados
  shape: TableShape;             // SQUARE | ROUND | RECTANGLE
  
  // Estado actual
  status: TableStatus;
  current_order_id?: string;
  occupied_since?: Date;
  
  // Para mesas unidas
  is_merged: boolean;
  merged_table_ids?: string[];   // IDs de mesas originales
  parent_table_id?: string;      // Si es parte de una unión
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE' | 'OVAL';

type TableStatus = 
  | 'AVAILABLE'        // 🟢 Libre
  | 'OCCUPIED'         // 🔴 Ocupada
  | 'RESERVED'         // 🟡 Reservada
  | 'CLEANING'         // 🟠 Limpiando
  | 'BLOCKED';         // ⚫ Bloqueada (mantenimiento)
```

### Tabla: Zone
```typescript
interface Zone {
  id: string;
  tenant_id: string;
  location_id: string;
  
  code: string;                  // "A", "B", "BAR", "TERRAZA"
  name: string;                  // "Zona A - Principal"
  color: string;                 // "#4CAF50" para UI
  
  // Área en el mapa
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Configuración
  is_smoking: boolean;           // Zona fumadores
  is_outdoor: boolean;           // Exterior
  has_ac: boolean;               // Aire acondicionado
  
  // Asignación de meseros
  assigned_waiter_ids: string[];
  
  sort_order: number;
  is_active: boolean;
}
```

### Tabla: Table_Layout (Configuración del Mapa)
```typescript
interface TableLayout {
  id: string;
  tenant_id: string;
  location_id: string;
  
  name: string;                  // "Layout Principal"
  is_active: boolean;            // Solo uno activo por location
  
  // Dimensiones del canvas
  canvas_width: number;
  canvas_height: number;
  
  // Imagen de fondo (plano del local)
  background_image_url?: string;
  background_opacity: number;    // 0-100
  
  // Elementos decorativos
  decorations: Decoration[];
  
  created_at: Date;
  updated_at: Date;
}

interface Decoration {
  id: string;
  type: 'WALL' | 'DOOR' | 'WINDOW' | 'BAR' | 'KITCHEN' | 'RESTROOM' | 'LABEL';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
}
```

---

## 📡 Eventos de Dominio

```typescript
// Mesa ocupada
interface TableOccupiedEvent {
  type: 'TABLE_OCCUPIED';
  payload: {
    table_id: string;
    order_id: string;
    party_size: number;
    waiter_id: string;
  };
}

// Mesa liberada
interface TableReleasedEvent {
  type: 'TABLE_RELEASED';
  payload: {
    table_id: string;
    order_id: string;
    duration_minutes: number;
    total_spent: number;         // centavos
  };
}

// Mesas unidas
interface TablesMergedEvent {
  type: 'TABLES_MERGED';
  payload: {
    merged_table_id: string;     // Nueva mesa virtual
    source_table_ids: string[];  // Mesas originales
    new_capacity: number;
  };
}

// Mesas separadas
interface TablesSplitEvent {
  type: 'TABLES_SPLIT';
  payload: {
    merged_table_id: string;
    restored_table_ids: string[];
  };
}

// Pedido transferido
interface TableTransferredEvent {
  type: 'TABLE_TRANSFERRED';
  payload: {
    order_id: string;
    from_table_id: string;
    to_table_id: string;
    reason?: string;
  };
}

// Layout actualizado
interface LayoutUpdatedEvent {
  type: 'LAYOUT_UPDATED';
  payload: {
    layout_id: string;
    changes: Array<{
      table_id: string;
      field: string;
      old_value: any;
      new_value: any;
    }>;
  };
}
```

---

## 🖥️ UI Mockups

### Mapa de Mesas (Vista Principal)
```
┌─────────────────────────────────────────────────────────────┐
│  🪑 MESAS - Local Centro                    [🔄] [⚙️ Edit] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Zonas: [Todas] [A] [B] [C] [Bar] [Terraza]                │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │    ┌───┐  ┌───┐  ┌───┐  ┌───┐      ┌─────────────┐    ││
│  │    │ 1 │  │ 2 │  │ 3 │  │ 4 │      │             │    ││
│  │    │🟢 │  │🔴 │  │🔴 │  │🟢 │      │    BAR      │    ││
│  │    └───┘  └───┘  └───┘  └───┘      │   🟢 🟢 🔴  │    ││
│  │                                     └─────────────┘    ││
│  │    ┌───┐  ┌───────────┐  ┌───┐                         ││
│  │    │ 5 │  │   6-7-8   │  │ 9 │      ZONA A             ││
│  │    │🟡 │  │    🔴     │  │🟢 │                         ││
│  │    └───┘  └───────────┘  └───┘                         ││
│  │    Rsv                                                  ││
│  │    8PM   ┌───┐  ┌───┐  ┌───┐  ┌───┐                    ││
│  │          │10 │  │11 │  │12 │  │13 │    ZONA B          ││
│  │          │🟢 │  │🔴 │  │🟠 │  │🟢 │                    ││
│  │          └───┘  └───┘  └───┘  └───┘                    ││
│  │                        Limp.                            ││
│  │  ═══════════════════════════════════════════════════   ││
│  │                      TERRAZA                            ││
│  │    (○)    (○)    (○)    (○)    (○)                     ││
│  │    T1🟢   T2🟢   T3🔴   T4🟢   T5🟢                    ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  🟢 Libre: 12  🔴 Ocupada: 8  🟡 Reservada: 2  🟠 Limpiando: 1│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Detalle de Mesa (al tocar)
```
┌─────────────────────────────────────────────────────────────┐
│  Mesa 6-7-8 (Unida)                                  [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Estado: 🔴 OCUPADA                                         │
│  Capacidad: 12 personas                                     │
│  Zona: A - Principal                                        │
│  Mesero: Carlos M.                                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Pedido Actual: #1234                                       │
│  Ocupada desde: 19:45 (hace 45 min)                         │
│  Personas: 10                                               │
│  Total parcial: S/ 285.00                                   │
│                                                             │
│  Items:                                                     │
│  • 3x Pollo Entero                                          │
│  • 2x 1/2 Pollo                                             │
│  • 5x Inca Kola 1.5L                                        │
│  • 1x Ensalada Extra                                        │
│                                                             │
│  [📝 Ver Pedido] [💳 Cobrar] [🔄 Transferir] [✂️ Dividir]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Editor de Layout (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ EDITOR DE LAYOUT                    [Guardar] [Cancelar]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Herramientas:                                              │
│  [🪑 Mesa] [⬜ Zona] [🚪 Puerta] [🧱 Pared] [🏷️ Etiqueta]  │
│                                                             │
│  ┌───────────────────────────────────────┬─────────────────┐│
│  │                                       │ Propiedades     ││
│  │     [Canvas del mapa con             │                 ││
│  │      elementos arrastrables]          │ Mesa 5          ││
│  │                                       │ ─────────────── ││
│  │     ┌───┐ ← Mesa seleccionada        │ Número: [5    ] ││
│  │     │ 5 │                            │ Capacidad: [4 ] ││
│  │     └───┘                            │ Forma: [■ ▼]   ││
│  │                                       │ Zona: [A ▼]    ││
│  │                                       │ Rotación: [0°] ││
│  │                                       │                 ││
│  │                                       │ [🗑️ Eliminar]  ││
│  │                                       │                 ││
│  └───────────────────────────────────────┴─────────────────┘│
│                                                             │
│  Zoom: [−] ████████░░ [+]   Grid: [✓]   Snap: [✓]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Sincronización en Tiempo Real

### WebSocket/SSE para Estados
```typescript
// Todos los terminales suscritos reciben:
interface TableStatusUpdate {
  type: 'TABLE_STATUS_CHANGED';
  payload: {
    table_id: string;
    new_status: TableStatus;
    order_id?: string;
    updated_at: string;
  };
}

// Actualización cada vez que:
// - Se abre una mesa (nuevo pedido)
// - Se cierra una mesa (pago completado)
// - Se une/divide mesas
// - Se transfiere pedido
// - Cambia a "limpiando"
```

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + API básica | 2 días |
| **2** | Vista de mapa (solo lectura) | 2 días |
| **3** | Interacción (tap para ver/asignar) | 2 días |
| **4** | Unir/dividir mesas | 2 días |
| **5** | Transferir pedidos | 1 día |
| **6** | Editor de layout | 3 días |
| **7** | Sync tiempo real | 1 día |

**Total estimado: 13 días de desarrollo**

---

*Última actualización: Enero 2026*
