/**
 * Domain Arbitraries - fast-check generators for core domain types
 * 
 * These arbitraries generate random values for property-based testing.
 * They ensure generated values are valid according to domain rules.
 */

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

/**
 * Generates valid Centavos values (non-negative integers)
 * Range: 0 to 10,000,000 (S/100,000.00)
 */
export const centavosArb = fc
  .integer({ min: 0, max: 10_000_000 })
  .map(unsafeCentavos);

/**
 * Generates small Centavos values for testing precision
 * Range: 0 to 10,000 (S/100.00)
 */
export const smallCentavosArb = fc
  .integer({ min: 0, max: 10_000 })
  .map(unsafeCentavos);

/**
 * Generates positive Centavos values (> 0)
 * Range: 1 to 10,000,000
 */
export const positiveCentavosArb = fc
  .integer({ min: 1, max: 10_000_000 })
  .map(unsafeCentavos);

/**
 * Generates OrderId values (UUIDs)
 */
export const orderIdArb = fc.uuid().map(asOrderId);

/**
 * Generates ShiftId values (UUIDs)
 */
export const shiftIdArb = fc.uuid().map(asShiftId);

/**
 * Generates TenantId values (UUIDs)
 */
export const tenantIdArb = fc.uuid().map(asTenantId);

/**
 * Generates TerminalId values
 * Format: ROLE-NUMBER (e.g., "CAJA-01", "MOZO-05", "KDS-03")
 */
export const terminalIdArb = fc
  .tuple(
    fc.constantFrom('CAJA', 'MOZO', 'KDS'),
    fc.integer({ min: 1, max: 99 })
  )
  .map(([role, num]) => asTerminalId(`${role}-${String(num).padStart(2, '0')}`));

/**
 * Generates BusinessDate values (YYYY-MM-DD format)
 * Range: 2024-01-01 to 2026-12-31
 */
export const businessDateArb = fc
  .date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
  .map(dateToBusinessDate);

/**
 * Generates PaymentMethod values
 */
export const paymentMethodArb = fc.constantFrom(
  'CASH',
  'CARD',
  'YAPE',
  'PLIN',
  'TRANSFER'
);

/**
 * Generates OrderType values
 */
export const orderTypeArb = fc.constantFrom(
  'DINE_IN',
  'TAKEOUT',
  'DELIVERY'
);

/**
 * Generates ItemStatus values
 */
export const itemStatusArb = fc.constantFrom(
  'PENDING',
  'COOKING',
  'READY',
  'DONE',
  'VOIDED'
);

/**
 * Generates PaymentStatus values
 */
export const paymentStatusArb = fc.constantFrom(
  'UNPAID',
  'PARTIAL',
  'PAID'
);

/**
 * Generates SplitMode values
 */
export const splitModeArb = fc.constantFrom('ITEMS', 'PERCENT');

/**
 * Generates role values
 */
export const roleArb = fc.constantFrom(
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN'
);

/**
 * Generates station names
 */
export const stationArb = fc.constantFrom(
  'PARRILLA',
  'COCINA',
  'BAR',
  'HORNO',
  'POSTRES'
);

/**
 * Generates ISO date strings
 */
export const isoDateArb = fc
  .date()
  .map(d => d.toISOString());

/**
 * Generates UUID strings
 */
export const uuidArb = fc.uuid();

/**
 * Generates short strings (1-50 chars) for names, descriptions
 */
export const shortStringArb = fc.string({
  minLength: 1,
  maxLength: 50,
});

/**
 * Generates medium strings (1-100 chars) for notes, reasons
 */
export const mediumStringArb = fc.string({
  minLength: 1,
  maxLength: 100,
});

/**
 * Generates SKU strings (alphanumeric, 1-20 chars)
 */
export const skuArb = fc
  .stringMatching(/^[A-Z0-9_]{1,20}$/)
  .map(s => s || 'SKU_001');

/**
 * Generates positive integers for quantities (1-100)
 */
export const quantityArb = fc.integer({ min: 1, max: 100 });

/**
 * Generates order numbers (1-99999)
 */
export const orderNumberArb = fc.integer({ min: 1, max: 99999 });

/**
 * Generates table numbers (1-50)
 */
export const tableNumberArb = fc.integer({ min: 1, max: 50 });

/**
 * Generates guest counts (1-20)
 */
export const guestCountArb = fc.integer({ min: 1, max: 20 });

/**
 * Generates percentage values (0-100)
 */
export const percentageArb = fc.integer({ min: 0, max: 100 });

/**
 * Generates discount percentages (0-50)
 */
export const discountPercentageArb = fc.integer({ min: 0, max: 50 });

/**
 * Generates tip percentages (0-30)
 */
export const tipPercentageArb = fc.integer({ min: 0, max: 30 });
