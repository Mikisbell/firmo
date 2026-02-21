/**
 * Print Job Service Tests
 *
 * @module core/services/__tests__/print-job.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrintJobService } from '../print-job.service';

function createMockPrisma() {
  return {
    print_jobs: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    tenant_id: 'tenant-1',
    printer_id: 'printer-1',
    job_type: 'RECEIPT',
    priority: 50,
    status: 'QUEUED',
    payload: { data: 'base64...' },
    order_id: 'order-1',
    check_id: null,
    actor_id: null,
    terminal_id: null,
    created_at: new Date(),
    sent_at: null,
    printed_at: null,
    failed_at: null,
    ...overrides,
  };
}

describe('PrintJobService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PrintJobService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PrintJobService(prisma);
  });

  describe('createPrintJob', () => {
    it('debe crear job con prioridad KITCHEN_TICKET alta', async () => {
      prisma.print_jobs.create.mockResolvedValue(makeJob({ job_type: 'KITCHEN_TICKET', priority: 100 }));

      const result = await service.createPrintJob({
        tenantId: 'tenant-1',
        jobType: 'KITCHEN_TICKET',
        payload: { escpos: 'data' },
      });

      expect(result.success).toBe(true);
      expect(prisma.print_jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 100,
            status: 'QUEUED',
          }),
        }),
      );
    });

    it('debe crear job con prioridad RECEIPT media', async () => {
      prisma.print_jobs.create.mockResolvedValue(makeJob());

      const result = await service.createPrintJob({
        tenantId: 'tenant-1',
        jobType: 'RECEIPT',
        payload: { escpos: 'data' },
        orderId: 'order-1',
      });

      expect(result.success).toBe(true);
      expect(prisma.print_jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 50 }),
        }),
      );
    });

    it('debe asociar printerId si se proporciona', async () => {
      prisma.print_jobs.create.mockResolvedValue(makeJob());

      await service.createPrintJob({
        tenantId: 'tenant-1',
        jobType: 'RECEIPT',
        payload: {},
        printerId: 'printer-1',
      });

      expect(prisma.print_jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ printer_id: 'printer-1' }),
        }),
      );
    });
  });

  describe('getPendingJobs', () => {
    it('debe retornar jobs QUEUED ordenados por prioridad', async () => {
      prisma.print_jobs.findMany.mockResolvedValue([
        makeJob({ id: 'j-1', priority: 100 }),
        makeJob({ id: 'j-2', priority: 50 }),
      ]);

      const result = await service.getPendingJobs('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
      expect(prisma.print_jobs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'QUEUED' }),
          orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
        }),
      );
    });

    it('debe filtrar por printerId', async () => {
      prisma.print_jobs.findMany.mockResolvedValue([]);

      await service.getPendingJobs('tenant-1', 'printer-1');
      expect(prisma.print_jobs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ printer_id: 'printer-1' }),
        }),
      );
    });
  });

  describe('markJobSent', () => {
    it('debe marcar job como SENT', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(makeJob());

      const result = await service.markJobSent('tenant-1', 'job-1');
      expect(result.success).toBe(true);
      expect(prisma.print_jobs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('debe rechazar job no encontrado', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(null);

      const result = await service.markJobSent('tenant-1', 'no-exist');
      expect(result.success).toBe(false);
    });
  });

  describe('markJobPrinted', () => {
    it('debe marcar job como PRINTED', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(makeJob({ status: 'SENT' }));

      const result = await service.markJobPrinted('tenant-1', 'job-1');
      expect(result.success).toBe(true);
      expect(prisma.print_jobs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PRINTED' }),
        }),
      );
    });
  });

  describe('markJobFailed', () => {
    it('debe marcar job como FAILED', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(makeJob({ status: 'SENT' }));

      const result = await service.markJobFailed('tenant-1', 'job-1');
      expect(result.success).toBe(true);
      expect(prisma.print_jobs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('retryJob', () => {
    it('debe reintentar job fallido', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(makeJob({ status: 'FAILED' }));

      const result = await service.retryJob('tenant-1', 'job-1');
      expect(result.success).toBe(true);
      expect(prisma.print_jobs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'QUEUED',
            sent_at: null,
            failed_at: null,
          }),
        }),
      );
    });

    it('debe rechazar retry de job no fallido', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(makeJob({ status: 'QUEUED' }));

      const result = await service.retryJob('tenant-1', 'job-1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('fallidos');
      }
    });

    it('debe rechazar job no encontrado', async () => {
      prisma.print_jobs.findFirst.mockResolvedValue(null);

      const result = await service.retryJob('tenant-1', 'no-exist');
      expect(result.success).toBe(false);
    });
  });

  describe('getJobStats', () => {
    it('debe retornar estadísticas agrupadas', async () => {
      prisma.print_jobs.groupBy.mockResolvedValue([
        { status: 'QUEUED', _count: 5 },
        { status: 'PRINTED', _count: 20 },
        { status: 'FAILED', _count: 2 },
      ]);

      const result = await service.getJobStats('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.queued).toBe(5);
        expect(result.data.printed).toBe(20);
        expect(result.data.failed).toBe(2);
        expect(result.data.total).toBe(27);
      }
    });

    it('debe retornar zeros sin jobs', async () => {
      prisma.print_jobs.groupBy.mockResolvedValue([]);

      const result = await service.getJobStats('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(0);
      }
    });
  });
});
