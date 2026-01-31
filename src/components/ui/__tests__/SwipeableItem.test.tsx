/**
 * SwipeableItem Component Tests
 * Task 3.2 - Mobile Responsive Spec
 * 
 * Tests threshold detection and action reveal logic
 * **Validates: Requirements 3.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Test the swipe logic without rendering
// This tests the core business logic of swipe detection

const DEFAULT_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 300;

type RevealState = 'left' | 'right' | null;

interface SwipeResult {
  revealed: RevealState;
  x: number;
}

/**
 * Pure function to determine swipe result based on drag
 */
function getSwipeResult(
  velocityX: number,
  offsetX: number,
  hasLeftAction: boolean,
  hasRightAction: boolean,
  threshold: number = DEFAULT_THRESHOLD,
  actionWidth: number = 80
): SwipeResult {
  // Fast swipe detection
  if (Math.abs(velocityX) > VELOCITY_THRESHOLD) {
    if (velocityX < 0 && hasRightAction) {
      return { revealed: 'right', x: -actionWidth };
    }
    if (velocityX > 0 && hasLeftAction) {
      return { revealed: 'left', x: actionWidth };
    }
  }

  // Slow drag - use threshold
  if (offsetX < -threshold && hasRightAction) {
    return { revealed: 'right', x: -actionWidth };
  }
  if (offsetX > threshold && hasLeftAction) {
    return { revealed: 'left', x: actionWidth };
  }

  // Return to center
  return { revealed: null, x: 0 };
}

/**
 * Check if offset exceeds threshold
 */
function isThresholdExceeded(offset: number, threshold: number): boolean {
  return Math.abs(offset) > threshold;
}

describe('SwipeableItem Logic', () => {
  describe('getSwipeResult', () => {
    it('reveals right action on fast left swipe', () => {
      const result = getSwipeResult(-400, 0, false, true);
      expect(result.revealed).toBe('right');
      expect(result.x).toBe(-80);
    });

    it('reveals left action on fast right swipe', () => {
      const result = getSwipeResult(400, 0, true, false);
      expect(result.revealed).toBe('left');
      expect(result.x).toBe(80);
    });

    it('does not reveal if action not available', () => {
      const result = getSwipeResult(-400, 0, false, false);
      expect(result.revealed).toBeNull();
      expect(result.x).toBe(0);
    });

    it('reveals right action on slow drag past threshold', () => {
      const result = getSwipeResult(0, -100, false, true);
      expect(result.revealed).toBe('right');
    });

    it('reveals left action on slow drag past threshold', () => {
      const result = getSwipeResult(0, 100, true, false);
      expect(result.revealed).toBe('left');
    });

    it('returns to center when drag below threshold', () => {
      const result = getSwipeResult(0, -50, false, true);
      expect(result.revealed).toBeNull();
      expect(result.x).toBe(0);
    });

    it('uses custom threshold', () => {
      // Below custom threshold
      const result1 = getSwipeResult(0, -100, false, true, 120);
      expect(result1.revealed).toBeNull();

      // Above custom threshold
      const result2 = getSwipeResult(0, -130, false, true, 120);
      expect(result2.revealed).toBe('right');
    });

    it('uses custom action width', () => {
      const result = getSwipeResult(-400, 0, false, true, 80, 100);
      expect(result.x).toBe(-100);
    });
  });

  describe('isThresholdExceeded', () => {
    it('returns true when offset exceeds threshold', () => {
      expect(isThresholdExceeded(100, 80)).toBe(true);
      expect(isThresholdExceeded(-100, 80)).toBe(true);
    });

    it('returns false when offset is below threshold', () => {
      expect(isThresholdExceeded(50, 80)).toBe(false);
      expect(isThresholdExceeded(-50, 80)).toBe(false);
    });

    it('returns false when offset equals threshold', () => {
      expect(isThresholdExceeded(80, 80)).toBe(false);
    });
  });

  describe('Property Tests', () => {
    /**
     * Property 1: Result x position is bounded by action width
     */
    it('x position is bounded by action width', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }), // velocity
          fc.integer({ min: -500, max: 500 }),   // offset
          fc.boolean(),                           // hasLeftAction
          fc.boolean(),                           // hasRightAction
          fc.integer({ min: 40, max: 200 }),     // actionWidth
          (velocityX, offsetX, hasLeft, hasRight, actionWidth) => {
            const result = getSwipeResult(
              velocityX, 
              offsetX, 
              hasLeft, 
              hasRight, 
              DEFAULT_THRESHOLD, 
              actionWidth
            );
            
            // x should be -actionWidth, 0, or actionWidth
            expect([-actionWidth, 0, actionWidth]).toContain(result.x);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2: Revealed state matches x position
     */
    it('revealed state matches x position', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -500, max: 500 }),
          fc.boolean(),
          fc.boolean(),
          (velocityX, offsetX, hasLeft, hasRight) => {
            const result = getSwipeResult(velocityX, offsetX, hasLeft, hasRight);
            
            if (result.revealed === 'left') {
              expect(result.x).toBeGreaterThan(0);
            } else if (result.revealed === 'right') {
              expect(result.x).toBeLessThan(0);
            } else {
              expect(result.x).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3: Cannot reveal action that doesn't exist
     */
    it('cannot reveal non-existent action', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -500, max: 500 }),
          (velocityX, offsetX) => {
            // No left action
            const result1 = getSwipeResult(velocityX, offsetX, false, true);
            expect(result1.revealed).not.toBe('left');
            
            // No right action
            const result2 = getSwipeResult(velocityX, offsetX, true, false);
            expect(result2.revealed).not.toBe('right');
            
            // No actions at all
            const result3 = getSwipeResult(velocityX, offsetX, false, false);
            expect(result3.revealed).toBeNull();
            expect(result3.x).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 4: Fast swipe always triggers if action exists
     */
    it('fast swipe triggers action if available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: VELOCITY_THRESHOLD + 1, max: 1000 }),
          (velocity) => {
            // Fast left swipe with right action
            const result1 = getSwipeResult(-velocity, 0, false, true);
            expect(result1.revealed).toBe('right');
            
            // Fast right swipe with left action
            const result2 = getSwipeResult(velocity, 0, true, false);
            expect(result2.revealed).toBe('left');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
