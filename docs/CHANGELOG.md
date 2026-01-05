# Changelog

## [1.2.0] - 2026-01-02
### Added
- **Full Frontend Integration (P0 MVP Complete):**
  - `page.tsx` now uses `CheckDetail` instead of basic `Cart`.
  - PaymentModal integrated: CASH, YAPE, PLIN, CARD selection.
  - InvoiceModal integrated: Boleta/Factura selection.
  - SplitBillModal integrated: Divide cuenta by items.
  - Automatic ticket printing after invoice issuance.
  - Real offline/online indicator (`navigator.onLine`).
  - Sonner toasts for all actions.

### Fixed
- **Items now auto-assign to default check** (was causing S/0.00 tickets).
- **Cycle resets correctly** after invoice (was staying on CONFIRMED sale).
- **Event sequences** no longer have gaps.

### Changed
- Replaced `Cart.tsx` usage with `CheckDetail.tsx` in main page.
- Unified payment flow: Add Payment → Mark Paid → Issue Invoice → Print.

---

## [1.1.0] - 2026-01-01
### Added
- **Billing System (Task 10):**
  - Facturación por Check completa.
  - Componentes UI: `PaymentModal`, `InvoiceModal`, `CheckDetail`.
  - Evento `INVOICE_ISSUED` integrado.
- **Backend Projections (Task 10b):**
  - Proyección síncrona en `/api/events/ingest`.
  - Autollenado de tablas `orders`, `invoices`, `shifts` en Postgres.
- **UX Polish:**
  - Rediseño Premium de `PaymentModal` y `InvoiceModal`.
  - Animaciones `framer-motion` (ScaleIn, BackdropBlur).
  - Glassmorphism y sombras mejoradas.
- **Impresión Térmica (Task 11):**
  - Soporte nativo para tickets de 80mm (`window.print`).
  - Botón "Pre-cuenta" e impresión automática de Boletas.
- **UX/UI Modernization (Task 13):**
  - **Sonner Toasts:** Reemplazo de `window.alert` por notificaciones no bloqueantes.
  - **Virtual Ticket:** Rediseño de `CheckDetail` con estética de recibo físico y fuente monospace.
  - **Catalog Animations:** Efecto "Staggered ScaleIn" y Glassmorphism en items.

### Changed
- **Architecture:** Separación de Billing vs Split Bill (T12 diferida).
- **Projections:** `SaleLine` ahora soporta `name` para UI.
- **Docs:** Actualizados `ARCHITECTURE.md` y `TASK_PROMPTS.md` con status P0.

## [1.0.0] - 2025-12-30
### Added
- **Core MVP:**
  - Dexie Local DB + Sync Client.
  - Catalog Management.
  - Shift Management logic.
  - Event Sourcing base (`events` table).
