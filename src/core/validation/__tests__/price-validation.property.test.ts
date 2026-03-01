/**
 * Property-Based Tests: Server-Side Price Validation (Fase 4 - C4)
 *
 * Invariants:
 * 1. ORDER_ITEM_ADDED with mismatched price is rejected with PRICE_MISMATCH
 * 2. ORDER_ITEM_ADDED with matching price passes price validation
 * 3. No product (no product_id) skips price validation
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";

function makeMockTx(options: {
    hasOpenShift?: boolean;
    hasRange?: boolean;
    productPriceCents?: number | null;
    productActive?: boolean;
    productExists?: boolean;
    orderItemCount?: number;
}) {
    const {
        hasOpenShift = true,
        hasRange = true,
        productPriceCents = 5000,
        productActive = true,
        productExists = true,
        orderItemCount = 0,
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
        products: {
            findFirst: vi.fn().mockResolvedValue(
                productExists
                    ? { id: uuidv4(), is_active: productActive, price_cents: productPriceCents }
                    : null
            ),
        },
        orders: {
            findUnique: vi.fn().mockResolvedValue({
                id: uuidv4(),
                items: Array(orderItemCount).fill({}),
                checks: [],
                order_status: "OPEN",
            }),
        },
        employees: {
            findUnique: vi.fn().mockResolvedValue({ role: "MANAGER", is_active: true }),
        },
    } as any;
}

function makeOrderItemAddedEvent(overrides?: Record<string, unknown>) {
    const order_id = uuidv4();
    const product_id = uuidv4();
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
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
        event_type: "ORDER_ITEM_ADDED" as const,
        payload: {
            order_id,
            line: {
                line_id: uuidv4(),
                product_id,
                sku: "SKU001",
                name: "Test Product",
                qty: 1,
                unit_price_cents: 5000,
                station: "COCINA",
                status: "PENDING",
                mods: [],
                ...overrides,
            },
        },
    };
}

async function getValidateEvent() {
    const mod = await import("@/src/core/validation/business-rules");
    return mod.validateEvent;
}

describe("Price Validation Property Tests (C4)", () => {

    it("Invariant 1: ORDER_ITEM_ADDED with mismatched price is rejected (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 100000 }),  // catalog price
                fc.integer({ min: 1, max: 99999 }),    // offset to make different
                async (catalogPrice, offset) => {
                    // Ensure client price differs from catalog
                    const clientPrice = catalogPrice + (offset === 0 ? 1 : offset);
                    if (clientPrice === catalogPrice) return; // Skip rare edge case

                    const event = makeOrderItemAddedEvent({
                        unit_price_cents: clientPrice,
                    });

                    const tx = makeMockTx({ productPriceCents: catalogPrice });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Must reject with PRICE_MISMATCH
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("PRICE_MISMATCH");
                    expect(result.details?.catalog_price_cents).toBe(catalogPrice);
                    expect(result.details?.client_price_cents).toBe(clientPrice);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: ORDER_ITEM_ADDED with matching price passes (200 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 100000 }),
                async (price) => {
                    const event = makeOrderItemAddedEvent({
                        unit_price_cents: price,
                    });

                    const tx = makeMockTx({ productPriceCents: price });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Matching prices should pass
                    expect(result.valid).toBe(true);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: product without price_cents skips price validation (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 100000 }),
                async (clientPrice) => {
                    const event = makeOrderItemAddedEvent({
                        unit_price_cents: clientPrice,
                    });

                    // Product exists but has no price_cents (null)
                    const tx = makeMockTx({ productPriceCents: null });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Should pass (no catalog price to compare against)
                    expect(result.valid).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 4: price tampering detected for any payment method product (100 runs)", async () => {
        const validateEvent = await getValidateEvent();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 50000 }),
                fc.constantFrom(1, -1, 50, -50, 100, -100), // common tampering offsets
                async (catalogPrice, tampering) => {
                    const clientPrice = catalogPrice + tampering;
                    if (clientPrice <= 0 || clientPrice === catalogPrice) return;

                    const event = makeOrderItemAddedEvent({
                        unit_price_cents: clientPrice,
                    });

                    const tx = makeMockTx({ productPriceCents: catalogPrice });

                    const result = await validateEvent(tx, event as any);

                    // INVARIANT: Any price deviation is detected
                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("PRICE_MISMATCH");
                }
            ),
            { numRuns: 100 }
        );
    });
});
