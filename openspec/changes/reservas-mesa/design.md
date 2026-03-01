# Design: reservas-mesa

## Technical Approach

CRUD directo sobre la tabla `reservations` existente en Prisma, con event trail opcional al event store para auditoria. Dos superficies de API: publica (sin auth, por `tenantSlug`) y admin (con `requireAdminAuth`). Un servicio de dominio centraliza logica de disponibilidad, validaciones y generacion de codigos de confirmacion.

El approach sigue los patrones existentes del proyecto:
- API routes en App Router con `withRequestLogging` y Pino structured logger
- Resolucion de tenant publico via `slug` (patron `tableQrService.resolveTableMenu`)
- Admin auth con `requireAdminAuth` + `tenantId` desde JWT
- Schemas Zod para validacion de request/response
- Cache Redis de 60s para queries de disponibilidad
- Property tests con fast-check para validaciones de negocio

---

## Architecture Decisions

### Decision: CRUD con Event Trail vs Full Event Sourcing

**Choice**: CRUD directo en `reservations` + emision de eventos `RESERVATION_*` para auditoria
**Alternatives considered**: Reconstruir estado de reserva desde eventos (full ES)
**Rationale**: Las reservas tienen ciclo de vida simple (PENDING -> CONFIRMED -> ARRIVED -> SEATED) sin necesidad de replay ni proyecciones complejas. El event trail da trazabilidad sin la complejidad de un reducer dedicado. Las ordenes SI necesitan ES por su complejidad; las reservas no.

### Decision: API publica por tenantSlug sin autenticacion

**Choice**: `POST /api/reservations/[tenantSlug]` resuelve tenant por `slug` en tabla `tenants`, sin auth
**Alternatives considered**: Token temporal de acceso, API key por tenant
**Rationale**: Patron identico al menu publico (`/api/menu/[tenantSlug]/[tableId]`). El rate limiting por IP (3 req/min) previene abuso. No se exponen datos sensibles del tenant. Un cliente comun no va a autenticarse para reservar.

### Decision: Confirmation code como campo en reservations

**Choice**: Campo `confirmation_code` VARCHAR(10) en `reservations` con unique index compuesto `(tenant_id, date, confirmation_code)`
**Alternatives considered**: UUID completo, secuencia autoincremental, hash del ID
**Rationale**: 6 caracteres alfanumericos (ej: `R4K7M2`) son faciles de comunicar por telefono/SMS. Unicidad por tenant+fecha evita colisiones sin ser globalmente unico. El prefix `R` + 5 chars aleatorios da ~60M combinaciones por tenant-dia.

### Decision: Servicio de dominio centralizado

**Choice**: `reservation.service.ts` encapsula disponibilidad, validaciones, y logica de estado
**Alternatives considered**: Logica inline en route handlers, multiple helpers sueltos
**Rationale**: Patron existente (`tableQrService`). Permite testear logica de negocio independiente de HTTP. Property tests pueden ejecutar el servicio directamente.

### Decision: Aggregate type RESERVATION en event sourcing

**Choice**: Agregar `"RESERVATION"` al `AggregateTypeSchema` y crear eventos bajo ese aggregate
**Alternatives considered**: Reusar aggregate `ORDER`
**Rationale**: Las reservas son un aggregate distinto con su propio ciclo de vida. No tienen relacion directa con ordenes en el flujo de eventos.

---

## Data Flow

### Flujo 1: Cliente crea reserva (publico)

```
Browser (mobile)
    |
    | POST /api/reservations/[tenantSlug]
    | { customer_name, customer_phone, date, time, party_size, special_requests }
    |
    v
Route Handler (no auth, rate-limited 3/min/IP)
    |
    |-- Resolve tenant by slug (prisma.tenants.findFirst({ where: { slug } }))
    |-- Validate input (Zod: CreateReservationSchema)
    |
    v
ReservationService.createReservation()
    |
    |-- Validate business rules:
    |     * date not in past
    |     * min 1h anticipation
    |     * max 30 days in future
    |     * party_size 1-20
    |     * time within operating hours
    |
    |-- Check availability:
    |     * Query tables with capacity >= party_size
    |     * Exclude tables with overlapping reservations (PENDING/CONFIRMED)
    |     * If no tables available -> 409 Conflict
    |
    |-- prisma.$transaction:
    |     * Create reservation (status: PENDING, generate confirmation_code)
    |     * Emit RESERVATION_CREATED event to event store (audit trail)
    |
    v
Response 201 { confirmation_code, status, date, time, party_size }
```

### Flujo 2: Admin gestiona reservas

```
Admin Panel
    |
    | GET /api/admin/reservations?date=2026-03-01&status=PENDING
    |
    v
Route Handler (requireAdminAuth)
    |-- tenantId from JWT
    |-- Query reservations with filters
    |-- Return paginated list
    |
    v
    | PATCH /api/admin/reservations/[id]
    | { action: "confirm" | "reject" | "arrive" | "seat" | "no_show" | "cancel" }
    |
    v
Route Handler (requireAdminAuth)
    |-- Validate state transition
    |-- Update reservation record
    |-- Emit corresponding RESERVATION_* event
    |-- Invalidate cache
    |
    v
Response 200 { updated reservation }
```

### Flujo 3: Cliente consulta reserva

```
Browser
    |
    | GET /api/reservations/[tenantSlug]/[code]
    |
    v
Route Handler (no auth)
    |-- Resolve tenant by slug
    |-- Find reservation by (tenant_id, confirmation_code, date >= today)
    |-- Return public-safe fields only (no internal_notes, no tenant data)
    |
    v
Response 200 { status, date, time, party_size, customer_name }
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/reservations/reservation.service.ts` | Create | Servicio de dominio: crear reserva, calcular disponibilidad, transiciones de estado, generar confirmation code |
| `src/core/reservations/reservation.schema.ts` | Create | Schemas Zod: CreateReservationSchema, ReservationQuerySchema, ReservationActionSchema, public response schemas |
| `src/core/reservations/__tests__/reservation.service.test.ts` | Create | Tests unitarios del servicio: creacion, disponibilidad, transiciones de estado, edge cases |
| `src/core/reservations/__tests__/reservation.property.test.ts` | Create | Property tests fast-check: validaciones de fecha/hora/party_size, no-overbooking, confirmation code unicidad |
| `src/app/api/reservations/[tenantSlug]/route.ts` | Create | API publica: POST crear reserva, GET listar horarios disponibles |
| `src/app/api/reservations/[tenantSlug]/[code]/route.ts` | Create | API publica: GET consultar reserva, PATCH cancelar reserva por cliente |
| `src/app/api/admin/reservations/route.ts` | Create | API admin: GET listar reservas con filtros y paginacion |
| `src/app/api/admin/reservations/[id]/route.ts` | Create | API admin: PATCH acciones (confirm/reject/arrive/seat/no_show/cancel) |
| `src/app/reservar/[tenantSlug]/page.tsx` | Create | UI publica mobile-first: formulario de reserva, selector de horarios, consulta de estado |
| `src/app/admin/reservas/page.tsx` | Create | UI admin: lista de reservas del dia, filtros, acciones rapidas, KPIs |
| `prisma/schema.prisma` | Modify | Agregar campo `confirmation_code` a model `reservations` |
| `src/core/domain/events.ts` | Modify | Agregar `"RESERVATION"` a AggregateTypeSchema + 6 payloads + 6 entradas en EventSchema union + type exports |
| `src/app/admin/components/AdminSidebar.tsx` | Modify | Agregar item `{ href: '/admin/reservas', label: 'Reservas', icon: CalendarClock }` al grupo `operaciones` |
| `src/core/validation/business-rules.ts` | Modify | Agregar `validateReservationEvent()` para validar reglas de negocio de reservas |

---

## Interfaces / Contracts

### Zod Schemas (`reservation.schema.ts`)

```typescript
import { z } from 'zod';

// Statuses for reservation lifecycle
export const ReservationStatusSchema = z.enum([
  'PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED',
  'ARRIVED', 'SEATED', 'NO_SHOW', 'COMPLETED',
]);

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

// Public: create reservation
export const CreateReservationSchema = z.object({
  customer_name: z.string().min(2).max(100),
  customer_phone: z.string().min(7).max(20),
  customer_email: z.string().email().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/),        // HH:MM
  party_size: z.number().int().min(1).max(20),
  special_requests: z.string().max(500).optional(),
  zone_preference: z.string().optional(),
});

// Admin: query reservations
export const ReservationQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: ReservationStatusSchema.optional(),
  zone_id: z.string().uuid().optional(),
});

// Admin: action on reservation
export const ReservationActionSchema = z.object({
  action: z.enum(['confirm', 'reject', 'arrive', 'seat', 'no_show', 'cancel']),
  reason: z.string().max(500).optional(), // Required for reject/cancel
  table_id: z.string().uuid().optional(), // Optional on confirm (assign table)
});
```

### Event Payloads (`events.ts` additions)

```typescript
// New aggregate type: add "RESERVATION" to AggregateTypeSchema

const ReservationCreatedPayload = z.object({
  reservation_id: uuidSchema,
  customer_name: z.string().min(1),
  customer_phone: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party_size: z.number().int().positive(),
  confirmation_code: z.string().min(1),
  zone_preference: z.string().nullish(),
  special_requests: z.string().nullish(),
});

const ReservationConfirmedPayload = z.object({
  reservation_id: uuidSchema,
  confirmed_by: uuidSchema, // admin user ID
  table_id: uuidSchema.nullish(),
});

const ReservationCancelledPayload = z.object({
  reservation_id: uuidSchema,
  cancelled_by: z.string().min(1), // "CUSTOMER" or admin user UUID
  reason: z.string().nullish(),
});

const ReservationArrivedPayload = z.object({
  reservation_id: uuidSchema,
  arrived_at: isoDateSchema,
});

const ReservationSeatedPayload = z.object({
  reservation_id: uuidSchema,
  table_id: uuidSchema,
  seated_at: isoDateSchema,
});

const ReservationNoShowPayload = z.object({
  reservation_id: uuidSchema,
  marked_by: uuidSchema, // admin user ID
});
```

### API Endpoint Contracts

#### Public: Create Reservation

```
POST /api/reservations/[tenantSlug]
Auth: None (rate-limited 3/min/IP)
Request Body: CreateReservationSchema
Response 201: {
  confirmation_code: string;
  status: "PENDING";
  date: string;
  time: string;
  party_size: number;
  restaurant_name: string;
}
Response 400: { error: string; details?: ValidationError[] }
Response 404: { error: "Restaurante no encontrado" }
Response 409: { error: "No hay disponibilidad para el horario seleccionado" }
Response 429: { error: "Demasiadas solicitudes" }
```

#### Public: Get Available Slots

```
GET /api/reservations/[tenantSlug]?date=2026-03-01&party_size=4
Auth: None
Response 200: {
  restaurant_name: string;
  date: string;
  slots: Array<{
    time: string;       // "12:00", "12:30", etc.
    available: boolean;
  }>;
}
```

#### Public: Query Reservation by Code

```
GET /api/reservations/[tenantSlug]/[code]
Auth: None
Response 200: {
  status: ReservationStatus;
  date: string;
  time: string;
  party_size: number;
  customer_name: string;
  special_requests?: string;
  confirmation_code: string;
}
Response 404: { error: "Reserva no encontrada" }
```

#### Public: Cancel Reservation by Customer

```
PATCH /api/reservations/[tenantSlug]/[code]/cancel
Auth: None (rate-limited)
Response 200: { status: "CANCELLED"; confirmation_code: string }
Response 404: { error: "Reserva no encontrada" }
Response 409: { error: "La reserva no puede ser cancelada en su estado actual" }
```

#### Admin: List Reservations

```
GET /api/admin/reservations?date=2026-03-01&status=PENDING&zone_id=xxx
Auth: requireAdminAuth (tenantId from JWT)
Response 200: PaginatedResponse<{
  id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time: string;
  party_size: number;
  status: ReservationStatus;
  confirmation_code: string;
  table_number?: string;
  zone_preference?: string;
  special_requests?: string;
  internal_notes?: string;
  created_at: string;
}>
```

#### Admin: Action on Reservation

```
PATCH /api/admin/reservations/[id]
Auth: requireAdminAuth
Request Body: ReservationActionSchema
Response 200: { updated reservation object }
Response 400: { error: "Transicion de estado invalida" }
Response 404: { error: "Reserva no encontrada" }
```

### State Transitions

```
PENDING ──────> CONFIRMED ──────> ARRIVED ──────> SEATED ──────> COMPLETED
   |                |                                               (auto)
   |                |
   +──> REJECTED    +──> CANCELLED    CONFIRMED ──> NO_SHOW
   +──> CANCELLED
```

Valid transitions map:
```typescript
const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING:    ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED:  ['ARRIVED', 'NO_SHOW', 'CANCELLED'],
  REJECTED:   [],
  CANCELLED:  [],
  ARRIVED:    ['SEATED'],
  SEATED:     ['COMPLETED'],
  NO_SHOW:    [],
  COMPLETED:  [],
};
```

---

## Prisma Schema Changes

```sql
-- Migration: add confirmation_code to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(10);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_tenant_date_code_idx
  ON reservations(tenant_id, date, confirmation_code);
```

Prisma model update:
```prisma
model reservations {
  // ... existing fields ...
  confirmation_code  String?   @db.VarChar(10)
  // ... existing fields ...

  @@unique([tenant_id, date, confirmation_code])
  // ... existing indexes ...
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ReservationService`: crear reserva, disponibilidad, state transitions, confirmation code generation | Vitest con Prisma mockeado (`vi.mock('@/src/core/db/prisma')`) |
| Unit | Zod schemas: validacion de inputs, edge cases | Vitest assertions directas |
| Property | Business rules: date bounds (1h min, 30d max), party_size (1-20), no-overbooking invariant, confirmation code formato | fast-check 100 numRuns, bounded dates, bounded integers |
| Property | State transitions: solo transiciones validas, no estados terminales reversibles | fast-check con arbitrario de secuencias de acciones |
| Integration | API routes: auth, rate limiting, tenant resolution, CRUD completo | Vitest con mocks de service layer |
| E2E | Flujo completo cliente: abrir form -> llenar -> enviar -> ver confirmacion -> consultar | Playwright mobile viewport |
| E2E | Flujo admin: ver lista -> confirmar reserva -> marcar llegada | Playwright con auth fixture |

Coverage target: >= 80% (per `openspec/config.yaml`)

---

## Migration / Rollout

1. **DB Migration first**: `ALTER TABLE ADD COLUMN IF NOT EXISTS confirmation_code` (non-breaking, nullable)
2. **Deploy backend**: API routes + service + events (new routes, no impact on existing)
3. **Deploy frontend**: Admin page + public form (new routes `/admin/reservas` + `/reservar/[slug]`)
4. **Feature flag recommended**: Add `enable_reservations` to `tenant_settings` to soft-launch per tenant. UI checks this flag before rendering reservation link.

No data migration needed -- the `reservations` table exists but is empty in production.

---

## Open Questions

- [ ] Operating hours: `tenant_settings` no tiene campos de horario de atencion (`opening_time`, `closing_time`). Opciones: (a) agregar columnas, (b) hardcodear 11:00-22:00 como default con config en JSON field, (c) dejarlo como campo opcional en el form y no validar horario al inicio. Recomendacion: (b) con JSON en `tenant_settings` o columna nueva.
- [ ] Notificacion de confirmacion: El campo `confirmation_sent` existe en el modelo. La propuesta excluye SMS/WhatsApp. Deberiamos al menos enviar un evento para que un futuro servicio de notificaciones pueda reaccionar?
