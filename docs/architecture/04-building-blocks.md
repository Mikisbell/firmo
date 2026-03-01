# 4. Building Blocks (C4 Level 2 — Containers + Level 3 — Components)

> Estructura interna del monolito: módulos, sus responsabilidades y dependencias.

## Vista de Contenedores

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (PWA)                               │
│  ┌─────────┐ ┌────────┐ ┌──────┐ ┌────┐ ┌───────┐ ┌──────────┐   │
│  │  POS    │ │ Cocina │ │ Mozo │ │Bar │ │ Admin │ │ Employee │   │
│  │         │ │  KDS   │ │      │ │KDS │ │ Panel │ │  Portal  │   │
│  └────┬────┘ └───┬────┘ └──┬───┘ └─┬──┘ └───┬───┘ └────┬─────┘   │
│       └──────────┴─────────┴───────┴─────────┴──────────┘          │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │              Dexie (IndexedDB) — Offline Store                │  │
│  │     events | projections | metadata | sagaQueue               │  │
│  │     SyncClient (circuit breaker, outbox, retry)               │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTPS + SSE
┌──────────────────────────────┼──────────────────────────────────────┐
│                    NEXT.JS 16 MONOLITH                              │
│                                                                      │
│  ┌─────────────────────── API Layer ───────────────────────────┐    │
│  │  Auth Guard → Rate Limiter → Zod Validation → Route Handler │    │
│  │  261 route handlers en /api/*                                │    │
│  └───────────────────────────┬──────────────────────────────────┘    │
│                              │                                       │
│  ┌─────────────────────── Core Domain ─────────────────────────┐    │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │    │
│  │  │ Events   │ │Projections│ │ Services  │ │  Validation  │  │    │
│  │  │ (72 types│ │+ Reducers │ │  (40)     │ │  + Rules     │  │    │
│  │  │  ingest) │ │           │ │           │ │              │  │    │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────────┘  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │    │
│  │  │  Auth    │ │  Cache   │ │  Conflict │ │ Observability│  │    │
│  │  │  + RBAC  │ │  (Redis) │ │  Resolver │ │  (Pino+Mtx)  │  │    │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                      PERSISTENCE LAYER                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  PostgreSQL    │  │    Redis      │  │  Supabase Realtime     │  │
│  │  (Supabase)    │  │  (Upstash)   │  │  (LISTEN/NOTIFY bus)   │  │
│  │  121 models    │  │  Cache+Rate  │  │  Canal: events:{tid}   │  │
│  │  Event store   │  │  Limiter+    │  │                        │  │
│  │  Projections   │  │  Push queue  │  │                        │  │
│  └────────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Módulos del Dominio

### Módulos Operacionales (Runtime — usados durante el servicio)

| # | Módulo | Páginas | Endpoints | Core Path | Responsabilidad |
|---|--------|---------|-----------|-----------|-----------------|
| 1 | **POS** | `/pos` | 8 | `core/actions/`, `core/projections/`, `core/payments/` | Caja: turnos, órdenes, pagos, impresión |
| 2 | **Cocina KDS** | `/cocina`, `/cocina/horno`, `/cocina/empaque` | 4 | `core/infra/event-bus.ts` | Display de tickets, estado de ítems |
| 3 | **Bar KDS** | `/bar` | 2 | — | Display de bebidas |
| 4 | **Mozo** | `/mozo`, `/mozo/listos`, `/mozo/config` | 3 | — | Mesas por zona, notificaciones |
| 5 | **Delivery** | `/delivery/*` | 12 | `core/delivery/`, `core/services/delivery.service.ts` | Conductores, asignación, tracking SSE |
| 6 | **Inventario** | `/inventario` + `/admin/inventario` | 9 | `core/inventory/` | Stock, kardex, mermas, lotes, conteo |

### Módulos Administrativos

| # | Módulo | Páginas | Endpoints | Core Path | Responsabilidad |
|---|--------|---------|-----------|-----------|-----------------|
| 7 | **Admin Panel** | 55 | 120+ | `core/admin/` | Dashboard, config, reportes |
| 8 | **HR** | 10 | 35+ | `core/hr/` (si existe) | Empleados, asistencia, nómina, vacaciones |
| 9 | **Employee Portal** | `/employee/*` | 8 | — | Self-service: horarios, boletas, datos |
| 10 | **Reservaciones** | `/reservar/[slug]` + `/admin/reservas` | 6 | `core/reservations/` | Booking público + gestión admin |
| 11 | **Facturación** | `/admin/facturacion` | 5 | `core/integrations/sunat/` | SUNAT, boletas, facturas, contingencia |
| 12 | **Multi-tenant** | `/admin/cross-tenant/*` | 12 | `core/tenant/` | Provisioning, health, deactivation |
| 13 | **Seguridad** | `/admin/seguridad` | 8 | `core/security/`, `core/auth/` | Sesiones, dispositivos, alertas |

### Módulos de Infraestructura (Cross-cutting)

| Módulo | Core Path | Responsabilidad |
|--------|-----------|-----------------|
| **Event Sourcing** | `core/domain/events.ts`, `core/events/`, `api/events/ingest/` | 73 event types, ingest, dedup, outbox |
| **Auth + RBAC** | `core/auth/`, `core/middleware/`, `core/constants/roles.ts` | JWT, 11 roles, guards, sesiones |
| **Cache** | `core/cache/cache-service.ts` | Redis con circuit breaker, fallback in-memory |
| **Observability** | `core/observability/` | Pino logger, metrics collector, error tracker |
| **Sync** | `core/sync/` (client), `core/infra/supabase-event-bus.ts` | SyncClient, SSE, LISTEN/NOTIFY |
| **Conflict Resolution** | `core/conflict/` | Soft locks, revision-based, 3 strategies |
| **Rate Limiting** | `core/rate-limiting/` | Sliding window Redis, fallback in-memory |
| **Printing** | `core/printing/` | ESC/POS builder, print queue, 3 transports |
| **Notifications** | `core/notifications/`, `core/delivery/push.service.ts` | Web Push VAPID, preferences, offline queue |

## Dependencias entre Módulos (Problema Identificado)

```
POS ──────┬──▶ Events (core)
          ├──▶ Projections
          ├──▶ Payments
          └──▶ Printing

Delivery ─┬──▶ Events (core)
          ├──▶ WhatsApp service
          ├──▶ Push service
          └──▶ Platform adapters (PedidosYa, LlamaFood)

HR ───────┬──▶ Events (core)
          └──▶ Notifications

Ingest ───┬──▶ Events (core)
          ├──▶ Conflict resolver
          ├──▶ Inventory (deduction)   ← CROSS-BOUNDARY
          ├──▶ Notifications           ← CROSS-BOUNDARY
          ├──▶ Rate limiting
          └──▶ Observability
```

**Nota**: No existen anti-corruption layers entre módulos. El ingest route importa directamente de 7+ módulos peer. Esto es aceptable para un monolito de equipo pequeño, pero se convierte en problema si se necesita descomponer.
