# PARK POS — Premium Dashboard & Push Notifications

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** 📋 Diseñado (Spec completo)

> **Objetivo:** Dashboard de analytics en tiempo real para dueños/administradores y notificaciones push para mozos cuando items están listos.

---

## 📋 Resumen

Este módulo implementa dos funcionalidades premium que diferencian PARK POS:

| Feature | Beneficio | Usuario |
|---------|-----------|---------|
| **Analytics Dashboard** | Métricas del negocio en tiempo real | Dueño/Admin |
| **Push Notifications** | Alertas cuando items están listos | Mozo/Cajero |

---

## 🎯 Casos de Uso

### Dashboard Analytics

1. **Ver métricas del turno actual**
   - Ventas totales, órdenes, ticket promedio
   - Ventas por método de pago (CASH, YAPE, PLIN, CARD)
   - Mesas ocupadas/libres, rotación

2. **Comparar con día anterior**
   - Mismo día de la semana anterior
   - Indicadores verde/rojo de tendencia
   - Porcentaje de cambio

3. **Monitorear estaciones KDS**
   - Items pendientes por estación (COCINA, HORNO, BAR)
   - Tiempo promedio de preparación
   - Alertas cuando > 10 items pendientes

4. **Ver productos más vendidos**
   - Top 5 del turno
   - Cantidad y revenue

### Push Notifications

5. **Mozo recibe alerta de item listo**
   - Notificación cuando item cambia a READY
   - Incluye: mesa, item, estación donde recoger
   - Click abre la mesa directamente

6. **Cajero recibe solicitud de cuenta**
   - Notificación cuando mozo pide cuenta (REQUEST_CHECK)
   - Incluye: mesa, total, nombre del mozo
   - Click abre la orden en caja

7. **Configurar preferencias**
   - Activar/desactivar tipos de notificación
   - Activar/desactivar sonido

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Bus (SSE)                          │
├─────────────────────────────────────────────────────────────┤
│                           │                                  │
│    ┌──────────────────────┼──────────────────────┐          │
│    │                      │                      │          │
│    ▼                      ▼                      ▼          │
│ ┌──────────┐      ┌──────────────┐      ┌──────────────┐   │
│ │ Analytics│      │ Notification │      │   Dashboard  │   │
│ │ Service  │      │   Service    │      │     UI       │   │
│ └────┬─────┘      └──────┬───────┘      └──────────────┘   │
│      │                   │                                  │
│      ▼                   ▼                                  │
│ ┌──────────┐      ┌──────────────┐                         │
│ │  orders  │      │push_subscript│                         │
│ │  events  │      │    ions      │                         │
│ └──────────┘      └──────┬───────┘                         │
│                          │                                  │
│                          ▼                                  │
│                   ┌──────────────┐                         │
│                   │ Web Push API │                         │
│                   │   (VAPID)    │                         │
│                   └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Nuevas Tablas

```sql
-- Suscripciones Web Push
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, endpoint)
);

-- Preferencias de notificación
CREATE TABLE notification_preferences (
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    items_ready BOOLEAN DEFAULT TRUE,
    request_check BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    PRIMARY KEY(tenant_id, employee_id)
);

-- Cache de analytics (opcional)
CREATE TABLE analytics_cache (
    tenant_id UUID NOT NULL,
    cache_key TEXT NOT NULL,
    metrics JSONB NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(tenant_id, cache_key)
);
```

---

## 🔌 API Endpoints

### Analytics

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/analytics/realtime` | GET | Métricas del turno actual |
| `/api/admin/analytics/history` | GET | Métricas históricas (filtro fecha) |
| `/api/admin/analytics/comparison` | GET | Comparativa con semana anterior |
| `/api/admin/analytics/top-products` | GET | Top N productos vendidos |

### Notifications

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/notifications/subscribe` | POST | Registrar suscripción push |
| `/api/notifications/subscribe` | DELETE | Eliminar suscripción |
| `/api/notifications/preferences` | GET/PATCH | Preferencias del usuario |
| `/api/notifications/test` | POST | Enviar notificación de prueba |
| `/api/admin/notifications/status` | GET | Estado de suscripciones (admin) |

---

## 📱 UI Components

### Dashboard (`/admin/dashboard`)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Dashboard - Turno Actual                    [Filtrar ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ S/2,450 │  │   23    │  │ S/106   │  │  12/18  │       │
│  │ Ventas  │  │ Órdenes │  │ Ticket  │  │ Mesas   │       │
│  │ ▲ +15%  │  │ ▲ +8%   │  │ ▼ -3%   │  │ ocupadas│       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ventas por Hora                                      │   │
│  │ ████████████████████████████████████████████████    │   │
│  │ 11  12  13  14  15  16  17  18  19  20  21  22      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐ │
│  │ Estaciones KDS      │  │ Top 5 Productos             │ │
│  │ COCINA: 3 ⏱️ 8min   │  │ 1. 1/4 Pollo      45  S/112 │ │
│  │ HORNO:  5 ⏱️ 12min  │  │ 2. Pollo Entero   12  S/456 │ │
│  │ BAR:    2 ⏱️ 3min   │  │ 3. Chicha 1L      38  S/190 │ │
│  │ ⚠️ HORNO > 10 items │  │ 4. Papas Fritas   32  S/128 │ │
│  └─────────────────────┘  │ 5. Ensalada       28  S/84  │ │
│                           └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Notificación Push (Mozo)

```
┌─────────────────────────────────────┐
│ 🍗 PARK POS                         │
│ Mesa 12 - 1/4 Pollo listo          │
│ Recoger en: HORNO                   │
│                                     │
│ [Ver Mesa]  [Cerrar]               │
└─────────────────────────────────────┘
```

---

## 🔧 Service Worker

El Service Worker existente (`public/sw.js`) se extiende con:

```javascript
// Push event handler
self.addEventListener('push', function(event) {
  const payload = event.data.json();
  self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/logo.svg',
    data: payload.data,
    actions: [
      { action: 'view', title: 'Ver Mesa' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  });
});

// Click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/mozo';
  clients.openWindow(url);
});
```

---

## 📁 Spec Completo

La especificación detallada está en:

```
.kiro/specs/premium-dashboard/
├── requirements.md   # 10 requirements con acceptance criteria
├── design.md         # Arquitectura, componentes, APIs, 13 properties
└── tasks.md          # 14 tareas de implementación
```

---

## ⏱️ Estimación

| Componente | Días |
|------------|------|
| Database & Infrastructure | 0.5 |
| Analytics Service | 2 |
| Analytics API | 1 |
| Notification Service | 2 |
| Event Handlers | 1 |
| Notification API | 0.5 |
| Service Worker | 0.5 |
| Dashboard UI | 2 |
| Mozo Push UI | 1 |
| Admin Notification UI | 0.5 |
| Integration | 0.5 |
| **Total** | **~7 días** |

---

## 🔗 Referencias

- [GROWTH.md](GROWTH.md) — Features de crecimiento relacionadas
- [FLUJO_ADMIN.md](FLUJO_ADMIN.md) — Panel de administración
- [FLUJO_MESERO.md](FLUJO_MESERO.md) — Flujo del mozo
- [FLUJO_KDS.md](FLUJO_KDS.md) — Kitchen Display System

---

**Última actualización:** 8 Enero 2026
