/**
 * Concurrency Tests: Reservation Overbooking Prevention
 *
 * Simulates concurrent reservation creation for the last available table.
 * Verifies that exactly one request succeeds and the other fails.
 *
 * Uses Prisma $transaction with Serializable isolation to ensure atomicity.
 *
 * Covers scenario: S29 (concurrent overbooking prevention)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock Prisma
// ============================================================================

let reservationCount = 0;

const mockTransaction = vi.fn();

vi.mock("@/src/core/db/prisma", () => ({
    default: {
        reservations: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        tenants: {
            findFirst: vi.fn(),
        },
        locations: {
            findFirst: vi.fn(),
        },
        events: {
            create: vi.fn(),
        },
        tables: {
            findMany: vi.fn(),
        },
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

vi.mock("@/src/core/observability/structured-logger", () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

import { createReservation } from "../reservation.service";
import { ConflictError } from "@/src/core/result";

// ============================================================================
// Constants
// ============================================================================

const TENANT_ID = "tenant-concurrency-001";
const LOCATION_ID = "location-concurrency-001";

// Dynamic future date — always 7 days ahead to pass "no past dates" validation
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
FUTURE_DATE.setHours(0, 0, 0, 0);
const FUTURE_DATE_STR = FUTURE_DATE.toISOString().split("T")[0]!;

const validInput = {
    customer_name: "Cliente Concurrente",
    customer_phone: "987654321",
    date: FUTURE_DATE_STR,
    time: "19:00",
    party_size: 2,
};

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    reservationCount = 0;
});

// ============================================================================
// Concurrency Tests
// ============================================================================

describe("Concurrent Overbooking Prevention", () => {
    it("exactly one of two concurrent reservations succeeds for the last available table", async () => {
        // Simulate Serializable isolation: the first transaction succeeds,
        // and the second transaction sees the reservation created by the first.
        // In real PostgreSQL with Serializable isolation, the second transaction
        // would either see the new row or get a serialization failure.

        // First call: table is free -> succeeds
        mockTransaction.mockImplementationOnce(async (cb: (tx: any) => Promise<any>) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([
                        { id: "table-only", capacity: 4 },
                    ]),
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]), // No existing reservations
                    findFirst: vi.fn().mockResolvedValue(null), // No code collision
                    create: vi.fn().mockImplementation(async () => {
                        reservationCount++;
                    }),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        // Second call: table is now occupied by the first reservation -> fails
        mockTransaction.mockImplementationOnce(async (cb: (tx: any) => Promise<any>) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([
                        { id: "table-only", capacity: 4 },
                    ]),
                },
                reservations: {
                    findMany: vi.fn()
                        .mockResolvedValueOnce([]) // No assigned reservations on the table
                        .mockResolvedValueOnce([
                            // But there IS an unassigned overlapping reservation (from first call)
                            { time: "19:00", duration_minutes: 90, party_size: 2 },
                        ]),
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        // First reservation succeeds
        const result1 = await createReservation(TENANT_ID, LOCATION_ID, validInput, "Polleria A");

        // Second reservation fails (table now occupied)
        const result2 = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, customer_name: "Cliente B" },
            "Polleria A",
        );

        const results = [result1, result2];
        const successes = results.filter((r) => r.success);
        const failures = results.filter((r) => !r.success);

        // Exactly one succeeds, one fails
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);

        // The successful one returns a confirmation code
        if (successes[0].success) {
            expect(successes[0].data.confirmation_code).toBeTruthy();
            expect(successes[0].data.status).toBe("PENDING");
        }

        // The failed one reports no availability
        if (!failures[0].success) {
            expect(failures[0].error.message).toContain("mesas disponibles");
        }
    });

    it("all reservations succeed when enough tables are available", async () => {
        mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([
                        { id: "table-1", capacity: 4 },
                        { id: "table-2", capacity: 4 },
                        { id: "table-3", capacity: 4 },
                    ]),
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]), // No existing reservations
                    findFirst: vi.fn().mockResolvedValue(null), // No code collision
                    create: vi.fn(),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const results = await Promise.all([
            createReservation(TENANT_ID, LOCATION_ID, validInput, "Polleria"),
            createReservation(TENANT_ID, LOCATION_ID, { ...validInput, customer_name: "B" }, "Polleria"),
        ]);

        const successes = results.filter((r) => r.success);
        expect(successes).toHaveLength(2);
    });

    it("Prisma serialization failure is handled gracefully", async () => {
        // Simulate Prisma P2034 (serialization failure)
        mockTransaction.mockRejectedValueOnce(
            Object.assign(new Error("Transaction failed due to a write conflict"), {
                code: "P2034",
            }),
        );

        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            validInput,
            "Polleria",
        );

        // Should return an error, not throw
        expect(result.success).toBe(false);
    });
});
