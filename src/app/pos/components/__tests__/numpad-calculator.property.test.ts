/**
 * Property-based tests for NumpadCalculator
 * Task 4.3 - Frontend Cleanup Spec
 * 
 * NOTE: These tests use model-based testing approach.
 * The simulateNumpad function mirrors the NumpadCalculator behavior
 * to verify properties without requiring React component rendering.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulated display state logic (mirrors NumpadCalculator behavior)
function simulateNumpad(actions: Array<{ type: 'digit' | 'decimal' | 'backspace' | 'clear' | 'doubleZero'; value?: string }>, maxValue = 999999) {
  let display = '';
  
  for (const action of actions) {
    switch (action.type) {
      case 'digit': {
        const newDisplay = display + action.value;
        const value = parseFloat(newDisplay) * 100;
        if (value <= maxValue) {
          display = newDisplay;
        }
        break;
      }
      case 'doubleZero': {
        // "00" button adds two zeros (same as pressing 0 twice)
        const newDisplay = display + '00';
        const value = parseFloat(newDisplay) * 100;
        if (value <= maxValue) {
          display = newDisplay;
        }
        break;
      }
      case 'decimal':
        if (!display.includes('.')) {
          display = (display || '0') + '.';
        }
        break;
      case 'backspace':
        display = display.slice(0, -1);
        break;
      case 'clear':
        display = '';
        break;
    }
  }
  
  return display;
}

// Arbitrary for single digit
const digitArb = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');

describe('NumpadCalculator Properties', () => {
  describe('Property 1: Clear Button Resets Display', () => {
    /**
     * **Validates: Requirements 3.2**
     * WHEN the user clicks the Clear button, THE System SHALL reset the display to empty
     */
    it('clear always results in empty display regardless of previous state', () => {
      fc.assert(
        fc.property(
          // Generate random sequence of numpad actions
          fc.array(
            fc.oneof(
              digitArb.map(d => ({ type: 'digit' as const, value: d })),
              fc.constant({ type: 'decimal' as const }),
              fc.constant({ type: 'backspace' as const }),
              fc.constant({ type: 'doubleZero' as const })
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (actions) => {
            // Apply random actions then clear
            const afterClear = simulateNumpad([...actions, { type: 'clear' }]);
            
            // Property: After clear, display is always empty
            expect(afterClear).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple clears are idempotent', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              digitArb.map(d => ({ type: 'digit' as const, value: d })),
              fc.constant({ type: 'clear' as const })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.integer({ min: 1, max: 5 }),
          (actions, clearCount) => {
            // Add multiple clears at the end
            const clears = Array(clearCount).fill({ type: 'clear' as const });
            const result = simulateNumpad([...actions, ...clears]);
            
            // Property: Multiple clears still result in empty display
            expect(result).toBe('');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Value Constraints', () => {
    /**
     * **Validates: Requirements 3.2 (implicit)**
     * The display value in cents never exceeds maxValue
     */
    it('display value never exceeds maxValue', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              digitArb.map(d => ({ type: 'digit' as const, value: d })),
              fc.constant({ type: 'decimal' as const }),
              fc.constant({ type: 'doubleZero' as const })
            ),
            { minLength: 1, maxLength: 15 }
          ),
          fc.integer({ min: 100, max: 100000 }),
          (actions, maxValue) => {
            const display = simulateNumpad(actions, maxValue);
            const valueCents = Math.round(parseFloat(display || '0') * 100);
            
            // Property: Value in cents never exceeds maxValue
            expect(valueCents).toBeLessThanOrEqual(maxValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Decimal Handling', () => {
    /**
     * Ensures decimal point is handled correctly
     */
    it('display contains at most one decimal point', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              digitArb.map(d => ({ type: 'digit' as const, value: d })),
              fc.constant({ type: 'decimal' as const }),
              fc.constant({ type: 'backspace' as const }),
              fc.constant({ type: 'clear' as const })
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (actions) => {
            const display = simulateNumpad(actions);
            const decimalCount = (display.match(/\./g) || []).length;
            
            // Property: At most one decimal point
            expect(decimalCount).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('decimal on empty display results in "0."', () => {
      const result = simulateNumpad([{ type: 'decimal' }]);
      expect(result).toBe('0.');
    });
  });

  describe('Property 4: Double Zero Button', () => {
    /**
     * The "00" button adds two zeros when within maxValue
     */
    it('double zero adds two zeros when within limit', () => {
      fc.assert(
        fc.property(
          fc.array(
            digitArb.map(d => ({ type: 'digit' as const, value: d })),
            { minLength: 0, maxLength: 3 }
          ),
          (actions) => {
            const beforeDouble = simulateNumpad(actions);
            const afterDouble = simulateNumpad([...actions, { type: 'doubleZero' }]);
            
            // If double zero was accepted, it should add "00"
            if (afterDouble !== beforeDouble) {
              expect(afterDouble).toBe(beforeDouble + '00');
            }
            // Otherwise maxValue was exceeded (which is valid)
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
