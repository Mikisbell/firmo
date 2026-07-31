import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deadLetterQueueService } from '../dlq.service';
import prisma from '@/src/core/db/prisma';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    dead_letter_queue: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    pending_events: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}));

describe('DeadLetterQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 0 si no hay eventos en el DLQ', async () => {
    vi.mocked(prisma.dead_letter_queue.findMany).mockResolvedValueOnce([]);
    const count = await deadLetterQueueService.drainDLQ();
    expect(count).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('debe procesar los eventos moviendolos a pending_events y borrandolos de DLQ', async () => {
    const mockEvent = {
      id: 'old-dlq-id',
      tenant_id: 'tenant-1',
      event_id: 'event-1',
      event_type: 'ORDER_ITEM_ADDED',
      aggregate_id: 'order-1',
      payload: { test: true },
      reason: 'Dependency missing',
      enqueued_at: new Date('2026-01-01'),
      expired_at: new Date(),
      created_at: new Date(),
    };

    vi.mocked(prisma.dead_letter_queue.findMany).mockResolvedValueOnce([mockEvent as any]);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([{}, {}]);

    const count = await deadLetterQueueService.drainDLQ();
    
    expect(count).toBe(1);
    expect(prisma.dead_letter_queue.findMany).toHaveBeenCalledWith({
      take: 100,
      orderBy: { enqueued_at: 'asc' },
    });

    // Se debió llamar a la transacción con un create y un delete
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionCalls = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown as any[];
    expect(transactionCalls).toHaveLength(2);

    // Verify create call logic (it's hard to verify inside a transaction mock if we didn't inject a specific structure, 
    // but we can check if it passed arrays properly)
    // Actually, prisma.pending_events.create and prisma.dead_letter_queue.delete are passed as unresolved promises or query objects.
    // In our implementation we passed the result of prisma...create() directly.
    expect(prisma.pending_events.create).toHaveBeenCalledTimes(1);
    expect(prisma.dead_letter_queue.delete).toHaveBeenCalledTimes(1);
    
    const createArgs = vi.mocked(prisma.pending_events.create).mock.calls[0][0];
    expect(createArgs.data.tenant_id).toBe('tenant-1');
    expect(createArgs.data.event_type).toBe('ORDER_ITEM_ADDED');
    expect(createArgs.data.reason).toBe('Reintentado desde DLQ: Dependency missing');
    expect(createArgs.data.id).toBeDefined();
    expect(createArgs.data.id).not.toBe('old-dlq-id'); // UUID v4 new
  });
});
