/**
 * Tests for Shared Types - Branded Types & Type Safety
 * 
 * Validates that branded types provide proper type safety
 * and helper functions work correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  asCentavos,
  unsafeCentavos,
  asOrderId,
  asShiftId,
  asTenantId,
  asTerminalId,
  asBusinessDate,
  dateToBusinessDate,
  type Centavos,
  type OrderId,
  type ShiftId,
  type BusinessDate,
} from '../shared';

describe('Centavos Branded Type', () => {
  it('asCentavos accepts valid non-negative integers', () => {
    expect(asCentavos(0)).toBe(0);
    expect(asCentavos(100)).toBe(100);
    expect(asCentavos(999999)).toBe(999999);
  });

  it('asCentavos rejects negative numbers', () => {
    expect(() => asCentavos(-1)).toThrow('non-negative');
    expect(() => asCentavos(-100)).toThrow('non-negative');
  });

  it('asCentavos rejects non-integers', () => {
    expect(() => asCentavos(10.5)).toThrow('integer');
    expect(() => asCentavos(0.01)).toThrow('integer');
    expect(() => asCentavos(NaN)).toThrow('integer');
  });

  it('unsafeCentavos bypasses validation for trusted sources', () => {
    // This is intentionally unsafe - for DB values we trust
    const value = unsafeCentavos(12345);
    expect(value).toBe(12345);
  });

  it('Centavos can be used in arithmetic (loses brand)', () => {
    const a: Centavos = asCentavos(100);
    const b: Centavos = asCentavos(50);
    
    // Arithmetic returns number, not Centavos
    const sum = a + b;
    expect(sum).toBe(150);
    
    // Must re-brand after arithmetic
    const total: Centavos = asCentavos(sum);
    expect(total).toBe(150);
  });
});

describe('ID Branded Types', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('asOrderId creates OrderId from string', () => {
    const orderId: OrderId = asOrderId(validUUID);
    expect(orderId).toBe(validUUID);
  });

  it('asShiftId creates ShiftId from string', () => {
    const shiftId: ShiftId = asShiftId(validUUID);
    expect(shiftId).toBe(validUUID);
  });

  it('asTenantId creates TenantId from string', () => {
    const tenantId = asTenantId(validUUID);
    expect(tenantId).toBe(validUUID);
  });

  it('asTerminalId creates TerminalId from string', () => {
    const terminalId = asTerminalId('MOZO-01');
    expect(terminalId).toBe('MOZO-01');
  });

  // TypeScript compile-time test: these should NOT compile if uncommented
  // This documents the type safety we get from branded types
  /*
  it('branded IDs are not interchangeable (compile error)', () => {
    const orderId: OrderId = asOrderId(validUUID);
    const shiftId: ShiftId = orderId; // ERROR: Type 'OrderId' is not assignable to type 'ShiftId'
  });
  */
});

describe('BusinessDate Branded Type', () => {
  it('asBusinessDate accepts valid YYYY-MM-DD format', () => {
    expect(asBusinessDate('2026-01-08')).toBe('2026-01-08');
    expect(asBusinessDate('2025-12-31')).toBe('2025-12-31');
    expect(asBusinessDate('2000-01-01')).toBe('2000-01-01');
  });

  it('asBusinessDate rejects invalid formats', () => {
    expect(() => asBusinessDate('2026-1-8')).toThrow('YYYY-MM-DD');
    expect(() => asBusinessDate('01-08-2026')).toThrow('YYYY-MM-DD');
    expect(() => asBusinessDate('2026/01/08')).toThrow('YYYY-MM-DD');
    expect(() => asBusinessDate('not-a-date')).toThrow('YYYY-MM-DD');
    expect(() => asBusinessDate('')).toThrow('YYYY-MM-DD');
  });

  it('dateToBusinessDate converts Date to BusinessDate', () => {
    // Use local date to avoid timezone issues
    const date = new Date(2026, 0, 8); // January 8, 2026 (month is 0-indexed)
    const businessDate: BusinessDate = dateToBusinessDate(date);
    expect(businessDate).toBe('2026-01-08');
  });

  it('dateToBusinessDate pads single-digit months and days', () => {
    // Use local date to avoid timezone issues
    const date = new Date(2026, 2, 5); // March 5, 2026 (month is 0-indexed)
    expect(dateToBusinessDate(date)).toBe('2026-03-05');
  });
});

describe('Type Re-exports', () => {
  it('PaymentMethod type is available', async () => {
    // Dynamic import to test re-export
    const { PaymentMethodSchema } = await import('../shared');
    
    expect(PaymentMethodSchema.parse('CASH')).toBe('CASH');
    expect(PaymentMethodSchema.parse('YAPE')).toBe('YAPE');
    expect(PaymentMethodSchema.parse('PLIN')).toBe('PLIN');
    expect(PaymentMethodSchema.parse('CARD')).toBe('CARD');
    expect(PaymentMethodSchema.parse('TRANSFER')).toBe('TRANSFER');
  });

  it('OrderTypeSchema is available', async () => {
    const { OrderTypeSchema } = await import('../shared');
    
    expect(OrderTypeSchema.parse('DINE_IN')).toBe('DINE_IN');
    expect(OrderTypeSchema.parse('TAKEOUT')).toBe('TAKEOUT');
    expect(OrderTypeSchema.parse('DELIVERY')).toBe('DELIVERY');
  });
});
