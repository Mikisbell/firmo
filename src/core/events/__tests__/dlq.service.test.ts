import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deadLetterQueueService } from '../dlq.service';
import prisma from '@/src/core/db/prisma';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    dead_letter_queue: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    pending_events: {
      createMany: vi.fn(),
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

  it('debe procesar los eventos en lote moviéndolos a pending_events y borrándolos de DLQ', async () => {
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
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([{ count: 1 }, { count: 1 }]);

    const count = await deadLetterQueueService.drainDLQ();
    
    expect(count).toBe(1);
    expect(prisma.dead_letter_queue.findMany).toHaveBeenCalledWith({
      take: 100,
      orderBy: { enqueued_at: 'asc' },
    });

    // Se debió llamar a la transacción con batch createMany y deleteMany
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.pending_events.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.dead_letter_queue.deleteMany).toHaveBeenCalledTimes(1);
    
    const createManyArgs = vi.mocked(prisma.pending_events.createMany).mock.calls[0]?.[0] as any;
    expect(createManyArgs?.data).toHaveLength(1);
    expect(createManyArgs?.data[0].tenant_id).toBe('tenant-1');
    expect(createManyArgs?.data[0].event_type).toBe('ORDER_ITEM_ADDED');
    expect(createManyArgs?.data[0].reason).toBe('Reintentado desde DLQ: Dependency missing');
    expect(createManyArgs?.data[0].id).toBeDefined();

    const deleteManyArgs = vi.mocked(prisma.dead_letter_queue.deleteMany).mock.calls[0]?.[0] as any;
    expect(deleteManyArgs?.where).toEqual({ id: { in: ['old-dlq-id'] } });
  });
});
