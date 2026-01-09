// src/core/conflict/__tests__/conflict-resolver.test.ts
// Property-Based Tests for Conflict Resolution

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import {
  detectAndResolveConflict,
  getResolutionStrategy,
  isValidStateTransition,
} from "../conflict-resolver";

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const uuidArb = fc.uuid();

const eventTypeArb = fc.oneof(
  fc.constant("ORDER_ITEM_ADDED"),
  fc.constant("ORDER_ITEM_QTY_CHANGED"),
  fc.constant("ORDER_ITEM_STATUS_CHANGED"),
  fc.constant("CHECK_PAYMENT_ADDED"),
  fc.constant("CHECK_MARKED_PAID"),
  fc.constant("CHECK_CREATED"),
  fc.constant("ORDER_CREATED")
);

const itemStatusArb = fc.oneof(
  fc.constant("PENDING"),
  fc.constant("COOKING"),
  fc.constant("READY"),
  fc.constant("DONE"),
  fc.constant("VOIDED")
);

const revisionArb = fc.integer({ min: 1, max: 1000 });

const baseEventArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  aggregate_type: fc.constant("ORDER"),
  aggregate_id: uuidArb,
  terminal_id: fc.string({ minLength: 5, maxLength: 20 }),
  occurred_at: fc.constant(new Date().toISOString()),
  schema_version: fc.constant(1),
  actor_id: uuidArb,
});

// ============================================================================
// Mock Transaction Client
// ============================================================================

function createMockTx() {
  const conflicts: any[] = [];
  return {
    // Usar conflict_logs (snake_case) para coincidir con schema.prisma
    conflict_logs: {
      create: vi.fn().mockImplementation(({ data }) => {
        conflicts.push(data);
        return Promise.resolve(data);
      }),
    },
    _conflicts: conflicts,
  };
}

// ============================================================================
// Property Tests
// ============================================================================

describe("Conflict Resolution Properties", () => {
  describe("Property 2: Conflict Detection Accuracy", () => {
    it("detects conflict when expected_revision differs from actual", async () => {
      await fc.assert(
        fc.asyncProperty(
          baseEventArb,
          eventTypeArb,
          revisionArb,
          revisionArb.filter((r) => r > 1),
          async (baseEvent, eventType, expectedRev, actualRev) => {
            // Ensure they differ
            const adjustedExpected = expectedRev;
            const adjustedActual = expectedRev === actualRev ? actualRev + 1 : actualRev;

            const event = {
              ...baseEvent,
              event_type: eventType,
              payload: { expected_revision: adjustedExpected },
            };

            const tx = createMockTx();
            const result = await detectAndResolveConflict(tx, event as any, adjustedActual);

            // Should detect conflict when revisions differ
            if (adjustedExpected !== adjustedActual) {
              expect(result.hasConflict).toBe(true);
              expect(result.conflict?.expected_revision).toBe(adjustedExpected);
              expect(result.conflict?.actual_revision).toBe(adjustedActual);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("does NOT detect conflict when revisions match", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, eventTypeArb, revisionArb, async (baseEvent, eventType, revision) => {
          const event = {
            ...baseEvent,
            event_type: eventType,
            payload: { expected_revision: revision },
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, revision);

          expect(result.hasConflict).toBe(false);
          expect(result.shouldApply).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("does NOT detect conflict when no expected_revision provided", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, eventTypeArb, revisionArb, async (baseEvent, eventType, revision) => {
          const event = {
            ...baseEvent,
            event_type: eventType,
            payload: {}, // No expected_revision
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, revision);

          // Backward compatibility: no revision check = no conflict
          expect(result.hasConflict).toBe(false);
          expect(result.shouldApply).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 3: Merge Preserves All Items (MERGE strategy)", () => {
    it("allows ORDER_ITEM_ADDED events even with revision conflict", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, revisionArb, async (baseEvent, expectedRev) => {
          const actualRev = expectedRev + 1; // Force conflict

          const event = {
            ...baseEvent,
            event_type: "ORDER_ITEM_ADDED",
            payload: {
              order_id: baseEvent.aggregate_id,
              expected_revision: expectedRev,
              line: { line_id: "test-line", product_id: "prod-1", qty: 1 },
            },
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, actualRev);

          // MERGE strategy: conflict detected but shouldApply = true
          expect(result.hasConflict).toBe(true);
          expect(result.shouldApply).toBe(true);
          expect(result.conflict?.resolution).toBe("MERGE");
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 5: Last-Write-Wins by Timestamp (LWW strategy)", () => {
    it("allows ORDER_ITEM_STATUS_CHANGED events with LWW resolution", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, revisionArb, itemStatusArb, async (baseEvent, expectedRev, toStatus) => {
          const actualRev = expectedRev + 1; // Force conflict

          const event = {
            ...baseEvent,
            event_type: "ORDER_ITEM_STATUS_CHANGED",
            payload: {
              order_id: baseEvent.aggregate_id,
              expected_revision: expectedRev,
              line_id: "test-line",
              from: "PENDING",
              to: toStatus,
            },
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, actualRev);

          // LWW strategy: conflict detected but shouldApply = true
          expect(result.hasConflict).toBe(true);
          expect(result.shouldApply).toBe(true);
          expect(result.conflict?.resolution).toBe("LWW");
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 7: Payment Conflict Rejection", () => {
    it("rejects CHECK_PAYMENT_ADDED events with revision conflict", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, revisionArb, async (baseEvent, expectedRev) => {
          const actualRev = expectedRev + 1; // Force conflict

          const event = {
            ...baseEvent,
            event_type: "CHECK_PAYMENT_ADDED",
            payload: {
              order_id: baseEvent.aggregate_id,
              expected_revision: expectedRev,
              check_id: "check-1",
              payment: { method: "CASH", amount_cents: 5000 },
            },
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, actualRev);

          // REJECT strategy: conflict detected and shouldApply = false
          expect(result.hasConflict).toBe(true);
          expect(result.shouldApply).toBe(false);
          expect(result.conflict?.resolution).toBe("REJECT");
          expect(result.conflict?.type).toBe("PAYMENT_CONFLICT");
        }),
        { numRuns: 100 }
      );
    });

    it("rejects CHECK_MARKED_PAID events with revision conflict", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, revisionArb, async (baseEvent, expectedRev) => {
          const actualRev = expectedRev + 1; // Force conflict

          const event = {
            ...baseEvent,
            event_type: "CHECK_MARKED_PAID",
            payload: {
              order_id: baseEvent.aggregate_id,
              expected_revision: expectedRev,
              check_id: "check-1",
            },
          };

          const tx = createMockTx();
          const result = await detectAndResolveConflict(tx, event as any, actualRev);

          // REJECT strategy for payment events
          expect(result.hasConflict).toBe(true);
          expect(result.shouldApply).toBe(false);
          expect(result.conflict?.resolution).toBe("REJECT");
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 8: Conflict Log Completeness", () => {
    it("logs all detected conflicts to conflict_log", async () => {
      await fc.assert(
        fc.asyncProperty(baseEventArb, eventTypeArb, revisionArb, async (baseEvent, eventType, expectedRev) => {
          const actualRev = expectedRev + 1; // Force conflict

          const event = {
            ...baseEvent,
            event_type: eventType,
            payload: { expected_revision: expectedRev },
          };

          const tx = createMockTx();
          await detectAndResolveConflict(tx, event as any, actualRev);

          // Should have logged the conflict
          expect(tx.conflict_logs.create).toHaveBeenCalled();
          expect(tx._conflicts.length).toBe(1);

          const logged = tx._conflicts[0];
          expect(logged.tenant_id).toBe(baseEvent.tenant_id);
          expect(logged.aggregate_id).toBe(baseEvent.aggregate_id);
          expect(logged.event_id).toBe(baseEvent.event_id);
          expect(logged.expected_revision).toBe(expectedRev);
          expect(logged.actual_revision).toBe(actualRev);
        }),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Unit Tests for Resolution Strategy
// ============================================================================

describe("getResolutionStrategy", () => {
  it("returns MERGE for ORDER_ITEM_ADDED", () => {
    expect(getResolutionStrategy("ORDER_ITEM_ADDED")).toBe("MERGE");
  });

  it("returns MERGE for ORDER_ITEM_QTY_CHANGED", () => {
    expect(getResolutionStrategy("ORDER_ITEM_QTY_CHANGED")).toBe("MERGE");
  });

  it("returns LWW for ORDER_ITEM_STATUS_CHANGED", () => {
    expect(getResolutionStrategy("ORDER_ITEM_STATUS_CHANGED")).toBe("LWW");
  });

  it("returns REJECT for CHECK_PAYMENT_ADDED", () => {
    expect(getResolutionStrategy("CHECK_PAYMENT_ADDED")).toBe("REJECT");
  });

  it("returns REJECT for CHECK_MARKED_PAID", () => {
    expect(getResolutionStrategy("CHECK_MARKED_PAID")).toBe("REJECT");
  });

  it("returns MERGE for CHECK_CREATED", () => {
    expect(getResolutionStrategy("CHECK_CREATED")).toBe("MERGE");
  });

  it("returns LWW for unknown event types", () => {
    expect(getResolutionStrategy("UNKNOWN_EVENT")).toBe("LWW");
  });
});

// ============================================================================
// Property 6: State Transition Validity
// ============================================================================

describe("State Transition Validity", () => {
  describe("isValidStateTransition", () => {
    it("allows valid forward transitions", () => {
      expect(isValidStateTransition("PENDING", "COOKING")).toBe(true);
      expect(isValidStateTransition("COOKING", "READY")).toBe(true);
      expect(isValidStateTransition("READY", "DONE")).toBe(true);
    });

    it("allows VOIDED from any state", () => {
      expect(isValidStateTransition("PENDING", "VOIDED")).toBe(true);
      expect(isValidStateTransition("COOKING", "VOIDED")).toBe(true);
      expect(isValidStateTransition("READY", "VOIDED")).toBe(true);
      expect(isValidStateTransition("DONE", "VOIDED")).toBe(true);
    });

    it("rejects backward transitions", () => {
      expect(isValidStateTransition("DONE", "PENDING")).toBe(false);
      expect(isValidStateTransition("DONE", "COOKING")).toBe(false);
      expect(isValidStateTransition("DONE", "READY")).toBe(false);
      expect(isValidStateTransition("READY", "PENDING")).toBe(false);
      expect(isValidStateTransition("READY", "COOKING")).toBe(false);
      expect(isValidStateTransition("COOKING", "PENDING")).toBe(false);
    });

    it("rejects transitions from VOIDED (terminal state)", () => {
      expect(isValidStateTransition("VOIDED", "PENDING")).toBe(false);
      expect(isValidStateTransition("VOIDED", "COOKING")).toBe(false);
      expect(isValidStateTransition("VOIDED", "READY")).toBe(false);
      expect(isValidStateTransition("VOIDED", "DONE")).toBe(false);
    });

    it("rejects skipping states", () => {
      expect(isValidStateTransition("PENDING", "READY")).toBe(false);
      expect(isValidStateTransition("PENDING", "DONE")).toBe(false);
      expect(isValidStateTransition("COOKING", "DONE")).toBe(false);
    });
  });

  it("property: no backward transitions allowed", () => {
    fc.assert(
      fc.property(itemStatusArb, itemStatusArb, (from, to) => {
        const stateOrder = ["PENDING", "COOKING", "READY", "DONE"];
        const fromIdx = stateOrder.indexOf(from);
        const toIdx = stateOrder.indexOf(to);

        // If going backward (excluding VOIDED), should be invalid
        if (fromIdx > toIdx && from !== "VOIDED" && to !== "VOIDED") {
          expect(isValidStateTransition(from, to)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
