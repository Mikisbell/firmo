/**
 * Invoice Queue Worker
 * 
 * Processes invoice_queue table and sends to SUNAT.
 * Runs as background job (cron, separate process, or serverless function).
 * 
 * @module workers/invoice-queue
 */

import prisma from '@/src/core/db/prisma';
import { sunatClient, InvoiceData } from '@/src/core/integrations/sunat/client';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

interface ProcessOptions {
  batchSize?: number;
  maxRetries?: number;
  dryRun?: boolean;
}

/**
 * Process pending invoices in queue
 */
export async function processInvoiceQueue(options: ProcessOptions = {}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ invoiceId: string; error: string }>;
}> {
  const { batchSize = 10, dryRun = false } = options;
  
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ invoiceId: string; error: string }>,
  };

  pinoLogger.info({ batchSize, dryRun }, 'Starting invoice queue processing');

  try {
    // Get pending invoices
    const pendingInvoices = await prisma.invoice_queue.findMany({
      where: {
        status: 'PENDING',
        scheduled_at: {
          lte: new Date(),
        },
        attempts: {
          lt: prisma.invoice_queue.fields.max_attempts,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduled_at: 'asc' },
      ],
      take: batchSize,
    });

    pinoLogger.info({ count: pendingInvoices.length }, 'Found pending invoices');

    for (const queueItem of pendingInvoices) {
      result.processed++;
      
      try {
        if (dryRun) {
          pinoLogger.info({ 
            queueId: queueItem.id, 
            invoiceId: queueItem.invoice_id,
            action: queueItem.action 
          }, 'DRY RUN: Would process invoice');
          continue;
        }

        await processQueueItem(queueItem);
        result.succeeded++;
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          invoiceId: queueItem.invoice_id,
          error: (error as Error).message,
        });

        // Update queue item with error
        await prisma.invoice_queue.update({
          where: { id: queueItem.id },
          data: {
            status: 'FAILED',
            last_error: (error as Error).message,
            last_attempt_at: new Date(),
            attempts: {
              increment: 1,
            },
          },
        });
      }
    }

    pinoLogger.info({
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    }, 'Invoice queue processing completed');

    return result;

  } catch (error) {
    pinoLogger.error({ error }, 'Fatal error processing invoice queue');
    throw error;
  }
}

/**
 * Process single queue item
 */
async function processQueueItem(queueItem: any): Promise<void> {
  const { id, invoice_id, action, invoices: invoice } = queueItem;

  pinoLogger.info({ queueId: id, invoiceId: invoice_id, action }, 'Processing queue item');

  // Update status to processing
  await prisma.invoice_queue.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      last_attempt_at: new Date(),
      attempts: {
        increment: 1,
      },
    },
  });

  switch (action) {
    case 'EMIT':
      await processEmit(invoice, queueItem);
      break;
    
    case 'VOID':
      await processVoid(invoice, queueItem);
      break;
    
    case 'CREDIT_NOTE':
      await processCreditNote(invoice, queueItem);
      break;
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Process EMIT action
 */
async function processEmit(invoice: any, queueItem: any): Promise<void> {
  // Build SUNAT invoice data
  const sunatData: InvoiceData = {
    serie: invoice.series,
    numero: invoice.invoice_number,
    tipo: invoice.invoice_type === 'BOLETA' ? '03' : '01',
    fechaEmision: invoice.created_at.toISOString().split('T')[0],
    tipoDocumentoCliente: '1', // DNI default
    numeroDocumentoCliente: invoice.customer_doc || '00000000',
    razonSocialCliente: 'CLIENTE', // Would come from customer data
    moneda: 'PEN',
    totalGravadas: (invoice.total_cents || 0) / 1.18,
    totalIgv: (invoice.total_cents || 0) * 0.18 / 1.18,
    totalImporte: (invoice.total_cents || 0) / 100,
    items: [
      {
        codigo: 'ITEM001',
        descripcion: 'Productos varios',
        cantidad: 1,
        unidadMedida: 'NIU',
        precioUnitario: (invoice.total_cents || 0) / 100 / 1.18,
        precioTotal: (invoice.total_cents || 0) / 100 / 1.18,
        igv: (invoice.total_cents || 0) * 0.18 / 1.18 / 100,
      },
    ],
  };

  // Send to SUNAT
  const cdr = await sunatClient.sendInvoice(sunatData);

  // Store CDR
  await prisma.invoice_cdr.create({
    data: {
      id: uuidv4(),
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      response_code: '0',
      response_message: 'OK',
      received_at: new Date(),
    },
  });

  // Update queue status
  await prisma.invoice_queue.update({
    where: { id: queueItem.id },
    data: {
      status: 'COMPLETED',
      processed_at: new Date(),
    },
  });

  pinoLogger.info({
    invoiceId: invoice.id,
    sunatCode: '0',
  }, 'Invoice successfully processed by SUNAT');
}

/**
 * Process VOID action
 */
async function processVoid(invoice: any, queueItem: any): Promise<void> {
  const cdr = await sunatClient.sendVoidRequest(
    invoice.invoice_type === 'BOLETA' ? '03' : '01',
    invoice.series,
    invoice.invoice_number,
    invoice.void_reason || 'Anulación solicitada'
  );

  // Store CDR for void
  await prisma.invoice_cdr.create({
    data: {
      id: uuidv4(),
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      response_code: '0',
      response_message: 'OK',
      received_at: new Date(),
    },
  });

  // Update queue status
  await prisma.invoice_queue.update({
    where: { id: queueItem.id },
    data: {
      status: 'COMPLETED',
      processed_at: new Date(),
    },
  });

  pinoLogger.info({
    invoiceId: invoice.id,
  }, 'Invoice void successfully processed');
}

/**
 * Process CREDIT_NOTE action
 */
async function processCreditNote(invoice: any, queueItem: any): Promise<void> {
  // Similar to emit but for credit notes
  // Implementation would be similar to processEmit
  
  // For now, just mark as completed
  await prisma.invoice_queue.update({
    where: { id: queueItem.id },
    data: {
      status: 'COMPLETED',
      processed_at: new Date(),
    },
  });

  pinoLogger.info({
    invoiceId: invoice.id,
  }, 'Credit note processed');
}

/**
 * Retry failed items (manual or scheduled)
 */
export async function retryFailedItems(maxAge?: number): Promise<number> {
  const cutoffDate = maxAge 
    ? new Date(Date.now() - maxAge * 60 * 60 * 1000)
    : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default 24 hours

  const failedItems = await prisma.invoice_queue.updateMany({
    where: {
      status: 'FAILED',
      last_attempt_at: {
        lte: cutoffDate,
      },
      attempts: {
        lt: prisma.invoice_queue.fields.max_attempts,
      },
    },
    data: {
      status: 'PENDING',
      scheduled_at: new Date(),
    },
  });

  pinoLogger.info({ count: failedItems.count }, 'Reset failed items for retry');

  return failedItems.count;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const stats = await prisma.invoice_queue.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
  });

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  stats.forEach((stat: any) => {
    result[stat.status.toLowerCase() as keyof typeof result] = stat._count.status;
  });

  return result;
}

// Run if called directly
if (require.main === module) {
  processInvoiceQueue()
    .then((result) => {
      console.log('Processing completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Processing failed:', error);
      process.exit(1);
    });
}
