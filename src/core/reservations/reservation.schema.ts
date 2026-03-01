/**
 * Reservation Zod Schemas
 *
 * Validation schemas for the reservation system:
 * - Public: create reservation, query availability
 * - Admin: list reservations, perform actions (confirm/reject/arrive/seat/no_show/cancel)
 */

import { z } from "zod";

// ============================================================================
// Reservation Status
// ============================================================================

export const ReservationStatusSchema = z.enum([
    "PENDING",
    "CONFIRMED",
    "REJECTED",
    "CANCELLED",
    "ARRIVED",
    "SEATED",
    "NO_SHOW",
    "COMPLETED",
]);

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

// Valid state transitions for reservation lifecycle
export const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    PENDING:   ["CONFIRMED", "REJECTED", "CANCELLED"],
    CONFIRMED: ["ARRIVED", "NO_SHOW", "CANCELLED"],
    REJECTED:  [],
    CANCELLED: [],
    ARRIVED:   ["SEATED"],
    SEATED:    ["COMPLETED"],
    NO_SHOW:   [],
    COMPLETED: [],
};

// Terminal states (no further transitions allowed)
export const TERMINAL_STATES: ReservationStatus[] = [
    "REJECTED",
    "CANCELLED",
    "NO_SHOW",
    "COMPLETED",
];

// ============================================================================
// Public: Create Reservation
// ============================================================================

export const CreateReservationSchema = z.object({
    customer_name: z.string()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres"),
    customer_phone: z.string()
        .min(7, "El telefono debe tener al menos 7 digitos")
        .max(20, "El telefono no puede exceder 20 caracteres"),
    customer_email: z.string().email("Email invalido").optional(),
    date: z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "La fecha debe tener formato YYYY-MM-DD",
    ),
    time: z.string().regex(
        /^\d{2}:\d{2}$/,
        "La hora debe tener formato HH:MM",
    ),
    party_size: z.number()
        .int("La cantidad de personas debe ser un numero entero")
        .min(1, "La cantidad de personas debe ser al menos 1")
        .max(20, "El maximo de personas por reserva es 20"),
    special_requests: z.string().max(500, "Las notas no pueden exceder 500 caracteres").optional(),
    zone_preference: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ============================================================================
// Public: Query Available Slots
// ============================================================================

export const AvailabilitySlotsQuerySchema = z.object({
    date: z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "La fecha debe tener formato YYYY-MM-DD",
    ),
    party_size: z.coerce.number()
        .int()
        .min(1, "La cantidad de personas debe ser al menos 1")
        .max(20, "El maximo de personas por reserva es 20"),
});

export type AvailabilitySlotsQuery = z.infer<typeof AvailabilitySlotsQuerySchema>;

// ============================================================================
// Admin: Query Reservations
// ============================================================================

export const ReservationQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: ReservationStatusSchema.optional(),
    zone_id: z.string().uuid().optional(),
});

export type ReservationQuery = z.infer<typeof ReservationQuerySchema>;

// ============================================================================
// Admin: Action on Reservation
// ============================================================================

export const ReservationActionSchema = z.object({
    action: z.enum(["confirm", "reject", "arrive", "seat", "no_show", "cancel"]),
    reason: z.string().max(500, "La razon no puede exceder 500 caracteres").optional(),
    table_id: z.string().uuid("table_id debe ser un UUID valido").optional(),
});

export type ReservationAction = z.infer<typeof ReservationActionSchema>;

// ============================================================================
// Action to status mapping
// ============================================================================

export const ACTION_TO_STATUS: Record<ReservationAction["action"], ReservationStatus> = {
    confirm: "CONFIRMED",
    reject:  "REJECTED",
    arrive:  "ARRIVED",
    seat:    "SEATED",
    no_show: "NO_SHOW",
    cancel:  "CANCELLED",
};

// ============================================================================
// Confirmation Code
// ============================================================================

// Characters allowed in confirmation codes (excluding ambiguous: 0/O, 1/I/L)
export const CONFIRMATION_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CONFIRMATION_CODE_LENGTH = 6;
export const CONFIRMATION_CODE_MAX_RETRIES = 3;

// ============================================================================
// Business Rule Constants
// ============================================================================

export const RESERVATION_DEFAULTS = {
    /** Minimum hours of anticipation required */
    MIN_ANTICIPATION_HOURS: 1,
    /** Maximum days in the future */
    MAX_DAYS_IN_FUTURE: 30,
    /** Maximum party size */
    MAX_PARTY_SIZE: 20,
    /** Minimum party size */
    MIN_PARTY_SIZE: 1,
    /** Default reservation duration in minutes */
    DEFAULT_DURATION_MINUTES: 90,
    /** Time slot interval in minutes */
    SLOT_INTERVAL_MINUTES: 30,
    /** Default operating hours (fallback if not configured in tenant) */
    DEFAULT_OPENING_TIME: "11:00",
    DEFAULT_CLOSING_TIME: "22:00",
} as const;
