/**
 * Property-Based Tests: Reservation Business Rules
 *
 * Uses fast-check to verify invariants that must hold for ANY input:
 * - Party size validation is symmetric (1-20 valid, outside invalid)
 * - Date validation is consistent (past always invalid, within 30 days valid)
 * - Confirmation code always 6 chars, uppercase alphanumeric, no ambiguous chars
 * - State machine: terminal states have no valid transitions
 * - Business rules are pure and deterministic
 *
 * Covers scenarios: S4-S9, S25-S26, S27-S29
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
    validateDateNotInPast,
    validateMinAnticipation,
    validateMaxFutureDays,
    validatePartySize,
    validateOperatingHours,
    validatePhoneFormat,
    sanitizeSpecialRequests,
    validateReservationCreation,
} from "../business-rules";
import {
    VALID_TRANSITIONS,
    TERMINAL_STATES,
    CONFIRMATION_CODE_CHARS,
    CONFIRMATION_CODE_LENGTH,
    RESERVATION_DEFAULTS,
    type ReservationStatus,
} from "../reservation.schema";
import {
    validateStateTransition,
    generateConfirmationCode,
} from "../reservation.service";

// ============================================================================
// Arbitraries
// ============================================================================

const allStatuses: ReservationStatus[] = [
    "PENDING", "CONFIRMED", "REJECTED", "CANCELLED",
    "ARRIVED", "SEATED", "NO_SHOW", "COMPLETED",
];

const statusArb = fc.constantFrom(...allStatuses);
const terminalStatusArb = fc.constantFrom(...TERMINAL_STATES);
const nonTerminalStatusArb = fc.constantFrom(
    ...allStatuses.filter((s) => !TERMINAL_STATES.includes(s)),
);

// Bounded date generator (avoids infinity/NaN issues)
const futureDateArb = fc.date({
    min: new Date("2026-03-01T00:00:00"),
    max: new Date("2026-03-30T23:59:59"),
});

const pastDateArb = fc.date({
    min: new Date("2025-01-01T00:00:00"),
    max: new Date("2026-02-27T23:59:59"),
});

const farFutureDateArb = fc.date({
    min: new Date("2026-05-01T00:00:00"),
    max: new Date("2027-12-31T23:59:59"),
});

// Safe string arbitrary: filters __proto__, constructor, prototype
const safeString = fc.string({ minLength: 0, maxLength: 100 }).filter(
    (s) => !["__proto__", "constructor", "prototype"].includes(s),
);

// ============================================================================
// Property 1: Party Size Validation is Symmetric
// ============================================================================

describe("Property: party_size validation", () => {
    it("party_size in [1, 20] is always valid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 20 }),
                (size) => {
                    const result = validatePartySize(size);
                    expect(result.valid).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("party_size < 1 is always invalid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -1000, max: 0 }),
                (size) => {
                    const result = validatePartySize(size);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("party_size > 20 is always invalid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 21, max: 1000 }),
                (size) => {
                    const result = validatePartySize(size);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("non-integer party_size is always invalid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0.1, max: 20.9, noNaN: true }).filter((n) => !Number.isInteger(n)),
                (size) => {
                    const result = validatePartySize(size);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 2: Date Validation
// ============================================================================

describe("Property: date validation", () => {
    it("past dates are always invalid (100 runs)", () => {
        const now = new Date("2026-02-28T12:00:00");

        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 365 }), // days in the past
                (daysInPast) => {
                    const pastDate = new Date(now.getTime() - daysInPast * 24 * 60 * 60 * 1000);
                    const year = pastDate.getFullYear();
                    const month = String(pastDate.getMonth() + 1).padStart(2, "0");
                    const day = String(pastDate.getDate()).padStart(2, "0");
                    const dateStr = `${year}-${month}-${day}`;
                    const result = validateDateNotInPast(dateStr, "12:00", now);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("dates within 30 days in the future are valid for max future check (100 runs)", () => {
        const now = new Date("2026-02-28T00:00:00");

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 30 }),
                (daysAhead) => {
                    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
                    const dateStr = future.toISOString().split("T")[0];
                    const result = validateMaxFutureDays(dateStr, now);
                    expect(result.valid).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("dates > 30 days in the future are always invalid (100 runs)", () => {
        const now = new Date("2026-02-28T00:00:00");

        fc.assert(
            fc.property(
                fc.integer({ min: 31, max: 365 }),
                (daysAhead) => {
                    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
                    const dateStr = future.toISOString().split("T")[0];
                    const result = validateMaxFutureDays(dateStr, now);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 3: Confirmation Code Format
// ============================================================================

describe("Property: confirmation code format", () => {
    it("always generates 6-character codes (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.constant(null), // No input needed, just run the function
                () => {
                    const code = generateConfirmationCode();
                    expect(code).toHaveLength(CONFIRMATION_CODE_LENGTH);
                },
            ),
            { numRuns: 200 },
        );
    });

    it("codes contain only allowed characters (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const code = generateConfirmationCode();
                    for (const char of code) {
                        expect(CONFIRMATION_CODE_CHARS).toContain(char);
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it("codes never contain ambiguous characters 0, O, 1, I, L (200 runs)", () => {
        const ambiguous = ["0", "O", "1", "I", "L"];

        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const code = generateConfirmationCode();
                    for (const char of ambiguous) {
                        expect(code).not.toContain(char);
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it("codes are uppercase alphanumeric (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const code = generateConfirmationCode();
                    expect(code).toMatch(/^[A-Z2-9]{6}$/);
                },
            ),
            { numRuns: 200 },
        );
    });
});

// ============================================================================
// Property 4: State Machine — Terminal States
// ============================================================================

describe("Property: state machine terminal states", () => {
    it("no transition is valid from any terminal state (100 runs)", () => {
        fc.assert(
            fc.property(
                terminalStatusArb,
                statusArb,
                (terminalStatus, targetStatus) => {
                    const result = validateStateTransition(terminalStatus, targetStatus);
                    // Terminal states should never have valid transitions
                    // (including to themselves, which is not in VALID_TRANSITIONS)
                    expect(result.success).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("non-terminal states have at least one valid transition (100 runs)", () => {
        fc.assert(
            fc.property(
                nonTerminalStatusArb,
                (status) => {
                    const validTargets = VALID_TRANSITIONS[status];
                    expect(validTargets.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 5: Operating Hours Validation
// ============================================================================

describe("Property: operating hours validation", () => {
    it("times within [11:00, 22:00) are valid with default hours (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 660, max: 1319 }), // 11:00 to 21:59 in minutes
                (totalMinutes) => {
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    const time = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
                    const result = validateOperatingHours(time);
                    expect(result.valid).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("times before 11:00 are invalid with default hours (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 659 }), // 00:00 to 10:59
                (totalMinutes) => {
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    const time = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
                    const result = validateOperatingHours(time);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("times >= 22:00 are invalid with default hours (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1320, max: 1439 }), // 22:00 to 23:59
                (totalMinutes) => {
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    const time = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
                    const result = validateOperatingHours(time);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 6: Phone Format
// ============================================================================

describe("Property: phone format validation", () => {
    it("9-digit numbers starting with 9 are always valid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 99999999 }),
                (suffix) => {
                    const phone = `9${String(suffix).padStart(8, "0")}`;
                    const result = validatePhoneFormat(phone);
                    expect(result.valid).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("9-digit numbers NOT starting with 9 are invalid (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }), // First digit 1-8
                fc.integer({ min: 0, max: 99999999 }),
                (firstDigit, suffix) => {
                    const phone = `${firstDigit}${String(suffix).padStart(8, "0")}`;
                    const result = validatePhoneFormat(phone);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 7: Sanitization
// ============================================================================

describe("Property: special_requests sanitization", () => {
    it("sanitized output never contains HTML tags (100 runs)", () => {
        fc.assert(
            fc.property(
                safeString,
                (text) => {
                    const result = sanitizeSpecialRequests(text);
                    if (result !== null) {
                        expect(result).not.toMatch(/<[^>]*>/);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it("null/undefined always returns null", () => {
        expect(sanitizeSpecialRequests(null)).toBeNull();
        expect(sanitizeSpecialRequests(undefined)).toBeNull();
    });
});

// ============================================================================
// Property 8: Business Rules are Pure and Deterministic
// ============================================================================

describe("Property: business rules are deterministic", () => {
    it("validatePartySize gives same result for same input (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -100, max: 100 }),
                (size) => {
                    const result1 = validatePartySize(size);
                    const result2 = validatePartySize(size);
                    expect(result1.valid).toBe(result2.valid);
                    expect(result1.error).toBe(result2.error);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("validateOperatingHours gives same result for same input (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 23 }),
                fc.integer({ min: 0, max: 59 }),
                (h, m) => {
                    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    const result1 = validateOperatingHours(time);
                    const result2 = validateOperatingHours(time);
                    expect(result1.valid).toBe(result2.valid);
                },
            ),
            { numRuns: 100 },
        );
    });
});
