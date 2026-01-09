/**
 * Property-Based Tests for Inventory Events
 * 
 * Property 4: PurchaseOrder Status Transitions
 * - Valid transitions follow the state machine
 * - Invalid transitions are rejected
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidPurchaseOrderTransition,
  PurchaseOrderStatusSchema,
  type PurchaseOrderStatus,
} from '../inventory-events';

const ALL_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"];

// Valid transitions according to state machine
const VALID_TRANSITIONS: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
  ["DRAFT", "SENT"],
  ["DRAFT", "CANCELLED"],
  ["SENT", "PARTIAL_RECEIVED"],
  ["SENT", "RECEIVED"],
  ["SENT", "CANCELLED"],
  ["PARTIAL_RECEIVED", "RECEIVED"],
  ["PARTIAL_RECEIVED", "CANCELLED"],
];

// Terminal states (no outgoing transitions)
const TERMINAL_STATES: PurchaseOrderStatus[] = ["RECEIVED", "CANCELLED"];

describe('PurchaseOrder Status Transitions - Property Tests', () => {
  
  // Property 4.1: All valid transitions are accepted
  it('should accept all valid transitions', () => {
    for (const [from, to] of VALID_TRANSITIONS) {
      expect(isValidPurchaseOrderTransition(from, to)).toBe(true);
    }
  });

  // Property 4.2: Terminal states have no outgoing transitions
  it('should reject transitions from terminal states', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TERMINAL_STATES),
        fc.constantFrom(...ALL_STATUSES),
        (from: PurchaseOrderStatus, to: PurchaseOrderStatus) => {
          return isValidPurchaseOrderTransition(from, to) === false;
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 4.3: Self-transitions are not allowed
  it('should reject self-transitions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        (status: PurchaseOrderStatus) => {
          return isValidPurchaseOrderTransition(status, status) === false;
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property 4.4: Backward transitions are not allowed (except to CANCELLED)
  it('should reject backward transitions except to CANCELLED', () => {
    const backwardTransitions: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
      ["SENT", "DRAFT"],
      ["PARTIAL_RECEIVED", "DRAFT"],
      ["PARTIAL_RECEIVED", "SENT"],
      ["RECEIVED", "DRAFT"],
      ["RECEIVED", "SENT"],
      ["RECEIVED", "PARTIAL_RECEIVED"],
    ];

    for (const [from, to] of backwardTransitions) {
      expect(isValidPurchaseOrderTransition(from, to)).toBe(false);
    }
  });

  // Property 4.5: CANCELLED can be reached from any non-terminal state
  it('should allow transition to CANCELLED from non-terminal states', () => {
    const nonTerminalStates: PurchaseOrderStatus[] = ["DRAFT", "SENT", "PARTIAL_RECEIVED"];
    
    for (const from of nonTerminalStates) {
      expect(isValidPurchaseOrderTransition(from, "CANCELLED")).toBe(true);
    }
  });

  // Property 4.6: Schema validates all status values
  it('should validate all status values with schema', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        (status: PurchaseOrderStatus) => {
          const result = PurchaseOrderStatusSchema.safeParse(status);
          return result.success === true;
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property 4.7: Schema rejects invalid status values
  it('should reject invalid status values', () => {
    const invalidStatuses = ["PENDING", "APPROVED", "SHIPPED", "COMPLETED", ""];
    
    for (const status of invalidStatuses) {
      const result = PurchaseOrderStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    }
  });

  // Property 4.8: Normal flow follows expected path
  it('should support normal purchase order flow', () => {
    // Normal flow: DRAFT -> SENT -> PARTIAL_RECEIVED -> RECEIVED
    expect(isValidPurchaseOrderTransition("DRAFT", "SENT")).toBe(true);
    expect(isValidPurchaseOrderTransition("SENT", "PARTIAL_RECEIVED")).toBe(true);
    expect(isValidPurchaseOrderTransition("PARTIAL_RECEIVED", "RECEIVED")).toBe(true);
    
    // Alternative flow: DRAFT -> SENT -> RECEIVED (full receipt)
    expect(isValidPurchaseOrderTransition("DRAFT", "SENT")).toBe(true);
    expect(isValidPurchaseOrderTransition("SENT", "RECEIVED")).toBe(true);
  });
});
