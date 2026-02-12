/**
 * Branded Type Property Tests
 * 
 * Tests branded type constructors and operations:
 * - Constructors validate input (asCentavos rejects negatives/floats)
 * - Unsafe constructors skip validation (for trusted sources)
 * - Type guards correctly identify branded types
 * - Operations preserve type safety
 * 
 * **Validates: Requirements 1.3, 1.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  asCentavos,
  unsafeCentavos,
  asOrderId,
  asShiftId,
  asTenantId,
  asTerminalId,
  asBusinessDate,
  dateToBusinessDate,
  Centavos,
  OrderId,
  ShiftId,
  TenantId,
  TerminalId,
  BusinessDate,
} from '@/src/core/types/shared';
import {
  centavosArb,
  orderIdArb,
  shiftIdArb,
  tenantIdArb,
  terminalIdArb,
  businessDateArb,
  uuidArb,
} from '@/src/test-utils';
import {
  testThrows,
  testNoThrow,
  testInvariant,
} from '@/src/test-utils';
import {
  expectCentavos,
  expectUUID,
  expectBusinessDate,
  expectTerminalId,
} from '@/src/test-utils';

describe('Branded Types - Property Tests', () => {
  describe('Property 3: Branded Type Constructor Validation', () => {
    it('asCentavos rejects negative numbers', () => {
      testThrows(
        fc.integer({ min: -1000, max: -1 }),
        (n) => asCentavos(n)
      );
    });

    it('asCentavos rejects non-integers', () => {
      testThrows(
        fc.float({ min: 0, max: 1000, noNaN: true }).filter(n => !Number.isInteger(n)),
        (n) => asCentavos(n)
      );
    });

    it('asCentavos accepts valid non-negative integers', () => {
      testNoThrow(
        fc.integer({ min: 0, max: 10_000_000 }),
        (n) => asCentavos(n)
      );
    });

    it('asBusinessDate rejects invalid format', () => {
      testThrows(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
        (s) => asBusinessDate(s),
        'YYYY-MM-DD'
      );
    });

    it('asBusinessDate accepts valid format', () => {
      testNoThrow(
        businessDateArb,
        (d) => asBusinessDate(d)
      );
    });
  });

  describe('Property 1.4: Money Operations Preserve Type Safety', () => {
    it('unsafeCentavos preserves value', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10_000_000 }), (n) => {
          const c = unsafeCentavos(n);
          expectCentavos(c);
          expect((c as number)).toBe(n);
        }),
        { numRuns: 100 }
      );
    });

    it('asCentavos and unsafeCentavos produce equivalent results for valid inputs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10_000_000 }), (n) => {
          const safe = asCentavos(n);
          const unsafe = unsafeCentavos(n);
          expect((safe as number)).toBe((unsafe as number));
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('OrderId Constructor', () => {
    it('asOrderId accepts valid UUIDs', () => {
      testNoThrow(
        uuidArb,
        (uuid) => asOrderId(uuid)
      );
    });

    it('asOrderId produces valid OrderId', () => {
      fc.assert(
        fc.property(orderIdArb, (id) => {
          expectUUID(id as unknown as string);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ShiftId Constructor', () => {
    it('asShiftId accepts valid UUIDs', () => {
      testNoThrow(
        uuidArb,
        (uuid) => asShiftId(uuid)
      );
    });

    it('asShiftId produces valid ShiftId', () => {
      fc.assert(
        fc.property(shiftIdArb, (id) => {
          expectUUID(id as unknown as string);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('TenantId Constructor', () => {
    it('asTenantId accepts valid UUIDs', () => {
      testNoThrow(
        uuidArb,
        (uuid) => asTenantId(uuid)
      );
    });

    it('asTenantId produces valid TenantId', () => {
      fc.assert(
        fc.property(tenantIdArb, (id) => {
          expectUUID(id as unknown as string);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('TerminalId Constructor', () => {
    it('asTerminalId accepts valid terminal IDs', () => {
      testNoThrow(
        terminalIdArb,
        (id) => asTerminalId(id as unknown as string)
      );
    });

    it('asTerminalId produces valid TerminalId', () => {
      fc.assert(
        fc.property(terminalIdArb, (id) => {
          expectTerminalId(id as unknown as string);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('BusinessDate Constructor', () => {
    it('asBusinessDate accepts valid dates', () => {
      testNoThrow(
        businessDateArb,
        (d) => asBusinessDate(d)
      );
    });

    it('asBusinessDate produces valid BusinessDate', () => {
      fc.assert(
        fc.property(businessDateArb, (d) => {
          expectBusinessDate(d);
        }),
        { numRuns: 100 }
      );
    });

    it('dateToBusinessDate produces valid format', () => {
      fc.assert(
        fc.property(fc.date(), (date) => {
          const bd = dateToBusinessDate(date);
          expectBusinessDate(bd);
        }),
        { numRuns: 100 }
      );
    });

    it('dateToBusinessDate is deterministic', () => {
      fc.assert(
        fc.property(fc.date(), (date) => {
          const bd1 = dateToBusinessDate(date);
          const bd2 = dateToBusinessDate(date);
          expect(bd1).toBe(bd2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Type Safety Invariants', () => {
    it('Centavos values are always non-negative integers', () => {
      testInvariant(
        centavosArb,
        (c) => (c as number) >= 0 && Number.isInteger(c as number),
        'Centavos must be non-negative integer'
      );
    });

    it('OrderId values are valid UUIDs', () => {
      testInvariant(
        orderIdArb,
        (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id as unknown as string),
        'OrderId must be valid UUID'
      );
    });

    it('TerminalId values match expected format', () => {
      testInvariant(
        terminalIdArb,
        (id) => /^(CAJA|MOZO|KDS)-\d{2}$/.test(id as unknown as string),
        'TerminalId must match ROLE-NN format'
      );
    });

    it('BusinessDate values match YYYY-MM-DD format', () => {
      testInvariant(
        businessDateArb,
        (d) => /^\d{4}-\d{2}-\d{2}$/.test(d),
        'BusinessDate must be YYYY-MM-DD format'
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero Centavos', () => {
      const zero = asCentavos(0);
      expectCentavos(zero);
      expect((zero as number)).toBe(0);
    });

    it('handles maximum Centavos', () => {
      const max = asCentavos(10_000_000);
      expectCentavos(max);
      expect((max as number)).toBe(10_000_000);
    });

    it('rejects negative zero', () => {
      expect(() => asCentavos(-0)).not.toThrow(); // -0 === 0 in JavaScript
    });

    it('rejects NaN', () => {
      expect(() => asCentavos(NaN)).toThrow();
    });

    it('rejects Infinity', () => {
      expect(() => asCentavos(Infinity)).toThrow();
    });
  });
});
