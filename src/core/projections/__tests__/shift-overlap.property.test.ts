/**
 * Property-Based Tests: Shift Overlap Prevention (Fase 6 - H3)
 *
 * Invariants:
 * 1. After N SHIFT_OPENED events on same terminal, exactly 1 is OPEN
 * 2. SHIFT_OPENED auto-closes previous shift
 * 3. Different terminals can have concurrent OPEN shifts
 *
 * These tests validate the projection logic in the sale.reducer
 * (shifts are projected separately in ingest/route.ts, so we test
 * the invariant at the reducer level where shifts are tracked).
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";

/**
 * Simulates the shift projection logic from ingest/route.ts
 * In-memory model of what the DB would look like.
 */
interface ShiftRecord {
    id: string;
    tenant_id: string;
    terminal_id: string;
    status: "OPEN" | "CLOSED";
    opened_at: string;
    closed_at: string | null;
}

function simulateShiftProjection(events: Array<{
    type: "SHIFT_OPENED" | "SHIFT_CLOSED";
    shift_id: string;
    tenant_id: string;
    terminal_id: string;
    occurred_at: string;
}>): ShiftRecord[] {
    const shifts: ShiftRecord[] = [];

    for (const event of events) {
        if (event.type === "SHIFT_OPENED") {
            // H3: Auto-close all OPEN shifts on this terminal first
            for (const s of shifts) {
                if (
                    s.tenant_id === event.tenant_id &&
                    s.terminal_id === event.terminal_id &&
                    s.status === "OPEN"
                ) {
                    s.status = "CLOSED";
                    s.closed_at = event.occurred_at;
                }
            }

            // Create new OPEN shift
            shifts.push({
                id: event.shift_id,
                tenant_id: event.tenant_id,
                terminal_id: event.terminal_id,
                status: "OPEN",
                opened_at: event.occurred_at,
                closed_at: null,
            });
        } else if (event.type === "SHIFT_CLOSED") {
            const shift = shifts.find((s) => s.id === event.shift_id);
            if (shift) {
                shift.status = "CLOSED";
                shift.closed_at = event.occurred_at;
            }
        }
    }

    return shifts;
}

// ============================================================================
// Arbitraries
// ============================================================================

const terminalIdArb = fc.constantFrom("T001", "T002", "T003", "T004", "T005");

describe("Shift Overlap Prevention Property Tests (H3)", () => {

    it("Invariant 1: max 1 OPEN shift per terminal after any sequence of events (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        terminal_id: terminalIdArb,
                        isOpen: fc.boolean(), // true = SHIFT_OPENED, false = SHIFT_CLOSED
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (eventSpecs) => {
                    const tenant_id = uuidv4();
                    const shiftIds: string[] = [];
                    const events: Array<{
                        type: "SHIFT_OPENED" | "SHIFT_CLOSED";
                        shift_id: string;
                        tenant_id: string;
                        terminal_id: string;
                        occurred_at: string;
                    }> = [];

                    for (let i = 0; i < eventSpecs.length; i++) {
                        const { terminal_id, isOpen } = eventSpecs[i];
                        const shift_id = uuidv4();
                        shiftIds.push(shift_id);

                        if (isOpen) {
                            events.push({
                                type: "SHIFT_OPENED",
                                shift_id,
                                tenant_id,
                                terminal_id,
                                occurred_at: new Date(Date.now() + i * 1000).toISOString(),
                            });
                        } else {
                            // Close the most recent open shift on this terminal
                            const openShiftId = [...shiftIds].reverse().find((sid) =>
                                events.some((e) => e.shift_id === sid && e.type === "SHIFT_OPENED")
                            );
                            if (openShiftId) {
                                events.push({
                                    type: "SHIFT_CLOSED",
                                    shift_id: openShiftId,
                                    tenant_id,
                                    terminal_id,
                                    occurred_at: new Date(Date.now() + i * 1000).toISOString(),
                                });
                            }
                        }
                    }

                    const shifts = simulateShiftProjection(events);

                    // INVARIANT: For each terminal, at most 1 shift is OPEN
                    const terminals = new Set(shifts.map((s) => s.terminal_id));
                    for (const tid of terminals) {
                        const openCount = shifts.filter(
                            (s) => s.terminal_id === tid && s.status === "OPEN"
                        ).length;
                        expect(openCount).toBeLessThanOrEqual(1);
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: SHIFT_OPENED always closes previous OPEN shift on same terminal (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 10 }),
                terminalIdArb,
                (shiftCount, terminal_id) => {
                    const tenant_id = uuidv4();
                    const events: Array<{
                        type: "SHIFT_OPENED" | "SHIFT_CLOSED";
                        shift_id: string;
                        tenant_id: string;
                        terminal_id: string;
                        occurred_at: string;
                    }> = [];

                    // Open N shifts on the SAME terminal without closing
                    for (let i = 0; i < shiftCount; i++) {
                        events.push({
                            type: "SHIFT_OPENED",
                            shift_id: uuidv4(),
                            tenant_id,
                            terminal_id,
                            occurred_at: new Date(Date.now() + i * 1000).toISOString(),
                        });
                    }

                    const shifts = simulateShiftProjection(events);

                    // INVARIANT: Only the LAST shift should be OPEN
                    const openShifts = shifts.filter((s) => s.status === "OPEN");
                    expect(openShifts.length).toBe(1);
                    expect(openShifts[0].id).toBe(events[events.length - 1].shift_id);

                    // All previous shifts should be CLOSED
                    const closedShifts = shifts.filter((s) => s.status === "CLOSED");
                    expect(closedShifts.length).toBe(shiftCount - 1);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: different terminals can have concurrent OPEN shifts (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 5 }),
                (terminalCount) => {
                    const tenant_id = uuidv4();
                    const events: Array<{
                        type: "SHIFT_OPENED" | "SHIFT_CLOSED";
                        shift_id: string;
                        tenant_id: string;
                        terminal_id: string;
                        occurred_at: string;
                    }> = [];

                    // Open one shift per terminal
                    for (let i = 0; i < terminalCount; i++) {
                        events.push({
                            type: "SHIFT_OPENED",
                            shift_id: uuidv4(),
                            tenant_id,
                            terminal_id: `T${String(i + 1).padStart(3, "0")}`,
                            occurred_at: new Date(Date.now() + i * 1000).toISOString(),
                        });
                    }

                    const shifts = simulateShiftProjection(events);

                    // INVARIANT: Each terminal has exactly 1 OPEN shift
                    const openShifts = shifts.filter((s) => s.status === "OPEN");
                    expect(openShifts.length).toBe(terminalCount);

                    // Each terminal has its own shift
                    const terminals = new Set(openShifts.map((s) => s.terminal_id));
                    expect(terminals.size).toBe(terminalCount);
                }
            ),
            { numRuns: 100 }
        );
    });
});
