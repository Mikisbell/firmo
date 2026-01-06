# 📅 FLUJO_RESERVAS — Sistema de Reservaciones

> Gestión de reservas con confirmación WhatsApp y prevención de overbooking

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Reservas en papel se pierden, overbooking frecuente |
| **Solución** | Sistema digital con confirmación automática |
| **Complejidad** | Media |
| **Prioridad** | 🟡 Media - Mejora experiencia cliente |

---

## 🎯 Escenarios de Uso

### Escenario 1: Reserva por Teléfono
```
DADO que un cliente llama para reservar
CUANDO el host ingresa:
  - Nombre: García
  - Teléfono: 987654321
  - Fecha: 05/01/2026
  - Hora: 8:00 PM
  - Personas: 6
ENTONCES el sistema sugiere mesas disponibles
Y se crea la reserva
Y se envía WhatsApp de confirmación
```

### Escenario 2: Confirmación Automática
```
DADO que hay reserva para mañana 8PM
CUANDO son las 10AM del día de la reserva
ENTONCES se envía WhatsApp automático:
  "Hola García! Te recordamos tu reserva hoy a las 8PM 
   para 6 personas. ¿Confirmas? Responde SI o NO"
Y si responde SI → se marca confirmada
Y si responde NO → se libera la mesa
Y si no responde en 4 horas → se llama manualmente
```

### Escenario 3: Cliente No Llega (No-Show)
```
DADO que la reserva era a las 8PM
Y son las 8:30PM y el cliente no llegó
CUANDO el host marca como "No-Show"
ENTONCES se libera la mesa
Y se registra en historial del cliente
Y si tiene 3+ no-shows → se marca como "cliente riesgoso"
```

### Escenario 4: Reserva con Depósito
```
DADO que es reserva para 15+ personas
CUANDO se crea la reserva
ENTONCES se solicita depósito de S/100
Y se envía link de pago por WhatsApp
Y la reserva queda "Pendiente de Pago"
Y si no paga en 24h → se cancela automáticamente
```

### Escenario 5: Modificar Reserva
```
DADO que García quiere cambiar de 6 a 8 personas
CUANDO el host modifica la reserva
ENTONCES verifica disponibilidad de mesa más grande
Y si hay → actualiza la reserva
Y si no hay → ofrece alternativas (otra hora/fecha)
```

### Escenario 6: Lista de Espera
```
DADO que no hay mesas disponibles para las 8PM
CUANDO el cliente quiere reservar igual
ENTONCES se agrega a lista de espera
Y si se libera una mesa → se notifica automáticamente
Y tiene 30 min para confirmar
```

---

## 📊 Modelo de Datos

### Tabla: Reservation
```typescript
interface Reservation {
  id: string;
  tenant_id: string;
  location_id: string;
  
  // Cliente
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_id?: string;          // Si es cliente registrado
  
  // Fecha y hora
  date: Date;                    // Solo fecha
  time: string;                  // "20:00"
  duration_minutes: number;      // Duración estimada (default 90)
  
  // Capacidad
  party_size: number;
  
  // Mesa asignada
  table_id?: string;
  table_number?: string;
  zone_preference?: string;      // "TERRAZA", "INTERIOR"
  
  // Estado
  status: ReservationStatus;
  
  // Confirmación
  confirmation_sent_at?: Date;
  confirmed_at?: Date;
  confirmed_via?: 'WHATSAPP' | 'PHONE' | 'EMAIL';
  
  // Depósito
  deposit_required: boolean;
  deposit_amount?: number;       // centavos
  deposit_paid_at?: Date;
  deposit_payment_id?: string;
  
  // Notas
  special_requests?: string;     // "Cumpleaños", "Silla bebé"
  internal_notes?: string;
  
  // Historial
  arrived_at?: Date;
  seated_at?: Date;
  no_show_at?: Date;
  cancelled_at?: Date;
  cancelled_reason?: string;
  
  // Auditoría
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

type ReservationStatus = 
  | 'PENDING'            // Creada, sin confirmar
  | 'PENDING_DEPOSIT'    // Esperando pago
  | 'CONFIRMED'          // Confirmada
  | 'WAITLIST'           // En lista de espera
  | 'SEATED'             // Cliente sentado
  | 'COMPLETED'          // Terminó su visita
  | 'NO_SHOW'            // No llegó
  | 'CANCELLED';         // Cancelada
```

### Tabla: Waitlist
```typescript
interface WaitlistEntry {
  id: string;
  tenant_id: string;
  location_id: string;
  
  customer_name: string;
  customer_phone: string;
  
  date: Date;
  preferred_time: string;
  party_size: number;
  
  position: number;              // Posición en la cola
  
  notified_at?: Date;
  expires_at?: Date;             // 30 min para confirmar
  
  status: 'WAITING' | 'NOTIFIED' | 'CONVERTED' | 'EXPIRED';
  
  created_at: Date;
}
```

---

## 📡 Eventos de Dominio

```typescript
interface ReservationCreatedEvent {
  type: 'RESERVATION_CREATED';
  payload: {
    reservation_id: string;
    customer_name: string;
    date: string;
    time: string;
    party_size: number;
    table_id?: string;
  };
}

interface ReservationConfirmedEvent {
  type: 'RESERVATION_CONFIRMED';
  payload: {
    reservation_id: string;
    confirmed_via: string;
  };
}

interface ReservationNoShowEvent {
  type: 'RESERVATION_NO_SHOW';
  payload: {
    reservation_id: string;
    customer_phone: string;
    no_show_count: number;       // Histórico del cliente
  };
}

interface ReservationSeatedEvent {
  type: 'RESERVATION_SEATED';
  payload: {
    reservation_id: string;
    table_id: string;
    actual_party_size: number;
    minutes_early_late: number;  // Negativo = temprano
  };
}
```

---

## 🖥️ UI Mockups

### Calendario de Reservas
```
┌─────────────────────────────────────────────────────────────┐
│  📅 RESERVAS - Enero 2026                    [+ Nueva]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ◀ [Semana 1]  Dom 5 │ Lun 6 │ Mar 7 │ Mie 8 │ ... ▶      │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Hora  │ Dom 5          │ Lun 6          │ Mar 7        ││
│  ├───────┼────────────────┼────────────────┼──────────────┤│
│  │ 12:00 │ García (4) ✓   │                │ López (2) ✓  ││
│  │ 12:30 │                │ Pérez (6) ⏳   │              ││
│  │ 13:00 │ Cumpleaños (15)│ Martínez (4) ✓│              ││
│  │ ...   │                │                │              ││
│  │ 19:00 │                │                │              ││
│  │ 19:30 │ Rodríguez (8)✓ │                │ Torres (6) ⏳││
│  │ 20:00 │ Sánchez (4) ✓  │ Flores (10) 💰│ Vargas (4) ✓ ││
│  │ 20:30 │ Castro (6) ✓   │                │              ││
│  │ 21:00 │                │ Díaz (4) ✓     │              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ✓ Confirmada  ⏳ Pendiente  💰 Requiere depósito          │
│                                                             │
│  Hoy: 8 reservas │ 52 personas │ 2 pendientes              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Formulario Nueva Reserva
```
┌─────────────────────────────────────────────────────────────┐
│  📅 NUEVA RESERVA                                    [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nombre: [García                    ]                       │
│  Teléfono: [987 654 321            ] [📱 Buscar cliente]   │
│                                                             │
│  Fecha: [05/01/2026  📅]    Hora: [20:00 ▼]                │
│  Personas: [6  ▼]           Duración: [90 min ▼]           │
│                                                             │
│  Preferencia: ( ) Interior  (•) Terraza  ( ) Sin preferencia│
│                                                             │
│  Mesa sugerida: Mesa 12 (Terraza, 8 personas) ✓ Disponible │
│                 [Cambiar mesa]                              │
│                                                             │
│  Ocasión especial:                                          │
│  [ ] Cumpleaños  [ ] Aniversario  [ ] Negocios  [ ] Otro   │
│                                                             │
│  Notas: [Necesitan silla para bebé              ]          │
│                                                             │
│  [ ] Requiere depósito (S/100)                              │
│                                                             │
│  [Cancelar]                    [✓ Crear y Enviar WhatsApp]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Vista del Día (Host)
```
┌─────────────────────────────────────────────────────────────┐
│  📅 HOY - Domingo 5 Enero                    [🔄] [+ Nueva] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Próximas:                                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 19:30 │ Rodríguez │ 8 pers │ Mesa 6-7 │ ✓ Confirmado││
│  │          │ 987654321 │ Terraza│          │ [📞] [✓ Llegó]│
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 20:00 │ Sánchez   │ 4 pers │ Mesa 10  │ ✓ Confirmado││
│  │          │ 912345678 │ Interior│         │ [📞] [✓ Llegó]│
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 20:30 │ Castro    │ 6 pers │ Mesa 15  │ ⏳ Pendiente ││
│  │          │ 998877665 │        │          │ [📱 Confirmar]│
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Lista de Espera (3):                                       │
│  1. Mendoza (4 pers) - 20:00 - Hace 15 min                 │
│  2. Vargas (2 pers) - 20:30 - Hace 8 min                   │
│  3. Luna (6 pers) - 21:00 - Hace 2 min                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Integración WhatsApp

### Mensajes Automáticos
```typescript
const WHATSAPP_TEMPLATES = {
  CONFIRMATION: `
Hola {{nombre}}! 👋

Tu reserva en PARK Pollería está confirmada:
📅 {{fecha}}
🕐 {{hora}}
👥 {{personas}} personas
🪑 {{mesa}}

¿Necesitas modificar? Responde a este mensaje.

¡Te esperamos! 🍗
  `,
  
  REMINDER: `
Hola {{nombre}}! 👋

Te recordamos tu reserva para HOY:
🕐 {{hora}}
👥 {{personas}} personas

¿Confirmas tu asistencia?
Responde SI o NO

Si no confirmas antes de las {{hora_limite}}, 
tu mesa podría ser reasignada.
  `,
  
  DEPOSIT_REQUEST: `
Hola {{nombre}}! 👋

Para confirmar tu reserva de {{personas}} personas,
necesitamos un depósito de S/{{monto}}.

Paga aquí: {{link_pago}}

Tienes hasta {{fecha_limite}} para completar el pago.
  `,
  
  WAITLIST_AVAILABLE: `
Hola {{nombre}}! 🎉

¡Buenas noticias! Se liberó una mesa para {{hora}}.

¿La quieres? Tienes 30 minutos para confirmar.
Responde SI para reservar.
  `
};
```

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + CRUD básico | 2 días |
| **2** | Calendario UI | 2 días |
| **3** | Integración WhatsApp | 2 días |
| **4** | Confirmación automática | 1 día |
| **5** | Lista de espera | 1 día |
| **6** | Depósitos | 2 días |

**Total estimado: 10 días de desarrollo**

---

*Última actualización: Enero 2026*
