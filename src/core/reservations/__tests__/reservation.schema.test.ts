/**
 * Unit Tests: Reservation Zod Schemas
 *
 * Tests for CreateReservationSchema, ReservationActionSchema,
 * ReservationQuerySchema, AvailabilitySlotsQuerySchema, and constants.
 *
 * Covers scenarios: S4-S9 (validation edge cases at schema level)
 */

import { describe, it, expect } from "vitest";
import {
    CreateReservationSchema,
    ReservationActionSchema,
    ReservationQuerySchema,
    AvailabilitySlotsQuerySchema,
    ReservationStatusSchema,
    VALID_TRANSITIONS,
    TERMINAL_STATES,
    ACTION_TO_STATUS,
    CONFIRMATION_CODE_CHARS,
    CONFIRMATION_CODE_LENGTH,
    RESERVATION_DEFAULTS,
    type ReservationStatus,
} from "../reservation.schema";

// ============================================================================
// CreateReservationSchema
// ============================================================================

describe("CreateReservationSchema", () => {
    const validInput = {
        customer_name: "Maria Lopez",
        customer_phone: "987654321",
        date: "2026-03-15",
        time: "19:00",
        party_size: 4,
    };

    it("accepts valid input with all required fields", () => {
        const result = CreateReservationSchema.safeParse(validInput);
        expect(result.success).toBe(true);
    });

    it("accepts valid input with optional fields", () => {
        const result = CreateReservationSchema.safeParse({
            ...validInput,
            customer_email: "maria@test.com",
            special_requests: "Mesa cerca de la ventana",
            zone_preference: "Terraza",
        });
        expect(result.success).toBe(true);
    });

    it("accepts input without optional fields", () => {
        const result = CreateReservationSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.special_requests).toBeUndefined();
            expect(result.data.zone_preference).toBeUndefined();
            expect(result.data.customer_email).toBeUndefined();
        }
    });

    // customer_name validation
    describe("customer_name", () => {
        it("rejects name shorter than 2 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_name: "A",
            });
            expect(result.success).toBe(false);
        });

        it("accepts name with exactly 2 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_name: "AB",
            });
            expect(result.success).toBe(true);
        });

        it("accepts name with exactly 100 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_name: "A".repeat(100),
            });
            expect(result.success).toBe(true);
        });

        it("rejects name longer than 100 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_name: "A".repeat(101),
            });
            expect(result.success).toBe(false);
        });

        it("rejects empty name", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_name: "",
            });
            expect(result.success).toBe(false);
        });

        it("rejects missing name", () => {
            const { customer_name, ...rest } = validInput;
            const result = CreateReservationSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    // customer_phone validation
    describe("customer_phone", () => {
        it("rejects phone shorter than 7 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_phone: "12345",
            });
            expect(result.success).toBe(false);
        });

        it("accepts phone with exactly 7 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_phone: "1234567",
            });
            expect(result.success).toBe(true);
        });

        it("accepts phone with exactly 20 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_phone: "1".repeat(20),
            });
            expect(result.success).toBe(true);
        });

        it("rejects phone longer than 20 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_phone: "1".repeat(21),
            });
            expect(result.success).toBe(false);
        });
    });

    // date format validation
    describe("date", () => {
        it("accepts valid YYYY-MM-DD format", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                date: "2026-03-15",
            });
            expect(result.success).toBe(true);
        });

        it("rejects invalid date format DD/MM/YYYY", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                date: "15/03/2026",
            });
            expect(result.success).toBe(false);
        });

        it("rejects invalid date format MM-DD-YYYY", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                date: "03-15-2026",
            });
            expect(result.success).toBe(false);
        });

        it("rejects empty date", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                date: "",
            });
            expect(result.success).toBe(false);
        });

        it("rejects date with text", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                date: "tomorrow",
            });
            expect(result.success).toBe(false);
        });
    });

    // time format validation
    describe("time", () => {
        it("accepts valid HH:MM format", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "19:00",
            });
            expect(result.success).toBe(true);
        });

        it("accepts midnight 00:00", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "00:00",
            });
            expect(result.success).toBe(true);
        });

        it("accepts 23:59", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "23:59",
            });
            expect(result.success).toBe(true);
        });

        it("rejects invalid time format HH:MM:SS", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "19:00:00",
            });
            expect(result.success).toBe(false);
        });

        it("rejects time with single digit hour", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "9:00",
            });
            expect(result.success).toBe(false);
        });

        it("rejects empty time", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                time: "",
            });
            expect(result.success).toBe(false);
        });
    });

    // party_size validation
    describe("party_size", () => {
        it("accepts party_size of 1 (minimum)", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: 1,
            });
            expect(result.success).toBe(true);
        });

        it("accepts party_size of 20 (maximum)", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: 20,
            });
            expect(result.success).toBe(true);
        });

        it("rejects party_size of 0", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: 0,
            });
            expect(result.success).toBe(false);
        });

        it("rejects party_size of 21", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: 21,
            });
            expect(result.success).toBe(false);
        });

        it("rejects negative party_size", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: -1,
            });
            expect(result.success).toBe(false);
        });

        it("rejects non-integer party_size", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: 2.5,
            });
            expect(result.success).toBe(false);
        });

        it("rejects string party_size", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                party_size: "4",
            });
            expect(result.success).toBe(false);
        });
    });

    // special_requests validation
    describe("special_requests", () => {
        it("accepts valid special_requests", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                special_requests: "Mesa cerca de la ventana",
            });
            expect(result.success).toBe(true);
        });

        it("rejects special_requests longer than 500 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                special_requests: "A".repeat(501),
            });
            expect(result.success).toBe(false);
        });

        it("accepts special_requests with exactly 500 characters", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                special_requests: "A".repeat(500),
            });
            expect(result.success).toBe(true);
        });
    });

    // customer_email validation
    describe("customer_email", () => {
        it("accepts valid email", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_email: "test@example.com",
            });
            expect(result.success).toBe(true);
        });

        it("rejects invalid email", () => {
            const result = CreateReservationSchema.safeParse({
                ...validInput,
                customer_email: "not-an-email",
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// ReservationActionSchema
// ============================================================================

describe("ReservationActionSchema", () => {
    const validActions = ["confirm", "reject", "arrive", "seat", "no_show", "cancel"] as const;

    for (const action of validActions) {
        it(`accepts valid action: ${action}`, () => {
            const result = ReservationActionSchema.safeParse({ action });
            expect(result.success).toBe(true);
        });
    }

    it("rejects unknown action", () => {
        const result = ReservationActionSchema.safeParse({ action: "unknown" });
        expect(result.success).toBe(false);
    });

    it("rejects empty action", () => {
        const result = ReservationActionSchema.safeParse({ action: "" });
        expect(result.success).toBe(false);
    });

    it("accepts action with optional reason", () => {
        const result = ReservationActionSchema.safeParse({
            action: "reject",
            reason: "Mesa no disponible",
        });
        expect(result.success).toBe(true);
    });

    it("rejects reason longer than 500 characters", () => {
        const result = ReservationActionSchema.safeParse({
            action: "cancel",
            reason: "A".repeat(501),
        });
        expect(result.success).toBe(false);
    });

    it("accepts action with optional table_id (UUID)", () => {
        const result = ReservationActionSchema.safeParse({
            action: "confirm",
            table_id: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });

    it("rejects action with invalid table_id (not UUID)", () => {
        const result = ReservationActionSchema.safeParse({
            action: "confirm",
            table_id: "not-a-uuid",
        });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// ReservationQuerySchema
// ============================================================================

describe("ReservationQuerySchema", () => {
    it("accepts empty query (all fields optional)", () => {
        const result = ReservationQuerySchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it("accepts query with date only", () => {
        const result = ReservationQuerySchema.safeParse({ date: "2026-03-15" });
        expect(result.success).toBe(true);
    });

    it("accepts query with status only", () => {
        const result = ReservationQuerySchema.safeParse({ status: "PENDING" });
        expect(result.success).toBe(true);
    });

    it("accepts query with zone_id only", () => {
        const result = ReservationQuerySchema.safeParse({
            zone_id: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });

    it("accepts query with all fields", () => {
        const result = ReservationQuerySchema.safeParse({
            date: "2026-03-15",
            status: "CONFIRMED",
            zone_id: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });

    it("rejects invalid date format", () => {
        const result = ReservationQuerySchema.safeParse({ date: "15-03-2026" });
        expect(result.success).toBe(false);
    });

    it("rejects invalid status", () => {
        const result = ReservationQuerySchema.safeParse({ status: "INVALID" });
        expect(result.success).toBe(false);
    });

    it("rejects invalid zone_id (not UUID)", () => {
        const result = ReservationQuerySchema.safeParse({ zone_id: "not-uuid" });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AvailabilitySlotsQuerySchema
// ============================================================================

describe("AvailabilitySlotsQuerySchema", () => {
    it("accepts valid date and party_size", () => {
        const result = AvailabilitySlotsQuerySchema.safeParse({
            date: "2026-03-15",
            party_size: "4",
        });
        expect(result.success).toBe(true);
    });

    it("coerces string party_size to number", () => {
        const result = AvailabilitySlotsQuerySchema.safeParse({
            date: "2026-03-15",
            party_size: "6",
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.party_size).toBe(6);
        }
    });

    it("rejects party_size of 0", () => {
        const result = AvailabilitySlotsQuerySchema.safeParse({
            date: "2026-03-15",
            party_size: "0",
        });
        expect(result.success).toBe(false);
    });

    it("rejects party_size of 21", () => {
        const result = AvailabilitySlotsQuerySchema.safeParse({
            date: "2026-03-15",
            party_size: "21",
        });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// ReservationStatusSchema
// ============================================================================

describe("ReservationStatusSchema", () => {
    const allStatuses = [
        "PENDING", "CONFIRMED", "REJECTED", "CANCELLED",
        "ARRIVED", "SEATED", "NO_SHOW", "COMPLETED",
    ];

    for (const status of allStatuses) {
        it(`accepts valid status: ${status}`, () => {
            const result = ReservationStatusSchema.safeParse(status);
            expect(result.success).toBe(true);
        });
    }

    it("rejects invalid status", () => {
        const result = ReservationStatusSchema.safeParse("UNKNOWN");
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// Constants
// ============================================================================

describe("VALID_TRANSITIONS", () => {
    it("has entries for all 8 statuses", () => {
        const allStatuses: ReservationStatus[] = [
            "PENDING", "CONFIRMED", "REJECTED", "CANCELLED",
            "ARRIVED", "SEATED", "NO_SHOW", "COMPLETED",
        ];
        for (const status of allStatuses) {
            expect(VALID_TRANSITIONS).toHaveProperty(status);
        }
    });

    it("terminal states have empty transition arrays", () => {
        for (const status of TERMINAL_STATES) {
            expect(VALID_TRANSITIONS[status]).toEqual([]);
        }
    });
});

describe("ACTION_TO_STATUS", () => {
    it("maps all 6 actions to their target statuses", () => {
        expect(ACTION_TO_STATUS.confirm).toBe("CONFIRMED");
        expect(ACTION_TO_STATUS.reject).toBe("REJECTED");
        expect(ACTION_TO_STATUS.arrive).toBe("ARRIVED");
        expect(ACTION_TO_STATUS.seat).toBe("SEATED");
        expect(ACTION_TO_STATUS.no_show).toBe("NO_SHOW");
        expect(ACTION_TO_STATUS.cancel).toBe("CANCELLED");
    });
});

describe("CONFIRMATION_CODE_CHARS", () => {
    it("does not contain ambiguous characters 0, O, 1, I, L", () => {
        expect(CONFIRMATION_CODE_CHARS).not.toContain("0");
        expect(CONFIRMATION_CODE_CHARS).not.toContain("O");
        expect(CONFIRMATION_CODE_CHARS).not.toContain("1");
        expect(CONFIRMATION_CODE_CHARS).not.toContain("I");
        expect(CONFIRMATION_CODE_CHARS).not.toContain("L");
    });

    it("contains only uppercase letters and digits", () => {
        for (const char of CONFIRMATION_CODE_CHARS) {
            expect(/[A-Z2-9]/.test(char)).toBe(true);
        }
    });

    it("has reasonable length for 6-char codes", () => {
        // 30 chars in alphabet gives ~30^6 = 729M combinations
        expect(CONFIRMATION_CODE_CHARS.length).toBeGreaterThanOrEqual(25);
    });
});

describe("RESERVATION_DEFAULTS", () => {
    it("has correct default values", () => {
        expect(RESERVATION_DEFAULTS.MIN_ANTICIPATION_HOURS).toBe(1);
        expect(RESERVATION_DEFAULTS.MAX_DAYS_IN_FUTURE).toBe(30);
        expect(RESERVATION_DEFAULTS.MAX_PARTY_SIZE).toBe(20);
        expect(RESERVATION_DEFAULTS.MIN_PARTY_SIZE).toBe(1);
        expect(RESERVATION_DEFAULTS.DEFAULT_DURATION_MINUTES).toBe(90);
        expect(RESERVATION_DEFAULTS.SLOT_INTERVAL_MINUTES).toBe(30);
        expect(RESERVATION_DEFAULTS.DEFAULT_OPENING_TIME).toBe("11:00");
        expect(RESERVATION_DEFAULTS.DEFAULT_CLOSING_TIME).toBe("22:00");
    });
});
