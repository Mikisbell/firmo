# PARK — Contexto Global (Fuente de Verdad)

**Fecha:** 2026-01-01 (Actualizado)  
**Perfil:** 1 Caja + 15 Terminales + KDS + Delivery + Offline-First + Cloud Sync  
**Estilo:** Event Sourcing (SoT = Event Log) + CQRS-light (Proyecciones)

---

## 0) Problema a Resolver

> **El sistema actual de la pollería es MUY LENTO** desde que se toma el pedido hasta que llega a caja.

**Objetivo:** Construir PARK, un sistema POS ultra-rápido para pollerías/parrilleras con:
- Toma de pedidos instantánea desde múltiples terminales (15+)
- Envío directo a cocina (KDS - Kitchen Display System)
- Cobro ágil en caja central
- Soporte delivery (propio + apps)
- Split bill (dividir cuenta)
- Facturación flexible (boleta/factura por check)
- Promos/cupones

---

## 1) Arquitectura Multi-Terminal

```
┌─────────────────────────────────────────────────────────┐
│                    15 TERMINALES                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      ┌─────────┐  │
│  │Terminal1│ │Terminal2│ │Terminal3│ ...  │TerminalN│  │
│  │ (Tablet)│ │  (PC)   │ │ (Móvil) │      │(Tablet) │  │
│  └────┬────┘ └────┬────┘ └────┬────┘      └────┬────┘  │
│       │           │           │                │       │
│       └───────────┴─────┬─────┴────────────────┘       │
│                         ▼                               │
│         ┌───────────────────────────────┐              │
│         │      IndexedDB (Dexie)        │ ← Local      │
│         │      Event Log por Terminal   │              │
│         └───────────────┬───────────────┘              │
│                         │                               │
│    ┌────────────────────┼────────────────────┐         │
│    ▼                    ▼                    ▼         │
│ ┌──────┐           ┌─────────┐          ┌─────────┐   │
│ │ CAJA │           │   KDS   │          │DELIVERY │   │
│ │Cobros│           │ Cocina  │          │Tracking │   │
│ └──────┘           └─────────┘          └─────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │      Supabase (PostgreSQL)    │ ← Cloud
         │      27 Tablas Enterprise     │
         └───────────────────────────────┘
```

---

## 2) Fases de Implementación

### 🎯 P0 — MVP (Piloto 1 Pollería)

| Feature | Schema/Tablas | Estado |
|---------|---------------|--------|
| 1 Caja Offline | `events`, `orders` (Dexie) | 🔨 |
| Sync Cloud Idempotente | `events` (Postgres) | ✅ |
| Catálogo Versionado | `products`, `catalog_meta` | 🔨 |
| Backup Cifrado | AES-GCM export/import | ✅ |
| Turnos (Shift) | `shifts`, `employees` | 🔨 |
| Facturación por Check | `invoices` | 🔨 |
| Pagos Básicos | CASH, YAPE, PLIN | 🔨 |

**Tablas Prisma P0:** `events`, `orders`, `products`, `catalog_meta`, `employees`, `shifts`, `invoices`, `tenant_settings`

### 📱 P1 — Multi-Terminal + KDS

| Feature | Schema/Tablas |
|---------|---------------|
| 15 Terminales de Pedido | `terminals` |
| Estaciones (KDS) | `stations` |
| Impresión Térmica | `printers`, `print_jobs` |
| Split Bill | `orders.checks` (JSONB) |
| Promociones | `promotions` |
| Delivery Propio | `drivers`, `customers` |

**Tablas Prisma P1:** `terminals`, `stations`, `printers`, `print_jobs`, `promotions`, `drivers`, `customers`

### 🧠 P2 — Growth + Inteligencia

| Feature | Schema/Tablas |
|---------|---------------|
| Segmentación Clientes | `customer_profile`, `marketing_segments` |
| Campañas WhatsApp | `marketing_campaigns`, `message_outbox` |
| Cupones Personalizados | `coupons`, `coupon_redemptions` |
| Sugerencias IA | `ai_suggestions` |
| Reportes Rápidos | `daily_sales_summary` |
| Anti-fraude | `sync_conflicts` |
| Inventario | `inventory`, `inventory_log` |

---

## 3) Reglas Duras (NO Negociables)

1. **Confirmar venta = persistir local primero.** Nunca depender de red.
2. **UI p95 ≤ 50ms** (tap → feedback), **≤ 150ms** (commit local).
3. **Dinero SIEMPRE en centavos (int).** Nunca float.
4. **Sync "at least once" + idempotencia** (`UNIQUE tenant_id, event_id`).
5. **Proyecciones NO son fuente de verdad:** se reconstruyen desde Event Log.
6. **KDS recibe pedido en ≤ 1s** desde que mesero confirma (P1).
7. **Hot Path sin JOINs ni JSONB scanning** para filtrar.

---

## 4) Eventos MVP (P0)

| Evento | Aggregate | Payload |
|--------|-----------|---------|
| `SHIFT_OPENED` | SHIFT | `{ shift_id, cash_opening_cents }` |
| `SHIFT_CLOSED` | SHIFT | `{ shift_id, cash_counted_cents }` |
| `ORDER_CREATED` | ORDER | `{ order_id, order_type, items[], checks[] }` |
| `ORDER_ITEM_ADDED` | ORDER | `{ order_id, line: {...} }` |
| `CHECK_PAYMENT_ADDED` | ORDER | `{ order_id, check_id, payment }` |
| `CHECK_MARKED_PAID` | ORDER | `{ order_id, check_id }` |
| `INVOICE_ISSUED` | INVOICE | `{ order_id, check_id, invoice_type, total_cents }` |

Ver `docs/EVENTS.md` para lista completa (30+ eventos).

---

## 5) Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Front** | Next.js 15 (App Router) + PWA |
| **UI** | TailwindCSS + Framer Motion |
| **Local DB** | Dexie (IndexedDB) |
| **Cloud DB** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **Sync** | Vercel API + pg Pool |
| **Cifrado** | WebCrypto (AES-GCM) |
| **PWA** | Service Worker (App Shell) |

---

## 6) Definition of Done (MVP)

| Criterio | Descripción |
|----------|-------------|
| **AC-01** | Operar 2h sin internet vendiendo efectivo |
| **AC-02** | Sync sin duplicar eventos |
| **AC-03** | Crash no pierde ventas |
| **AC-04** | Catálogo versionado con rollback |
| **AC-05** | Backup cifrado export/import |
| **AC-06** | Facturación por check (boleta/factura) |
| **AC-07** | Turnos con apertura/cierre de caja |

---

## 7) Documentación de Referencia

| Documento | Contenido | Fase |
|-----------|-----------|------|
| `ARCHITECTURE.md` | 27 tablas Prisma | P0-P2 |
| `EVENTS.md` | 30+ eventos + triggers | P0-P1 |
| `SPECS.md` | Enums, pagos, impresión | P0-P1 |
| `GROWTH.md` | WhatsApp, IA, segmentación | P2 |
| `PROMOTIONS_DSL.md` | Reglas de promociones | P1 |
| `SECURITY.md` | Cupones, anti-fraude | P1-P2 |
