/**
 * Reservation Business Rules
 *
 * Pure validation functions for reservation creation and management.
 * These rules are independent of database state (no Prisma queries).
 *
 * Rules enforced:
 * - Date not in the past
 * - Minimum 1 hour of anticipation
 * - Maximum 30 days in the future
 * - Party size 1-20
 * - Time within operating hours
 * - Phone format validation (Peru: 9 digits)
 * - Customer name validation
 * - Special requests sanitization (strip HTML for XSS prevention)
 */

import type { ValidationResult } from "@/src/core/validation/business-rules";
import { RESERVATION_DEFAULTS } from "./reservation.schema";

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that the reservation date is not in the past
 */
export function validateDateNotInPast(
    reservationDate: string,
    reservationTime: string,
    now: Date = new Date(),
): ValidationResult {
    const reservationDateTime = new Date(`${reservationDate}T${reservationTime}:00`);

    if (isNaN(reservationDateTime.getTime())) {
        return {
            valid: false,
            error: "INVALID_DATE_TIME",
            details: { date: reservationDate, time: reservationTime },
        };
    }

    if (reservationDateTime <= now) {
        return {
            valid: false,
            error: "DATE_IN_PAST",
            details: {
                message: "No se puede reservar en un horario pasado",
                reservation_date: reservationDate,
                reservation_time: reservationTime,
            },
        };
    }

    return { valid: true };
}

/**
 * Validate minimum anticipation (1 hour by default)
 */
export function validateMinAnticipation(
    reservationDate: string,
    reservationTime: string,
    now: Date = new Date(),
    minHours: number = RESERVATION_DEFAULTS.MIN_ANTICIPATION_HOURS,
): ValidationResult {
    const reservationDateTime = new Date(`${reservationDate}T${reservationTime}:00`);

    if (isNaN(reservationDateTime.getTime())) {
        return {
            valid: false,
            error: "INVALID_DATE_TIME",
            details: { date: reservationDate, time: reservationTime },
        };
    }

    const diffMs = reservationDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < minHours) {
        return {
            valid: false,
            error: "INSUFFICIENT_ANTICIPATION",
            details: {
                message: `La reserva debe hacerse con al menos ${minHours} hora de anticipacion`,
                hours_until_reservation: Math.round(diffHours * 100) / 100,
                min_required_hours: minHours,
            },
        };
    }

    return { valid: true };
}

/**
 * Validate maximum days in the future (30 by default)
 */
export function validateMaxFutureDays(
    reservationDate: string,
    now: Date = new Date(),
    maxDays: number = RESERVATION_DEFAULTS.MAX_DAYS_IN_FUTURE,
): ValidationResult {
    const reservationDay = new Date(`${reservationDate}T00:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (isNaN(reservationDay.getTime())) {
        return {
            valid: false,
            error: "INVALID_DATE",
            details: { date: reservationDate },
        };
    }

    const diffMs = reservationDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > maxDays) {
        return {
            valid: false,
            error: "TOO_FAR_IN_FUTURE",
            details: {
                message: `No se puede reservar con mas de ${maxDays} dias de anticipacion`,
                days_in_future: diffDays,
                max_days: maxDays,
            },
        };
    }

    return { valid: true };
}

/**
 * Validate party size bounds
 */
export function validatePartySize(
    partySize: number,
    min: number = RESERVATION_DEFAULTS.MIN_PARTY_SIZE,
    max: number = RESERVATION_DEFAULTS.MAX_PARTY_SIZE,
): ValidationResult {
    if (!Number.isInteger(partySize)) {
        return {
            valid: false,
            error: "INVALID_PARTY_SIZE",
            details: { message: "La cantidad de personas debe ser un numero entero" },
        };
    }

    if (partySize < min) {
        return {
            valid: false,
            error: "PARTY_SIZE_TOO_SMALL",
            details: {
                message: `La cantidad de personas debe ser al menos ${min}`,
                party_size: partySize,
                min,
            },
        };
    }

    if (partySize > max) {
        return {
            valid: false,
            error: "PARTY_SIZE_TOO_LARGE",
            details: {
                message: `El maximo de personas por reserva es ${max}`,
                party_size: partySize,
                max,
            },
        };
    }

    return { valid: true };
}

/**
 * Validate time is within restaurant operating hours
 */
export function validateOperatingHours(
    reservationTime: string,
    openingTime: string = RESERVATION_DEFAULTS.DEFAULT_OPENING_TIME,
    closingTime: string = RESERVATION_DEFAULTS.DEFAULT_CLOSING_TIME,
): ValidationResult {
    const [resHour, resMin] = reservationTime.split(":").map(Number);
    const [openHour, openMin] = openingTime.split(":").map(Number);
    const [closeHour, closeMin] = closingTime.split(":").map(Number);

    if (isNaN(resHour) || isNaN(resMin)) {
        return {
            valid: false,
            error: "INVALID_TIME_FORMAT",
            details: { time: reservationTime },
        };
    }

    const resTotalMinutes = resHour * 60 + resMin;
    const openTotalMinutes = openHour * 60 + openMin;
    const closeTotalMinutes = closeHour * 60 + closeMin;

    if (resTotalMinutes < openTotalMinutes || resTotalMinutes >= closeTotalMinutes) {
        return {
            valid: false,
            error: "OUTSIDE_OPERATING_HOURS",
            details: {
                message: "El restaurante no esta abierto en ese horario",
                time: reservationTime,
                opening_time: openingTime,
                closing_time: closingTime,
            },
        };
    }

    return { valid: true };
}

/**
 * Validate Peruvian phone format (9 digits starting with 9)
 */
export function validatePhoneFormat(phone: string): ValidationResult {
    // Strip common formatting characters
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");

    // Peru phone: 9 digits, starts with 9
    // Also accept with country code +51
    const peruPattern = /^(51)?9\d{8}$/;

    if (!peruPattern.test(cleaned)) {
        return {
            valid: false,
            error: "INVALID_PHONE_FORMAT",
            details: {
                message: "El telefono debe tener 9 digitos numericos (formato Peru)",
                phone,
            },
        };
    }

    return { valid: true };
}

/**
 * Sanitize special_requests to prevent XSS (strip HTML tags)
 */
export function sanitizeSpecialRequests(text: string | null | undefined): string | null {
    if (!text) return null;
    // Strip HTML tags
    return text.replace(/<[^>]*>/g, "").trim() || null;
}

/**
 * Run all business rule validations for a reservation creation request
 */
export function validateReservationCreation(input: {
    date: string;
    time: string;
    party_size: number;
    customer_phone: string;
    opening_time?: string;
    closing_time?: string;
    now?: Date;
}): ValidationResult {
    const now = input.now ?? new Date();

    // 1. Date not in the past
    const dateCheck = validateDateNotInPast(input.date, input.time, now);
    if (!dateCheck.valid) return dateCheck;

    // 2. Minimum anticipation
    const anticipationCheck = validateMinAnticipation(input.date, input.time, now);
    if (!anticipationCheck.valid) return anticipationCheck;

    // 3. Maximum days in the future
    const futureCheck = validateMaxFutureDays(input.date, now);
    if (!futureCheck.valid) return futureCheck;

    // 4. Party size
    const partySizeCheck = validatePartySize(input.party_size);
    if (!partySizeCheck.valid) return partySizeCheck;

    // 5. Operating hours
    const hoursCheck = validateOperatingHours(
        input.time,
        input.opening_time,
        input.closing_time,
    );
    if (!hoursCheck.valid) return hoursCheck;

    // 6. Phone format
    const phoneCheck = validatePhoneFormat(input.customer_phone);
    if (!phoneCheck.valid) return phoneCheck;

    return { valid: true };
}
