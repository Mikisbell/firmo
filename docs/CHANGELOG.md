# Changelog

## [1.3.0] - 2026-01-05
### Added
- **Shared Component Architecture:**
  - New shared components: `src/components/shared/LineItem.tsx`, `OrderPanel.tsx`
  - `OrderPanel` supports `mode="waiter"` and `mode="cashier"` for role-based UI
  - Index exports at `src/components/shared/index.ts`
  
- **Waiter UI Redesign (Split Layout):**
  - Two-column layout: Left = Catalog, Right = Order sidebar
  - QR code payment display for Yape/Plin
  - "Enviar a Cocina" and "Llamar Cuenta" buttons
  - Modern dark glassmorphism styling
  
- **Shift Validation Tests:**
  - 4 new tests in `pos-flow.e2e.test.ts`:
    - `should require open shift before creating order`
    - `should require open shift before adding items`
    - `should require open shift before processing payments`
    - `should track shift cash movements correctly`

- **Role-Module Documentation:**
  - Created `roles-modules.md` documenting URL ↔ Role mapping
  - Cajera (`/`), Mozo (`/waiter`), KDS (`/kds`), Bar/Parrilla filters

### Fixed
- **SyncClient TypeError:** Added missing `onOnline()` and `syncNow()` methods
- **Dexie Schema Error:** Added `aggregate_id` index in Version 4
- **SSE Stream Error:** Added `closed` flag to prevent "Controller already closed" errors
- **Next.js 15 Params Warning:** Updated to use `React.use(params)` pattern
- **Invalid UUIDs:** Fixed placeholder `"test_tenant"` → valid UUID format
- **sale.reducer `status` undefined:** Fixed missing destructuring

### Changed
- `WaiterOrderPage` now uses shared `OrderPanel` component
- Improved error messages in `ShiftModal` to show actual error details

## [1.2.0] - 2026-01-05
### Added
- **Multi-Terminal Architecture (Phase P1):**

## [1.1.1] - 2026-01-02
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
