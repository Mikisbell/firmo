/**
 * Unit Tests: Reservation State Machine
 *
 * Tests every valid and invalid state transition, terminal states,
 * action-to-status mapping, and confirmation code generation.
 *
 * Covers scenarios: S14-S16 (cancel), S21-S24 (admin actions),
 * S25-S26 (confirmation code generation/collision)
 */

import { describe, it, expect } from "vitest";
import {
    VALID_TRANSITIONS,
    TERMINAL_STATES,
    ACTION_TO_STATUS,
    CONFIRMATION_CODE_CHARS,
    CONFIRMATION_CODE_LENGTH,
    type ReservationStatus,
} from "../reservation.schema";
import {
    validateStateTransition,
    actionToStatus,
    generateConfirmationCode,
} from "../reservation.service";

// ============================================================================
// State Transition Tests
// ============================================================================

describe("State Machine: Valid Transitions", () => {
    const validCases: Array<{ from: ReservationStatus; to: ReservationStatus }> = [
        // PENDING transitions
        { from: "PENDING", to: "CONFIRMED" },
        { from: "PENDING", to: "REJECTED" },
        { from: "PENDING", to: "CANCELLED" },
        // CONFIRMED transitions
        { from: "CONFIRMED", to: "ARRIVED" },
        { from: "CONFIRMED", to: "NO_SHOW" },
        { from: "CONFIRMED", to: "CANCELLED" },
        // ARRIVED transitions
        { from: "ARRIVED", to: "SEATED" },
        // SEATED transitions
        { from: "SEATED", to: "COMPLETED" },
    ];

    for (const { from, to } of validCases) {
        it(`allows transition ${from} -> ${to}`, () => {
            const result = validateStateTransition(from, to);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(true);
            }
        });
    }
});

describe("State Machine: Invalid Transitions", () => {
    const allStatuses: ReservationStatus[] = [
        "PENDING", "CONFIRMED", "REJECTED", "CANCELLED",
        "ARRIVED", "SEATED", "NO_SHOW", "COMPLETED",
    ];

    // Test every transition that is NOT in VALID_TRANSITIONS
    for (const from of allStatuses) {
        const validTargets = VALID_TRANSITIONS[from];
        const invalidTargets = allStatuses.filter((s) => !validTargets.includes(s));

        for (const to of invalidTargets) {
            it(`rejects transition ${from} -> ${to}`, () => {
                const result = validateStateTransition(from, to);
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain(from);
                    expect(result.error.message).toContain(to);
                }
            });
        }
    }
});

describe("State Machine: Terminal States", () => {
    const allStatuses: ReservationStatus[] = [
        "PENDING", "CONFIRMED", "REJECTED", "CANCELLED",
        "ARRIVED", "SEATED", "NO_SHOW", "COMPLETED",
    ];

    for (const terminalState of TERMINAL_STATES) {
        it(`${terminalState} cannot transition to any other state`, () => {
            for (const target of allStatuses) {
                if (target === terminalState) continue;
                const result = validateStateTransition(terminalState, target);
                expect(result.success).toBe(false);
            }
        });
    }

    it("TERMINAL_STATES contains REJECTED, CANCELLED, NO_SHOW, COMPLETED", () => {
        expect(TERMINAL_STATES).toContain("REJECTED");
        expect(TERMINAL_STATES).toContain("CANCELLED");
        expect(TERMINAL_STATES).toContain("NO_SHOW");
        expect(TERMINAL_STATES).toContain("COMPLETED");
        expect(TERMINAL_STATES).toHaveLength(4);
    });
});

// ============================================================================
// Action-to-Status Mapping
// ============================================================================

describe("actionToStatus", () => {
    it("maps confirm to CONFIRMED", () => {
        expect(actionToStatus("confirm")).toBe("CONFIRMED");
    });

    it("maps reject to REJECTED", () => {
        expect(actionToStatus("reject")).toBe("REJECTED");
    });

    it("maps arrive to ARRIVED", () => {
        expect(actionToStatus("arrive")).toBe("ARRIVED");
    });

    it("maps seat to SEATED", () => {
        expect(actionToStatus("seat")).toBe("SEATED");
    });

    it("maps no_show to NO_SHOW", () => {
        expect(actionToStatus("no_show")).toBe("NO_SHOW");
    });

    it("maps cancel to CANCELLED", () => {
        expect(actionToStatus("cancel")).toBe("CANCELLED");
    });

    it("covers all entries in ACTION_TO_STATUS", () => {
        const actions = Object.keys(ACTION_TO_STATUS) as Array<keyof typeof ACTION_TO_STATUS>;
        for (const action of actions) {
            expect(actionToStatus(action)).toBe(ACTION_TO_STATUS[action]);
        }
    });
});

// ============================================================================
// Confirmation Code Generation
// ============================================================================

describe("generateConfirmationCode", () => {
    it("generates a code of CONFIRMATION_CODE_LENGTH characters", () => {
        const code = generateConfirmationCode();
        expect(code).toHaveLength(CONFIRMATION_CODE_LENGTH);
    });

    it("generates codes using only allowed characters", () => {
        // Run multiple times to increase confidence
        for (let i = 0; i < 50; i++) {
            const code = generateConfirmationCode();
            for (const char of code) {
                expect(CONFIRMATION_CODE_CHARS).toContain(char);
            }
        }
    });

    it("does not generate codes with ambiguous characters (0, O, 1, I, L)", () => {
        const ambiguous = ["0", "O", "1", "I", "L"];
        for (let i = 0; i < 100; i++) {
            const code = generateConfirmationCode();
            for (const char of ambiguous) {
                expect(code).not.toContain(char);
            }
        }
    });

    it("generates different codes (not deterministic)", () => {
        const codes = new Set<string>();
        for (let i = 0; i < 20; i++) {
            codes.add(generateConfirmationCode());
        }
        // With 30^6 possible codes, 20 should be unique
        expect(codes.size).toBeGreaterThan(1);
    });

    it("generates only uppercase alphanumeric codes", () => {
        for (let i = 0; i < 50; i++) {
            const code = generateConfirmationCode();
            expect(code).toMatch(/^[A-Z2-9]+$/);
        }
    });
});

// ============================================================================
// Combined: Admin action flow validation
// ============================================================================

describe("Admin Action Flow: Full Lifecycle", () => {
    it("supports the happy path: PENDING -> CONFIRMED -> ARRIVED -> SEATED -> COMPLETED", () => {
        const lifecycle: Array<{ action: keyof typeof ACTION_TO_STATUS; from: ReservationStatus }> = [
            { action: "confirm", from: "PENDING" },
            { action: "arrive", from: "CONFIRMED" },
            { action: "seat", from: "ARRIVED" },
        ];

        let currentStatus: ReservationStatus = "PENDING";

        for (const { action, from } of lifecycle) {
            expect(currentStatus).toBe(from);
            const targetStatus = actionToStatus(action);
            const result = validateStateTransition(currentStatus, targetStatus);
            expect(result.success).toBe(true);
            currentStatus = targetStatus;
        }

        // Final transition: SEATED -> COMPLETED (no action, system-driven)
        const completedResult = validateStateTransition(currentStatus, "COMPLETED");
        expect(completedResult.success).toBe(true);
    });

    it("supports PENDING -> REJECTED path", () => {
        const result = validateStateTransition("PENDING", actionToStatus("reject"));
        expect(result.success).toBe(true);
    });

    it("supports CONFIRMED -> NO_SHOW path", () => {
        const result = validateStateTransition("CONFIRMED", actionToStatus("no_show"));
        expect(result.success).toBe(true);
    });

    it("supports cancellation from PENDING", () => {
        const result = validateStateTransition("PENDING", actionToStatus("cancel"));
        expect(result.success).toBe(true);
    });

    it("supports cancellation from CONFIRMED", () => {
        const result = validateStateTransition("CONFIRMED", actionToStatus("cancel"));
        expect(result.success).toBe(true);
    });

    it("rejects cancellation from SEATED (not cancellable)", () => {
        const result = validateStateTransition("SEATED", actionToStatus("cancel"));
        expect(result.success).toBe(false);
    });

    it("rejects cancellation from NO_SHOW (terminal)", () => {
        const result = validateStateTransition("NO_SHOW", actionToStatus("cancel"));
        expect(result.success).toBe(false);
    });

    it("rejects confirmation of already CANCELLED reservation", () => {
        const result = validateStateTransition("CANCELLED", actionToStatus("confirm"));
        expect(result.success).toBe(false);
    });
});
