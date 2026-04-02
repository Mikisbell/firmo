/**
 * Print Job Service - Manages print queue via print_jobs table
 *
 * Creates, queues, and tracks print jobs for thermal printers.
 * Jobs contain ESC/POS binary data as base64 in the payload field.
 *
 * @module core/services/print-job.service
 */

import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type PrintJobType = 'RECEIPT' | 'KITCHEN_TICKET' | 'PRE_CHECK' | 'INVOICE' | 'TEST';
export type PrintJobStatus = 'QUEUED' | 'SENT' | 'PRINTED' | 'FAILED';

export interface PrintJobRecord {
  id: string;
  tenantId: string;
  printerId: string | null;
  jobType: string;
  priority: number;
  status: string;
  payload: unknown;
  orderId: string | null;
  checkId: string | null;
  actorId: string | null;
  terminalId: string | null;
  createdAt: string;
  sentAt: string | null;
  printedAt: string | null;
  failedAt: string | null;
}

export interface CreatePrintJobInput {
  tenantId: string;
  printerId?: string;
  jobType: PrintJobType;
  payload: unknown;
  orderId?: string;
  checkId?: string;
  actorId?: string;
  terminalId?: string;
}

export interface PrintJobStats {
  queued: number;
  sent: number;
  printed: number;
  failed: number;
  total: number;
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

// Priority mapping — higher = more urgent
const PRIORITY_MAP: Record<string, number> = {
  KITCHEN_TICKET: 100,
  RECEIPT: 50,
  PRE_CHECK: 40,
  INVOICE: 30,
  TEST: 10,
};

// ============================================================================
// Service
// ============================================================================

export class PrintJobService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new print job
   */
  async createPrintJob(input: CreatePrintJobInput): Promise<Result<PrintJobRecord>> {
    const priority = PRIORITY_MAP[input.jobType] ?? 10;

    const job = await this.prisma.print_jobs.create({
      data: {
        id: randomUUID(),
        tenant_id: input.tenantId,
        printer_id: input.printerId || null,
        job_type: input.jobType,
        priority,
        status: 'QUEUED',
        payload: input.payload as any,
        order_id: input.orderId || null,
        check_id: input.checkId || null,
        actor_id: input.actorId || null,
        terminal_id: input.terminalId || null,
        created_at: new Date(),
      },
    });

    return { success: true, data: this.mapRecord(job) };
  }

  /**
   * Get pending jobs for a printer (or all printers)
   */
  async getPendingJobs(
    tenantId: string,
    printerId?: string,
  ): Promise<Result<PrintJobRecord[]>> {
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      status: 'QUEUED',
    };
    if (printerId) where.printer_id = printerId;

    const jobs = await this.prisma.print_jobs.findMany({
      where: where as any,
      orderBy: [
        { priority: 'desc' },
        { created_at: 'asc' },
      ],
    });

    return { success: true, data: jobs.map((j) => this.mapRecord(j)) };
  }

  /**
   * Mark job as sent to printer
   */
  async markJobSent(tenantId: string, jobId: string): Promise<Result<void>> {
    const job = await this.prisma.print_jobs.findFirst({
      where: { id: jobId, tenant_id: tenantId },
    });

    if (!job) {
      return { success: false, error: { message: 'Job no encontrado' } };
    }

    await this.prisma.print_jobs.update({
      where: { id: jobId },
      data: { status: 'SENT', sent_at: new Date() },
    });

    return { success: true, data: undefined };
  }

  /**
   * Mark job as printed successfully
   */
  async markJobPrinted(tenantId: string, jobId: string): Promise<Result<void>> {
    const job = await this.prisma.print_jobs.findFirst({
      where: { id: jobId, tenant_id: tenantId },
    });

    if (!job) {
      return { success: false, error: { message: 'Job no encontrado' } };
    }

    await this.prisma.print_jobs.update({
      where: { id: jobId },
      data: { status: 'PRINTED', printed_at: new Date() },
    });

    return { success: true, data: undefined };
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(
    tenantId: string,
    jobId: string,
  ): Promise<Result<void>> {
    const job = await this.prisma.print_jobs.findFirst({
      where: { id: jobId, tenant_id: tenantId },
    });

    if (!job) {
      return { success: false, error: { message: 'Job no encontrado' } };
    }

    await this.prisma.print_jobs.update({
      where: { id: jobId },
      data: { status: 'FAILED', failed_at: new Date() },
    });

    return { success: true, data: undefined };
  }

  /**
   * Retry a failed job (reset to QUEUED)
   */
  async retryJob(tenantId: string, jobId: string): Promise<Result<void>> {
    const job = await this.prisma.print_jobs.findFirst({
      where: { id: jobId, tenant_id: tenantId },
    });

    if (!job) {
      return { success: false, error: { message: 'Job no encontrado' } };
    }

    if (job.status !== 'FAILED') {
      return { success: false, error: { message: 'Solo se pueden reintentar jobs fallidos' } };
    }

    await this.prisma.print_jobs.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        sent_at: null,
        printed_at: null,
        failed_at: null,
      },
    });

    return { success: true, data: undefined };
  }

  /**
   * Get print job statistics
   */
  async getJobStats(tenantId: string): Promise<Result<PrintJobStats>> {
    const jobs = await this.prisma.print_jobs.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _count: true,
    });

    const stats: PrintJobStats = { queued: 0, sent: 0, printed: 0, failed: 0, total: 0 };

    for (const row of jobs) {
      const count = row._count;
      switch (row.status) {
        case 'QUEUED': stats.queued = count; break;
        case 'SENT': stats.sent = count; break;
        case 'PRINTED': stats.printed = count; break;
        case 'FAILED': stats.failed = count; break;
      }
      stats.total += count;
    }

    return { success: true, data: stats };
  }

  private mapRecord(row: any): PrintJobRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      printerId: row.printer_id,
      jobType: row.job_type,
      priority: row.priority,
      status: row.status,
      payload: row.payload,
      orderId: row.order_id,
      checkId: row.check_id,
      actorId: row.actor_id,
      terminalId: row.terminal_id,
      createdAt: new Date(row.created_at).toISOString(),
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      printedAt: row.printed_at ? new Date(row.printed_at).toISOString() : null,
      failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
    };
  }
}
