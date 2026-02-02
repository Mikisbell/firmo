/**
 * Property Test: Subscription Storage Integrity (Property 6)
 * 
 * For any valid push subscription data and employee_id:
 * - After subscribe(), getSubscriptions(employee_id) SHALL include the subscription
 * - Multiple subscriptions per employee SHALL be allowed (different endpoints)
 * - After unsubscribe(endpoint), that endpoint SHALL NOT appear in subscriptions
 * 
 * Validates: Requirements 4.2, 4.3, 4.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

// Mock prisma
const mockPrisma = {
  push_subscriptions: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('@/src/core/db/prisma', () => ({
  default: mockPrisma,
}));

// In-memory store for testing
interface StoredSubscription {
  id: string;
  tenant_id: string;
  employee_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  device_info: string | null;
  created_at: Date;
  last_used_at: Date;
}

// Generators
const uuidArb = fc.uuid();
const _hexStringArb = fc.string({ minLength: 32, maxLength: 32 }).filter(s => /^[0-9a-f]+$/.test(s));
const _endpointArb = fc.webUrl().map(url => `${url}/push/v1/subscription`);
const base64Arb = fc.base64String({ minLength: 20, maxLength: 100 });

const subscriptionDataArb = fc.record({
  endpoint: fc.webUrl(),
  keys: fc.record({
    p256dh: base64Arb,
    auth: base64Arb,
  }),
});

describe('Property 6: Subscription Storage Integrity', () => {
  let subscriptionStore: Map<string, StoredSubscription>;

  beforeEach(() => {
    subscriptionStore = new Map();
    vi.clearAllMocks();

    // Mock upsert - simulates database behavior
    mockPrisma.push_subscriptions.upsert.mockImplementation(async (args: {
      where: { tenant_id_employee_id_endpoint: { tenant_id: string; employee_id: string; endpoint: string } };
      update: { p256dh_key: string; auth_key: string; last_used_at: Date };
      create: { tenant_id: string; employee_id: string; endpoint: string; p256dh_key: string; auth_key: string };
    }) => {
      const key = `${args.where.tenant_id_employee_id_endpoint.tenant_id}:${args.where.tenant_id_employee_id_endpoint.employee_id}:${args.where.tenant_id_employee_id_endpoint.endpoint}`;
      const existing = subscriptionStore.get(key);
      
      if (existing) {
        existing.p256dh_key = args.update.p256dh_key;
        existing.auth_key = args.update.auth_key;
        existing.last_used_at = args.update.last_used_at;
        return existing;
      }
      
      const newSub: StoredSubscription = {
        id: uuidv4(),
        tenant_id: args.create.tenant_id,
        employee_id: args.create.employee_id,
        endpoint: args.create.endpoint,
        p256dh_key: args.create.p256dh_key,
        auth_key: args.create.auth_key,
        device_info: null,
        created_at: new Date(),
        last_used_at: new Date(),
      };
      subscriptionStore.set(key, newSub);
      return newSub;
    });

    // Mock deleteMany
    mockPrisma.push_subscriptions.deleteMany.mockImplementation(async (args: {
      where: { tenant_id: string; employee_id: string; endpoint: string };
    }) => {
      const keysToDelete: string[] = [];
      for (const [key, sub] of subscriptionStore) {
        if (sub.tenant_id === args.where.tenant_id &&
            sub.employee_id === args.where.employee_id &&
            sub.endpoint === args.where.endpoint) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(k => subscriptionStore.delete(k));
      return { count: keysToDelete.length };
    });

    // Mock findMany
    mockPrisma.push_subscriptions.findMany.mockImplementation(async (args: {
      where: { tenant_id: string; employee_id: string };
    }) => {
      const results: StoredSubscription[] = [];
      for (const sub of subscriptionStore.values()) {
        if (sub.tenant_id === args.where.tenant_id &&
            sub.employee_id === args.where.employee_id) {
          results.push(sub);
        }
      }
      return results;
    });
  });

  it('Property 6.1: After subscribe(), getSubscriptions() includes the subscription', async () => {
    const { subscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        subscriptionDataArb,
        async (tenantId, employeeId, subData) => {
          // Subscribe
          await subscribe(tenantId, employeeId, subData);

          // Get subscriptions
          const subs = await getSubscriptions(tenantId, employeeId);

          // Verify subscription is present
          const found = subs.find(s => s.endpoint === subData.endpoint);
          expect(found).toBeDefined();
          expect(found?.keys.p256dh).toBe(subData.keys.p256dh);
          expect(found?.keys.auth).toBe(subData.keys.auth);
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  it('Property 6.2: Multiple subscriptions per employee are allowed (different endpoints)', async () => {
    const { subscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        fc.array(subscriptionDataArb, { minLength: 2, maxLength: 5 }),
        async (tenantId, employeeId, subDataList) => {
          // Make endpoints unique
          const uniqueSubs = subDataList.map((sub, i) => ({
            ...sub,
            endpoint: `${sub.endpoint}/${i}`,
          }));

          // Subscribe all
          for (const subData of uniqueSubs) {
            await subscribe(tenantId, employeeId, subData);
          }

          // Get subscriptions
          const subs = await getSubscriptions(tenantId, employeeId);

          // Verify all subscriptions are present
          expect(subs.length).toBe(uniqueSubs.length);
          for (const subData of uniqueSubs) {
            const found = subs.find(s => s.endpoint === subData.endpoint);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  it('Property 6.3: After unsubscribe(endpoint), that endpoint is removed', async () => {
    const { subscribe, unsubscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        subscriptionDataArb,
        async (tenantId, employeeId, subData) => {
          // Subscribe
          await subscribe(tenantId, employeeId, subData);

          // Verify it exists
          let subs = await getSubscriptions(tenantId, employeeId);
          expect(subs.find(s => s.endpoint === subData.endpoint)).toBeDefined();

          // Unsubscribe
          await unsubscribe(tenantId, employeeId, subData.endpoint);

          // Verify it's gone
          subs = await getSubscriptions(tenantId, employeeId);
          expect(subs.find(s => s.endpoint === subData.endpoint)).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  it('Property 6.4: Unsubscribe only removes the specified endpoint', async () => {
    const { subscribe, unsubscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        fc.array(subscriptionDataArb, { minLength: 2, maxLength: 5 }),
        fc.nat(),
        async (tenantId, employeeId, subDataList, removeIndex) => {
          // Make endpoints unique
          const uniqueSubs = subDataList.map((sub, i) => ({
            ...sub,
            endpoint: `${sub.endpoint}/${i}`,
          }));

          // Subscribe all
          for (const subData of uniqueSubs) {
            await subscribe(tenantId, employeeId, subData);
          }

          // Remove one
          const indexToRemove = removeIndex % uniqueSubs.length;
          const endpointToRemove = uniqueSubs[indexToRemove].endpoint;
          await unsubscribe(tenantId, employeeId, endpointToRemove);

          // Verify only that one is removed
          const subs = await getSubscriptions(tenantId, employeeId);
          expect(subs.length).toBe(uniqueSubs.length - 1);
          expect(subs.find(s => s.endpoint === endpointToRemove)).toBeUndefined();
          
          // Others still exist
          for (let i = 0; i < uniqueSubs.length; i++) {
            if (i !== indexToRemove) {
              expect(subs.find(s => s.endpoint === uniqueSubs[i].endpoint)).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  it('Property 6.5: Subscriptions are isolated by tenant and employee', async () => {
    const { subscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        subscriptionDataArb,
        async (tenant1, tenant2, employee1, employee2, subData) => {
          // Ensure different tenants/employees
          fc.pre(tenant1 !== tenant2 || employee1 !== employee2);

          // Subscribe for tenant1/employee1
          await subscribe(tenant1, employee1, subData);

          // Get subscriptions for tenant2/employee2
          const subs = await getSubscriptions(tenant2, employee2);

          // Should not find the subscription
          expect(subs.find(s => s.endpoint === subData.endpoint)).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  it('Property 6.6: Re-subscribing updates existing subscription', async () => {
    const { subscribe, getSubscriptions } = await import('../notification.service');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        subscriptionDataArb,
        base64Arb,
        base64Arb,
        async (tenantId, employeeId, subData, newP256dh, newAuth) => {
          // Subscribe initially
          await subscribe(tenantId, employeeId, subData);

          // Subscribe again with same endpoint but different keys
          const updatedSubData = {
            ...subData,
            keys: { p256dh: newP256dh, auth: newAuth },
          };
          await subscribe(tenantId, employeeId, updatedSubData);

          // Get subscriptions
          const subs = await getSubscriptions(tenantId, employeeId);

          // Should have only one subscription with updated keys
          const matching = subs.filter(s => s.endpoint === subData.endpoint);
          expect(matching.length).toBe(1);
          expect(matching[0].keys.p256dh).toBe(newP256dh);
          expect(matching[0].keys.auth).toBe(newAuth);
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);
});
