/**
 * Print Queue Service
 *
 * Manages print jobs with priority, retry, and station-based routing.
 * Jobs are enqueued when:
 * - Invoice issued → receipt on CAJA printer
 * - ORDER_SUBMITTED → kitchen tickets per station
 * - Manual reprint requested
 *
 * @module core/printing/print-queue
 */

import { printerManager, type PrintResult } from './printer-driver';
import { buildThermalReceipt, buildKitchenTicket, type ReceiptData, type KitchenTicketData } from './receipt-builder';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Types
// ============================================================================

export type PrintJobType = 'RECEIPT' | 'KITCHEN_TICKET' | 'RAW';

export type PrintJobPriority = 'HIGH' | 'NORMAL' | 'LOW';

export type PrintJobStatus = 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED';

export interface PrintJob {
  id: string;
  type: PrintJobType;
  priority: PrintJobPriority;
  status: PrintJobStatus;
  /** Target printer ID (null = auto-route by station) */
  printerId: string | null;
  /** Target station for auto-routing (COCINA, BAR, CAJA) */
  station: string | null;
  /** Pre-built ESC/POS data (for RAW type) */
  rawData: Uint8Array | null;
  /** Receipt data (for RECEIPT type) */
  receiptData: ReceiptData | null;
  /** Kitchen ticket data (for KITCHEN_TICKET type) */
  kitchenData: KitchenTicketData | null;
  /** Number of print attempts */
  attempts: number;
  maxAttempts: number;
  /** Error from last attempt */
  lastError: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// ============================================================================
// Print Queue
// ============================================================================

const PRIORITY_ORDER: Record<PrintJobPriority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

export class PrintQueueService {
  private queue: PrintJob[] = [];
  private isProcessing = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /** Enqueue a receipt print job */
  enqueueReceipt(data: ReceiptData, priority: PrintJobPriority = 'HIGH'): string {
    const id = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      id,
      type: 'RECEIPT',
      priority,
      status: 'QUEUED',
      printerId: null,
      station: 'CAJA',
      rawData: null,
      receiptData: data,
      kitchenData: null,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: new Date(),
      completedAt: null,
    });
    this.sortQueue();
    this.processNext();
    return id;
  }

  /** Enqueue a kitchen ticket print job */
  enqueueKitchenTicket(data: KitchenTicketData, priority: PrintJobPriority = 'HIGH'): string {
    const id = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      id,
      type: 'KITCHEN_TICKET',
      priority,
      status: 'QUEUED',
      printerId: null,
      station: data.station,
      rawData: null,
      receiptData: null,
      kitchenData: data,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: new Date(),
      completedAt: null,
    });
    this.sortQueue();
    this.processNext();
    return id;
  }

  /** Enqueue raw ESC/POS data to a specific printer */
  enqueueRaw(data: Uint8Array, printerId: string, priority: PrintJobPriority = 'NORMAL'): string {
    const id = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      id,
      type: 'RAW',
      priority,
      status: 'QUEUED',
      printerId,
      station: null,
      rawData: data,
      receiptData: null,
      kitchenData: null,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: new Date(),
      completedAt: null,
    });
    this.sortQueue();
    this.processNext();
    return id;
  }

  /** Start background polling (for server-side use) */
  startPolling(intervalMs: number = 1000): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => this.processNext(), intervalMs);
  }

  /** Stop background polling */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Get current queue status */
  getStats(): { queued: number; printing: number; completed: number; failed: number } {
    return {
      queued: this.queue.filter(j => j.status === 'QUEUED').length,
      printing: this.queue.filter(j => j.status === 'PRINTING').length,
      completed: this.queue.filter(j => j.status === 'COMPLETED').length,
      failed: this.queue.filter(j => j.status === 'FAILED').length,
    };
  }

  /** Get job by ID */
  getJob(id: string): PrintJob | undefined {
    return this.queue.find(j => j.id === id);
  }

  /** Clear completed/failed jobs older than maxAgeMs */
  cleanup(maxAgeMs: number = 30 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.queue.length;
    this.queue = this.queue.filter(j => {
      if (j.status === 'QUEUED' || j.status === 'PRINTING') return true;
      return j.createdAt.getTime() > cutoff;
    });
    return before - this.queue.length;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Status: QUEUED first
      if (a.status === 'QUEUED' && b.status !== 'QUEUED') return -1;
      if (a.status !== 'QUEUED' && b.status === 'QUEUED') return 1;
      // Priority
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;

    const nextJob = this.queue.find(j => j.status === 'QUEUED');
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = 'PRINTING';
    nextJob.attempts++;

    try {
      const bytes = this.buildBytes(nextJob);
      const result = await this.sendToPrinter(nextJob, bytes);

      if (result.success) {
        nextJob.status = 'COMPLETED';
        nextJob.completedAt = new Date();
        pinoLogger.info({ jobId: nextJob.id, type: nextJob.type, bytes: result.bytesSent }, 'Print job completed');
      } else {
        nextJob.lastError = result.error || 'Unknown error';
        if (nextJob.attempts >= nextJob.maxAttempts) {
          nextJob.status = 'FAILED';
          pinoLogger.error({ jobId: nextJob.id, error: result.error, attempts: nextJob.attempts }, 'Print job failed permanently');
        } else {
          nextJob.status = 'QUEUED'; // Re-queue for retry
          pinoLogger.warn({ jobId: nextJob.id, error: result.error, attempt: nextJob.attempts }, 'Print job failed, retrying');
        }
      }
    } catch (err) {
      nextJob.lastError = err instanceof Error ? err.message : String(err);
      if (nextJob.attempts >= nextJob.maxAttempts) {
        nextJob.status = 'FAILED';
      } else {
        nextJob.status = 'QUEUED';
      }
    } finally {
      this.isProcessing = false;
      // Process next job if any queued
      const hasMore = this.queue.some(j => j.status === 'QUEUED');
      if (hasMore) {
        // Defer to avoid stack overflow on large queues
        setTimeout(() => this.processNext(), 0);
      }
    }
  }

  private buildBytes(job: PrintJob): Uint8Array {
    switch (job.type) {
      case 'RECEIPT':
        if (!job.receiptData) throw new Error('Missing receiptData for RECEIPT job');
        return buildThermalReceipt(job.receiptData);
      case 'KITCHEN_TICKET':
        if (!job.kitchenData) throw new Error('Missing kitchenData for KITCHEN_TICKET job');
        return buildKitchenTicket(job.kitchenData);
      case 'RAW':
        if (!job.rawData) throw new Error('Missing rawData for RAW job');
        return job.rawData;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async sendToPrinter(job: PrintJob, data: Uint8Array): Promise<PrintResult> {
    // Route by explicit printer ID
    if (job.printerId) {
      return printerManager.print(job.printerId, data);
    }

    // Route by station
    if (job.station) {
      // CAJA station = default receipt printer
      if (job.station === 'CAJA') {
        return printerManager.printReceipt(data);
      }
      return printerManager.printToStation(job.station, data);
    }

    // Fallback to default printer
    return printerManager.printReceipt(data);
  }
}

/** Singleton print queue */
export const printQueue = new PrintQueueService();
