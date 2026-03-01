/**
 * Property-Based Tests: Shift Enforcement (Fase 2 - C2)
 *
 * Invariants:
 * 1. ORDER_CREATED rejected when no OPEN shift for the terminal
 * 2. CHECK_PAYMENT_ADDED rejected when no OPEN shift for the terminal
 * 3. Events with OPEN shift pass the shift check (other rules may still fail)
 *
 * These tests mock the Prisma tx to simulate shift presence/absence
 * and validate that business-rules.ts correctly enforces C2.
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { seededMathRandom } from "@/src/test-utils/seeded-random";

// We need to test validateEvent which is the main entry point
// Since it uses Prisma.TransactionClient, we mock the tx object

/**
 * Build a mock Prisma TransactionClient that returns
 * controlled data for shifts, terminal_number_ranges, orders, employees, etc.
 */
function makeMockTx(options: {
    hasOpenShift: boolean;
    hasRange?: boolean;
    orderNumber?: number;
    rangeStart?: number;
    rangeEnd?: number;
}) {
    const { hasOpenShift, hasRange = true, orderNumber = 1, rangeStart = 1, rangeEnd = 1000 } = options;

    return {
        shifts: {
            findFirst: vi.fn().mockResolvedValue(
                hasOpenShift ? { id: `shift-${uuidv4()}` } : null
            ),
        },
        terminal_number_ranges: {
            findUnique: vi.fn().mockResolvedValue(
                hasRange ? { range_start: rangeStart, range_end: rangeEnd, current_number: orderNumber } : null
            ),
        },
        orders: {
            findUnique: vi.fn().mockResolvedValue({
                id: uuidv4(),
                checks: [{ check_id: "c1", total_cents: 100000, status: "UNPAID", payment: { payments: [] } }],
                order_status: "OPEN",
                items: [],
            }),
        },
        employees: {
            findUnique: vi.fn().mockResolvedValue({ role: "MANAGER", is_active: true }),
        },
        processed_events: {
            findUnique: vi.fn().mockResolvedValue(null),
        },
    } as any;
}

const { randomInt } = seededMathRandom(42);

function makeOrderCreatedEvent(overrides?: Record<string, unknown>) {
    const order_id = uuidv4();
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: `T${randomInt(0, 99)}`,
        terminal_sequence: 1,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: order_id,
        correlation_id: order_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "CASHIER",
        schema_version: 1,
        payload_version: 1,
        event_type: "ORDER_CREATED" as const,
        payload: {
            order_id,
            order_number: 1,
            order_type: "DINE_IN",
            items: [],
            checks: [{
                check_id: "c1",
                name: "Principal",
                mode: "ITEMS",
                lines: [],
                subtotal_cents: 0,
                discount_cents: 0,
                tip_cents: 0,
                total_cents: 0,
                payment: { status: "UNPAID", payments: [] },
            }],
            ...overrides,
        },
    };
}

function makeCheckPaymentAddedEvent(overrides?: Record<string, unknown>) {
    const order_id = uuidv4();
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: `T${randomInt(0, 99)}`,
        terminal_sequence: 2,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: order_id,
        correlation_id: order_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "CASHIER",
        schema_version: 1,
        payload_version: 1,
        event_type: "CHECK_PAYMENT_ADDED" as const,
        payload: {
            order_id,
            check_id: "c1",
            idempotency_key: `pay_${uuidv4()}`,
            payment: {
                method: "CASH",
                amount_cents: 5000,
            },
            ...overrides,
        },
    };
}

// Dynamically import validateEvent to test against real business-rules
async function getValidateEvent() {
    const mod = await import("@/src/core/validation/business-rules");
    return mod.validateEvent;
}

describe("Shift Enforcement Property Tests (C2)", () => {

    it("Invariant 1: ORDER_CREATED is rejected when no OPEN shift (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 100 }),
                async (orderNumber) => {
                    const event = makeOrderCreatedEvent({ order_number: orderNumber });
                    const tx = makeMockTx({ hasOpenShift: false, hasRange: true, rangeStart: 1, rangeEnd: 1000 });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Must be rejected with NO_OPEN_SHIFT
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("NO_OPEN_SHIFT");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 2: CHECK_PAYMENT_ADDED is rejected when no OPEN shift (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 100000 }),
                fc.constantFrom("CASH" as const, "CARD" as const, "YAPE" as const, "PLIN" as const),
                async (amount, method) => {
                    const event = makeCheckPaymentAddedEvent({
                        payment: { method, amount_cents: amount },
                    });
                    const tx = makeMockTx({ hasOpenShift: false });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Must be rejected with NO_OPEN_SHIFT
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("NO_OPEN_SHIFT");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 3: ORDER_CREATED passes shift check when shift is OPEN (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 999 }),
                async (orderNumber) => {
                    const event = makeOrderCreatedEvent({ order_number: orderNumber });
                    const tx = makeMockTx({ hasOpenShift: true, hasRange: true, rangeStart: 1, rangeEnd: 1000 });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: With open shift + valid range, should pass
                    // (other validation rules like role are checked before validateOrderCreated)
                    expect(result.valid).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 4: CHECK_PAYMENT_ADDED passes shift check when shift is OPEN (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }),
                fc.constantFrom("CASH" as const, "CARD" as const, "YAPE" as const, "PLIN" as const, "TRANSFER" as const),
                async (amount, method) => {
                    const event = makeCheckPaymentAddedEvent({
                        payment: { method, amount_cents: amount },
                    });
                    const tx = makeMockTx({ hasOpenShift: true });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: With open shift + valid payment, should pass
                    expect(result.valid).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
