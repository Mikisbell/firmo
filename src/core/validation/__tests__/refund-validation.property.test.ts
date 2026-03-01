/**
 * Property-Based Tests: Refund Validation (Caja Crítico 1)
 *
 * Invariants:
 * 1. refund_amount > original_amount → REFUND_EXCEEDS_ORIGINAL
 * 2. REFUND_ISSUED sin orden → ORDER_NOT_FOUND
 * 3. REFUND_ISSUED sin pagos → NO_PAYMENTS_TO_REFUND
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";

function makeMockTx(options: {
    orderExists?: boolean;
    hasOpenShift?: boolean;
    hasRange?: boolean;
    paymentCount?: number;
}) {
    const {
        orderExists = true,
        hasOpenShift = true,
        hasRange = true,
        paymentCount = 1,
    } = options;

    return {
        shifts: {
            findFirst: vi.fn().mockResolvedValue(
                hasOpenShift ? { id: "shift-1" } : null
            ),
        },
        terminal_number_ranges: {
            findUnique: vi.fn().mockResolvedValue(
                hasRange ? { range_start: 1, range_end: 1000, current_number: 1 } : null
            ),
        },
        orders: {
            findUnique: vi.fn().mockResolvedValue(
                orderExists ? { id: uuidv4(), order_status: "OPEN", items: [], checks: [] } : null
            ),
        },
        products: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        employees: {
            findUnique: vi.fn().mockResolvedValue({ role: "MANAGER", is_active: true }),
        },
        payments: {
            count: vi.fn().mockResolvedValue(paymentCount),
        },
    } as any;
}

function makeRefundEvent(overrides?: Record<string, unknown>) {
    const order_id = uuidv4();
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: 1,
        occurred_at: new Date().toISOString(),
        aggregate_type: "INVOICE",
        aggregate_id: uuidv4(),
        correlation_id: order_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "MANAGER",
        schema_version: 1,
        payload_version: 1,
        event_type: "REFUND_ISSUED" as const,
        payload: {
            refund_id: uuidv4(),
            order_id,
            check_id: "c1",
            type: "FULL",
            reason_code: "CUSTOMER_REQUEST",
            original_amount: 5000,
            refund_amount: 5000,
            refund_method: "CASH",
            issued_by: uuidv4(),
            issued_at: new Date().toISOString(),
            ...overrides,
        },
    };
}

async function getValidateEvent() {
    const mod = await import("@/src/core/validation/business-rules");
    return mod.validateEvent;
}

describe("Refund Validation Property Tests (Caja C1)", () => {

    it("Invariant 1: refund_amount > original_amount is rejected (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }), // original
                fc.integer({ min: 1, max: 50000 }),    // excess
                async (originalAmount, excess) => {
                    const refundAmount = originalAmount + excess;
                    const event = makeRefundEvent({
                        original_amount: originalAmount,
                        refund_amount: refundAmount,
                    });
                    const tx = makeMockTx({ orderExists: true, paymentCount: 1 });
                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: refund > original → rejected
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("REFUND_EXCEEDS_ORIGINAL");
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: REFUND_ISSUED without order → ORDER_NOT_FOUND (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }),
                async (amount) => {
                    const event = makeRefundEvent({
                        original_amount: amount,
                        refund_amount: amount,
                    });
                    const tx = makeMockTx({ orderExists: false });
                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: No order → rejected
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("ORDER_NOT_FOUND");
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: REFUND_ISSUED without payments → NO_PAYMENTS_TO_REFUND (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }),
                async (amount) => {
                    const event = makeRefundEvent({
                        original_amount: amount,
                        refund_amount: amount,
                    });
                    const tx = makeMockTx({ orderExists: true, paymentCount: 0 });
                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: No payments → rejected
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("NO_PAYMENTS_TO_REFUND");
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 4: Valid refund (amount <= original, order exists, has payments) passes (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }), // original
                fc.integer({ min: 0, max: 49999 }),    // reduction (ensures refund <= original)
                async (originalAmount, reduction) => {
                    const refundAmount = Math.max(1, originalAmount - reduction);
                    const event = makeRefundEvent({
                        original_amount: originalAmount,
                        refund_amount: refundAmount,
                    });
                    const tx = makeMockTx({ orderExists: true, paymentCount: 2 });
                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Valid refund → passes
                    expect(result.valid).toBe(true);
                }
            ),
            { numRuns: 200 }
        );
    });
});
