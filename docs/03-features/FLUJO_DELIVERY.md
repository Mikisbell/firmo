# 🛵 FLUJO DE DELIVERY — Diseño Completo

> **Documento:** Sistema de delivery y para llevar  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero — Solo existe el tipo en schema

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Tipos de Pedidos](#tipos-de-pedidos)
3. [Estado Actual del Código](#estado-actual-del-código)
4. [Escenarios Reales](#escenarios-reales)
5. [Diseño Propuesto](#diseño-propuesto)
6. [Integraciones](#integraciones)
7. [Implementación](#implementación)

---

## CONTEXTO DEL NEGOCIO

### ¿Por qué Delivery en una Pollería?

```
REALIDAD DEL MERCADO PERUANO:

- 40% de ventas de pollerías son delivery/para llevar
- Apps dominantes: Rappi, PedidosYa, Uber Eats
- Muchas pollerías tienen delivery propio
- Yape/Plin facilitan pago anticipado
- COVID aceleró adopción de delivery

TIPOS DE CLIENTES:
1. Cliente que llama por teléfono
2. Cliente que pide por WhatsApp
3. Cliente que usa app de delivery
4. Cliente que viene a recoger (TAKEOUT)
```

### Canales de Pedido

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANALES DE DELIVERY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  TELÉFONO   │  │  WHATSAPP   │  │   APPS      │             │
│  │             │  │             │  │             │             │
│  │  Cajero     │  │  Cajero o   │  │  Rappi      │             │
│  │  recibe     │  │  Bot        │  │  PedidosYa  │             │
│  │  llamada    │  │  responde   │  │  Uber Eats  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                   ┌─────────────┐                               │
│                   │  PARK POS   │                               │
│                   │  (Central)  │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   COCINA    │  │ MOTORIZADO  │  │  CLIENTE    │             │
│  │   (KDS)     │  │  (Propio)   │  │  (Recoge)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Métricas Típicas

```
POLLERÍA MEDIANA:
- Pedidos delivery/día: 30-80
- Ticket promedio delivery: S/ 55-85 (mayor que local)
- Tiempo promedio preparación: 20-30 min
- Radio de cobertura: 3-5 km
- Costo de delivery: S/ 5-10

HORARIOS PICO DELIVERY:
- Almuerzo: 12:00 - 14:00
- Cena: 19:00 - 21:00
- Domingos: Todo el día
```

---

## TIPOS DE PEDIDOS

### Tipo 1: DINE_IN (En Local)

```
CARACTERÍSTICAS:
- Cliente come en el restaurante
- Asignado a una mesa
- Mesero atiende
- Pago al final

FLUJO:
Mesa → Mesero → Cocina → Servir → Cobrar

ESTADO ACTUAL: ✅ IMPLEMENTADO
```

### Tipo 2: TAKEOUT (Para Llevar)

```
CARACTERÍSTICAS:
- Cliente viene a recoger
- No hay mesa asignada
- Pago anticipado o al recoger
- Empaque para llevar

FLUJO:
Pedido → Cocina → Empacar → Cliente recoge → Entregar

ESTADO ACTUAL: ⚠️ TIPO EXISTE, SIN UI
```

### Tipo 3: DELIVERY (Envío a Domicilio)

```
CARACTERÍSTICAS:
- Cliente en su casa/oficina
- Dirección de entrega
- Motorizado asignado
- Pago anticipado o contra-entrega

FLUJO:
Pedido → Cocina → Empacar → Motorizado → Entregar → Confirmar

ESTADO ACTUAL: ⚠️ TIPO EXISTE, SIN UI
```

---

## ESTADO ACTUAL DEL CÓDIGO

### Lo que existe

```typescript
// src/core/domain/events.ts - Línea 20
export const OrderTypeSchema = z.enum(["DINE_IN", "TAKEOUT", "DELIVERY"]);

// src/core/domain/events.ts - Líneas 157-167
export const DeliverySchema = z.object({
    courier_type: z.enum(["OWN", "APP"]).optional(),
    delivery_fee_cents: positiveCentsSchema.default(0),
    assigned_driver_id: uuidSchema.optional(),
    payment_expectation: z.enum(["PREPAID", "COD"]).default("PREPAID"),
});

// src/app/kds/page.tsx - Línea 95
const isDelivery = ticket.order_type === "DELIVERY";
// KDS muestra diferente color para delivery
```

### Lo que NO existe

```
❌ UI para crear pedido delivery
❌ UI para crear pedido takeout
❌ Gestión de direcciones
❌ Gestión de motorizados
❌ Tracking de pedido
❌ Integración con apps (Rappi, etc.)
❌ Cálculo de delivery fee
❌ Zonas de cobertura
❌ Tiempos estimados
❌ Notificaciones al cliente
```


---

## ESCENARIOS REALES

### ESCENARIO D1: Cliente Llama por Teléfono

```
SITUACIÓN:
- Cliente llama al local
- Quiere 1 pollo + papas + gaseosa
- Paga contra-entrega en efectivo

FLUJO ESPERADO:
1. Cajero contesta teléfono
2. Abre POS → "Nuevo Pedido" → "Delivery"
3. Ingresa datos del cliente:
   - Nombre: "Carlos Pérez"
   - Teléfono: 987654321
   - Dirección: "Av. Arequipa 1234, Dpto 501"
   - Referencia: "Frente al grifo"
4. Agrega productos:
   - 1 Pollo entero: S/ 58
   - Papas grandes: S/ 12
   - Inca Kola 1.5L: S/ 8
5. Sistema calcula:
   - Subtotal: S/ 78
   - Delivery: S/ 6 (zona cercana)
   - Total: S/ 84
6. Cajero selecciona: "Pago contra-entrega"
7. Confirma pedido
8. Ticket va a cocina (KDS muestra 🛵)
9. Cajero asigna motorizado disponible

ESTADO ACTUAL: ❌ NO EXISTE UI
```

### ESCENARIO D2: Pedido por WhatsApp

```
SITUACIÓN:
- Cliente escribe por WhatsApp
- Envía foto de lo que quiere
- Paga con Yape antes

FLUJO ESPERADO:
1. Cajero ve mensaje de WhatsApp
2. Abre POS → "Nuevo Pedido" → "Delivery"
3. Busca cliente por teléfono (si existe)
4. Si no existe, crea nuevo:
   - Nombre: "María García"
   - Teléfono: 912345678
   - Dirección: "Jr. Cusco 456, San Isidro"
5. Agrega productos según pedido
6. Total: S/ 65 (incluye delivery)
7. Selecciona: "Prepagado - Yape"
8. Cliente envía Yape
9. Cajero confirma pago recibido
10. Pedido entra a cocina
11. Cuando está listo, asigna motorizado

ESTADO ACTUAL: ❌ NO EXISTE UI
```

### ESCENARIO D3: Pedido de Rappi

```
SITUACIÓN:
- Llega pedido de Rappi
- Motorizado de Rappi viene a recoger
- Rappi paga después

FLUJO ESPERADO:
1. Tablet de Rappi suena con nuevo pedido
2. Cajero acepta en Rappi
3. Sistema PARK POS recibe webhook (futuro)
   O cajero ingresa manualmente:
4. POS → "Nuevo Pedido" → "Delivery App"
5. Selecciona: Rappi
6. Ingresa número de pedido Rappi: #R12345
7. Agrega productos según pedido Rappi
8. Pago: "App - Rappi" (no cobra al cliente)
9. Pedido va a cocina con etiqueta "RAPPI #R12345"
10. Cuando está listo:
    - KDS marca como listo
    - Cajero empaca con sticker Rappi
    - Motorizado Rappi recoge

ESTADO ACTUAL: ❌ NO EXISTE UI
```

### ESCENARIO D4: Cliente Viene a Recoger (TAKEOUT)

```
SITUACIÓN:
- Cliente llama: "Voy en 20 minutos"
- Quiere tener listo para recoger
- Paga al llegar

FLUJO ESPERADO:
1. Cajero recibe llamada
2. POS → "Nuevo Pedido" → "Para Llevar"
3. Ingresa:
   - Nombre: "Juan López"
   - Teléfono: 999888777
   - Hora estimada: 20 min
4. Agrega productos
5. Total: S/ 45 (sin delivery)
6. Pago: "Pendiente - Recoger"
7. Pedido va a cocina
8. KDS muestra: "PARA LLEVAR - Juan - 20 min"
9. Cocina prepara con timing
10. Cliente llega, cajero cobra
11. Entrega pedido empacado

ESTADO ACTUAL: ❌ NO EXISTE UI
```

### ESCENARIO D5: Delivery Propio con Tracking

```
SITUACIÓN:
- Pedido listo para enviar
- Motorizado propio disponible
- Cliente quiere saber cuándo llega

FLUJO ESPERADO:
1. Cocina marca pedido como LISTO
2. Cajero ve en pantalla: "Pedidos listos para envío"
3. Asigna motorizado: "Pedro (Moto 1)"
4. Sistema registra:
   - Hora de salida
   - Motorizado asignado
   - Dirección destino
5. (Futuro) Cliente recibe SMS/WhatsApp:
   "Tu pedido está en camino 🛵"
6. Motorizado entrega
7. Motorizado marca como "Entregado" en su app
8. Sistema registra hora de entrega
9. Métricas: Tiempo total = 35 min

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO D6: Cambio de Dirección en Vuelo

```
SITUACIÓN:
- Pedido ya en camino
- Cliente llama: "Cambié de lugar"

FLUJO ESPERADO:
1. Cajero busca pedido activo
2. Ve estado: "En camino - Pedro"
3. Edita dirección:
   - Nueva: "Av. Javier Prado 789"
4. Sistema notifica a motorizado
5. Motorizado ve nueva dirección
6. Se recalcula tiempo estimado
7. (Opcional) Cobro adicional si zona más lejos

PROBLEMA POTENCIAL:
- ¿Qué pasa si ya está llegando?
- ¿Quién autoriza cambio de zona?

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO D7: Pedido Cancelado Después de Preparar

```
SITUACIÓN:
- Pedido listo
- Cliente cancela
- ¿Qué pasa con la comida?

FLUJO ESPERADO:
1. Cliente llama: "Cancelo el pedido"
2. Cajero busca pedido
3. Ve estado: "Listo para envío"
4. Intenta cancelar
5. Sistema advierte:
   ⚠️ "Pedido ya preparado"
   - Costo de productos: S/ 58
   - ¿Proceder con cancelación?
6. Requiere autorización de supervisor
7. Supervisor aprueba con motivo
8. Sistema registra:
   - Pedido cancelado
   - Motivo: "Cliente canceló"
   - Pérdida: S/ 58
   - Autorizado por: Admin
9. Comida va a "merma" o consumo interno

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO D8: Reclamo por Pedido Incompleto

```
SITUACIÓN:
- Cliente recibe pedido
- Falta la gaseosa
- Quiere solución

FLUJO ESPERADO:
1. Cliente llama reclamando
2. Cajero busca pedido por número/teléfono
3. Ve detalle del pedido:
   - 1 Pollo ✓
   - Papas ✓
   - Inca Kola 1.5L ← FALTANTE
4. Opciones:
   a) Enviar producto faltante
   b) Reembolso parcial
   c) Crédito para próximo pedido
5. Cajero selecciona: "Enviar faltante"
6. Sistema crea pedido complementario:
   - Solo Inca Kola
   - Sin costo de delivery
   - Vinculado al pedido original
7. Se registra incidente para métricas

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO D9: Zona Fuera de Cobertura

```
SITUACIÓN:
- Cliente quiere delivery
- Dirección muy lejos (8 km)

FLUJO ESPERADO:
1. Cajero ingresa dirección
2. Sistema detecta: "Fuera de zona de cobertura"
3. Opciones:
   a) Rechazar pedido
   b) Cobrar delivery especial (S/ 15)
   c) Sugerir recojo en local
4. Cajero informa al cliente
5. Cliente acepta delivery especial
6. Sistema agrega: Delivery zona extendida S/ 15
7. Pedido procede normalmente

CONFIGURACIÓN NECESARIA:
- Zonas de cobertura (polígonos o radios)
- Tarifas por zona
- Zonas bloqueadas

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO D10: Múltiples Pedidos para Mismo Motorizado

```
SITUACIÓN:
- 3 pedidos listos
- Direcciones cercanas
- Un solo motorizado

FLUJO ESPERADO:
1. Cajero ve 3 pedidos listos:
   - #101: Av. Arequipa 1000
   - #102: Av. Arequipa 1500
   - #103: Jr. Cusco 200
2. Asigna los 3 a "Pedro"
3. Sistema sugiere ruta óptima:
   1° → #103 (más cercano)
   2° → #101
   3° → #102
4. Pedro sale con 3 pedidos
5. Va marcando entregas:
   - 19:15 - #103 entregado
   - 19:25 - #101 entregado
   - 19:35 - #102 entregado
6. Sistema calcula métricas por pedido

ESTADO ACTUAL: ❌ NO EXISTE
```


---

## DISEÑO PROPUESTO

### Modelo de Datos: Cliente de Delivery

```typescript
// Nuevo modelo para clientes de delivery
interface DeliveryCustomer {
  customer_id: string;        // UUID
  tenant_id: string;
  
  // Datos básicos
  name: string;
  phone: string;              // Único por tenant
  email?: string;
  
  // Direcciones (puede tener varias)
  addresses: DeliveryAddress[];
  default_address_id?: string;
  
  // Historial
  total_orders: number;
  total_spent_cents: number;
  last_order_at?: string;
  
  // Preferencias
  preferred_payment?: PaymentMethod;
  notes?: string;             // "Alérgico a maní"
  
  // Estado
  created_at: string;
  updated_at: string;
}

interface DeliveryAddress {
  address_id: string;
  label?: string;             // "Casa", "Oficina"
  address_text: string;       // Dirección completa
  reference?: string;         // "Frente al grifo"
  district?: string;          // Para calcular zona
  coordinates?: {
    lat: number;
    lng: number;
  };
  zone_id?: string;           // Zona de cobertura
  delivery_fee_cents: number; // Tarifa calculada
}
```

### Modelo de Datos: Motorizado

```typescript
interface Driver {
  driver_id: string;          // UUID
  tenant_id: string;
  
  // Datos
  name: string;
  phone: string;
  vehicle_type: "MOTO" | "BICI" | "AUTO";
  vehicle_plate?: string;
  
  // Estado actual
  status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE";
  current_location?: {
    lat: number;
    lng: number;
    updated_at: string;
  };
  
  // Pedidos asignados
  active_orders: string[];    // order_ids
  
  // Métricas
  deliveries_today: number;
  avg_delivery_time_mins: number;
  rating?: number;
  
  // Acceso
  pin?: string;               // Para app de motorizado
  
  created_at: string;
  is_active: boolean;
}
```

### Modelo de Datos: Zona de Cobertura

```typescript
interface DeliveryZone {
  zone_id: string;
  tenant_id: string;
  
  name: string;               // "Zona Centro", "Zona Norte"
  
  // Definición geográfica
  type: "RADIUS" | "POLYGON";
  center?: { lat: number; lng: number };  // Para RADIUS
  radius_km?: number;
  polygon?: { lat: number; lng: number }[];  // Para POLYGON
  
  // Tarifas
  delivery_fee_cents: number;
  min_order_cents?: number;   // Pedido mínimo
  
  // Tiempo estimado
  estimated_mins: number;
  
  // Estado
  is_active: boolean;
  priority: number;           // Para zonas superpuestas
}
```

### Eventos Nuevos para Delivery

```typescript
// ============================================================================
// DELIVERY Events (Nuevos)
// ============================================================================

// Cuando se crea pedido delivery/takeout (extiende ORDER_CREATED)
// Ya existe en OrderCreatedPayload con delivery?: DeliverySchema

// Nuevo: Asignación de motorizado
const DeliveryAssignedPayload = z.object({
  order_id: uuidSchema,
  driver_id: uuidSchema,
  assigned_at: isoDateSchema,
  estimated_delivery_at: isoDateSchema,
});

// Nuevo: Motorizado sale a entregar
const DeliveryDispatchedPayload = z.object({
  order_id: uuidSchema,
  driver_id: uuidSchema,
  dispatched_at: isoDateSchema,
});

// Nuevo: Pedido entregado
const DeliveryCompletedPayload = z.object({
  order_id: uuidSchema,
  driver_id: uuidSchema,
  delivered_at: isoDateSchema,
  delivery_time_mins: z.number().int().positive(),
  signature_url?: z.string().optional(),  // Foto de entrega
});

// Nuevo: Problema en delivery
const DeliveryFailedPayload = z.object({
  order_id: uuidSchema,
  driver_id: uuidSchema,
  failed_at: isoDateSchema,
  reason: z.enum([
    "CUSTOMER_NOT_AVAILABLE",
    "WRONG_ADDRESS", 
    "CUSTOMER_REJECTED",
    "ACCIDENT",
    "OTHER"
  ]),
  notes?: z.string(),
});

// Nuevo: Cambio de dirección
const DeliveryAddressChangedPayload = z.object({
  order_id: uuidSchema,
  old_address: z.object({
    address_text: z.string(),
    zone_id: z.string().optional(),
  }),
  new_address: z.object({
    address_text: z.string(),
    reference: z.string().optional(),
    zone_id: z.string().optional(),
  }),
  fee_adjustment_cents: centsSchema,  // Puede ser positivo o negativo
  changed_by: uuidSchema,
});

// Nuevo: Cliente de delivery creado/actualizado
const CustomerCreatedPayload = z.object({
  customer_id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  addresses: z.array(z.object({
    address_id: z.string(),
    address_text: z.string(),
    reference: z.string().optional(),
  })),
});
```

### Estados del Pedido Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESTADOS DE DELIVERY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PEDIDO          COCINA           DELIVERY         FINAL        │
│                                                                 │
│  ┌────────┐     ┌────────┐      ┌────────┐      ┌────────┐     │
│  │ OPEN   │────▶│COOKING │─────▶│ READY  │─────▶│ASSIGNED│     │
│  └────────┘     └────────┘      └────────┘      └────────┘     │
│                                       │              │          │
│                                       │              ▼          │
│                                       │         ┌────────┐      │
│                                       │         │DISPATCH│      │
│                                       │         └────────┘      │
│                                       │              │          │
│                                       │              ▼          │
│                                       │         ┌────────┐      │
│                                       └────────▶│DELIVERED│     │
│                                                 └────────┘      │
│                                                      │          │
│  CANCELACIONES:                                      ▼          │
│  ┌────────┐                                    ┌────────┐      │
│  │CANCELLED│◀─────────────────────────────────│  PAID  │      │
│  └────────┘                                    └────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ESTADOS ESPECÍFICOS DELIVERY:
- READY_FOR_PICKUP: Listo, esperando motorizado
- ASSIGNED: Motorizado asignado
- DISPATCHED: En camino
- DELIVERED: Entregado
- FAILED: Falló entrega (reintento o cancelar)
```

### API Endpoints Propuestos

```typescript
// ============================================================================
// DELIVERY API
// ============================================================================

// Clientes
POST   /api/customers                    // Crear cliente
GET    /api/customers?phone=987654321    // Buscar por teléfono
GET    /api/customers/:id                // Detalle cliente
PUT    /api/customers/:id                // Actualizar
POST   /api/customers/:id/addresses      // Agregar dirección

// Zonas
GET    /api/delivery/zones               // Listar zonas
POST   /api/delivery/zones               // Crear zona
GET    /api/delivery/zones/check?lat=X&lng=Y  // Verificar cobertura
GET    /api/delivery/fee?address=...     // Calcular tarifa

// Motorizados
GET    /api/drivers                      // Listar motorizados
GET    /api/drivers/available            // Solo disponibles
POST   /api/drivers                      // Crear motorizado
PUT    /api/drivers/:id/status           // Cambiar estado
GET    /api/drivers/:id/location         // Ubicación actual

// Pedidos Delivery
GET    /api/orders/delivery/pending      // Pendientes de asignar
GET    /api/orders/delivery/active       // En curso
POST   /api/orders/:id/assign            // Asignar motorizado
POST   /api/orders/:id/dispatch          // Marcar como despachado
POST   /api/orders/:id/delivered         // Marcar como entregado
POST   /api/orders/:id/failed            // Marcar como fallido

// Integraciones (futuro)
POST   /api/integrations/rappi/webhook   // Webhook de Rappi
POST   /api/integrations/pedidosya/webhook
GET    /api/integrations/status          // Estado de integraciones
```


---

## INTEGRACIONES

### Integración con Apps de Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│                 INTEGRACIONES DELIVERY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   RAPPI     │     │ PEDIDOSYA   │     │  UBER EATS  │       │
│  │             │     │             │     │             │       │
│  │  Webhook    │     │  Webhook    │     │  Webhook    │       │
│  │  ────────▶  │     │  ────────▶  │     │  ────────▶  │       │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘       │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                             ▼                                   │
│                   ┌─────────────────┐                           │
│                   │  ADAPTER LAYER  │                           │
│                   │                 │                           │
│                   │ - Normaliza     │                           │
│                   │ - Valida        │                           │
│                   │ - Transforma    │                           │
│                   └────────┬────────┘                           │
│                            │                                    │
│                            ▼                                    │
│                   ┌─────────────────┐                           │
│                   │    PARK POS     │                           │
│                   │                 │                           │
│                   │ ORDER_CREATED   │                           │
│                   │ (delivery: APP) │                           │
│                   └─────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rappi Integration

```typescript
// Webhook de Rappi (ejemplo simplificado)
interface RappiWebhookPayload {
  event_type: "NEW_ORDER" | "ORDER_CANCELLED" | "ORDER_PICKED_UP";
  order_id: string;
  store_id: string;
  
  // Solo en NEW_ORDER
  order?: {
    id: string;
    created_at: string;
    total_products: number;
    total_order: number;
    payment_method: string;
    
    products: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      comments?: string;
    }>;
    
    client: {
      first_name: string;
      last_name: string;
    };
  };
}

// Adapter: Rappi → PARK POS
function rappiToParkOrder(rappi: RappiWebhookPayload["order"]): OrderCreatedPayload {
  return {
    order_id: generateUUID(),
    order_number: getNextOrderNumber(),
    order_type: "DELIVERY",
    
    items: rappi.products.map(p => ({
      line_id: generateLineId(),
      product_id: mapRappiProductId(p.id),  // Mapeo de catálogo
      sku: p.id,
      name: p.name,
      qty: p.quantity,
      unit_price_cents: Math.round(p.price * 100),
      station: getStationForProduct(p.id),
      status: "PENDING",
      mods: [],
      notes: p.comments,
    })),
    
    delivery: {
      courier_type: "APP",
      delivery_fee_cents: 0,  // Rappi maneja su fee
      payment_expectation: "PREPAID",
    },
    
    // Metadata de Rappi
    external_order_id: rappi.id,
    external_source: "RAPPI",
  };
}
```

### PedidosYa Integration

```typescript
// Similar estructura, diferente formato
interface PedidosYaWebhook {
  type: "ORDER_PLACED" | "ORDER_CANCELLED";
  order: {
    code: string;
    registeredDate: string;
    
    details: Array<{
      product: {
        id: string;
        name: string;
      };
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>;
    
    payment: {
      online: boolean;
      paymentAmount: number;
    };
    
    user: {
      name: string;
      phone: string;
    };
  };
}
```

### WhatsApp Business (Manual + Semi-automático)

```
FLUJO ACTUAL (Manual):
1. Cliente escribe a WhatsApp del negocio
2. Cajero lee mensaje
3. Cajero ingresa pedido manualmente en POS
4. Cajero responde por WhatsApp con confirmación

FLUJO FUTURO (Semi-automático):
1. Cliente escribe a WhatsApp
2. Bot responde con menú/catálogo
3. Cliente selecciona productos
4. Bot genera resumen y link de pago (Yape)
5. Cliente paga
6. Bot notifica a POS vía webhook
7. Pedido entra automáticamente
8. Bot envía confirmación con tiempo estimado

IMPLEMENTACIÓN:
- WhatsApp Business API (Meta)
- Chatbot con flujo de pedido
- Integración con Yape/Plin para pagos
- Webhook a PARK POS
```

### Yape/Plin para Delivery

```
FLUJO DE PAGO ANTICIPADO:

1. Cliente hace pedido (teléfono/WhatsApp)
2. Cajero crea pedido en POS como "Pendiente de pago"
3. Sistema genera código/QR de Yape:
   - Monto: S/ 84.00
   - Concepto: "Pedido #123 - Pollería"
4. Cajero envía código al cliente
5. Cliente paga con Yape
6. Opciones de confirmación:
   a) Manual: Cajero ve notificación Yape, marca como pagado
   b) Automático: Webhook de Yape Business confirma pago
7. Pedido pasa a cocina

CONSIDERACIONES:
- Yape Business tiene API para comercios
- Plin tiene integración similar
- Timeout: Si no paga en 15 min, cancelar pedido
```


---

## IMPLEMENTACIÓN

### Fases de Implementación

```
┌─────────────────────────────────────────────────────────────────┐
│                 ROADMAP DE DELIVERY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FASE 1: MVP Delivery (2-3 semanas)                            │
│  ─────────────────────────────────                              │
│  ✓ UI para crear pedido TAKEOUT                                │
│  ✓ UI para crear pedido DELIVERY                               │
│  ✓ Ingreso manual de dirección                                 │
│  ✓ Cálculo de delivery fee (fijo por ahora)                    │
│  ✓ Pago anticipado o contra-entrega                            │
│  ✓ KDS diferencia delivery/takeout                             │
│  ✓ Lista de pedidos delivery pendientes                        │
│                                                                 │
│  FASE 2: Gestión de Motorizados (2 semanas)                    │
│  ──────────────────────────────────────────                     │
│  ○ CRUD de motorizados                                         │
│  ○ Asignación de pedidos a motorizado                          │
│  ○ Estados: disponible/en delivery/offline                     │
│  ○ Marcar como entregado                                       │
│  ○ Métricas básicas por motorizado                             │
│                                                                 │
│  FASE 3: Clientes y Direcciones (2 semanas)                    │
│  ──────────────────────────────────────────                     │
│  ○ Base de datos de clientes                                   │
│  ○ Historial de direcciones                                    │
│  ○ Búsqueda por teléfono                                       │
│  ○ Autocompletado de dirección                                 │
│  ○ Cliente frecuente = descuento automático                    │
│                                                                 │
│  FASE 4: Zonas y Tarifas (1-2 semanas)                         │
│  ─────────────────────────────────────                          │
│  ○ Configuración de zonas de cobertura                         │
│  ○ Tarifas por zona                                            │
│  ○ Pedido mínimo por zona                                      │
│  ○ Zonas bloqueadas                                            │
│  ○ Tiempo estimado por zona                                    │
│                                                                 │
│  FASE 5: Integraciones (3-4 semanas)                           │
│  ───────────────────────────────────                            │
│  ○ Webhook Rappi                                               │
│  ○ Webhook PedidosYa                                           │
│  ○ Mapeo de catálogo                                           │
│  ○ Sincronización de estados                                   │
│  ○ Dashboard de apps                                           │
│                                                                 │
│  FASE 6: App Motorizado (2-3 semanas)                          │
│  ────────────────────────────────────                           │
│  ○ PWA para motorizado                                         │
│  ○ Ver pedidos asignados                                       │
│  ○ Navegación a dirección                                      │
│  ○ Marcar entregado con foto                                   │
│  ○ Tracking GPS (opcional)                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
src/
├── app/
│   ├── (pos)/
│   │   └── page.tsx              # Agregar selector DINE_IN/TAKEOUT/DELIVERY
│   │
│   ├── delivery/                 # Nueva sección
│   │   ├── page.tsx             # Dashboard delivery
│   │   ├── pending/page.tsx     # Pedidos pendientes
│   │   ├── active/page.tsx      # En curso
│   │   └── history/page.tsx     # Historial
│   │
│   ├── drivers/                  # Gestión motorizados
│   │   ├── page.tsx             # Lista
│   │   └── [id]/page.tsx        # Detalle
│   │
│   └── api/
│       ├── customers/
│       │   └── route.ts         # CRUD clientes
│       ├── drivers/
│       │   └── route.ts         # CRUD motorizados
│       ├── delivery/
│       │   ├── zones/route.ts   # Zonas
│       │   └── fee/route.ts     # Calcular tarifa
│       └── integrations/
│           ├── rappi/
│           │   └── webhook/route.ts
│           └── pedidosya/
│               └── webhook/route.ts
│
├── components/
│   ├── delivery/
│   │   ├── OrderTypeSelector.tsx    # DINE_IN | TAKEOUT | DELIVERY
│   │   ├── DeliveryForm.tsx         # Formulario dirección
│   │   ├── CustomerSearch.tsx       # Buscar cliente
│   │   ├── DriverAssignment.tsx     # Asignar motorizado
│   │   ├── DeliveryStatusBadge.tsx  # Estado del delivery
│   │   └── DeliveryTimeline.tsx     # Timeline del pedido
│   │
│   └── drivers/
│       ├── DriverCard.tsx
│       ├── DriverStatus.tsx
│       └── DriverMetrics.tsx
│
└── core/
    └── domain/
        ├── events.ts            # Agregar eventos de delivery
        └── delivery/
            ├── customer.ts      # Modelo cliente
            ├── driver.ts        # Modelo motorizado
            └── zone.ts          # Modelo zona
```

### UI: Selector de Tipo de Pedido

```
┌─────────────────────────────────────────────────────────────────┐
│  NUEVO PEDIDO                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tipo de pedido:                                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   🍽️        │  │   🥡        │  │   🛵        │             │
│  │             │  │             │  │             │             │
│  │  EN LOCAL   │  │ PARA LLEVAR │  │  DELIVERY   │             │
│  │             │  │             │  │             │             │
│  │  Mesa 12    │  │  Recoger    │  │  Envío      │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│       ✓                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI: Formulario Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│  DATOS DE DELIVERY                                        [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Teléfono *                    [🔍 Buscar cliente]              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 987654321                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ✓ Cliente encontrado: Carlos Pérez                            │
│                                                                 │
│  Nombre *                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Carlos Pérez                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Dirección *                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Av. Arequipa 1234, Dpto 501                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [📍 Usar dirección guardada ▼]                                │
│                                                                 │
│  Referencia                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Frente al grifo, edificio azul                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Zona detectada: Centro          Delivery: S/ 6.00             │
│  Tiempo estimado: 25-35 min                                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Forma de pago:                                                │
│  ○ Prepagado (Yape/Plin/Transferencia)                        │
│  ● Contra-entrega (Efectivo)                                   │
│                                                                 │
│                              [Cancelar]  [Continuar →]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI: Dashboard Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│  🛵 DELIVERY                                      05/01/26 19:30│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Pendientes (3)] [En Cocina (2)] [Listos (1)] [En Camino (2)] │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  LISTOS PARA ENVIAR                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #145 │ Carlos Pérez      │ Av. Arequipa 1234  │ S/ 84.00   ││
│  │      │ 987654321         │ Zona Centro        │ COD        ││
│  │      │ Listo hace 5 min  │                    │ [Asignar]  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  EN CAMINO                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #142 │ María García      │ Jr. Cusco 456      │ S/ 65.00   ││
│  │      │ 🛵 Pedro (Moto 1) │ Salió hace 12 min  │ PREPAID    ││
│  │      │ ETA: 8 min        │                    │ [Tracking] ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ #140 │ Juan López        │ Av. Pardo 789      │ S/ 120.00  ││
│  │      │ 🛵 Luis (Moto 2)  │ Salió hace 20 min  │ COD        ││
│  │      │ ETA: 5 min        │                    │ [Tracking] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  MOTORIZADOS                                                    │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │
│  │ 🟢 Pedro       │ │ 🟡 Luis        │ │ 🔴 Carlos      │      │
│  │ Disponible     │ │ 1 pedido       │ │ Offline        │      │
│  │ 8 entregas hoy │ │ 6 entregas hoy │ │ -              │      │
│  └────────────────┘ └────────────────┘ └────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI: Modal Asignar Motorizado

```
┌─────────────────────────────────────────────────────────────────┐
│  ASIGNAR MOTORIZADO                                       [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pedido #145                                                    │
│  Cliente: Carlos Pérez                                          │
│  Dirección: Av. Arequipa 1234, Dpto 501                        │
│  Total: S/ 84.00 (Contra-entrega)                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Seleccionar motorizado:                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ○ 🟢 Pedro (Moto 1)                                        ││
│  │   Disponible • 8 entregas hoy • Tiempo prom: 28 min        ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ○ 🟡 Luis (Moto 2)                                         ││
│  │   1 pedido activo • Regresa en ~10 min                     ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │   🔴 Carlos (Moto 3)                                       ││
│  │   Offline desde 18:00                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Notas para motorizado:                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Llevar sencillo para vuelto                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                              [Cancelar]  [Asignar y Despachar]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Prioridad de Implementación

```
PRIORIDAD ALTA (P0 - MVP):
1. Selector de tipo de pedido en POS
2. Formulario básico de delivery (nombre, teléfono, dirección)
3. Delivery fee fijo configurable
4. Lista de pedidos delivery en caja
5. KDS muestra tipo de pedido claramente

PRIORIDAD MEDIA (P1):
6. Base de datos de clientes
7. Búsqueda por teléfono
8. CRUD de motorizados
9. Asignación de pedidos
10. Estados de delivery

PRIORIDAD BAJA (P2):
11. Zonas de cobertura
12. Tarifas dinámicas
13. Integraciones con apps
14. App de motorizado
15. Tracking GPS
```

---

## MÉTRICAS Y KPIs

```
MÉTRICAS DE DELIVERY:

Operativas:
- Pedidos delivery/día
- Tiempo promedio de preparación
- Tiempo promedio de entrega
- Tasa de entregas exitosas
- Pedidos por motorizado

Financieras:
- Ticket promedio delivery vs local
- Ingresos por delivery fee
- Costo por entrega
- Margen de delivery

Calidad:
- Reclamos por pedido incompleto
- Reclamos por demora
- Cancelaciones post-preparación
- Rating de motorizados

Por Canal:
- % pedidos teléfono
- % pedidos WhatsApp
- % pedidos Rappi
- % pedidos PedidosYa
```

---

## CONSIDERACIONES TÉCNICAS

### Offline Support

```
PROBLEMA:
- Delivery requiere datos de cliente/dirección
- ¿Qué pasa si no hay conexión?

SOLUCIÓN:
- Clientes frecuentes se cachean en IndexedDB
- Direcciones recientes disponibles offline
- Nuevo cliente: solo nombre + teléfono + dirección texto
- Validación de zona: skip si offline, validar al sincronizar
- Asignación de motorizado: requiere conexión (o lista local)
```

### Seguridad

```
CONSIDERACIONES:
- Datos de clientes son PII (nombre, teléfono, dirección)
- Encriptar en reposo
- No exponer en logs
- Acceso solo a roles autorizados
- Retención: política de borrado después de X meses
```

### Escalabilidad

```
PARA MÚLTIPLES LOCALES:
- Cada local tiene sus propios motorizados
- Zonas de cobertura por local
- Clientes pueden ser compartidos (mismo teléfono)
- Métricas agregadas a nivel cadena
```

---

**Última actualización:** Enero 2026  
**Estado:** Diseño completo — Listo para implementación Fase 1
