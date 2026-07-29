# 📡 FIRMO POS - Documentación de API

> Documentación completa de todos los endpoints REST de FIRMO POS

**Base URL:** `http://localhost:3000/api` (desarrollo) | `https://tu-dominio.com/api` (producción)

**Versión:** 2.0.0  
**Última actualización:** 13 Febrero 2026

---

## 📋 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Eventos](#eventos)
3. [Órdenes](#órdenes)
4. [Productos](#productos)
5. [Empleados](#empleados)
6. [Terminales](#terminales)
7. [Inventario](#inventario)
8. [Delivery](#delivery)
9. [Reportes y Analytics](#reportes-y-analytics)
10. [Admin](#admin)
11. [Códigos de Error](#códigos-de-error)

---

## 🔐 Autenticación

Todos los endpoints (excepto `/health` y `/auth/login`) requieren autenticación.

### Métodos de Autenticación

**1. Cookie (Recomendado para Web)**
```http
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**2. Bearer Token (Para APIs)**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### POST `/auth/login`

Autenticar usuario con PIN.

**Request:**
```json
{
  "pin": "1234",
  "terminalId": "term_001"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": "emp_123",
    "name": "Juan Pérez",
    "role": "ADMIN"
  },
  "terminal": {
    "id": "term_001",
    "type": "CASHIER",
    "station": null
  }
}
```

**Errores:**
- `401` - PIN inválido
- `423` - Cuenta bloqueada (3 intentos fallidos)
- `404` - Terminal no encontrado

### POST `/auth/session`

Crear sesión de administrador (solo para panel admin).

**Request:**
```json
{
  "pin": "1234"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": "emp_123",
    "name": "Admin",
    "role": "ADMIN"
  }
}
```

### POST `/auth/logout`

Cerrar sesión actual.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

---

## 📨 Eventos

Sistema de Event Sourcing - todos los cambios son eventos inmutables.

### POST `/data-sync/ingest`

Ingerir eventos desde terminales.

**Request:**
```json
{
  "events": [
    {
      "id": "evt_123",
      "type": "ORDER_CREATED",
      "entityType": "ORDER",
      "entityId": "ord_456",
      "occurredAt": "2026-02-13T10:30:00Z",
      "payload": {
        "orderType": "DINE_IN",
        "tableNumber": "12",
        "items": [
          {
            "lineId": "l1",
            "productId": "prod_789",
            "sku": "pollo_1_4",
            "name": "1/4 Pollo",
            "qty": 2,
            "unitPriceCents": 2500,
            "station": "PARRILLA"
          }
        ]
      }
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "processed": 1,
  "duplicates": 0,
  "errors": []
}
```

**Validaciones:**
- Deduplicación automática por `event.id`
- Validación de schema con Zod
- Validación de permisos por rol
- Proyección síncrona a tablas

### GET `/events/stream`

Stream de eventos en tiempo real (SSE).

**Response (text/event-stream):**
```
event: ORDER_CREATED
data: {"id":"evt_123","type":"ORDER_CREATED",...}

event: ORDER_ITEM_ADDED
data: {"id":"evt_124","type":"ORDER_ITEM_ADDED",...}
```

**Uso:**
```javascript
const eventSource = new EventSource('/api/events/stream');

eventSource.addEventListener('ORDER_CREATED', (e) => {
  const event = JSON.parse(e.data);
  console.log('Nueva orden:', event);
});
```

---

## 🍽️ Órdenes

Gestión de pedidos (dine-in, takeout, delivery).

### GET `/orders`

Listar órdenes activas.

**Query Parameters:**
- `status` - Filtrar por estado (OPEN, IN_PROGRESS, DONE)
- `type` - Filtrar por tipo (DINE_IN, TAKEOUT, DELIVERY)
- `limit` - Límite de resultados (default: 50)
- `offset` - Offset para paginación

**Response (200 OK):**
```json
{
  "orders": [
    {
      "id": "ord_123",
      "orderNumber": 42,
      "orderType": "DINE_IN",
      "orderStatus": "OPEN",
      "fulfillmentStatus": "COOKING",
      "stationsActive": ["PARRILLA", "BAR"],
      "unpaidChecksCount": 1,
      "subtotalCents": 5000,
      "totalCents": 5000,
      "items": [...],
      "checks": [...],
      "createdAt": "2026-02-13T10:30:00Z"
    }
  ],
  "total": 15,
  "hasMore": false
}
```

### GET `/orders/:orderId`

Obtener detalle de una orden.

**Response (200 OK):**
```json
{
  "id": "ord_123",
  "orderNumber": 42,
  "orderType": "DINE_IN",
  "orderStatus": "OPEN",
  "fulfillmentStatus": "COOKING",
  "handoffStatus": "WAITING",
  "stationsActive": ["PARRILLA"],
  "unpaidChecksCount": 1,
  "subtotalCents": 5000,
  "discountCents": 0,
  "totalCents": 5000,
  "items": [
    {
      "lineId": "l1",
      "productId": "prod_789",
      "sku": "pollo_1_4",
      "name": "1/4 Pollo",
      "shortName": "1/4 P",
      "qty": 2,
      "unitPriceCents": 2500,
      "station": "PARRILLA",
      "mods": [],
      "notes": "",
      "addedAt": "2026-02-13T10:30:00Z",
      "void": null
    }
  ],
  "checks": [
    {
      "checkId": "c1",
      "name": "Mesa 12",
      "mode": "ITEMS",
      "lines": [{"lineId": "l1", "qty": 2}],
      "subtotalCents": 5000,
      "discountCents": 0,
      "tipCents": 0,
      "totalCents": 5000,
      "payment": {
        "status": "UNPAID",
        "payments": []
      }
    }
  ],
  "fulfillment": {
    "tableNumber": "12",
    "guestCount": 4
  },
  "createdAt": "2026-02-13T10:30:00Z",
  "updatedAt": "2026-02-13T10:35:00Z"
}
```

---

## 🛒 Productos

Catálogo de productos con versionado.

### GET `/products`

Listar productos activos.

**Query Parameters:**
- `category` - Filtrar por categoría
- `station` - Filtrar por estación
- `search` - Búsqueda por nombre/SKU

**Response (200 OK):**
```json
{
  "products": [
    {
      "id": "prod_123",
      "sku": "pollo_1_4",
      "name": "1/4 Pollo a la Brasa",
      "shortName": "1/4 Pollo",
      "priceCents": 2500,
      "category": "POLLOS",
      "station": "PARRILLA",
      "type": "SIMPLE",
      "isActive": true,
      "version": 1
    }
  ],
  "catalogVersion": 5
}
```

### GET `/catalog/latest`

Obtener catálogo completo con versión.

**Response (200 OK):**
```json
{
  "catalogVersion": 5,
  "products": [...],
  "updatedAt": "2026-02-13T09:00:00Z"
}
```

---

## 👥 Empleados

Gestión de empleados y roles.

### GET `/admin/employees`

Listar empleados (requiere rol ADMIN).

**Response (200 OK):**
```json
{
  "employees": [
    {
      "id": "emp_123",
      "name": "Juan Pérez",
      "role": "CASHIER",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### POST `/admin/employees`

Crear nuevo empleado.

**Request:**
```json
{
  "name": "María García",
  "role": "WAITER",
  "pin": "5678"
}
```

**Response (201 Created):**
```json
{
  "id": "emp_456",
  "name": "María García",
  "role": "WAITER",
  "isActive": true,
  "createdAt": "2026-02-13T10:00:00Z"
}
```

### PUT `/admin/employees/:id`

Actualizar empleado.

**Request:**
```json
{
  "name": "María García López",
  "role": "MANAGER",
  "isActive": true
}
```

### DELETE `/admin/employees/:id`

Desactivar empleado (soft delete).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Empleado desactivado"
}
```

---

## 🖥️ Terminales

Gestión de terminales y activación.

### GET `/admin/terminals`

Listar terminales registrados.

**Response (200 OK):**
```json
{
  "terminals": [
    {
      "id": "term_001",
      "terminalId": "CAJA-01",
      "type": "CASHIER",
      "stationId": null,
      "isAllowed": true,
      "lastSeenAt": "2026-02-13T10:30:00Z"
    }
  ]
}
```

### POST `/admin/terminals`

Crear nuevo terminal y generar código de activación.

**Request:**
```json
{
  "terminalId": "MESERO-01",
  "type": "WAITER",
  "stationId": null
}
```

**Response (201 Created):**
```json
{
  "terminal": {
    "id": "term_002",
    "terminalId": "MESERO-01",
    "type": "WAITER"
  },
  "activationCode": "ABC123XYZ",
  "expiresAt": "2026-02-13T11:00:00Z"
}
```

### POST `/terminals/activate`

Activar terminal con código.

**Request:**
```json
{
  "activationCode": "ABC123XYZ",
  "deviceId": "device_unique_id"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "terminal": {
    "id": "term_002",
    "terminalId": "MESERO-01",
    "type": "WAITER"
  },
  "deviceSecret": "secret_hash_here"
}
```

---

## 📦 Inventario

Gestión de inventario y stock.

### GET `/inventory/stock`

Obtener stock actual de todos los productos.

**Response (200 OK):**
```json
{
  "items": [
    {
      "code": "POLLO-ENTERO",
      "name": "Pollo Entero",
      "unit": "UNIDAD",
      "currentStock": 50,
      "minStock": 20,
      "maxStock": 100,
      "status": "OK"
    }
  ]
}
```

### POST `/inventory/receive`

Registrar recepción de mercadería.

**Request:**
```json
{
  "items": [
    {
      "code": "POLLO-ENTERO",
      "quantity": 30,
      "lotNumber": "LOT-2026-02-13",
      "expiryDate": "2026-02-20"
    }
  ],
  "notes": "Recepción matutina"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "movementId": "mov_123",
  "itemsProcessed": 1
}
```

### POST `/inventory/waste`

Registrar merma o desperdicio.

**Request:**
```json
{
  "code": "POLLO-ENTERO",
  "quantity": 2,
  "reason": "EXPIRED",
  "notes": "Producto vencido"
}
```

---

## 🚚 Delivery

Gestión de pedidos delivery y drivers.

### GET `/delivery`

Listar pedidos delivery activos.

**Response (200 OK):**
```json
{
  "deliveries": [
    {
      "id": "del_123",
      "orderId": "ord_456",
      "orderNumber": 42,
      "deliveryStatus": "ASSIGNED",
      "assignedDriverId": "drv_789",
      "driverName": "Carlos Ruiz",
      "customerName": "Ana López",
      "customerPhone": "+51987654321",
      "address": "Av. Principal 123, San Isidro",
      "deliveryFeeCents": 500,
      "totalCents": 5500,
      "estimatedDeliveryTime": "2026-02-13T11:00:00Z"
    }
  ]
}
```

### POST `/delivery/:id/assign`

Asignar driver a pedido delivery.

**Request:**
```json
{
  "driverId": "drv_789"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "delivery": {
    "id": "del_123",
    "deliveryStatus": "ASSIGNED",
    "assignedDriverId": "drv_789"
  }
}
```

### POST `/delivery/:id/dispatch`

Marcar pedido como despachado.

**Response (200 OK):**
```json
{
  "success": true,
  "delivery": {
    "id": "del_123",
    "deliveryStatus": "IN_TRANSIT",
    "dispatchedAt": "2026-02-13T10:45:00Z"
  }
}
```

### POST `/delivery/:id/deliver`

Marcar pedido como entregado.

**Request:**
```json
{
  "deliveredAt": "2026-02-13T11:15:00Z",
  "notes": "Entregado sin novedad"
}
```

---

## 📊 Reportes y Analytics

Endpoints para reportes y análisis.

### GET `/admin/analytics/realtime`

Métricas en tiempo real del día actual.

**Response (200 OK):**
```json
{
  "date": "2026-02-13",
  "grossSalesCents": 125000,
  "netSalesCents": 120000,
  "discountCents": 5000,
  "ordersCount": 45,
  "checksCount": 52,
  "averageCheckCents": 2307,
  "topProducts": [
    {
      "sku": "pollo_1_4",
      "name": "1/4 Pollo",
      "quantity": 89,
      "salesCents": 22250
    }
  ],
  "paymentBreakdown": {
    "CASH": 60000,
    "YAPE": 40000,
    "CARD": 20000
  }
}
```

### GET `/admin/analytics/comparison`

Comparación con período anterior.

**Query Parameters:**
- `period` - Período a comparar (today, week, month)

**Response (200 OK):**
```json
{
  "current": {
    "salesCents": 125000,
    "ordersCount": 45
  },
  "previous": {
    "salesCents": 110000,
    "ordersCount": 40
  },
  "change": {
    "salesPercent": 13.6,
    "ordersPercent": 12.5
  }
}
```

### GET `/admin/reports`

Generar reporte personalizado.

**Query Parameters:**
- `startDate` - Fecha inicio (YYYY-MM-DD)
- `endDate` - Fecha fin (YYYY-MM-DD)
- `groupBy` - Agrupar por (day, week, month)

**Response (200 OK):**
```json
{
  "period": {
    "start": "2026-02-01",
    "end": "2026-02-13"
  },
  "summary": {
    "totalSalesCents": 1500000,
    "totalOrders": 580,
    "averageCheckCents": 2586
  },
  "breakdown": [
    {
      "date": "2026-02-01",
      "salesCents": 115000,
      "ordersCount": 42
    }
  ]
}
```

---

## ⚙️ Admin

Endpoints administrativos.

### GET `/admin/dashboard/stats`

Estadísticas del dashboard.

**Response (200 OK):**
```json
{
  "today": {
    "salesCents": 125000,
    "ordersCount": 45,
    "activeOrders": 8
  },
  "alerts": [
    {
      "type": "LOW_STOCK",
      "message": "Stock bajo: Pollo Entero (15 unidades)",
      "severity": "WARNING"
    }
  ]
}
```

### POST `/admin/cleanup`

Limpiar datos antiguos (eventos, logs).

**Request:**
```json
{
  "olderThanDays": 90,
  "dryRun": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "eventsDeleted": 15420,
  "logsDeleted": 8930
}
```

---

## ❌ Códigos de Error

### Códigos HTTP

| Código | Significado | Cuándo se usa |
|--------|-------------|---------------|
| `200` | OK | Operación exitosa |
| `201` | Created | Recurso creado exitosamente |
| `400` | Bad Request | Datos inválidos en request |
| `401` | Unauthorized | No autenticado o token inválido |
| `403` | Forbidden | No tiene permisos para esta operación |
| `404` | Not Found | Recurso no encontrado |
| `409` | Conflict | Conflicto (ej: duplicado) |
| `422` | Unprocessable Entity | Validación de negocio falló |
| `423` | Locked | Recurso bloqueado (ej: cuenta) |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Error del servidor |

### Formato de Error

```json
{
  "error": "VALIDATION_ERROR",
  "message": "PIN debe tener 4 dígitos",
  "field": "pin",
  "code": "INVALID_PIN_FORMAT"
}
```

### Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| `INVALID_PIN` | PIN incorrecto |
| `ACCOUNT_LOCKED` | Cuenta bloqueada por intentos fallidos |
| `TERMINAL_NOT_FOUND` | Terminal no registrado |
| `INSUFFICIENT_PERMISSIONS` | Sin permisos para esta operación |
| `ORDER_NOT_FOUND` | Orden no encontrada |
| `PRODUCT_NOT_FOUND` | Producto no encontrado |
| `INVALID_ORDER_STATUS` | Estado de orden inválido para esta operación |
| `PAYMENT_FAILED` | Pago falló |
| `STOCK_INSUFFICIENT` | Stock insuficiente |

---

## 📚 Recursos Adicionales

- **OpenAPI Spec:** [/api/docs/openapi.json](/api/docs/openapi.json)
- **Swagger UI:** [/api/docs/swagger](/api/docs/swagger)
- **Postman Collection:** [/api/docs/postman](/api/docs/postman)
- **Health Check:** [/api/health](/api/health)

---

## 🔧 Rate Limiting

Todos los endpoints tienen rate limiting:

- **Autenticación:** 5 requests/minuto por IP
- **Lectura:** 100 requests/minuto por usuario
- **Escritura:** 50 requests/minuto por usuario
- **Admin:** 200 requests/minuto por usuario

Headers de respuesta:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1676304000
```

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 2.0.0  
**Mantenido por:** Equipo PARK POS
