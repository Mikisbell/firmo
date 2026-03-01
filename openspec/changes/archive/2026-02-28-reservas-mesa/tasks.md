# Tasks: reservas-mesa

**Change:** reservas-mesa
**Fecha:** 2026-02-28
**Specs:** 13 requirements, 35 scenarios
**Design:** 10 new files, 4 modified files
**Status:** ARCHIVED (2026-02-28)
**Verification:** tsc 0 errors, vitest 264 files / 4340 tests / 0 failures, build OK

---

## Phase 1: Infrastructure / Foundation

> Database migration, Prisma schema, Zod schemas, event types, constants.
> Everything that other tasks depend on.

- [x] **1.1** Add `confirmation_code` field to Prisma schema and run migration
  - **Files:**
    - Modify: `prisma/schema.prisma` — add `confirmation_code String? @db.VarChar(10)` to model `reservations`, add `@@unique([tenant_id, date, confirmation_code])`
  - **Migration SQL:**
    ```sql
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(10);
    CREATE UNIQUE INDEX IF NOT EXISTS reservations_tenant_date_code_idx
      ON reservations(tenant_id, date, confirmation_code);
    ```
  - **Acceptance:** `npx prisma db execute --stdin` succeeds idempotently, `npx prisma generate` succeeds, Prisma client types include `confirmation_code`
  - **Depends on:** nothing

- [x] **1.2** Create Zod schemas for reservation validation (`reservation.schema.ts`)
  - **Files:**
    - Create: `src/core/reservations/reservation.schema.ts`
  - **Content:** `ReservationStatusSchema`, `CreateReservationSchema`, `ReservationQuerySchema`, `ReservationActionSchema`, `AvailabilitySlotsQuerySchema` (as defined in design.md Interfaces section)
  - **Acceptance:** All schemas export correctly, `CreateReservationSchema.parse()` validates party_size 1-20, date format YYYY-MM-DD, time format HH:MM, customer_name 2-100 chars, customer_phone 7-20 chars. TypeScript compiles with no errors.
  - **Depends on:** nothing

- [x] **1.3** Add `RESERVATION` aggregate type and 6 event payloads to `events.ts`
  - **Files:**
    - Modify: `src/core/domain/events.ts`
  - **Changes:**
    - Add `"RESERVATION"` to `AggregateTypeSchema` enum
    - Add 6 payload schemas: `ReservationCreatedPayload`, `ReservationConfirmedPayload`, `ReservationCancelledPayload`, `ReservationArrivedPayload`, `ReservationSeatedPayload`, `ReservationNoShowPayload`
    - Add 6 entries to `EventSchema` discriminated union: `RESERVATION_CREATED`, `RESERVATION_CONFIRMED`, `RESERVATION_CANCELLED`, `RESERVATION_ARRIVED`, `RESERVATION_SEATED`, `RESERVATION_NO_SHOW`
    - Export the new event types
  - **Acceptance:** `tsc --noEmit` passes, existing tests still pass, new event types are part of `ParkEvent` union
  - **Depends on:** nothing

- [x] **1.4** Add reservation business rules to `business-rules.ts`
  - **Files:**
    - Modify: `src/core/validation/business-rules.ts`
  - **Changes:**
    - Add `validateReservationEvent(event, context)` function
    - Validate: date not in past, min 1h anticipation, max 30 days future, party_size 1-20, time within operating hours, phone format (9 digits Peru)
    - Sanitize `special_requests` (strip HTML tags for XSS prevention)
  - **Acceptance:** Function exported, returns `ValidationResult`, existing tests still pass
  - **Depends on:** 1.3 (uses new event types)

- [x] **1.5** Add reservation role permissions to `role-permissions.ts`
  - **Files:**
    - Modify: `src/core/validation/role-permissions.ts`
  - **Changes:**
    - Map RESERVATION_* events to allowed roles (ADMIN_ROLES for confirm/reject/arrive/seat/no_show; all roles for CREATED/CANCELLED from public)
  - **Acceptance:** `canRoleEmitEvent()` returns correct permissions for all 6 RESERVATION_* events
  - **Depends on:** 1.3

---

## Phase 2: Core Implementation — Domain Service

> The reservation service with all business logic. This is the heart of the feature.

- [x] **2.1** Create `ReservationService` — confirmation code generation + state machine
  - **Files:**
    - Create: `src/core/reservations/reservation.service.ts`
  - **Content:**
    - `generateConfirmationCode()` — 6 chars alphanumeric (A-Z, 2-9 excluding ambiguous 0/O/1/I/L), up to 3 retries on collision
    - `VALID_TRANSITIONS` map (as defined in design.md)
    - `validateStateTransition(currentStatus, action)` — returns `ValidationResult`
    - Helper: `actionToStatus(action)` mapping (confirm->CONFIRMED, reject->REJECTED, etc.)
  - **Acceptance:** Code generates 6-char codes, state machine rejects invalid transitions (CANCELLED->CONFIRMED), retries on collision
  - **Depends on:** 1.2

- [x] **2.2** Create `ReservationService` — availability calculation
  - **Files:**
    - Modify: `src/core/reservations/reservation.service.ts`
  - **Content:**
    - `checkAvailability(tenantId, date, time, partySize, durationMinutes?)` — queries tables with capacity >= partySize, excludes tables with overlapping PENDING/CONFIRMED reservations, returns `{ available: boolean, availableTableCount: number }`
    - `getAvailableSlots(tenantId, date, partySize)` — returns 30-min slots within operating hours with availability flag
    - Overlap logic: reservation occupies [time, time + duration_minutes), two reservations overlap if their intervals intersect
    - Use Prisma transaction for atomic check-and-create to prevent overbooking from concurrent requests
  - **Acceptance:** Returns correct availability for non-overlapping/overlapping scenarios, correctly uses 90-min default duration
  - **Depends on:** 2.1, 1.1 (needs confirmation_code field)

- [x] **2.3** Create `ReservationService` — create reservation (full flow)
  - **Files:**
    - Modify: `src/core/reservations/reservation.service.ts`
  - **Content:**
    - `createReservation(tenantId, input: CreateReservationInput)` — validates business rules, checks availability, creates reservation in `$transaction` with confirmation code, emits `RESERVATION_CREATED` event
    - Tenant resolution helper: `resolveTenantBySlug(slug)` — `prisma.tenants.findFirst({ where: { slug, is_active: true } })`
    - Sanitize `special_requests` (strip HTML)
  - **Acceptance:** Full creation flow works: validates -> checks availability -> creates with code -> emits event. Returns confirmation_code. Rejects if no tables available (409).
  - **Depends on:** 2.1, 2.2, 1.4 (business rules)

- [x] **2.4** Create `ReservationService` — admin actions (confirm, reject, arrive, seat, no_show, cancel)
  - **Files:**
    - Modify: `src/core/reservations/reservation.service.ts`
  - **Content:**
    - `performAction(tenantId, reservationId, action, actorId, options?)` — validates state transition, updates reservation, emits corresponding event, optionally assigns table_id on confirm
    - `cancelByCustomer(tenantId, confirmationCode, date?)` — finds reservation by code, validates cancellable status (PENDING or CONFIRMED only), updates to CANCELLED, emits event
  - **Acceptance:** All 6 transitions work per state machine, invalid transitions return error, events emitted correctly
  - **Depends on:** 2.1, 1.3 (events)

- [x] **2.5** Create `ReservationService` — query methods (list, get by code)
  - **Files:**
    - Modify: `src/core/reservations/reservation.service.ts`
  - **Content:**
    - `getReservationsByDate(tenantId, filters: { date, status?, zoneId? })` — returns reservations ordered by time ascending, includes summary totals (total, confirmed, pending, no_show, cancelled)
    - `getReservationByCode(tenantId, confirmationCode)` — finds reservation by tenant + code, returns public-safe fields only (no tenant_id, no table_id, no internal_notes)
    - `getReservationById(tenantId, id)` — for admin use, returns full reservation data
  - **Acceptance:** List returns ordered by time, totals calculated correctly, public query excludes sensitive fields, 404 for non-existent codes
  - **Depends on:** 1.1

---

## Phase 3: Core Implementation — API Routes

> HTTP layer: route handlers for public and admin endpoints.

- [x] **3.1** Create public API route: `POST` create reservation + `GET` available slots
  - **Files:**
    - Create: `src/app/api/reservations/[tenantSlug]/route.ts`
  - **Content:**
    - `POST`: Resolve tenant by slug -> validate body with `CreateReservationSchema` -> call `ReservationService.createReservation()` -> return 201 with confirmation_code. Rate limit: 3 req/min/IP.
    - `GET`: Resolve tenant by slug -> parse query params (date, party_size) -> call `ReservationService.getAvailableSlots()` -> return 200 with slots array. Rate limit: 10 req/min/IP.
    - No auth required. Use `withRequestLogging`. Return 404 for unknown slug, 400 for validation errors, 409 for no availability, 429 for rate limit.
  - **Scenarios covered:** S1 (happy path create), S2 (optional fields), S3 (unknown slug), S10-S11 (rate limiting)
  - **Acceptance:** POST returns 201 with code, GET returns slots, proper error codes, rate limiting works, no tenant data leaked
  - **Depends on:** 2.3, 2.2

- [x] **3.2** Create public API route: `GET` query reservation + `PATCH` cancel by customer
  - **Files:**
    - Create: `src/app/api/reservations/[tenantSlug]/[code]/route.ts`
    - Create: `src/app/api/reservations/[tenantSlug]/[code]/cancel/route.ts`
  - **Content:**
    - `GET /api/reservations/[tenantSlug]/[code]`: Resolve tenant -> find reservation by code -> return public-safe fields. 404 if not found. Rate limit: 10 req/min/IP.
    - `PATCH /api/reservations/[tenantSlug]/[code]/cancel`: Resolve tenant -> call `ReservationService.cancelByCustomer()` -> return 200. 409 if not cancellable. Rate limit: 10 req/min/IP.
  - **Scenarios covered:** S12-S13 (query by code), S14-S15 (cancel by customer), S16 (cancel non-cancellable)
  - **Acceptance:** GET returns public-safe data (no tenant_id, no table_id), PATCH changes status to CANCELLED, 409 for SEATED/ARRIVED/NO_SHOW/CANCELLED reservations
  - **Depends on:** 2.4, 2.5

- [x] **3.3** Create admin API route: `GET` list reservations with filters
  - **Files:**
    - Create: `src/app/api/admin/reservations/route.ts`
  - **Content:**
    - `GET`: `requireAdminAuth` -> parse query (date default today, status, zone_id) with `ReservationQuerySchema` -> call `ReservationService.getReservationsByDate()` -> return 200 with reservations + totals
    - tenant_id ALWAYS from JWT (`authResult.user.tenantId`)
  - **Scenarios covered:** S17-S18 (admin list), S19 (auth required), S20 (filter by zone)
  - **Acceptance:** Returns reservations ordered by time, includes totals, filters work, 401 without auth, scoped to admin's tenant
  - **Depends on:** 2.5

- [x] **3.4** Create admin API route: `PATCH` actions on reservation
  - **Files:**
    - Create: `src/app/api/admin/reservations/[id]/route.ts`
  - **Content:**
    - `PATCH`: `requireAdminAuth` -> parse body with `ReservationActionSchema` -> call `ReservationService.performAction()` -> return 200 with updated reservation
    - Support actions: confirm, reject, arrive, seat, no_show, cancel
    - Optional: `table_id` on confirm
  - **Scenarios covered:** S21-S24 (admin actions: confirm, no_show, invalid transition, assign table)
  - **Acceptance:** All 6 actions work, invalid transitions return 409, table assignment on confirm works, events emitted
  - **Depends on:** 2.4

---

## Phase 4: UI Implementation

> Public reservation form and admin management page.

- [x] **4.1** Create public reservation page: `/reservar/[tenantSlug]/page.tsx`
  - **Files:**
    - Create: `src/app/reservar/[tenantSlug]/page.tsx`
  - **Content:**
    - `'use client'` component, mobile-first responsive layout
    - Step 1: Form with fields: customer_name, customer_phone, date (date picker), time (slot selector), party_size, special_requests (optional)
    - Step 2: Fetch available slots via `GET /api/reservations/[tenantSlug]?date=X&party_size=Y` when date+party_size selected
    - Step 3: Submit via `POST /api/reservations/[tenantSlug]`
    - Step 4: Show confirmation screen with code
    - Additional: "Consultar reserva" section — input confirmation code, fetch via GET, show status
    - Error handling: show validation errors inline, 404 for invalid tenant, 409 for no availability
    - Tailwind dark theme (zinc-900/800), sonner toasts for errors
  - **Scenarios covered:** S30-S31 (UI happy path, invalid slug)
  - **Acceptance:** Mobile-responsive form, slot selector works, confirmation code displayed, query existing reservation works, no internal data exposed
  - **Depends on:** 3.1, 3.2

- [x] **4.2** Create admin reservations page: `/admin/reservas/page.tsx`
  - **Files:**
    - Create: `src/app/admin/reservas/page.tsx`
  - **Content:**
    - `'use client'` component with SWR for data fetching
    - KPI cards at top: total, confirmed, pending, no_show counts
    - Filters: date picker (default today), status dropdown, zone dropdown
    - Reservation list: card per reservation showing name, phone, time, party_size, status badge, special_requests
    - Action buttons per reservation (context-dependent based on current status): Confirmar, Rechazar, Llego, Sentar, No-Show, Cancelar
    - Actions call `PATCH /api/admin/reservations/[id]` and refresh list
    - Tailwind dark theme, Lucide icons
  - **Scenarios covered:** S32 (admin manages reservations of the day)
  - **Acceptance:** Shows reservations with KPIs, filters work, actions change status, list refreshes after action
  - **Depends on:** 3.3, 3.4

- [x] **4.3** Add "Reservas" link to AdminSidebar
  - **Files:**
    - Modify: `src/app/admin/components/AdminSidebar.tsx`
  - **Changes:**
    - Import `CalendarClock` icon from `lucide-react`
    - Add `{ href: '/admin/reservas', label: 'Reservas', icon: CalendarClock }` to the `operaciones` group (next to existing items like Ordenes, Delivery)
  - **Acceptance:** "Reservas" link visible in sidebar, navigates to `/admin/reservas`, active state highlights correctly
  - **Depends on:** nothing (can be done in parallel)

---

## Phase 5: Testing

> Unit tests, property tests, and integration tests. TDD-aligned: these verify ALL 35 scenarios from specs.md.

- [x] **5.1** Write unit tests for Zod schemas (`reservation.schema.test.ts`)
  - **Files:**
    - Create: `src/core/reservations/__tests__/reservation.schema.test.ts`
  - **Tests:**
    - `CreateReservationSchema`: valid input passes, missing required fields fail, party_size boundaries (0 fails, 1 passes, 20 passes, 21 fails), date format validation, time format validation, customer_name min/max, phone format
    - `ReservationActionSchema`: all 6 actions valid, unknown action fails
    - `ReservationQuerySchema`: optional fields work, invalid date format fails
  - **Scenarios covered:** Implicitly covers S4-S9 (validation edge cases at schema level)
  - **Acceptance:** All schema validations tested, edge cases covered
  - **Depends on:** 1.2

- [x] **5.2** Write unit tests for ReservationService — state machine + confirmation code
  - **Files:**
    - Create: `src/core/reservations/__tests__/reservation.service.test.ts`
  - **Tests (with Prisma mocked via `vi.mock`):**
    - State transitions: PENDING->CONFIRMED, PENDING->REJECTED, CONFIRMED->ARRIVED, ARRIVED->SEATED, CONFIRMED->NO_SHOW, any active->CANCELLED
    - Invalid transitions: CANCELLED->CONFIRMED (409), SEATED->PENDING (409), NO_SHOW->CONFIRMED (409), REJECTED->anything (409)
    - Confirmation code: generates 6 chars, only valid chars (no 0/O/1/I/L), retries on collision (max 3)
    - Cancel by customer: PENDING works, CONFIRMED works, SEATED fails, CANCELLED fails
  - **Scenarios covered:** S14-S16 (cancel), S21-S24 (admin actions), S25-S26 (confirmation code generation/collision)
  - **Acceptance:** All state transitions verified, code generation tested including retry, mock Prisma
  - **Depends on:** 2.1, 2.4

- [x] **5.3** Write unit tests for ReservationService — availability + creation
  - **Files:**
    - Modify: `src/core/reservations/__tests__/reservation.service.test.ts`
  - **Tests:**
    - Availability: returns available when no overlapping reservations, returns unavailable when all tables occupied, correctly handles 90-min duration overlap, non-overlapping time slots are available
    - Creation happy path: validates -> checks availability -> creates with code -> returns confirmation
    - Creation failures: no tables available (409), validation fails (400), unknown tenant (404)
    - Business rules in creation: past date rejected, <1h anticipation rejected, >30 days rejected, party_size 0 rejected, party_size 21 rejected, out-of-hours rejected
  - **Scenarios covered:** S1-S3 (creation), S4-S9 (validation), S27-S29 (availability/overbooking)
  - **Acceptance:** All creation and availability scenarios tested with mocked Prisma
  - **Depends on:** 2.2, 2.3

- [x] **5.4** Write unit tests for ReservationService — query methods
  - **Files:**
    - Modify: `src/core/reservations/__tests__/reservation.service.test.ts`
  - **Tests:**
    - List by date: returns ordered by time, includes totals, filters by status, filters by zone
    - Get by code: returns public-safe fields (no tenant_id, no table_id, no internal_notes), 404 for non-existent
    - Get by id: returns full data for admin
    - Tenant isolation: never returns cross-tenant data
  - **Scenarios covered:** S12-S13 (query by code), S17-S20 (admin list, filters, auth, zone filter)
  - **Acceptance:** All query scenarios verified, public responses sanitized
  - **Depends on:** 2.5

- [x] **5.5** Write property tests for reservation business rules (`reservation.property.test.ts`)
  - **Files:**
    - Create: `src/core/reservations/__tests__/reservation.property.test.ts`
  - **Tests (fast-check, 100 numRuns, filter `__proto__`/`constructor`/`prototype` from keys):**
    - Property: `party_size` in [1, 20] always valid; outside always invalid
    - Property: date in [now+1h, now+30d] always valid; date < now or date > now+30d always invalid
    - Property: confirmation code always 6 chars, only chars from allowed set (A-Z excl O/I, 2-9 excl 0/1)
    - Property: no overbooking — given N tables of capacity C, creating N+1 reservations for same slot always results in exactly 1 failure
    - Property: state transitions — from any terminal state (CANCELLED, REJECTED, NO_SHOW, COMPLETED), no transition is valid
    - Property: fc.date() with bounds for date generation
  - **Scenarios covered:** S4-S9 (validation invariants), S25-S26 (code format), S27-S29 (overbooking invariant)
  - **Acceptance:** All properties hold for 100 runs, fc.date() bounded, no `__proto__` keys
  - **Depends on:** 2.1, 2.2, 1.4

- [x] **5.6** Write integration tests for API routes (public + admin)
  - **Files:**
    - Create: `src/core/reservations/__tests__/reservation.api.test.ts`
  - **Tests (mock service layer, test HTTP layer):**
    - POST /api/reservations/[slug]: 201 on success, 400 on validation error, 404 on unknown slug, 409 on no availability, 429 on rate limit
    - GET /api/reservations/[slug]?date&party_size: 200 with slots
    - GET /api/reservations/[slug]/[code]: 200 with public data, 404 on unknown
    - PATCH /api/reservations/[slug]/[code]/cancel: 200 on success, 409 on non-cancellable
    - GET /api/admin/reservations: 401 without auth, 200 with auth + data
    - PATCH /api/admin/reservations/[id]: 200 on valid action, 409 on invalid transition
  - **Scenarios covered:** S1-S3, S10-S11 (rate limiting), S12-S13, S14-S16, S17-S20, S21-S24
  - **Acceptance:** All API response codes verified, auth enforced on admin routes, rate limiting tested
  - **Depends on:** 3.1, 3.2, 3.3, 3.4

- [x] **5.7** Write concurrency test for overbooking prevention
  - **Files:**
    - Modify: `src/core/reservations/__tests__/reservation.service.test.ts`
  - **Tests:**
    - Simulate two concurrent `createReservation()` calls for the last available table
    - Verify exactly one succeeds (201) and one fails (409)
    - Use Prisma `$transaction` isolation to ensure atomicity
  - **Scenarios covered:** S29 (concurrent overbooking prevention)
  - **Acceptance:** Exactly 1 of 2 concurrent requests succeeds, no overbooking
  - **Depends on:** 2.3

---

## Phase 6: Cleanup / Integration Verification

> Final checks: build, typecheck, full test suite, sidebar integration.

- [x] **6.1** Verify TypeScript compilation and build
  - **Actions:**
    - Run `npx tsc --noEmit` — must pass with 0 errors
    - Run `npm run build` — must succeed
    - Verify no new `any` types introduced (project rule: minimize `as any`)
  - **Acceptance:** `tsc` 0 errors, `npm run build` succeeds
  - **Depends on:** all previous tasks

- [x] **6.2** Run full test suite and verify no regressions
  - **Actions:**
    - Run `npx vitest run` — all tests pass (existing 4024+ tests + new reservation tests)
    - Verify coverage >= 80% for new files
    - No flaky tests introduced
  - **Acceptance:** 0 test failures, coverage threshold met
  - **Depends on:** 5.1-5.7

- [x] **6.3** Verify event integration — new RESERVATION_* events work with ingest pipeline
  - **Actions:**
    - Confirm that `RESERVATION_*` events pass through the existing ingest pipeline without errors
    - Confirm that the event dedup mechanism handles RESERVATION events correctly
    - Confirm that the discriminated union in `events.ts` compiles and is exhaustive
  - **Acceptance:** Events ingestable, no runtime errors, type safety maintained
  - **Depends on:** 1.3, 2.3, 2.4

---

## Dependency Graph

```
Phase 1 (Infrastructure):
  1.1 (DB migration)         ─┐
  1.2 (Zod schemas)          ─┤─ no deps, can run in parallel
  1.3 (Event types)          ─┤
  1.4 (Business rules)       ─┘─ depends on 1.3
  1.5 (Role permissions)     ─── depends on 1.3

Phase 2 (Domain Service):
  2.1 (State machine + code) ─── depends on 1.2
  2.2 (Availability)         ─── depends on 2.1, 1.1
  2.3 (Create reservation)   ─── depends on 2.1, 2.2, 1.4
  2.4 (Admin actions)        ─── depends on 2.1, 1.3
  2.5 (Query methods)        ─── depends on 1.1

Phase 3 (API Routes):
  3.1 (Public POST/GET)      ─── depends on 2.2, 2.3
  3.2 (Public GET/PATCH)     ─── depends on 2.4, 2.5
  3.3 (Admin GET)            ─── depends on 2.5
  3.4 (Admin PATCH)          ─── depends on 2.4

Phase 4 (UI):
  4.1 (Public page)          ─── depends on 3.1, 3.2
  4.2 (Admin page)           ─── depends on 3.3, 3.4
  4.3 (Sidebar link)         ─── no deps (parallel)

Phase 5 (Testing):
  5.1 (Schema tests)         ─── depends on 1.2
  5.2 (Service state tests)  ─── depends on 2.1, 2.4
  5.3 (Service avail tests)  ─── depends on 2.2, 2.3
  5.4 (Service query tests)  ─── depends on 2.5
  5.5 (Property tests)       ─── depends on 2.1, 2.2, 1.4
  5.6 (API integration tests)─── depends on 3.1-3.4
  5.7 (Concurrency test)     ─── depends on 2.3

Phase 6 (Cleanup):
  6.1 (TypeScript + build)   ─── depends on all
  6.2 (Full test suite)      ─── depends on 5.1-5.7
  6.3 (Event integration)    ─── depends on 1.3, 2.3, 2.4
```

---

## Scenario Coverage Map

| Spec Scenario | Task(s) | Type |
|---------------|---------|------|
| S1: Happy path create | 5.3, 5.6 | Unit + Integration |
| S2: Optional fields | 5.3, 5.6 | Unit + Integration |
| S3: Unknown tenant slug | 5.3, 5.6 | Unit + Integration |
| S4: Past date | 5.3, 5.5 | Unit + Property |
| S5: <1h anticipation | 5.3, 5.5 | Unit + Property |
| S6: >30 days future | 5.3, 5.5 | Unit + Property |
| S7: Party size > 20 | 5.1, 5.3, 5.5 | Schema + Unit + Property |
| S8: Party size 0 | 5.1, 5.3, 5.5 | Schema + Unit + Property |
| S9: Out of hours | 5.3, 5.5 | Unit + Property |
| S10: Rate limit hit | 5.6 | Integration |
| S11: Rate limit normal | 5.6 | Integration |
| S12: Query existing reservation | 5.4, 5.6 | Unit + Integration |
| S13: Query non-existent code | 5.4, 5.6 | Unit + Integration |
| S14: Cancel PENDING | 5.2, 5.6 | Unit + Integration |
| S15: Cancel CONFIRMED | 5.2, 5.6 | Unit + Integration |
| S16: Cancel SEATED (fails) | 5.2, 5.6 | Unit + Integration |
| S17: Admin list by date | 5.4, 5.6 | Unit + Integration |
| S18: Admin totals | 5.4, 5.6 | Unit + Integration |
| S19: Admin 401 | 5.6 | Integration |
| S20: Admin filter by zone | 5.4, 5.6 | Unit + Integration |
| S21: Admin confirm | 5.2, 5.6 | Unit + Integration |
| S22: Admin no_show | 5.2, 5.6 | Unit + Integration |
| S23: Invalid transition | 5.2, 5.5, 5.6 | Unit + Property + Integration |
| S24: Assign table on confirm | 5.2, 5.6 | Unit + Integration |
| S25: Code generation unique | 5.2, 5.5 | Unit + Property |
| S26: Code collision retry | 5.2 | Unit |
| S27: Overbooking blocked | 5.3, 5.5 | Unit + Property |
| S28: Non-overlapping allowed | 5.3 | Unit |
| S29: Concurrent overbooking | 5.7 | Concurrency |
| S30: UI happy path | 4.1 | Manual / E2E |
| S31: UI invalid slug | 4.1 | Manual / E2E |
| S32: Admin UI manage | 4.2 | Manual / E2E |
| S33: Event emitted on create | 5.3 | Unit |
| S34: Migration idempotent | 1.1 | Manual verification |
| S35: Sidebar link | 4.3 | Visual verification |

---

## Recommended Apply Batches

For the `/sdd-apply` phase, tasks can be batched as follows:

- **Batch A** (Infrastructure — ~1 session): Tasks 1.1, 1.2, 1.3, 1.4, 1.5
- **Batch B** (Domain Service — ~1-2 sessions): Tasks 2.1, 2.2, 2.3, 2.4, 2.5
- **Batch C** (API Routes — ~1 session): Tasks 3.1, 3.2, 3.3, 3.4
- **Batch D** (UI — ~1-2 sessions): Tasks 4.1, 4.2, 4.3
- **Batch E** (Testing — ~1-2 sessions): Tasks 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
- **Batch F** (Verification — ~1 session): Tasks 6.1, 6.2, 6.3
