/**
 * Property-Based Tests for Item Timestamps by Status
 * 
 * Property 3: Item Timestamps by Status
 * - COOKING status sets started_cooking_at
 * - READY status sets ready_at
 * - DONE status sets served_at
 * - Timestamps are monotonically increasing
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applySaleEvent, createOrderFromEvent } from '../sale.reducer';
import type { ParkEvent } from '@/src/core/domain/events';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERMINAL_ID = 'terminal-001';

function createBaseEnvelope(seq: number, occurredAt: string): Omit<ParkEvent, 'event_type' | 'payload' | 'aggregate_type'> {
  return {
    event_id: crypto.randomUUID(),
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    terminal_sequence: seq,
    occurred_at: occurredAt,
    aggregate_id: crypto.randomUUID(),
    correlation_id: crypto.randomUUID(),
    schema_version: 1,
    payload_version: 1,
  };
}

function createOrderCreatedEvent(orderId: string, lineId: string, occurredAt: string): Extract<ParkEvent, { event_type: 'ORDER_CREATED' }> {
  return {
    ...createBaseEnvelope(1, occurredAt),
    event_type: 'ORDER_CREATED',
    aggregate_type: 'ORDER',
    aggregate_id: orderId,
    payload: {
      order_id: orderId,
      order_number: 1,
      order_type: 'DINE_IN',
      items: [{
        line_id: lineId,
        product_id: 'prod-001',
        sku: 'SKU001',
        name: 'Test Product',
        qty: 1,
        unit_price_cents: 1000,
        station: 'COCINA',
        status: 'PENDING',
        mods: [],
      }],
      checks: [],
    },
  };
}

function createStatusChangeEvent(
  orderId: string,
  lineId: string,
  from: 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED',
  to: 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED',
  seq: number,
  occurredAt: string
): Extract<ParkEvent, { event_type: 'ORDER_ITEM_STATUS_CHANGED' }> {
  return {
    ...createBaseEnvelope(seq, occurredAt),
    event_type: 'ORDER_ITEM_STATUS_CHANGED',
    aggregate_type: 'ORDER',
    aggregate_id: orderId,
    payload: {
      order_id: orderId,
      line_id: lineId,
      from,
      to,
      station: 'COCINA',
    },
  };
}

describe('Item Timestamps by Status - Property Tests', () => {
  
  // Property 3.1: COOKING status sets started_cooking_at
  it('should set started_cooking_at when status changes to COOKING', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (baseDate: Date) => {
          if (isNaN(baseDate.getTime())) return true;
          
          const orderId = crypto.randomUUID();
          const lineId = 'line-001';
          const createTime = baseDate.toISOString();
          const cookingTime = new Date(baseDate.getTime() + 60000).toISOString(); // 1 min later
          
          const createEvent = createOrderCreatedEvent(orderId, lineId, createTime);
          const sale = createOrderFromEvent(createEvent);
          
          const statusEvent = createStatusChangeEvent(orderId, lineId, 'PENDING', 'COOKING', 2, cookingTime);
          const { state } = applySaleEvent(sale, statusEvent);
          
          if (!state) return false;
          const line = state.lines[lineId];
          return line?.started_cooking_at === cookingTime;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 3.2: READY status sets ready_at
  it('should set ready_at when status changes to READY', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (baseDate: Date) => {
          if (isNaN(baseDate.getTime())) return true;
          
          const orderId = crypto.randomUUID();
          const lineId = 'line-001';
          const createTime = baseDate.toISOString();
          const readyTime = new Date(baseDate.getTime() + 120000).toISOString(); // 2 min later
          
          const createEvent = createOrderCreatedEvent(orderId, lineId, createTime);
          const sale = createOrderFromEvent(createEvent);
          
          const statusEvent = createStatusChangeEvent(orderId, lineId, 'COOKING', 'READY', 2, readyTime);
          const { state } = applySaleEvent(sale, statusEvent);
          
          if (!state) return false;
          const line = state.lines[lineId];
          return line?.ready_at === readyTime;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 3.3: DONE status sets served_at
  it('should set served_at when status changes to DONE', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (baseDate: Date) => {
          if (isNaN(baseDate.getTime())) return true;
          
          const orderId = crypto.randomUUID();
          const lineId = 'line-001';
          const createTime = baseDate.toISOString();
          const doneTime = new Date(baseDate.getTime() + 180000).toISOString(); // 3 min later
          
          const createEvent = createOrderCreatedEvent(orderId, lineId, createTime);
          const sale = createOrderFromEvent(createEvent);
          
          const statusEvent = createStatusChangeEvent(orderId, lineId, 'READY', 'DONE', 2, doneTime);
          const { state } = applySaleEvent(sale, statusEvent);
          
          if (!state) return false;
          const line = state.lines[lineId];
          return line?.served_at === doneTime;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 3.4: Full lifecycle maintains all timestamps
  it('should maintain all timestamps through full lifecycle', () => {
    const orderId = crypto.randomUUID();
    const lineId = 'line-001';
    const baseTime = new Date('2025-01-15T12:00:00Z');
    
    const createTime = baseTime.toISOString();
    const cookingTime = new Date(baseTime.getTime() + 60000).toISOString();
    const readyTime = new Date(baseTime.getTime() + 300000).toISOString();
    const doneTime = new Date(baseTime.getTime() + 360000).toISOString();
    
    // Create order
    const createEvent = createOrderCreatedEvent(orderId, lineId, createTime);
    let sale = createOrderFromEvent(createEvent);
    
    // Verify created_at is set
    expect(sale.lines[lineId]?.created_at).toBe(createTime);
    
    // Change to COOKING
    const cookingEvent = createStatusChangeEvent(orderId, lineId, 'PENDING', 'COOKING', 2, cookingTime);
    sale = applySaleEvent(sale, cookingEvent).state!;
    expect(sale.lines[lineId]?.started_cooking_at).toBe(cookingTime);
    
    // Change to READY
    const readyEvent = createStatusChangeEvent(orderId, lineId, 'COOKING', 'READY', 3, readyTime);
    sale = applySaleEvent(sale, readyEvent).state!;
    expect(sale.lines[lineId]?.ready_at).toBe(readyTime);
    
    // Change to DONE
    const doneEvent = createStatusChangeEvent(orderId, lineId, 'READY', 'DONE', 4, doneTime);
    sale = applySaleEvent(sale, doneEvent).state!;
    expect(sale.lines[lineId]?.served_at).toBe(doneTime);
    
    // All timestamps should be preserved
    const finalLine = sale.lines[lineId];
    expect(finalLine?.created_at).toBe(createTime);
    expect(finalLine?.started_cooking_at).toBe(cookingTime);
    expect(finalLine?.ready_at).toBe(readyTime);
    expect(finalLine?.served_at).toBe(doneTime);
  });

  // Property 3.5: Timestamps are monotonically increasing in normal flow
  it('should have monotonically increasing timestamps in normal flow', () => {
    const orderId = crypto.randomUUID();
    const lineId = 'line-001';
    const baseTime = new Date('2025-01-15T12:00:00Z');
    
    const createTime = baseTime.toISOString();
    const cookingTime = new Date(baseTime.getTime() + 60000).toISOString();
    const readyTime = new Date(baseTime.getTime() + 300000).toISOString();
    const doneTime = new Date(baseTime.getTime() + 360000).toISOString();
    
    const createEvent = createOrderCreatedEvent(orderId, lineId, createTime);
    let sale = createOrderFromEvent(createEvent);
    
    sale = applySaleEvent(sale, createStatusChangeEvent(orderId, lineId, 'PENDING', 'COOKING', 2, cookingTime)).state!;
    sale = applySaleEvent(sale, createStatusChangeEvent(orderId, lineId, 'COOKING', 'READY', 3, readyTime)).state!;
    sale = applySaleEvent(sale, createStatusChangeEvent(orderId, lineId, 'READY', 'DONE', 4, doneTime)).state!;
    
    const line = sale.lines[lineId];
    const created = new Date(line!.created_at!).getTime();
    const cooking = new Date(line!.started_cooking_at!).getTime();
    const ready = new Date(line!.ready_at!).getTime();
    const done = new Date(line!.served_at!).getTime();
    
    expect(created).toBeLessThan(cooking);
    expect(cooking).toBeLessThan(ready);
    expect(ready).toBeLessThan(done);
  });
});
