/**
 * Unit Tests for Saga Implementations
 * 
 * Tests specific saga scenarios, edge cases, and error conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SagaOrchestrator } from '../orchestrator';
import {
  completeSaleSaga,
  voidSaleSaga,
  applyPromotionSaga,
  CompleteSaleContext,
  VoidSaleContext,
  ApplyPromotionContext,
} from '../sagas';

// Mock Dexie
vi.mock('@/src/core/db/schema', () => {
  const sagaLogs = new Map<string, any>();

  return {
    db: {
      saga_logs: {
        add: vi.fn(async (entity: any) => {
          sagaLogs.set(entity.saga_id, entity);
          return entity.saga_id;
        }),
        get: vi.fn(async (sagaId: string) => {
          return sagaLogs.get(sagaId) || null;
        }),
        update: vi.fn(async (sagaId: string, changes: any) => {
          const existing = sagaLogs.get(sagaId);
          if (existing) {
            sagaLogs.set(sagaId, { ...existing, ...changes });
          }
          return 1;
        }),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(async () => []),
          })),
        })),
        toArray: vi.fn(async () => Array.from(sagaLogs.values())),
        clear: vi.fn(async () => {
          sagaLogs.clear();
        }),
      },
      offline_saga_events: {
        add: vi.fn(async () => {}),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(async () => []),
          })),
        })),
      },
    },
  };
});

describe('Complete Sale Saga', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = new SagaOrchestrator();
  });

  it('should complete successfully with all steps', async () => {
    const context: CompleteSaleContext = {
      sagaId: 'test-complete-sale-1',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      checkId: 'check-456',
      paymentMethod: 'CASH',
      amountCents: 5000,
      couponId: 'coupon-789',
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(completeSaleSaga, context);

    expect(result.status).toBe('COMPLETED');
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every(s => s.status === 'COMPLETED')).toBe(true);
  });

  it('should fail and compensate when payment validation fails', async () => {
    const context: CompleteSaleContext = {
      sagaId: 'test-complete-sale-2',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      checkId: 'check-456',
      paymentMethod: 'CASH',
      amountCents: -100, // Invalid amount
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(completeSaleSaga, context);

    expect(result.status).toBe('COMPENSATED');
    expect(result.steps[0].status).toBe('FAILED');
  });

  it('should skip coupon reservation if no coupon provided', async () => {
    const context: CompleteSaleContext = {
      sagaId: 'test-complete-sale-3',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      checkId: 'check-456',
      paymentMethod: 'CASH',
      amountCents: 5000,
      // No couponId
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(completeSaleSaga, context);

    expect(result.status).toBe('COMPLETED');
    expect(result.steps[1].result).toEqual({ couponReserved: false });
  });
});

describe('Void Sale Saga', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = new SagaOrchestrator();
  });

  it('should complete successfully with all steps', async () => {
    const context: VoidSaleContext = {
      sagaId: 'test-void-sale-1',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      invoiceId: 'inv-456',
      reason: 'Customer request',
      approvedBy: 'manager-1',
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(voidSaleSaga, context);

    expect(result.status).toBe('COMPLETED');
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every(s => s.status === 'COMPLETED')).toBe(true);
  });

  it('should fail immediately if authorization is missing', async () => {
    const context: VoidSaleContext = {
      sagaId: 'test-void-sale-2',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      invoiceId: 'inv-456',
      reason: 'Customer request',
      approvedBy: '', // No approval
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(voidSaleSaga, context);

    expect(result.status).toBe('COMPENSATED');
    expect(result.steps[0].status).toBe('FAILED');
  });

  it('should compensate all steps if refund fails', async () => {
    const context: VoidSaleContext = {
      sagaId: 'test-void-sale-3',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      invoiceId: 'inv-456',
      reason: 'Customer request',
      approvedBy: 'manager-1',
      actorId: 'cashier-1',
    };

    // Mock refund failure by modifying the saga
    const modifiedSaga = {
      ...voidSaleSaga,
      steps: voidSaleSaga.steps.map((step, i) => {
        if (step.name === 'refund_payment') {
          return {
            ...step,
            do: async () => {
              throw new Error('Refund service unavailable');
            },
          };
        }
        return step;
      }),
    };

    const result = await orchestrator.execute(modifiedSaga, context);

    expect(result.status).toBe('COMPENSATED');
    expect(result.steps[2].status).toBe('FAILED');
    // Steps 0 and 1 should be compensated
    expect(result.steps[0].status).toBe('COMPENSATED');
    expect(result.steps[1].status).toBe('COMPENSATED');
  });
});

describe('Apply Promotion Saga', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = new SagaOrchestrator();
  });

  it('should complete successfully with all steps', async () => {
    const context: ApplyPromotionContext = {
      sagaId: 'test-apply-promo-1',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      promotionId: 'promo-456',
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(applyPromotionSaga, context);

    expect(result.status).toBe('COMPLETED');
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every(s => s.status === 'COMPLETED')).toBe(true);
  });

  it('should fail if promotion is invalid', async () => {
    const context: ApplyPromotionContext = {
      sagaId: 'test-apply-promo-2',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      promotionId: '', // Invalid
      actorId: 'cashier-1',
    };

    const result = await orchestrator.execute(applyPromotionSaga, context);

    expect(result.status).toBe('COMPENSATED');
    expect(result.steps[0].status).toBe('FAILED');
  });

  it('should compensate reservation and discount if notification fails', async () => {
    const context: ApplyPromotionContext = {
      sagaId: 'test-apply-promo-3',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-123',
      promotionId: 'promo-456',
      actorId: 'cashier-1',
    };

    // Mock notification failure
    const modifiedSaga = {
      ...applyPromotionSaga,
      steps: applyPromotionSaga.steps.map((step) => {
        if (step.name === 'send_notification') {
          return {
            ...step,
            do: async () => {
              throw new Error('Notification service unavailable');
            },
          };
        }
        return step;
      }),
    };

    const result = await orchestrator.execute(modifiedSaga, context);

    expect(result.status).toBe('COMPENSATED');
    expect(result.steps[3].status).toBe('FAILED');
    // Steps 0, 1, 2 should be compensated
    expect(result.steps[0].status).toBe('COMPENSATED');
    expect(result.steps[1].status).toBe('COMPENSATED');
    expect(result.steps[2].status).toBe('COMPENSATED');
  });
});

describe('Saga Integration', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = new SagaOrchestrator();
  });

  it('should handle multiple sagas independently', async () => {
    const completeSaleContext: CompleteSaleContext = {
      sagaId: 'saga-1',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-1',
      checkId: 'check-1',
      paymentMethod: 'CASH',
      amountCents: 5000,
      actorId: 'cashier-1',
    };

    const applyPromoContext: ApplyPromotionContext = {
      sagaId: 'saga-2',
      tenantId: 'test-tenant',
      startedAt: new Date(),
      orderId: 'order-2',
      promotionId: 'promo-1',
      actorId: 'cashier-1',
    };

    const result1 = await orchestrator.execute(completeSaleSaga, completeSaleContext);
    const result2 = await orchestrator.execute(applyPromotionSaga, applyPromoContext);

    expect(result1.sagaId).toBe('saga-1');
    expect(result2.sagaId).toBe('saga-2');
    expect(result1.status).toBe('COMPLETED');
    expect(result2.status).toBe('COMPLETED');
  });
});
