# PARK — Contexto Global (Fuente de Verdad)

**Fecha:** 2025-12-30 (Actualizado)
**Perfil:** 1 Caja + N Terminales de Pedido + KDS + Offline-First + Cloud Sync
**Estilo:** Event Sourcing (SoT = Event Log) + CQRS-light (Proyecciones)

---

## 0) Problema a Resolver

> **El sistema actual de la pollería es MUY LENTO** desde que se toma el pedido hasta que llega a caja.

**Objetivo:** Construir PARK, un sistema POS ultra-rápido para pollerías/parrilleras con:
- Toma de pedidos instantánea desde múltiples terminales
- Envío directo a cocina (KDS - Kitchen Display System)
- Cobro ágil en caja central
- Soporte delivery
- Facturación flexible (boleta/factura con agrupación personalizada)

---

## 1) Arquitectura Multi-Terminal (Flujo de Velocidad)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Terminal 1 │    │  Terminal 2 │    │  Terminal N │
│   (Tablet)  │    │    (PC)     │    │   (Móvil)   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
              ┌───────────────────────┐
              │     Event Log Local   │  ← IndexedDB (Dexie)
              │   (Append-Only SoT)   │
              └───────────┬───────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    CAJA     │    │     KDS     │    │   DELIVERY  │
│  (Cobros)   │    │  (Cocina)   │    │  (Tracking) │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     Cloud Sync        │  ← PostgreSQL (Eventual)
              │   (Backup + Reports)  │
              └───────────────────────┘
```

### Modelo Recomendado: "N Writers → 1 Hub Local"

| Rol | Dispositivo | Permisos | Justificación |
|-----|-------------|----------|---------------|
| **Terminal Pedido** | Tablet/PC | Crear pedidos (`order_created`) | Velocidad: el mesero no espera |
| **KDS (Cocina)** | Pantalla | Solo lectura + marcar listo | Elimina tickets de papel |
| **Caja** | PC/Tablet | Cobrar + facturar + cerrar turno | Control de dinero |
| **Delivery** | Móvil | Actualizar estado | Tracking |

> **Decisión arquitectónica:** Cada terminal escribe eventos localmente. Un proceso de consolidación sincroniza al hub central (la caja) cada ~5s vía WebSocket/polling local.

---

## 2) Fases de Implementación

### 🎯 MVP (P0) — Piloto Pollería
| Feature | Descripción | Criterio de Aceptación |
|---------|-------------|------------------------|
| 1 Caja Offline | Event log local, cobro efectivo | AC-01: 2h sin internet |
| Sync Cloud | Idempotencia, ACK por secuencia | AC-02: Sin duplicados |
| Crash Recovery | Proyecciones reconstruibles | AC-03: No pierde ventas |
| Catálogo Versionado | Snapshot + checksum | AC-04: Rollback funciona |
| Backup Cifrado | AES-GCM export/import | AC-05: Import dedupea |
| Facturación Flexible | Boleta/Factura con agrupación | Nuevo: AC-06 |

### 📱 P1 — Multi-Terminal
| Feature | Descripción |
|---------|-------------|
| N Terminales de Pedido | Tablets para meseros |
| KDS (Kitchen Display) | Pantalla en cocina |
| Sincronización Local | Hub en caja consolida eventos |
| Delivery | Módulo de seguimiento |

### 🧠 P2 — Inteligencia (2025)
| Feature | Descripción |
|---------|-------------|
| Sugerencias Inteligentes | Reglas de asociación (sin IA pesada) |
| Predicción de Demanda | Análisis histórico |
| Optimización Inventario | Alertas de stock |

---

## 3) Reglas Duras (NO Negociables)

1. **Confirmar venta = persistir local primero.** Nunca depender de red.
2. **UI p95 ≤ 50ms** (tap → feedback), **≤ 150ms** (commit local).
3. **Dinero SIEMPRE en centavos (int).** Nunca float.
4. **Sync "at least once" + idempotencia** (`UNIQUE store_id, event_id`).
5. **Proyecciones NO son fuente de verdad:** se reconstruyen desde Event Log.
6. **KDS recibe pedido en ≤ 1s** desde que mesero confirma.

---

## 4) Eventos MVP (Actualizados)

| Evento | Aggregate | Payload |
|--------|-----------|---------|
| `shift_opened` | SHIFT | `{ opening_cash_cents }` |
| `cash_movement` | SHIFT | `{ type, amount_cents, reason }` |
| `shift_closed` | SHIFT | `{ declared_cash_cents, over_short_cents }` |
| `order_created` | ORDER | `{ order_id, table_id?, delivery_info?, catalog_version }` |
| `order_item_added` | ORDER | `{ line_id, product_id, qty, unit_price_cents, mods? }` |
| `order_item_removed` | ORDER | `{ line_id, qty }` |
| `order_sent_to_kitchen` | ORDER | `{ sent_at }` |
| `order_ready` | ORDER | `{ ready_at }` |
| `payment_captured` | ORDER | `{ method, amount_cents, change_cents? }` |
| `order_invoiced` | ORDER | `{ invoice_type, invoice_number, grouped_as? }` |
| `order_completed` | ORDER | `{ total_cents }` |

---

## 5) Facturación Flexible (AC-06)

**Problema del usuario:**
> "Compraron 2 pollos y una chicha, pero el cliente pide el detalle como total."

**Solución:**
```typescript
interface InvoiceRequest {
  order_ids: string[];           // Puede agrupar varios pedidos
  invoice_type: 'BOLETA' | 'FACTURA';
  grouping: 'DETAILED' | 'SUMMARY';  // Detallado o resumen
  custom_description?: string;   // "Consumo" en lugar de items
  customer_ruc?: string;         // Solo para factura
}
```

---

## 6) Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Front** | Next.js 15 (App Router) + PWA |
| **UI** | TailwindCSS + Framer Motion |
| **Local DB** | Dexie (IndexedDB) |
| **Cloud DB** | PostgreSQL (Supabase) |
| **Sync** | Vercel API + pg Pool |
| **Cifrado** | WebCrypto (AES-GCM) |
| **PWA** | Service Worker (App Shell) |

---

## 7) Definition of Done (Actualizado)

| Criterio | Descripción |
|----------|-------------|
| **AC-01** | Operar 2h sin internet vendiendo efectivo |
| **AC-02** | Sync sin duplicar |
| **AC-03** | Crash no pierde ventas |
| **AC-04** | Catálogo versionado con rollback |
| **AC-05** | Backup cifrado export/import |
| **AC-06** | Facturación flexible (boleta/factura, agrupación) |
