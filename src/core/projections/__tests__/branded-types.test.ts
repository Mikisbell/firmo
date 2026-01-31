/**
 * Tests for Branded Types in Projections
 * 
 * Validates that projection types correctly use Branded Types
 * and that reducers properly convert values.
 */

import { describe, it, expect } from 'vitest';
import { 
  asCentavos, 
  asOrderId, 
  asShiftId,
  type Centavos,
  type OrderId,
  type ShiftId 
} from '@/src/core/types/shared';
import type { 
  SaleProjection, 
  ShiftProjection, 
  SaleLine, 
  CheckProjection 
} from '../types';
import { createOrderFromEvent } from '../sale.reducer';
import { emptyShift, applyShiftEvent } from '../shift.reducer';
import type { ParkEvent } from '@/src/core/domain/events';

// Import migrations to ensure they're registered
import '@/src/core/domain/migrations';

describe('Projection Types use Branded Types', () => {
  describe('SaleProjection', () => {
    it('order_id is OrderId branded type', () => {
      const orderId: OrderId = asOrderId('test-order-123');
      
      // Create a minimal sale projection
      const sale: Partial<SaleProjection> = {
        order_id: orderId,
        sale_id: orderId,
      };
      
      expect(sale.order_id).toBe('test-order-123');
      expect(sale.sale_id).toBe('test-order-123');
    });

    it('money fields are Centavos branded type', () => {
      const subtotal: Centavos = asCentavos(10000);
      const paid: Centavos = asCentavos(10000);
      const change: Centavos = asCentavos(0);
      
      const sale: Partial<SaleProjection> = {
        subtotal_cents: subtotal,
        paid_cents: paid,
        change_cents: change,
        total_cents: subtotal,
      };
      
      expect(sale.subtotal_cents).toBe(10000);
      expect(sale.paid_cents).toBe(10000);
      expect(sale.change_cents).toBe(0);
    });
  });

  describe('ShiftProjection', () => {
    it('shift_id is ShiftId branded type', () => {
      const shiftId: ShiftId = asShiftId('test-shift-456');
      
      const shift: Partial<ShiftProjection> = {
        shift_id: shiftId,
      };
      
      expect(shift.shift_id).toBe('test-shift-456');
    });

    it('cash fields are Centavos branded type', () => {
      const opening: Centavos = asCentavos(50000);
      const sales: Centavos = asCentavos(100000);
      const changeOut: Centavos = asCentavos(5000);
      
      const shift: Partial<ShiftProjection> = {
        opening_cash_cents: opening,
        cash_sales_in_cents: sales,
        cash_change_out_cents: changeOut,
      };
      
      expect(shift.opening_cash_cents).toBe(50000);
      expect(shift.cash_sales_in_cents).toBe(100000);
      expect(shift.cash_change_out_cents).toBe(5000);
    });
  });

  describe('SaleLine', () => {
    it('price fields are Centavos branded type', () => {
      const unitPrice: Centavos = asCentavos(2500);
      const lineTotal: Centavos = asCentavos(5000);
      
      const line: Partial<SaleLine> = {
        unit_price_cents: unitPrice,
        line_total_cents: lineTotal,
      };
      
      expect(line.unit_price_cents).toBe(2500);
      expect(line.line_total_cents).toBe(5000);
    });
  });

  describe('CheckProjection', () => {
    it('money fields are Centavos branded type', () => {
      const subtotal: Centavos = asCentavos(5000);
      const discount: Centavos = asCentavos(500);
      const tip: Centavos = asCentavos(750);
      const total: Centavos = asCentavos(5250);
      
      const check: Partial<CheckProjection> = {
        subtotal_cents: subtotal,
        discount_cents: discount,
        tip_cents: tip,
        total_cents: total,
      };
      
      expect(check.subtotal_cents).toBe(5000);
      expect(check.discount_cents).toBe(500);
      expect(check.tip_cents).toBe(750);
      expect(check.total_cents).toBe(5250);
    });
  });
});

describe('Reducers convert to Branded Types', () => {
  describe('createOrderFromEvent', () => {
    it('converts event values to Centavos', () => {
      const event: Extract<ParkEvent, { event_type: 'ORDER_CREATED' }> = {
        event_id: 'evt-1',
        event_type: 'ORDER_CREATED',
        aggregate_type: 'ORDER',
        aggregate_id: 'order-1',
        tenant_id: 'tenant-1',
        terminal_id: 'CAJA-01',
        terminal_sequence: 1,
        correlation_id: 'corr-1',
        occurred_at: new Date().toISOString(),
        payload_version: 1,
        schema_version: 1,
        payload: {
          order_id: 'order-1',
          order_number: 1,
          order_type: 'DINE_IN',
          checks: [],
          items: [
            {
              line_id: 'line-1',
              product_id: 'prod-1',
              sku: 'SKU-001',
              name: 'Pollo a la Brasa',
              qty: 2,
              unit_price_cents: 2500,
              status: 'PENDING',
              station: 'PARRILLA',
              mods: [],
            }
          ],
        },
      };

      const sale = createOrderFromEvent(event);

      // Verify order_id is OrderId
      expect(sale.order_id).toBe('order-1');
      expect(sale.sale_id).toBe('order-1');

      // Verify money fields are Centavos
      expect(sale.subtotal_cents).toBe(5000); // 2 * 2500
      expect(sale.paid_cents).toBe(0);
      expect(sale.change_cents).toBe(0);

      // Verify line money fields
      const line = sale.lines['line-1'];
      expect(line.unit_price_cents).toBe(2500);
      expect(line.line_total_cents).toBe(5000);
    });
  });

  describe('emptyShift', () => {
    it('initializes with Centavos zero values', () => {
      const shift = emptyShift();

      // All money fields should be 0 as Centavos
      expect(shift.opening_cash_cents).toBe(0);
      expect(shift.cash_sales_in_cents).toBe(0);
      expect(shift.cash_change_out_cents).toBe(0);
      expect(shift.expected_cash_cents).toBe(0);
      expect(shift.declared_cash_cents).toBeNull();
      expect(shift.over_short_cents).toBeNull();
    });
  });

  describe('applyShiftEvent', () => {
    it('converts SHIFT_OPENED values to Centavos', () => {
      const shift = emptyShift();
      const event: ParkEvent = {
        event_id: 'evt-1',
        event_type: 'SHIFT_OPENED',
        aggregate_type: 'SHIFT',
        aggregate_id: 'shift-1',
        tenant_id: 'tenant-1',
        terminal_id: 'CAJA-01',
        terminal_sequence: 1,
        correlation_id: 'corr-1',
        occurred_at: new Date().toISOString(),
        payload_version: 1,
        schema_version: 1,
        payload: {
          shift_id: 'shift-1',
          cash_opening_cents: 50000,
        },
      };

      const { state } = applyShiftEvent(shift, event);

      expect(state.shift_id).toBe('shift-1');
      expect(state.opening_cash_cents).toBe(50000);
      expect(state.expected_cash_cents).toBe(50000);
    });
  });
});

describe('Centavos arithmetic in reducers', () => {
  it('correctly calculates subtotal from multiple items', () => {
    const event: Extract<ParkEvent, { event_type: 'ORDER_CREATED' }> = {
      event_id: 'evt-1',
      event_type: 'ORDER_CREATED',
      aggregate_type: 'ORDER',
      aggregate_id: 'order-1',
      tenant_id: 'tenant-1',
      terminal_id: 'CAJA-01',
      terminal_sequence: 1,
      correlation_id: 'corr-1',
      occurred_at: new Date().toISOString(),
      payload_version: 1,
      schema_version: 1,
      payload: {
        order_id: 'order-1',
        order_number: 1,
        order_type: 'DINE_IN',
        checks: [],
        items: [
          { line_id: 'l1', product_id: 'p1', sku: 'SKU-1', name: 'Item 1', qty: 2, unit_price_cents: 1000, status: 'PENDING', station: 'COCINA', mods: [] },
          { line_id: 'l2', product_id: 'p2', sku: 'SKU-2', name: 'Item 2', qty: 3, unit_price_cents: 1500, status: 'PENDING', station: 'COCINA', mods: [] },
          { line_id: 'l3', product_id: 'p3', sku: 'SKU-3', name: 'Item 3', qty: 1, unit_price_cents: 2500, status: 'PENDING', station: 'BAR', mods: [] },
        ],
      },
    };

    const sale = createOrderFromEvent(event);

    // 2*1000 + 3*1500 + 1*2500 = 2000 + 4500 + 2500 = 9000
    expect(sale.subtotal_cents).toBe(9000);
  });
});
