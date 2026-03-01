/**
 * Unit Tests: ReservationService (Tasks 5.2, 5.3, 5.4, 5.7)
 *
 * Tests with mocked Prisma for:
 * - State transitions and confirmation code (5.2)
 * - Availability calculation and creation flow (5.3)
 * - Query methods (5.4)
 * - Concurrency / overbooking prevention (5.7)
 *
 * Covers scenarios: S1-S3, S12-S16, S17-S20, S21-S29, S33
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock Prisma — MUST come before importing the service
// ============================================================================

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

const mockTxReservations = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
};

const mockTxTables = {
    findMany: vi.fn(),
};

const mockTxEvents = {
    create: vi.fn(),
};

const mockTxLocations = {
    findFirst: vi.fn(),
};

const mockTxTenants = {
    findFirst: vi.fn(),
};

// The transaction callback receives a tx object with the same shape
const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<any>, _opts?: any) => {
    const tx = {
        reservations: mockTxReservations,
        tables: mockTxTables,
        events: mockTxEvents,
        locations: mockTxLocations,
        tenants: mockTxTenants,
    };
    return cb(tx);
});

vi.mock("@/src/core/db/prisma", () => ({
    default: {
        reservations: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
            findMany: (...args: any[]) => mockFindMany(...args),
            create: (...args: any[]) => mockCreate(...args),
            update: (...args: any[]) => mockUpdate(...args),
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
        $transaction: (fn: any) => mockTransaction(fn),
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

import prisma from "@/src/core/db/prisma";
import {
    validateStateTransition,
    actionToStatus,
    generateConfirmationCode,
    checkAvailability,
    createReservation,
    performAction,
    cancelByCustomer,
    getReservationsByDate,
    getReservationByCode,
    getReservationById,
    getReservationsByPhone,
    resolveTenantBySlug,
} from "../reservation.service";
import {
    CONFIRMATION_CODE_CHARS,
    CONFIRMATION_CODE_LENGTH,
    type ReservationStatus,
} from "../reservation.schema";

// ============================================================================
// Constants
// ============================================================================

const TENANT_ID = "tenant-test-001";
const LOCATION_ID = "location-test-001";
const ACTOR_ID = "admin-test-001";
const RESERVATION_ID = "res-test-001";

function makeMockReservation(overrides: Record<string, unknown> = {}) {
    return {
        id: RESERVATION_ID,
        tenant_id: TENANT_ID,
        location_id: LOCATION_ID,
        customer_name: "Maria Lopez",
        customer_phone: "987654321",
        customer_email: null,
        date: new Date("2026-03-15T00:00:00"),
        time: "19:00",
        duration_minutes: 90,
        party_size: 4,
        status: "PENDING",
        confirmation_code: "R4K7M2",
        table_id: null,
        table_number: null,
        zone_preference: null,
        special_requests: null,
        internal_notes: null,
        confirmed_at: null,
        arrived_at: null,
        seated_at: null,
        no_show_at: null,
        cancelled_at: null,
        cancelled_reason: null,
        created_by: "system",
        created_at: new Date("2026-02-28T10:00:00"),
        updated_at: new Date("2026-02-28T10:00:00"),
        ...overrides,
    };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    // Default tx mock responses
    mockTxReservations.findFirst.mockResolvedValue(null);
    mockTxReservations.findMany.mockResolvedValue([]);
    mockTxReservations.create.mockResolvedValue(undefined);
    mockTxReservations.update.mockResolvedValue(makeMockReservation());
    mockTxTables.findMany.mockResolvedValue([]);
    mockTxEvents.create.mockResolvedValue(undefined);
});

// ============================================================================
// Task 5.2: State Transitions (already tested in state-machine.test.ts,
//           but here we test via performAction with mocked Prisma)
// ============================================================================

describe("performAction — State Transitions with Prisma", () => {
    it("allows PENDING -> CONFIRMED (confirm)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "PENDING" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "CONFIRMED", confirmed_at: new Date() }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "confirm", ACTOR_ID);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("CONFIRMED");
        }
    });

    it("allows PENDING -> REJECTED (reject)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "PENDING" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "REJECTED" }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "reject", ACTOR_ID, { reason: "Sin mesa" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("REJECTED");
        }
    });

    it("allows CONFIRMED -> ARRIVED (arrive)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "CONFIRMED" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "ARRIVED", arrived_at: new Date() }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "arrive", ACTOR_ID);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("ARRIVED");
        }
    });

    it("allows ARRIVED -> SEATED (seat)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "ARRIVED" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "SEATED", seated_at: new Date() }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "seat", ACTOR_ID);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("SEATED");
        }
    });

    it("allows CONFIRMED -> NO_SHOW (no_show)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "CONFIRMED" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "NO_SHOW", no_show_at: new Date() }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "no_show", ACTOR_ID);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("NO_SHOW");
        }
    });

    it("allows any active -> CANCELLED (cancel from PENDING)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "PENDING" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: {
                    update: vi.fn().mockResolvedValue(
                        makeMockReservation({ status: "CANCELLED", cancelled_at: new Date() }),
                    ),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "cancel", ACTOR_ID, { reason: "No disponible" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("CANCELLED");
        }
    });

    it("rejects CANCELLED -> CONFIRMED (invalid transition)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "CANCELLED" }));

        const result = await performAction(TENANT_ID, RESERVATION_ID, "confirm", ACTOR_ID);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain("CANCELLED");
            expect(result.error.message).toContain("CONFIRMED");
        }
    });

    it("rejects SEATED -> PENDING (invalid transition)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "SEATED" }));

        // seat -> cancel is invalid too (no CANCEL from SEATED allowed)
        const result = await performAction(TENANT_ID, RESERVATION_ID, "cancel", ACTOR_ID);
        expect(result.success).toBe(false);
    });

    it("rejects NO_SHOW -> CONFIRMED (terminal state)", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "NO_SHOW" }));

        const result = await performAction(TENANT_ID, RESERVATION_ID, "confirm", ACTOR_ID);
        expect(result.success).toBe(false);
    });

    it("returns not found for missing reservation", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await performAction(TENANT_ID, "non-existent-id", "confirm", ACTOR_ID);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe("NOT_FOUND");
        }
    });

    it("assigns table_id on confirm when provided", async () => {
        const TABLE_ID = "table-uuid-001";
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "PENDING" }));

        const updateMock = vi.fn().mockResolvedValue(
            makeMockReservation({ status: "CONFIRMED", table_id: TABLE_ID }),
        );
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: { update: updateMock },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await performAction(TENANT_ID, RESERVATION_ID, "confirm", ACTOR_ID, { table_id: TABLE_ID });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.table_id).toBe(TABLE_ID);
        }
        // Verify the update call included table_id
        expect(updateMock).toHaveBeenCalled();
        const updateArgs = updateMock.mock.calls[0][0];
        expect(updateArgs.data.table_id).toBe(TABLE_ID);
    });
});

// ============================================================================
// Task 5.2: cancelByCustomer
// ============================================================================

describe("cancelByCustomer", () => {
    it("cancels a PENDING reservation successfully", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "PENDING" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: { update: vi.fn() },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await cancelByCustomer(TENANT_ID, "R4K7M2");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("CANCELLED");
            expect(result.data.confirmation_code).toBe("R4K7M2");
        }
    });

    it("cancels a CONFIRMED reservation successfully", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "CONFIRMED" }));
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                reservations: { update: vi.fn() },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await cancelByCustomer(TENANT_ID, "R4K7M2");
        expect(result.success).toBe(true);
    });

    it("rejects cancellation of SEATED reservation", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "SEATED" }));

        const result = await cancelByCustomer(TENANT_ID, "R4K7M2");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain("SEATED");
        }
    });

    it("rejects cancellation of already CANCELLED reservation", async () => {
        mockFindFirst.mockResolvedValueOnce(makeMockReservation({ status: "CANCELLED" }));

        const result = await cancelByCustomer(TENANT_ID, "R4K7M2");
        expect(result.success).toBe(false);
    });

    it("returns not found for non-existent reservation", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await cancelByCustomer(TENANT_ID, "XXXXXX");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe("NOT_FOUND");
        }
    });
});

// ============================================================================
// Task 5.3: checkAvailability
// ============================================================================

describe("checkAvailability", () => {
    it("returns available when tables exist and no overlapping reservations", async () => {
        const tx = {
            tables: {
                findMany: vi.fn().mockResolvedValue([
                    { id: "table-1", capacity: 4 },
                    { id: "table-2", capacity: 6 },
                ]),
            },
            reservations: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        } as any;

        const result = await checkAvailability(tx, TENANT_ID, new Date("2026-03-15"), "19:00", 4);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available).toBe(true);
            expect(result.data.availableTableCount).toBe(2);
        }
    });

    it("returns unavailable when no tables with sufficient capacity", async () => {
        const tx = {
            tables: {
                findMany: vi.fn().mockResolvedValue([]),  // No tables match
            },
            reservations: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        } as any;

        const result = await checkAvailability(tx, TENANT_ID, new Date("2026-03-15"), "19:00", 4);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available).toBe(false);
            expect(result.data.availableTableCount).toBe(0);
        }
    });

    it("returns unavailable when all tables have overlapping reservations", async () => {
        const tx = {
            tables: {
                findMany: vi.fn().mockResolvedValue([
                    { id: "table-1", capacity: 4 },
                ]),
            },
            reservations: {
                findMany: vi.fn()
                    .mockResolvedValueOnce([
                        // Assigned reservation overlapping
                        { table_id: "table-1", time: "19:00", duration_minutes: 90 },
                    ])
                    .mockResolvedValueOnce([]), // No unassigned reservations
            },
        } as any;

        const result = await checkAvailability(tx, TENANT_ID, new Date("2026-03-15"), "19:30", 4);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available).toBe(false);
            expect(result.data.availableTableCount).toBe(0);
        }
    });

    it("returns available when reservation does not overlap (90 min gap)", async () => {
        const tx = {
            tables: {
                findMany: vi.fn().mockResolvedValue([
                    { id: "table-1", capacity: 4 },
                ]),
            },
            reservations: {
                findMany: vi.fn()
                    .mockResolvedValueOnce([
                        // Existing reservation 19:00-20:30
                        { table_id: "table-1", time: "19:00", duration_minutes: 90 },
                    ])
                    .mockResolvedValueOnce([]), // No unassigned
            },
        } as any;

        // Request at 21:00 — no overlap with 19:00-20:30
        const result = await checkAvailability(tx, TENANT_ID, new Date("2026-03-15"), "21:00", 4);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available).toBe(true);
            expect(result.data.availableTableCount).toBe(1);
        }
    });

    it("accounts for unassigned overlapping reservations", async () => {
        const tx = {
            tables: {
                findMany: vi.fn().mockResolvedValue([
                    { id: "table-1", capacity: 4 },
                ]),
            },
            reservations: {
                findMany: vi.fn()
                    .mockResolvedValueOnce([]) // No assigned reservations
                    .mockResolvedValueOnce([
                        // 1 unassigned overlapping reservation
                        { time: "19:00", duration_minutes: 90, party_size: 4 },
                    ]),
            },
        } as any;

        // 1 table, 1 unassigned overlapping = 0 available
        const result = await checkAvailability(tx, TENANT_ID, new Date("2026-03-15"), "19:30", 4);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available).toBe(false);
            expect(result.data.availableTableCount).toBe(0);
        }
    });
});

// ============================================================================
// Task 5.3: createReservation — Full Flow
// ============================================================================

describe("createReservation", () => {
    const validInput = {
        customer_name: "Maria Lopez",
        customer_phone: "987654321",
        date: "2026-03-15",
        time: "19:00",
        party_size: 4,
    };

    it("creates reservation successfully (happy path)", async () => {
        // Mock the transaction to simulate full flow
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([{ id: "table-1", capacity: 6 }]),
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]),
                    findFirst: vi.fn().mockResolvedValue(null), // No code collision
                    create: vi.fn().mockResolvedValue(undefined),
                },
                events: {
                    create: vi.fn().mockResolvedValue(undefined),
                },
            };
            return cb(tx);
        });

        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            validInput,
            "Polleria Don Pepe",
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe("PENDING");
            expect(result.data.date).toBe("2026-03-15");
            expect(result.data.time).toBe("19:00");
            expect(result.data.party_size).toBe(4);
            expect(result.data.confirmation_code).toBeTruthy();
            expect(result.data.confirmation_code).toHaveLength(CONFIRMATION_CODE_LENGTH);
        }
    });

    it("returns conflict error when no tables available", async () => {
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([]), // No tables with capacity
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]),
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            validInput,
            "Polleria Don Pepe",
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain("mesas disponibles");
        }
    });

    it("returns validation error for past date", async () => {
        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, date: "2025-01-01", time: "12:00" },
            "Polleria Don Pepe",
        );

        expect(result.success).toBe(false);
        // Transaction should not even be called for validation failures
    });

    it("returns validation error for party_size of 0", async () => {
        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, party_size: 0 },
            "Polleria Don Pepe",
        );

        expect(result.success).toBe(false);
    });

    it("returns validation error for invalid phone format", async () => {
        const result = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, customer_phone: "12345" },
            "Polleria Don Pepe",
        );

        expect(result.success).toBe(false);
    });

    it("sanitizes special_requests by stripping HTML", async () => {
        const createMock = vi.fn().mockResolvedValue(undefined);
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([{ id: "t1", capacity: 6 }]),
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]),
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: createMock,
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, special_requests: "Hola <b>mundo</b> Mesa ventana" },
            "Polleria Don Pepe",
        );

        // Verify that the reservation was created with sanitized text (HTML tags stripped)
        expect(createMock).toHaveBeenCalled();
        const createdData = createMock.mock.calls[0][0].data;
        expect(createdData.special_requests).toBe("Hola mundo Mesa ventana");
    });
});

// ============================================================================
// Task 5.3: resolveTenantBySlug
// ============================================================================

describe("resolveTenantBySlug", () => {
    it("resolves tenant by slug successfully", async () => {
        (prisma.tenants.findFirst as any).mockResolvedValueOnce({
            id: TENANT_ID,
            name: "Polleria Don Pepe",
        });
        (prisma.locations.findFirst as any).mockResolvedValueOnce({
            id: LOCATION_ID,
        });

        const result = await resolveTenantBySlug("polleria-don-pepe");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(TENANT_ID);
            expect(result.data.name).toBe("Polleria Don Pepe");
            expect(result.data.locationId).toBe(LOCATION_ID);
        }
    });

    it("returns not found for non-existent slug", async () => {
        (prisma.tenants.findFirst as any).mockResolvedValueOnce(null);

        const result = await resolveTenantBySlug("restaurante-fantasma");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe("NOT_FOUND");
        }
    });

    it("returns not found when tenant has no active location", async () => {
        (prisma.tenants.findFirst as any).mockResolvedValueOnce({
            id: TENANT_ID,
            name: "Polleria",
        });
        (prisma.locations.findFirst as any).mockResolvedValueOnce(null);

        const result = await resolveTenantBySlug("polleria");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe("NOT_FOUND");
        }
    });
});

// ============================================================================
// Task 5.4: Query Methods
// ============================================================================

describe("getReservationsByDate", () => {
    it("returns reservations ordered by time with summary totals", async () => {
        const reservations = [
            makeMockReservation({ time: "19:00", status: "PENDING" }),
            makeMockReservation({ time: "12:00", status: "CONFIRMED", id: "res-2" }),
            makeMockReservation({ time: "20:00", status: "CANCELLED", id: "res-3" }),
        ];

        // First call: allForDate (for summary)
        mockFindMany
            .mockResolvedValueOnce(reservations.map((r) => ({ status: r.status })))
            // Second call: filtered + ordered reservations
            .mockResolvedValueOnce(reservations);

        const result = await getReservationsByDate(TENANT_ID, {
            date: "2026-03-15",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.reservations).toHaveLength(3);
            expect(result.data.summary.total).toBe(3);
            expect(result.data.summary.pending).toBe(1);
            expect(result.data.summary.confirmed).toBe(1);
            expect(result.data.summary.cancelled).toBe(1);
        }
    });

    it("returns empty list when no reservations for date", async () => {
        mockFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const result = await getReservationsByDate(TENANT_ID, { date: "2026-03-15" });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.reservations).toHaveLength(0);
            expect(result.data.summary.total).toBe(0);
        }
    });

    it("filters by status when provided", async () => {
        mockFindMany
            .mockResolvedValueOnce([{ status: "PENDING" }, { status: "CONFIRMED" }])
            .mockResolvedValueOnce([makeMockReservation({ status: "PENDING" })]);

        const result = await getReservationsByDate(TENANT_ID, {
            date: "2026-03-15",
            status: "PENDING",
        });

        expect(result.success).toBe(true);
        // The second findMany call should have status filter
        const secondCall = mockFindMany.mock.calls[1];
        expect(secondCall[0].where.status).toBe("PENDING");
    });
});

describe("getReservationByCode", () => {
    it("returns public-safe fields (no tenant_id, no table_id, no internal_notes)", async () => {
        mockFindFirst.mockResolvedValueOnce(
            makeMockReservation({
                table_id: "secret-table",
                internal_notes: "SECRET NOTE",
            }),
        );

        const result = await getReservationByCode(TENANT_ID, "R4K7M2", "Polleria Don Pepe");

        expect(result.success).toBe(true);
        if (result.success) {
            // Public fields present
            expect(result.data.confirmation_code).toBe("R4K7M2");
            expect(result.data.status).toBe("PENDING");
            expect(result.data.customer_name).toBe("Maria Lopez");
            expect(result.data.restaurant_name).toBe("Polleria Don Pepe");
            // Sensitive fields NOT present
            expect((result.data as any).tenant_id).toBeUndefined();
            expect((result.data as any).table_id).toBeUndefined();
            expect((result.data as any).internal_notes).toBeUndefined();
        }
    });

    it("returns not found for non-existent code", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await getReservationByCode(TENANT_ID, "XXXXXX", "Polleria");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.code).toBe("NOT_FOUND");
        }
    });
});

describe("getReservationById", () => {
    it("returns full admin reservation data", async () => {
        mockFindFirst.mockResolvedValueOnce(
            makeMockReservation({
                table_id: "table-123",
                internal_notes: "VIP customer",
            }),
        );

        const result = await getReservationById(TENANT_ID, RESERVATION_ID);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(RESERVATION_ID);
            expect(result.data.table_id).toBe("table-123");
            expect(result.data.internal_notes).toBe("VIP customer");
        }
    });

    it("returns not found for non-existent reservation", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await getReservationById(TENANT_ID, "non-existent");
        expect(result.success).toBe(false);
    });
});

describe("getReservationsByPhone", () => {
    it("returns reservations for a phone number", async () => {
        mockFindMany.mockResolvedValueOnce([
            makeMockReservation({ confirmation_code: "AAA111" }),
            makeMockReservation({ confirmation_code: "BBB222", id: "res-2" }),
        ]);

        const result = await getReservationsByPhone(TENANT_ID, "987654321", "Polleria");

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toHaveLength(2);
            expect(result.data[0].confirmation_code).toBe("AAA111");
            expect(result.data[1].confirmation_code).toBe("BBB222");
            // Public-safe: no tenant_id
            expect((result.data[0] as any).tenant_id).toBeUndefined();
        }
    });

    it("returns empty array for phone with no reservations", async () => {
        mockFindMany.mockResolvedValueOnce([]);

        const result = await getReservationsByPhone(TENANT_ID, "999999999", "Polleria");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toHaveLength(0);
        }
    });
});

// ============================================================================
// Task 5.7: Concurrency — Overbooking Prevention
// ============================================================================

describe("Concurrency: Overbooking Prevention", () => {
    it("one of two sequential createReservation calls fails when only 1 table available", async () => {
        const validInput = {
            customer_name: "Cliente Test",
            customer_phone: "987654321",
            date: "2026-03-15",
            time: "19:00",
            party_size: 2,
        };

        // First call: table is free -> succeeds
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([{ id: "table-1", capacity: 4 }]),
                },
                reservations: {
                    findMany: vi.fn().mockResolvedValue([]),
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        // Second call: table is occupied by the first reservation -> fails
        mockTransaction.mockImplementationOnce(async (cb) => {
            const tx = {
                tables: {
                    findMany: vi.fn().mockResolvedValue([{ id: "table-1", capacity: 4 }]),
                },
                reservations: {
                    findMany: vi.fn()
                        .mockResolvedValueOnce([]) // No assigned reservations
                        .mockResolvedValueOnce([
                            // One unassigned overlapping reservation (from first call)
                            { time: "19:00", duration_minutes: 90, party_size: 2 },
                        ]),
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                },
                events: { create: vi.fn() },
            };
            return cb(tx);
        });

        // First call succeeds
        const result1 = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            validInput,
            "Polleria",
        );

        // Second call should fail (table now occupied)
        const result2 = await createReservation(
            TENANT_ID,
            LOCATION_ID,
            { ...validInput, customer_name: "Cliente 2" },
            "Polleria",
        );

        // Exactly one should succeed and one should fail
        const successes = [result1, result2].filter((r) => r.success);
        const failures = [result1, result2].filter((r) => !r.success);

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);

        if (!failures[0].success) {
            expect(failures[0].error.message).toContain("mesas disponibles");
        }
    });
});
