/**
 * Property Test: Notification Payload Completeness (Property 8)
 * 
 * For any ITEM_READY notification, the payload SHALL contain:
 * - table_number (from order.fulfillment)
 * - item_name (from the item)
 * - station (from the item)
 * - url matching pattern /mozo/mesa/{tableId}
 * 
 * For any REQUEST_CHECK notification, the payload SHALL contain:
 * - table_number
 * - total_cents (from order)
 * - waiter_name (from employee)
 * - url matching pattern /caja/orden/{orderId}
 * 
 * Validates: Requirements 5.2, 5.4, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildItemReadyPayload, buildRequestCheckPayload } from '../event-handlers';

// Generators
const uuidArb = fc.uuid();
const tableNumberArb = fc.integer({ min: 1, max: 99 }).map(n => String(n));
const productNameArb = fc.string({ minLength: 1, maxLength: 50 });
const stationArb = fc.constantFrom('COCINA', 'HORNO', 'BAR');
const waiterNameArb = fc.string({ minLength: 1, maxLength: 50 });
const totalCentsArb = fc.integer({ min: 0, max: 10000000 }); // Up to 100,000 soles

const itemArb = fc.record({
  name: productNameArb,
  station: stationArb,
});

describe('Property 8: Notification Payload Completeness', () => {
  describe('ITEM_READY Payload', () => {
    it('Property 8.1: ITEM_READY payload contains table_number', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            expect(payload.data.table_number).toBe(tableNumber);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.2: ITEM_READY payload contains item names in body', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            // For single item, body should contain the item name
            if (items.length === 1) {
              expect(payload.body).toContain(items[0].name);
            } else {
              // For multiple items, body should mention count
              expect(payload.body).toContain(`${items.length} items`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.3: ITEM_READY payload contains station(s)', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            // Station should be in data
            expect(payload.data.station).toBeDefined();
            
            // All unique stations should be included
            const uniqueStations = [...new Set(items.map(i => i.station))];
            for (const station of uniqueStations) {
              expect(payload.data.station).toContain(station);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.4: ITEM_READY payload URL matches /mozo/mesa/{orderId}', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            expect(payload.data.url).toBe(`/mozo/mesa/${orderId}`);
            expect(payload.data.url).toMatch(/^\/mozo\/mesa\/[a-f0-9-]+$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.5: ITEM_READY payload has correct type', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            expect(payload.type).toBe('ITEM_READY');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.6: ITEM_READY payload has order_id in data', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            expect(payload.data.order_id).toBe(orderId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.7: ITEM_READY payload has tag for grouping', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          fc.array(itemArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          (tableNumber, items, orderId) => {
            const payload = buildItemReadyPayload(tableNumber, items, orderId);

            expect(payload.tag).toBe(`item-ready-${orderId}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('REQUEST_CHECK Payload', () => {
    it('Property 8.8: REQUEST_CHECK payload contains table_number', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.data.table_number).toBe(tableNumber);
            expect(payload.title).toContain(tableNumber);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.9: REQUEST_CHECK payload contains total in body (formatted as soles)', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            // Total should be formatted as soles (cents / 100)
            const expectedSoles = (totalCents / 100).toFixed(2);
            expect(payload.body).toContain(expectedSoles);
            expect(payload.body).toContain('S/');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.10: REQUEST_CHECK payload contains waiter_name', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.body).toContain(waiterName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.11: REQUEST_CHECK payload URL matches /caja/orden/{orderId}', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.data.url).toBe(`/caja/orden/${orderId}`);
            expect(payload.data.url).toMatch(/^\/caja\/orden\/[a-f0-9-]+$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.12: REQUEST_CHECK payload has correct type', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.type).toBe('REQUEST_CHECK');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.13: REQUEST_CHECK payload has order_id in data', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.data.order_id).toBe(orderId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.14: REQUEST_CHECK payload has tag for grouping', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            expect(payload.tag).toBe(`request-check-${orderId}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Money Formatting', () => {
    it('Property 8.15: Total is always formatted with 2 decimal places', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            // Extract the number from the body (anchor to "Total:" to avoid matching waiter name)
            const match = payload.body.match(/Total:\s*S\/\s*([\d.]+)/);
            expect(match).not.toBeNull();
            
            if (match) {
              const formattedTotal = match[1];
              // Should have exactly 2 decimal places
              expect(formattedTotal).toMatch(/^\d+\.\d{2}$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.16: Total conversion from cents to soles is correct', () => {
      fc.assert(
        fc.property(
          tableNumberArb,
          totalCentsArb,
          waiterNameArb,
          uuidArb,
          (tableNumber, totalCents, waiterName, orderId) => {
            const payload = buildRequestCheckPayload(tableNumber, totalCents, waiterName, orderId);

            const expectedSoles = (totalCents / 100).toFixed(2);
            expect(payload.body).toContain(expectedSoles);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
