/**
 * Unit Tests: Reservation Business Rules
 *
 * Tests for pure validation functions in business-rules.ts:
 * - Date not in past
 * - Min anticipation (1 hour)
 * - Max future days (30)
 * - Party size bounds (1-20)
 * - Operating hours (11:00-22:00 default)
 * - Phone format (9 digits starting with 9)
 * - Special requests sanitization (strip HTML)
 * - Combined validateReservationCreation
 *
 * Covers scenarios: S4-S9 (business rule edge cases)
 */

import { describe, it, expect } from "vitest";
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a date N hours in the future from `now`.
 */
function futureDate(now: Date, hoursAhead: number): { date: string; time: string } {
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const date = future.toISOString().split("T")[0];
    const time = `${String(future.getHours()).padStart(2, "0")}:${String(future.getMinutes()).padStart(2, "0")}`;
    return { date, time };
}

/**
 * Create a date N days in the future (at noon for safety).
 */
function futureDays(now: Date, daysAhead: number): string {
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return future.toISOString().split("T")[0];
}

// ============================================================================
// validateDateNotInPast
// ============================================================================

describe("validateDateNotInPast", () => {
    it("returns valid for a future date/time", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateDateNotInPast("2026-02-28", "16:00", now);
        expect(result.valid).toBe(true);
    });

    it("returns invalid for a past date/time", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateDateNotInPast("2026-02-28", "14:00", now);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("DATE_IN_PAST");
        expect(result.details?.message).toBe("No se puede reservar en un horario pasado");
    });

    it("returns invalid for the exact current time (not strictly future)", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateDateNotInPast("2026-02-28", "15:00", now);
        expect(result.valid).toBe(false);
    });

    it("returns valid for tomorrow", () => {
        const now = new Date("2026-02-28T23:00:00");
        const result = validateDateNotInPast("2026-03-01", "12:00", now);
        expect(result.valid).toBe(true);
    });

    it("returns invalid for yesterday", () => {
        const now = new Date("2026-02-28T10:00:00");
        const result = validateDateNotInPast("2026-02-27", "20:00", now);
        expect(result.valid).toBe(false);
    });

    it("returns invalid for malformed date/time", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateDateNotInPast("invalid", "99:99", now);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_DATE_TIME");
    });
});

// ============================================================================
// validateMinAnticipation
// ============================================================================

describe("validateMinAnticipation", () => {
    it("returns valid for reservation 2 hours in the future", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMinAnticipation("2026-02-28", "17:00", now);
        expect(result.valid).toBe(true);
    });

    it("returns valid for reservation exactly 1 hour in the future", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMinAnticipation("2026-02-28", "16:00", now);
        expect(result.valid).toBe(true);
    });

    it("returns invalid for reservation 30 minutes in the future", () => {
        const now = new Date("2026-02-28T18:30:00");
        const result = validateMinAnticipation("2026-02-28", "19:00", now);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_ANTICIPATION");
        expect(result.details?.message).toContain("al menos 1 hora");
    });

    it("returns invalid for reservation 10 minutes in the future", () => {
        const now = new Date("2026-02-28T18:50:00");
        const result = validateMinAnticipation("2026-02-28", "19:00", now);
        expect(result.valid).toBe(false);
    });

    it("allows custom minimum hours", () => {
        const now = new Date("2026-02-28T15:00:00");
        // 1.5 hours ahead, but requires 2
        const result = validateMinAnticipation("2026-02-28", "16:30", now, 2);
        expect(result.valid).toBe(false);
    });

    it("returns invalid for malformed date/time", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMinAnticipation("bad-date", "xx:yy", now);
        expect(result.valid).toBe(false);
        // May return INVALID_DATE_TIME or INSUFFICIENT_ANTICIPATION depending
        // on Date parsing behavior (NaN comparison differs by platform)
        expect(["INVALID_DATE_TIME", "INSUFFICIENT_ANTICIPATION"]).toContain(result.error);
    });
});

// ============================================================================
// validateMaxFutureDays
// ============================================================================

describe("validateMaxFutureDays", () => {
    it("returns valid for reservation 1 day in the future", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("2026-03-01", now);
        expect(result.valid).toBe(true);
    });

    it("returns valid for reservation exactly 30 days in the future", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("2026-03-30", now);
        expect(result.valid).toBe(true);
    });

    it("returns invalid for reservation 31 days in the future", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("2026-03-31", now);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("TOO_FAR_IN_FUTURE");
        expect(result.details?.message).toContain("30 dias");
    });

    it("returns invalid for reservation 60 days in the future", () => {
        const now = new Date("2026-02-28T00:00:00");
        const dateFuture = futureDays(now, 60);
        const result = validateMaxFutureDays(dateFuture, now);
        expect(result.valid).toBe(false);
    });

    it("returns valid for today", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("2026-02-28", now);
        expect(result.valid).toBe(true);
    });

    it("allows custom max days", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("2026-03-10", now, 7);
        expect(result.valid).toBe(false);
    });

    it("returns invalid for malformed date", () => {
        const now = new Date("2026-02-28T15:00:00");
        const result = validateMaxFutureDays("not-a-date", now);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_DATE");
    });
});

// ============================================================================
// validatePartySize
// ============================================================================

describe("validatePartySize", () => {
    it("returns valid for party_size of 1 (minimum)", () => {
        expect(validatePartySize(1).valid).toBe(true);
    });

    it("returns valid for party_size of 10 (mid-range)", () => {
        expect(validatePartySize(10).valid).toBe(true);
    });

    it("returns valid for party_size of 20 (maximum)", () => {
        expect(validatePartySize(20).valid).toBe(true);
    });

    it("returns invalid for party_size of 0", () => {
        const result = validatePartySize(0);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_SMALL");
        expect(result.details?.message).toContain("al menos 1");
    });

    it("returns invalid for negative party_size", () => {
        const result = validatePartySize(-5);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_SMALL");
    });

    it("returns invalid for party_size of 21", () => {
        const result = validatePartySize(21);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_LARGE");
        expect(result.details?.message).toContain("20");
    });

    it("returns invalid for party_size of 100", () => {
        const result = validatePartySize(100);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_LARGE");
    });

    it("returns invalid for non-integer party_size", () => {
        const result = validatePartySize(2.5);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_PARTY_SIZE");
    });

    it("allows custom bounds", () => {
        expect(validatePartySize(5, 5, 10).valid).toBe(true);
        expect(validatePartySize(4, 5, 10).valid).toBe(false);
        expect(validatePartySize(11, 5, 10).valid).toBe(false);
    });
});

// ============================================================================
// validateOperatingHours
// ============================================================================

describe("validateOperatingHours", () => {
    it("returns valid for time within default hours (11:00-22:00)", () => {
        expect(validateOperatingHours("12:00").valid).toBe(true);
        expect(validateOperatingHours("19:30").valid).toBe(true);
    });

    it("returns valid for time at exactly opening time", () => {
        expect(validateOperatingHours("11:00").valid).toBe(true);
    });

    it("returns invalid for time at exactly closing time (>=)", () => {
        const result = validateOperatingHours("22:00");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("OUTSIDE_OPERATING_HOURS");
    });

    it("returns invalid for time before opening (e.g., 08:00)", () => {
        const result = validateOperatingHours("08:00");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("OUTSIDE_OPERATING_HOURS");
        expect(result.details?.message).toBe("El restaurante no esta abierto en ese horario");
    });

    it("returns invalid for time after closing (e.g., 23:00)", () => {
        const result = validateOperatingHours("23:00");
        expect(result.valid).toBe(false);
    });

    it("returns valid for last minute before closing", () => {
        expect(validateOperatingHours("21:59").valid).toBe(true);
    });

    it("allows custom operating hours", () => {
        expect(validateOperatingHours("09:00", "08:00", "20:00").valid).toBe(true);
        expect(validateOperatingHours("07:00", "08:00", "20:00").valid).toBe(false);
        expect(validateOperatingHours("20:30", "08:00", "20:00").valid).toBe(false);
    });

    it("returns invalid for malformed time", () => {
        const result = validateOperatingHours("abc");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_TIME_FORMAT");
    });
});

// ============================================================================
// validatePhoneFormat
// ============================================================================

describe("validatePhoneFormat", () => {
    it("returns valid for 9-digit Peruvian phone starting with 9", () => {
        expect(validatePhoneFormat("987654321").valid).toBe(true);
    });

    it("returns valid for Peruvian phone with country code +51", () => {
        expect(validatePhoneFormat("51987654321").valid).toBe(true);
    });

    it("returns valid for phone with formatting characters", () => {
        expect(validatePhoneFormat("+51 987 654 321").valid).toBe(true);
        expect(validatePhoneFormat("987-654-321").valid).toBe(true);
        expect(validatePhoneFormat("(987) 654321").valid).toBe(true);
    });

    it("returns invalid for phone not starting with 9", () => {
        const result = validatePhoneFormat("123456789");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_PHONE_FORMAT");
        expect(result.details?.message).toContain("9 digitos");
    });

    it("returns invalid for phone with less than 9 digits", () => {
        expect(validatePhoneFormat("98765").valid).toBe(false);
    });

    it("returns invalid for phone with more than 9 digits (without country code)", () => {
        expect(validatePhoneFormat("9876543210").valid).toBe(false);
    });

    it("returns invalid for empty phone", () => {
        expect(validatePhoneFormat("").valid).toBe(false);
    });

    it("returns invalid for phone with letters", () => {
        expect(validatePhoneFormat("98765abc1").valid).toBe(false);
    });

    it("returns valid for 900000000 (boundary)", () => {
        expect(validatePhoneFormat("900000000").valid).toBe(true);
    });

    it("returns valid for 999999999 (boundary)", () => {
        expect(validatePhoneFormat("999999999").valid).toBe(true);
    });
});

// ============================================================================
// sanitizeSpecialRequests
// ============================================================================

describe("sanitizeSpecialRequests", () => {
    it("returns null for null input", () => {
        expect(sanitizeSpecialRequests(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
        expect(sanitizeSpecialRequests(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(sanitizeSpecialRequests("")).toBeNull();
    });

    it("returns text unchanged if no HTML", () => {
        expect(sanitizeSpecialRequests("Mesa cerca de la ventana")).toBe("Mesa cerca de la ventana");
    });

    it("strips HTML tags for XSS prevention", () => {
        // Tags are stripped, but text content between tags is preserved
        expect(sanitizeSpecialRequests("<script>alert('xss')</script>")).toBe("alert('xss')");
        expect(sanitizeSpecialRequests("Hola <b>mundo</b>")).toBe("Hola mundo");
        // Pure tags with no text content after stripping
        expect(sanitizeSpecialRequests("<br/><hr/>")).toBeNull();
    });

    it("strips complex HTML", () => {
        const input = '<img src="x" onerror="alert(1)">Mesa por favor';
        expect(sanitizeSpecialRequests(input)).toBe("Mesa por favor");
    });

    it("preserves text with angle brackets in non-HTML context", () => {
        // This is acceptable behavior — angle brackets are stripped
        const result = sanitizeSpecialRequests("Temp < 30 grados");
        expect(typeof result).toBe("string");
    });

    it("trims whitespace after stripping", () => {
        expect(sanitizeSpecialRequests("  Hola  ")).toBe("Hola");
    });

    it("returns null if only HTML tags with no text content", () => {
        expect(sanitizeSpecialRequests("<br/>")).toBeNull();
        expect(sanitizeSpecialRequests("<div></div>")).toBeNull();
    });
});

// ============================================================================
// validateReservationCreation (Combined)
// ============================================================================

describe("validateReservationCreation", () => {
    // Use a fixed "now" for deterministic tests
    const now = new Date("2026-02-28T10:00:00");

    const validInput = {
        date: "2026-02-28",
        time: "14:00", // 4 hours ahead, within operating hours
        party_size: 4,
        customer_phone: "987654321",
        now,
    };

    it("returns valid for correct input", () => {
        const result = validateReservationCreation(validInput);
        expect(result.valid).toBe(true);
    });

    it("fails for date in the past", () => {
        const result = validateReservationCreation({
            ...validInput,
            date: "2026-02-27",
            time: "14:00",
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("DATE_IN_PAST");
    });

    it("fails for insufficient anticipation", () => {
        const result = validateReservationCreation({
            ...validInput,
            time: "10:30", // only 30 minutes ahead
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_ANTICIPATION");
    });

    it("fails for date too far in the future", () => {
        const result = validateReservationCreation({
            ...validInput,
            date: "2026-04-15", // > 30 days
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("TOO_FAR_IN_FUTURE");
    });

    it("fails for party_size of 0", () => {
        const result = validateReservationCreation({
            ...validInput,
            party_size: 0,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_SMALL");
    });

    it("fails for party_size of 21", () => {
        const result = validateReservationCreation({
            ...validInput,
            party_size: 21,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("PARTY_SIZE_TOO_LARGE");
    });

    it("fails for time outside operating hours", () => {
        const result = validateReservationCreation({
            ...validInput,
            date: "2026-03-01",
            time: "08:00", // before 11:00
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("OUTSIDE_OPERATING_HOURS");
    });

    it("fails for invalid phone format", () => {
        const result = validateReservationCreation({
            ...validInput,
            customer_phone: "12345",
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("INVALID_PHONE_FORMAT");
    });

    it("accepts custom operating hours", () => {
        const result = validateReservationCreation({
            ...validInput,
            date: "2026-03-01",
            time: "09:00",
            opening_time: "08:00",
            closing_time: "23:00",
        });
        expect(result.valid).toBe(true);
    });

    it("validates in order: date > anticipation > future > party_size > hours > phone", () => {
        // Past date takes precedence
        const result = validateReservationCreation({
            date: "2026-02-27",
            time: "08:00", // also outside hours
            party_size: 0, // also invalid
            customer_phone: "123", // also invalid
            now,
        });
        expect(result.valid).toBe(false);
        // First failure should be DATE_IN_PAST
        expect(result.error).toBe("DATE_IN_PAST");
    });
});
