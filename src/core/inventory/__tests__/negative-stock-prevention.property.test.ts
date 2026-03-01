/**
 * Property-Based Tests: Negative Stock Prevention (Fase 3 - C3)
 *
 * Invariants:
 * 1. If allowNegative=false, stock is NEVER < 0 after deduction
 * 2. Deduction that would go negative throws INSUFFICIENT_STOCK and does NOT modify stock
 * 3. If allowNegative=true, stock CAN go negative (admin override)
 * 4. Deduction within available stock succeeds and decrements correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { Decimal } from "@prisma/client/runtime/library";

// Mock logger before imports
vi.mock("@/src/core/observability/logger", () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

import { deductInventoryForOrder } from "../deduction.service";

// ============================================================================
// Mock Prisma helpers
// ============================================================================

function makeMockPrisma(options: {
    hasRecipe: boolean;
    ingredients?: Array<{ code: string; quantity: number; is_optional?: boolean }>;
    inventoryStock?: Record<string, number>;
    inventoryMinStock?: Record<string, number | null>;
}) {
    const { hasRecipe, ingredients = [], inventoryStock = {}, inventoryMinStock = {} } = options;

    const createdLogs: any[] = [];
    const createdAlerts: any[] = [];
    const stockUpdates: any[] = [];

    const txMethods = {
        inventory: {
            findFirst: vi.fn().mockImplementation(({ where }: any) => {
                const code = where.code;
                if (inventoryStock[code] === undefined) return null;
                return {
                    id: `inv-${code}`,
                    stock: new Decimal(inventoryStock[code]),
                    min_stock: inventoryMinStock[code] !== undefined
                        ? new Decimal(inventoryMinStock[code]!)
                        : null,
                };
            }),
            update: vi.fn().mockImplementation(({ where, data }: any) => {
                // Simulate the decrement
                const code = Object.keys(inventoryStock).find(k => `inv-${k}` === where.id) || "";
                const current = inventoryStock[code] || 0;
                const decremented = data.stock?.decrement || 0;
                const newStock = current - decremented;
                stockUpdates.push({ code, decremented, newStock });
                return { id: where.id, stock: new Decimal(newStock) };
            }),
        },
        inventory_log: {
            create: vi.fn().mockImplementation(({ data }: any) => {
                createdLogs.push(data);
                return data;
            }),
        },
        stock_alerts: {
            create: vi.fn().mockImplementation(({ data }: any) => {
                createdAlerts.push(data);
                return data;
            }),
        },
    };

    const mockPrisma = {
        recipes: {
            findUnique: vi.fn().mockResolvedValue(
                hasRecipe
                    ? {
                        is_active: true,
                        ingredients: ingredients.map((i) => ({
                            inventory_code: i.code,
                            quantity: i.quantity,
                            unit: "g",
                            is_optional: i.is_optional || false,
                        })),
                    }
                    : null
            ),
        },
        $transaction: vi.fn().mockImplementation(async (fn: any) => {
            return fn(txMethods);
        }),
    };

    return { mockPrisma, txMethods, createdLogs, createdAlerts, stockUpdates };
}

// ============================================================================
// Property Tests
// ============================================================================

describe("Negative Stock Prevention Property Tests (C3)", () => {

    it("Invariant 1: deduction blocked when stock < needed and allowNegative=false (200 runs)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 100 }),   // quantity ordered
                fc.integer({ min: 1, max: 50 }),     // recipe ingredient qty per unit
                fc.integer({ min: 0, max: 49 }),     // current stock (always less than needed)
                async (orderQty, ingredientQty, currentStock) => {
                    const needed = orderQty * ingredientQty;
                    // Ensure stock is less than needed
                    const stock = Math.min(currentStock, needed - 1);

                    const { mockPrisma } = makeMockPrisma({
                        hasRecipe: true,
                        ingredients: [{ code: "ING001", quantity: ingredientQty }],
                        inventoryStock: { ING001: stock },
                    });

                    const result = await deductInventoryForOrder(
                        mockPrisma as any,
                        uuidv4(), "loc-1", uuidv4(), uuidv4(), uuidv4(),
                        orderQty,
                        false // allowNegative = false
                    );

                    // INVARIANT: Deduction should fail
                    expect(result.success).toBe(false);
                    expect(result.error).toContain("INSUFFICIENT_STOCK");
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: deduction succeeds when stock >= needed (200 runs)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),    // quantity ordered
                fc.integer({ min: 1, max: 10 }),    // recipe ingredient qty per unit
                fc.integer({ min: 0, max: 1000 }),  // extra stock above needed
                async (orderQty, ingredientQty, extraStock) => {
                    const needed = orderQty * ingredientQty;
                    const stock = needed + extraStock;

                    const { mockPrisma, stockUpdates } = makeMockPrisma({
                        hasRecipe: true,
                        ingredients: [{ code: "ING001", quantity: ingredientQty }],
                        inventoryStock: { ING001: stock },
                    });

                    const result = await deductInventoryForOrder(
                        mockPrisma as any,
                        uuidv4(), "loc-1", uuidv4(), uuidv4(), uuidv4(),
                        orderQty,
                        false
                    );

                    // INVARIANT: Deduction should succeed
                    expect(result.success).toBe(true);
                    // Stock after deduction should be >= 0
                    if (stockUpdates.length > 0) {
                        expect(stockUpdates[0].newStock).toBeGreaterThanOrEqual(0);
                        expect(stockUpdates[0].newStock).toBe(stock - needed);
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: allowNegative=true permits negative stock (100 runs)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),
                fc.integer({ min: 1, max: 10 }),
                async (orderQty, ingredientQty) => {
                    const needed = orderQty * ingredientQty;
                    const stock = Math.max(0, needed - 5); // Intentionally less than needed

                    const { mockPrisma } = makeMockPrisma({
                        hasRecipe: true,
                        ingredients: [{ code: "ING001", quantity: ingredientQty }],
                        inventoryStock: { ING001: stock },
                    });

                    const result = await deductInventoryForOrder(
                        mockPrisma as any,
                        uuidv4(), "loc-1", uuidv4(), uuidv4(), uuidv4(),
                        orderQty,
                        true // allowNegative = true (admin override)
                    );

                    // INVARIANT: Should succeed even with insufficient stock
                    expect(result.success).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 4: failed deduction does NOT modify stock (transaction rollback) (100 runs)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 2, max: 20 }),
                fc.integer({ min: 2, max: 10 }),
                async (orderQty, ingredientQty) => {
                    const needed = orderQty * ingredientQty;
                    const stock = 0; // Definitely insufficient

                    const { mockPrisma, txMethods } = makeMockPrisma({
                        hasRecipe: true,
                        ingredients: [{ code: "ING001", quantity: ingredientQty }],
                        inventoryStock: { ING001: stock },
                    });

                    // Override $transaction to simulate rollback on throw
                    (mockPrisma as any).$transaction = vi.fn().mockImplementation(async (fn: any) => {
                        try {
                            return await fn(txMethods);
                        } catch (error) {
                            // Transaction rolled back — stock.update should NOT persist
                            throw error;
                        }
                    });

                    const result = await deductInventoryForOrder(
                        mockPrisma as any,
                        uuidv4(), "loc-1", uuidv4(), uuidv4(), uuidv4(),
                        orderQty,
                        false
                    );

                    // INVARIANT: Failed deduction means no stock updates persisted
                    expect(result.success).toBe(false);
                    // The inventory.update should NOT have been called (throw happens before)
                    expect(txMethods.inventory.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 5: no recipe = no deduction = no stock change (100 runs)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 100 }),
                async (orderQty) => {
                    const { mockPrisma, stockUpdates } = makeMockPrisma({
                        hasRecipe: false,
                        inventoryStock: { ING001: 50 },
                    });

                    const result = await deductInventoryForOrder(
                        mockPrisma as any,
                        uuidv4(), "loc-1", uuidv4(), uuidv4(), uuidv4(),
                        orderQty,
                        false
                    );

                    // INVARIANT: No recipe = success with no deductions
                    expect(result.success).toBe(true);
                    expect(result.deductions).toHaveLength(0);
                    expect(stockUpdates).toHaveLength(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});
