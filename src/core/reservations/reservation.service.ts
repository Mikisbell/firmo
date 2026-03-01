/**
 * Reservation Service - Domain logic for table reservations
 *
 * CRUD-based service with event trail for audit:
 * - Confirmation code generation (6 chars, no ambiguous characters)
 * - State machine for reservation lifecycle
 * - Availability calculation (anti-overbooking via $transaction)
 * - Full creation flow (validate -> check availability -> create -> emit event)
 * - Admin actions (confirm, reject, arrive, seat, no_show, cancel)
 * - Public + admin query methods
 *
 * @module core/reservations/reservation.service
 */

import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/src/core/db/prisma";
import {
    type Result,
    ok,
    err,
    type DomainError,
    ValidationError,
    NotFoundError,
    ConflictError,
} from "@/src/core/result";
import { createLogger } from "@/src/core/observability/structured-logger";
import {
    type ReservationStatus,
    type CreateReservationInput,
    type ReservationAction,
    VALID_TRANSITIONS,
    ACTION_TO_STATUS,
    CONFIRMATION_CODE_CHARS,
    CONFIRMATION_CODE_LENGTH,
    CONFIRMATION_CODE_MAX_RETRIES,
    RESERVATION_DEFAULTS,
} from "./reservation.schema";
import {
    validateReservationCreation,
    sanitizeSpecialRequests,
} from "./business-rules";

const log = createLogger("reservation-service");

// ============================================================================
// Types
// ============================================================================

/** Public-safe reservation data (no tenant_id, no table_id, no internal_notes) */
export interface PublicReservation {
    confirmation_code: string;
    status: string;
    date: string;
    time: string;
    party_size: number;
    customer_name: string;
    special_requests: string | null;
    restaurant_name: string;
}

/** Full reservation data for admin use */
export interface AdminReservation {
    id: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    date: string;
    time: string;
    duration_minutes: number;
    party_size: number;
    status: string;
    confirmation_code: string | null;
    table_id: string | null;
    table_number: string | null;
    zone_preference: string | null;
    special_requests: string | null;
    internal_notes: string | null;
    arrived_at: string | null;
    seated_at: string | null;
    no_show_at: string | null;
    cancelled_at: string | null;
    cancelled_reason: string | null;
    created_at: string;
}

/** Summary totals for admin reservation listing */
export interface ReservationSummary {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    no_show: number;
    arrived: number;
    seated: number;
    rejected: number;
    completed: number;
}

/** Result of reservation creation */
export interface CreateReservationResult {
    id: string;
    confirmation_code: string;
    status: string;
    date: string;
    time: string;
    party_size: number;
}

/** Availability slot */
export interface AvailabilitySlot {
    time: string;
    available: boolean;
}

/** Tenant info resolved from slug */
interface TenantInfo {
    id: string;
    name: string;
    locationId: string;
}

// ============================================================================
// Task 2.1: State Machine + Confirmation Code Generation
// ============================================================================

/**
 * Validate a state transition for a reservation.
 * Uses the VALID_TRANSITIONS map from reservation.schema.ts.
 */
export function validateStateTransition(
    currentStatus: ReservationStatus,
    targetStatus: ReservationStatus,
): Result<true, DomainError> {
    const validTargets = VALID_TRANSITIONS[currentStatus];

    if (!validTargets || !validTargets.includes(targetStatus)) {
        return err(
            new ConflictError(
                `No se puede cambiar de ${currentStatus} a ${targetStatus}`,
                "status",
                { current_status: currentStatus, target_status: targetStatus },
            ),
        );
    }

    return ok(true);
}

/**
 * Map an admin action to the target ReservationStatus.
 */
export function actionToStatus(action: ReservationAction["action"]): ReservationStatus {
    return ACTION_TO_STATUS[action];
}

/**
 * Generate a random confirmation code of CONFIRMATION_CODE_LENGTH chars
 * using only non-ambiguous characters (no 0/O, 1/I/L).
 */
export function generateConfirmationCode(): string {
    const chars = CONFIRMATION_CODE_CHARS;
    let code = "";
    for (let i = 0; i < CONFIRMATION_CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
    }
    return code;
}

/**
 * Generate a unique confirmation code within a Prisma transaction.
 * Retries up to CONFIRMATION_CODE_MAX_RETRIES times on collision.
 */
async function generateUniqueConfirmationCode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date,
): Promise<Result<string, DomainError>> {
    for (let attempt = 0; attempt < CONFIRMATION_CODE_MAX_RETRIES; attempt++) {
        const code = generateConfirmationCode();

        const existing = await tx.reservations.findFirst({
            where: {
                tenant_id: tenantId,
                date,
                confirmation_code: code,
            },
            select: { id: true },
        });

        if (!existing) {
            return ok(code);
        }

        log.warn("Confirmation code collision, retrying", {
            tenantId,
            date: date.toISOString(),
            attempt: attempt + 1,
            maxRetries: CONFIRMATION_CODE_MAX_RETRIES,
        });
    }

    return err(
        new ConflictError(
            "No se pudo generar un codigo de confirmacion unico. Intente de nuevo.",
            "confirmation_code",
            { max_retries: CONFIRMATION_CODE_MAX_RETRIES },
        ),
    );
}

// ============================================================================
// Task 2.2: Availability Check
// ============================================================================

/**
 * Parse a time string "HH:MM" into total minutes from midnight.
 */
function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Format minutes from midnight into "HH:MM".
 */
function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Check if two time intervals overlap.
 * Interval A: [startA, startA + durationA)
 * Interval B: [startB, startB + durationB)
 */
function intervalsOverlap(
    startAMinutes: number,
    durationA: number,
    startBMinutes: number,
    durationB: number,
): boolean {
    const endA = startAMinutes + durationA;
    const endB = startBMinutes + durationB;
    return startAMinutes < endB && startBMinutes < endA;
}

/**
 * Check availability of tables for a given date/time/party_size.
 * Queries tables with capacity >= partySize and excludes those with
 * overlapping active reservations (PENDING or CONFIRMED).
 *
 * MUST be called within a Prisma transaction for atomicity.
 */
export async function checkAvailability(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date,
    time: string,
    partySize: number,
    durationMinutes: number = RESERVATION_DEFAULTS.DEFAULT_DURATION_MINUTES,
): Promise<Result<{ available: boolean; availableTableCount: number }, DomainError>> {
    try {
        // 1. Get all active tables with sufficient capacity for this tenant
        const tables = await tx.tables.findMany({
            where: {
                tenant_id: tenantId,
                is_active: true,
                capacity: { gte: partySize },
            },
            select: { id: true, capacity: true },
        });

        if (tables.length === 0) {
            return ok({ available: false, availableTableCount: 0 });
        }

        const tableIds = tables.map((t) => t.id);

        // 2. Get all active reservations (PENDING/CONFIRMED) for these tables on this date
        const activeReservations = await tx.reservations.findMany({
            where: {
                tenant_id: tenantId,
                date,
                table_id: { in: tableIds },
                status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: {
                table_id: true,
                time: true,
                duration_minutes: true,
            },
        });

        // 3. Also get reservations WITHOUT table_id (pending assignment) that could fill capacity
        const unassignedReservations = await tx.reservations.findMany({
            where: {
                tenant_id: tenantId,
                date,
                table_id: null,
                status: { in: ["PENDING", "CONFIRMED"] },
                party_size: { lte: Math.max(...tables.map((t) => t.capacity)) },
            },
            select: {
                time: true,
                duration_minutes: true,
                party_size: true,
            },
        });

        const requestedStartMinutes = timeToMinutes(time);

        // 4. For each table, check if it has an overlapping reservation
        const occupiedTableIds = new Set<string>();

        for (const reservation of activeReservations) {
            if (!reservation.table_id) continue;
            const resStartMinutes = timeToMinutes(reservation.time);
            if (
                intervalsOverlap(
                    requestedStartMinutes,
                    durationMinutes,
                    resStartMinutes,
                    reservation.duration_minutes,
                )
            ) {
                occupiedTableIds.add(reservation.table_id);
            }
        }

        // 5. Count unassigned overlapping reservations — each one "occupies" a potential table
        let unassignedOverlapping = 0;
        for (const reservation of unassignedReservations) {
            const resStartMinutes = timeToMinutes(reservation.time);
            if (
                intervalsOverlap(
                    requestedStartMinutes,
                    durationMinutes,
                    resStartMinutes,
                    reservation.duration_minutes,
                )
            ) {
                unassignedOverlapping++;
            }
        }

        // 6. Available = total suitable tables - occupied tables - unassigned overlapping
        const freeTables = tables.filter((t) => !occupiedTableIds.has(t.id));
        const availableCount = Math.max(0, freeTables.length - unassignedOverlapping);

        return ok({
            available: availableCount > 0,
            availableTableCount: availableCount,
        });
    } catch (error) {
        log.error("Error checking availability", error as Error, {
            tenantId,
            date: date.toISOString(),
            time,
            partySize,
        });
        return err(
            new ValidationError("Error al verificar disponibilidad", "availability"),
        );
    }
}

/**
 * Get available time slots for a given date and party size.
 * Returns 30-minute interval slots within operating hours with availability flag.
 */
export async function getAvailableSlots(
    tenantId: string,
    date: string,
    partySize: number,
    openingTime: string = RESERVATION_DEFAULTS.DEFAULT_OPENING_TIME,
    closingTime: string = RESERVATION_DEFAULTS.DEFAULT_CLOSING_TIME,
): Promise<Result<AvailabilitySlot[], DomainError>> {
    try {
        const dateObj = new Date(`${date}T00:00:00`);
        const openMinutes = timeToMinutes(openingTime);
        const closeMinutes = timeToMinutes(closingTime);
        const interval = RESERVATION_DEFAULTS.SLOT_INTERVAL_MINUTES;

        const slots: AvailabilitySlot[] = [];

        // Use a single transaction for all availability checks
        await prisma.$transaction(async (tx) => {
            for (
                let minutes = openMinutes;
                minutes < closeMinutes;
                minutes += interval
            ) {
                const slotTime = minutesToTime(minutes);
                const result = await checkAvailability(
                    tx,
                    tenantId,
                    dateObj,
                    slotTime,
                    partySize,
                );

                slots.push({
                    time: slotTime,
                    available: result.success ? result.data.available : false,
                });
            }
        });

        return ok(slots);
    } catch (error) {
        log.error("Error getting available slots", error as Error, {
            tenantId,
            date,
            partySize,
        });
        return err(
            new ValidationError("Error al obtener horarios disponibles", "slots"),
        );
    }
}

// ============================================================================
// Task 2.3: Create Reservation (Full Flow)
// ============================================================================

/**
 * Resolve a tenant by its public slug.
 * Returns tenant ID, name, and first active location ID.
 */
export async function resolveTenantBySlug(
    slug: string,
): Promise<Result<TenantInfo, DomainError>> {
    const tenant = await prisma.tenants.findFirst({
        where: { slug, is_active: true },
        select: { id: true, name: true },
    });

    if (!tenant) {
        return err(new NotFoundError("Restaurante", slug));
    }

    // Get first active location for this tenant
    const location = await prisma.locations.findFirst({
        where: { tenant_id: tenant.id, is_active: true },
        select: { id: true },
    });

    if (!location) {
        return err(new NotFoundError("Ubicacion del restaurante", tenant.id));
    }

    return ok({
        id: tenant.id,
        name: tenant.name,
        locationId: location.id,
    });
}

/**
 * Emit a reservation event to the event store (audit trail).
 * Uses the events table directly within a Prisma transaction.
 */
async function emitReservationEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    eventType: string,
    reservationId: string,
    payload: Record<string, unknown>,
    actorId?: string,
): Promise<void> {
    await tx.events.create({
        data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: eventType,
            entity_type: "RESERVATION",
            entity_id: reservationId,
            actor_id: actorId ?? null,
            actor_role_snapshot: actorId ? "ADMIN" : "SYSTEM",
            terminal_id: "system",
            payload: payload as Prisma.InputJsonValue,
        },
    });
}

/**
 * Create a reservation — full flow:
 * 1. Validate business rules (date, time, party_size, phone, operating hours)
 * 2. Check availability (atomic, within transaction)
 * 3. Generate unique confirmation code
 * 4. Insert reservation record
 * 5. Emit RESERVATION_CREATED event
 *
 * Uses Prisma $transaction for atomicity (anti-overbooking).
 */
export async function createReservation(
    tenantId: string,
    locationId: string,
    input: CreateReservationInput,
    restaurantName: string,
    openingTime?: string,
    closingTime?: string,
): Promise<Result<CreateReservationResult, DomainError>> {
    // 1. Validate business rules (pure function, no DB)
    const validation = validateReservationCreation({
        date: input.date,
        time: input.time,
        party_size: input.party_size,
        customer_phone: input.customer_phone,
        opening_time: openingTime,
        closing_time: closingTime,
    });

    if (!validation.valid) {
        return err(
            new ValidationError(
                validation.details?.message as string ?? validation.error ?? "Validacion fallida",
                "business_rules",
                validation.details,
            ),
        );
    }

    // Sanitize special_requests
    const sanitizedRequests = sanitizeSpecialRequests(input.special_requests);

    const dateObj = new Date(`${input.date}T00:00:00`);

    try {
        // 2-5. Atomic transaction: check availability -> generate code -> insert -> emit event
        const result = await prisma.$transaction(
            async (tx) => {
                // 2. Check availability
                const availabilityResult = await checkAvailability(
                    tx,
                    tenantId,
                    dateObj,
                    input.time,
                    input.party_size,
                );

                if (!availabilityResult.success) {
                    throw new Error(availabilityResult.error.message);
                }

                if (!availabilityResult.data.available) {
                    throw new ConflictError(
                        "No hay mesas disponibles para ese horario",
                        "availability",
                    );
                }

                // 3. Generate unique confirmation code
                const codeResult = await generateUniqueConfirmationCode(
                    tx,
                    tenantId,
                    dateObj,
                );

                if (!codeResult.success) {
                    throw codeResult.error;
                }

                const confirmationCode = codeResult.data;
                const reservationId = uuidv4();

                // 4. Insert reservation
                await tx.reservations.create({
                    data: {
                        id: reservationId,
                        tenant_id: tenantId,
                        location_id: locationId,
                        customer_name: input.customer_name,
                        customer_phone: input.customer_phone,
                        customer_email: input.customer_email ?? null,
                        date: dateObj,
                        time: input.time,
                        duration_minutes: RESERVATION_DEFAULTS.DEFAULT_DURATION_MINUTES,
                        party_size: input.party_size,
                        zone_preference: input.zone_preference ?? null,
                        special_requests: sanitizedRequests,
                        confirmation_code: confirmationCode,
                        status: "PENDING",
                        created_by: uuidv4(), // System-generated for public API
                        created_at: new Date(),
                        updated_at: new Date(),
                    },
                });

                // 5. Emit RESERVATION_CREATED event
                await emitReservationEvent(
                    tx,
                    tenantId,
                    "RESERVATION_CREATED",
                    reservationId,
                    {
                        reservation_id: reservationId,
                        customer_name: input.customer_name,
                        customer_phone: input.customer_phone,
                        date: input.date,
                        time: input.time,
                        party_size: input.party_size,
                        confirmation_code: confirmationCode,
                        zone_preference: input.zone_preference ?? null,
                        special_requests: sanitizedRequests,
                    },
                );

                return {
                    id: reservationId,
                    confirmation_code: confirmationCode,
                    status: "PENDING",
                    date: input.date,
                    time: input.time,
                    party_size: input.party_size,
                };
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        );

        log.info("Reservation created successfully", {
            tenantId,
            confirmationCode: result.confirmation_code,
            date: input.date,
            time: input.time,
            partySize: input.party_size,
        });

        return ok(result);
    } catch (error) {
        if (error instanceof ConflictError) {
            return err(error);
        }

        // Handle Prisma unique constraint violations (confirmation code race)
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code: string }).code === "P2002"
        ) {
            return err(
                new ConflictError(
                    "No se pudo crear la reserva por conflicto de datos. Intente de nuevo.",
                    "unique_constraint",
                ),
            );
        }

        log.error("Error creating reservation", error as Error, {
            tenantId,
            date: input.date,
            time: input.time,
        });

        return err(
            new ValidationError("Error al crear la reserva", "creation"),
        );
    }
}

// ============================================================================
// Task 2.4: Admin Actions
// ============================================================================

/** Additional data maps for each action type */
interface ActionOptions {
    table_id?: string;
    reason?: string;
}

/**
 * Perform an admin action on a reservation (confirm, reject, arrive, seat, no_show, cancel).
 *
 * 1. Fetch reservation (scoped by tenant_id)
 * 2. Validate state transition
 * 3. Update reservation record with action-specific data
 * 4. Emit corresponding RESERVATION_* event
 */
export async function performAction(
    tenantId: string,
    reservationId: string,
    action: ReservationAction["action"],
    actorId: string,
    options?: ActionOptions,
): Promise<Result<AdminReservation, DomainError>> {
    try {
        const reservation = await prisma.reservations.findFirst({
            where: {
                id: reservationId,
                tenant_id: tenantId,
            },
        });

        if (!reservation) {
            return err(new NotFoundError("Reserva", reservationId));
        }

        const currentStatus = reservation.status as ReservationStatus;
        const targetStatus = actionToStatus(action);

        // Validate state transition
        const transitionResult = validateStateTransition(currentStatus, targetStatus);
        if (!transitionResult.success) {
            return err(transitionResult.error);
        }

        const now = new Date();
        const updateData: Record<string, unknown> = {
            status: targetStatus,
            updated_at: now,
        };

        // Action-specific updates
        switch (action) {
            case "confirm":
                updateData.confirmed_at = now;
                if (options?.table_id) {
                    updateData.table_id = options.table_id;
                }
                break;
            case "arrive":
                updateData.arrived_at = now;
                break;
            case "seat":
                updateData.seated_at = now;
                if (options?.table_id) {
                    updateData.table_id = options.table_id;
                }
                break;
            case "no_show":
                updateData.no_show_at = now;
                break;
            case "cancel":
                updateData.cancelled_at = now;
                if (options?.reason) {
                    updateData.cancelled_reason = options.reason;
                }
                break;
            case "reject":
                if (options?.reason) {
                    updateData.cancelled_reason = options.reason;
                }
                break;
        }

        // Update reservation + emit event in a transaction
        const updated = await prisma.$transaction(async (tx) => {
            const updatedRes = await tx.reservations.update({
                where: { id: reservationId },
                data: updateData,
            });

            // Build event payload based on action
            const eventType = actionToEventType(action);
            const eventPayload = buildEventPayload(action, reservationId, actorId, options);

            await emitReservationEvent(
                tx,
                tenantId,
                eventType,
                reservationId,
                eventPayload,
                actorId,
            );

            return updatedRes;
        });

        log.info("Reservation action performed", {
            tenantId,
            reservationId,
            action,
            previousStatus: currentStatus,
            newStatus: targetStatus,
            actorId,
        });

        return ok(mapToAdminReservation(updated));
    } catch (error) {
        log.error("Error performing reservation action", error as Error, {
            tenantId,
            reservationId,
            action,
        });
        return err(
            new ValidationError("Error al realizar la accion", "action"),
        );
    }
}

/**
 * Cancel a reservation by customer (public API).
 * Only PENDING or CONFIRMED reservations can be cancelled by customer.
 */
export async function cancelByCustomer(
    tenantId: string,
    confirmationCode: string,
): Promise<Result<{ status: string; confirmation_code: string }, DomainError>> {
    try {
        const reservation = await prisma.reservations.findFirst({
            where: {
                tenant_id: tenantId,
                confirmation_code: confirmationCode,
                date: { gte: new Date(new Date().toISOString().split("T")[0] + "T00:00:00") },
            },
        });

        if (!reservation) {
            return err(new NotFoundError("Reserva", confirmationCode));
        }

        const currentStatus = reservation.status as ReservationStatus;
        const transitionResult = validateStateTransition(currentStatus, "CANCELLED");
        if (!transitionResult.success) {
            return err(
                new ConflictError(
                    `No se puede cancelar una reserva en estado ${currentStatus}`,
                    "status",
                    { current_status: currentStatus },
                ),
            );
        }

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            await tx.reservations.update({
                where: { id: reservation.id },
                data: {
                    status: "CANCELLED",
                    cancelled_at: now,
                    cancelled_reason: "Cancelado por el cliente",
                    updated_at: now,
                },
            });

            await emitReservationEvent(
                tx,
                tenantId,
                "RESERVATION_CANCELLED",
                reservation.id,
                {
                    reservation_id: reservation.id,
                    cancelled_by: "CUSTOMER",
                    reason: "Cancelado por el cliente",
                },
            );
        });

        log.info("Reservation cancelled by customer", {
            tenantId,
            reservationId: reservation.id,
            confirmationCode,
        });

        return ok({
            status: "CANCELLED",
            confirmation_code: confirmationCode,
        });
    } catch (error) {
        log.error("Error cancelling reservation", error as Error, {
            tenantId,
            confirmationCode,
        });
        return err(
            new ValidationError("Error al cancelar la reserva", "cancellation"),
        );
    }
}

// ============================================================================
// Task 2.5: Query Methods
// ============================================================================

/**
 * Get reservations for a specific date with filters (admin use).
 * Returns reservations ordered by time ascending + summary totals.
 */
export async function getReservationsByDate(
    tenantId: string,
    filters: {
        date?: string;
        status?: string;
        zoneId?: string;
    },
): Promise<
    Result<{ reservations: AdminReservation[]; summary: ReservationSummary }, DomainError>
> {
    try {
        const dateStr = filters.date ?? new Date().toISOString().split("T")[0];
        const dateObj = new Date(`${dateStr}T00:00:00`);

        const where: Prisma.reservationsWhereInput = {
            tenant_id: tenantId,
            date: dateObj,
        };

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.zoneId) {
            where.tables = {
                zone_id: filters.zoneId,
            };
        }

        // Get all reservations for the date (for summary) — unfiltered by status/zone
        const allForDate = await prisma.reservations.findMany({
            where: {
                tenant_id: tenantId,
                date: dateObj,
            },
            select: { status: true },
        });

        // Get filtered reservations
        const reservations = await prisma.reservations.findMany({
            where,
            orderBy: { time: "asc" },
        });

        // Calculate summary from ALL reservations of the day (not filtered)
        const summary: ReservationSummary = {
            total: allForDate.length,
            confirmed: 0,
            pending: 0,
            cancelled: 0,
            no_show: 0,
            arrived: 0,
            seated: 0,
            rejected: 0,
            completed: 0,
        };

        for (const r of allForDate) {
            const status = r.status.toLowerCase() as keyof ReservationSummary;
            if (status in summary && status !== "total") {
                (summary[status] as number)++;
            }
        }

        return ok({
            reservations: reservations.map(mapToAdminReservation),
            summary,
        });
    } catch (error) {
        log.error("Error fetching reservations by date", error as Error, {
            tenantId,
            filters,
        });
        return err(
            new ValidationError("Error al obtener reservas", "query"),
        );
    }
}

/**
 * Get a reservation by confirmation code (public use).
 * Returns only public-safe fields (no tenant_id, table_id, internal_notes).
 */
export async function getReservationByCode(
    tenantId: string,
    confirmationCode: string,
    restaurantName: string,
): Promise<Result<PublicReservation, DomainError>> {
    try {
        const reservation = await prisma.reservations.findFirst({
            where: {
                tenant_id: tenantId,
                confirmation_code: confirmationCode,
                // Only look at recent/future reservations
                date: {
                    gte: new Date(
                        new Date().toISOString().split("T")[0] + "T00:00:00",
                    ),
                },
            },
        });

        if (!reservation) {
            return err(new NotFoundError("Reserva", confirmationCode));
        }

        const dateStr =
            reservation.date instanceof Date
                ? reservation.date.toISOString().split("T")[0]
                : String(reservation.date);

        return ok({
            confirmation_code: reservation.confirmation_code ?? "",
            status: reservation.status,
            date: dateStr,
            time: reservation.time,
            party_size: reservation.party_size,
            customer_name: reservation.customer_name,
            special_requests: reservation.special_requests,
            restaurant_name: restaurantName,
        });
    } catch (error) {
        log.error("Error fetching reservation by code", error as Error, {
            tenantId,
            confirmationCode,
        });
        return err(
            new ValidationError("Error al consultar la reserva", "query"),
        );
    }
}

/**
 * Get a reservation by ID (admin use).
 * Returns full reservation data.
 */
export async function getReservationById(
    tenantId: string,
    reservationId: string,
): Promise<Result<AdminReservation, DomainError>> {
    try {
        const reservation = await prisma.reservations.findFirst({
            where: {
                id: reservationId,
                tenant_id: tenantId,
            },
        });

        if (!reservation) {
            return err(new NotFoundError("Reserva", reservationId));
        }

        return ok(mapToAdminReservation(reservation));
    } catch (error) {
        log.error("Error fetching reservation by id", error as Error, {
            tenantId,
            reservationId,
        });
        return err(
            new ValidationError("Error al obtener la reserva", "query"),
        );
    }
}

/**
 * Get reservations by customer phone number (public use).
 * Returns public-safe fields only.
 */
export async function getReservationsByPhone(
    tenantId: string,
    phone: string,
    restaurantName: string,
): Promise<Result<PublicReservation[], DomainError>> {
    try {
        const reservations = await prisma.reservations.findMany({
            where: {
                tenant_id: tenantId,
                customer_phone: phone,
                date: {
                    gte: new Date(
                        new Date().toISOString().split("T")[0] + "T00:00:00",
                    ),
                },
            },
            orderBy: [{ date: "asc" }, { time: "asc" }],
        });

        return ok(
            reservations.map((r) => {
                const dateStr =
                    r.date instanceof Date
                        ? r.date.toISOString().split("T")[0]
                        : String(r.date);

                return {
                    confirmation_code: r.confirmation_code ?? "",
                    status: r.status,
                    date: dateStr,
                    time: r.time,
                    party_size: r.party_size,
                    customer_name: r.customer_name,
                    special_requests: r.special_requests,
                    restaurant_name: restaurantName,
                };
            }),
        );
    } catch (error) {
        log.error("Error fetching reservations by phone", error as Error, {
            tenantId,
            phone,
        });
        return err(
            new ValidationError("Error al buscar reservas", "query"),
        );
    }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Map an admin action to the corresponding event type string.
 */
function actionToEventType(action: ReservationAction["action"]): string {
    const map: Record<ReservationAction["action"], string> = {
        confirm: "RESERVATION_CONFIRMED",
        reject: "RESERVATION_CANCELLED", // Rejection also uses CANCELLED event trail
        arrive: "RESERVATION_ARRIVED",
        seat: "RESERVATION_SEATED",
        no_show: "RESERVATION_NO_SHOW",
        cancel: "RESERVATION_CANCELLED",
    };
    return map[action];
}

/**
 * Build event payload based on the action type.
 */
function buildEventPayload(
    action: ReservationAction["action"],
    reservationId: string,
    actorId: string,
    options?: ActionOptions,
): Record<string, unknown> {
    switch (action) {
        case "confirm":
            return {
                reservation_id: reservationId,
                confirmed_by: actorId,
                table_id: options?.table_id ?? null,
            };
        case "reject":
        case "cancel":
            return {
                reservation_id: reservationId,
                cancelled_by: actorId,
                reason: options?.reason ?? null,
            };
        case "arrive":
            return {
                reservation_id: reservationId,
                arrived_at: new Date().toISOString(),
            };
        case "seat":
            return {
                reservation_id: reservationId,
                table_id: options?.table_id ?? reservationId, // fallback, real table_id from options
                seated_at: new Date().toISOString(),
            };
        case "no_show":
            return {
                reservation_id: reservationId,
                marked_by: actorId,
            };
        default:
            return { reservation_id: reservationId };
    }
}

/**
 * Map a Prisma reservation record to the AdminReservation interface.
 */
function mapToAdminReservation(
    r: {
        id: string;
        customer_name: string;
        customer_phone: string;
        customer_email: string | null;
        date: Date;
        time: string;
        duration_minutes: number;
        party_size: number;
        status: string;
        confirmation_code: string | null;
        table_id: string | null;
        table_number: string | null;
        zone_preference: string | null;
        special_requests: string | null;
        internal_notes: string | null;
        arrived_at: Date | null;
        seated_at: Date | null;
        no_show_at: Date | null;
        cancelled_at: Date | null;
        cancelled_reason: string | null;
        created_at: Date;
    },
): AdminReservation {
    return {
        id: r.id,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        date:
            r.date instanceof Date
                ? r.date.toISOString().split("T")[0]
                : String(r.date),
        time: r.time,
        duration_minutes: r.duration_minutes,
        party_size: r.party_size,
        status: r.status,
        confirmation_code: r.confirmation_code,
        table_id: r.table_id,
        table_number: r.table_number,
        zone_preference: r.zone_preference,
        special_requests: r.special_requests,
        internal_notes: r.internal_notes,
        arrived_at: r.arrived_at?.toISOString() ?? null,
        seated_at: r.seated_at?.toISOString() ?? null,
        no_show_at: r.no_show_at?.toISOString() ?? null,
        cancelled_at: r.cancelled_at?.toISOString() ?? null,
        cancelled_reason: r.cancelled_reason,
        created_at: r.created_at.toISOString(),
    };
}
