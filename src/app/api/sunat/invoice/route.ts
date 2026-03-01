/**
 * SUNAT API - Issue Electronic Invoice
 * 
 * POST /api/sunat/invoice
 * 
 * Issues a SUNAT electronic invoice (boleta/factura)
 * Creates invoice record and adds to processing queue
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

const IssueInvoiceSchema = z.object({
  order_id: z.string().uuid(),
  check_id: z.string().min(1),
  invoice_type: z.enum(['BOLETA', 'FACTURA']),
  customer_doc_type: z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE']).optional(),
  customer_doc: z.string().optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional(),
  series: z.string().optional(), // e.g., "B001" or "F001"
});

// Generate next invoice number based on series
async function getNextInvoiceNumber(tenantId: string, series: string): Promise<string> {
  const lastInvoice = await prisma.invoices.findFirst({
    where: {
      tenant_id: tenantId,
      series: series,
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      invoice_number: true,
    },
  });

  if (!lastInvoice?.invoice_number) {
    return '00000001';
  }

  const lastNumber = parseInt(lastInvoice.invoice_number, 10);
  const nextNumber = lastNumber + 1;
  return nextNumber.toString().padStart(8, '0');
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = getTenantId();
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = IssueInvoiceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const {
      order_id,
      check_id,
      invoice_type,
      customer_doc_type,
      customer_doc,
      customer_name,
      customer_email,
      series: providedSeries,
    } = validationResult.data;

    // Verify order exists and belongs to tenant
    const order = await prisma.orders.findFirst({
      where: { 
        id: order_id, 
        tenant_id: tenantId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if invoice already exists for this order+check
    const existingInvoice = await prisma.invoices.findFirst({
      where: {
        tenant_id: tenantId,
        order_id,
        check_id,
        status: { not: 'VOIDED' },
      },
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice already exists for this order and check', existing_invoice_id: existingInvoice.id },
        { status: 409 }
      );
    }

    // Determine series (B001 for boleta, F001 for factura by default)
    const series = providedSeries || (invoice_type === 'BOLETA' ? 'B001' : 'F001');
    
    // Generate invoice number
    const invoiceNumber = await getNextInvoiceNumber(tenantId, series);

    // Get check data from order
    const checks = order.checks as any[] || [];
    const check = checks.find((c: any) => c.check_id === check_id);
    
    if (!check) {
      return NextResponse.json(
        { error: 'Check not found in order' },
        { status: 404 }
      );
    }

    const totalCents = check.total_cents || 0;

    // Create invoice record
    const invoiceId = uuidv4();
    const invoice = await prisma.invoices.create({
      data: {
        id: invoiceId,
        tenant_id: tenantId,
        order_id,
        check_id,
        invoice_type,
        series,
        invoice_number: invoiceNumber,
        customer_doc_type: customer_doc_type || null,
        customer_doc: customer_doc || null,
        total_cents: totalCents,
        payment_summary: {
          items: check.lines || [],
          subtotal_cents: check.subtotal_cents || totalCents,
          discount_cents: check.discount_cents || 0,
          total_cents: totalCents,
          customer_name: customer_name || null,
          customer_email: customer_email || null,
        },
        status: 'ISSUED',
      },
    });

    // Add to invoice queue for SUNAT processing
    const queueId = uuidv4();
    await prisma.invoice_queue.create({
      data: {
        id: queueId,
        tenant_id: tenantId,
        invoice_id: invoiceId,
        action: 'EMIT',
        priority: 5,
        attempts: 0,
        max_attempts: 3,
        scheduled_at: new Date(),
        status: 'PENDING',
      },
    });

    // TODO: Trigger async SUNAT processing (would be done by a worker)
    // For now, we'll simulate immediate processing in development
    if (process.env.NODE_ENV === 'development') {
      // Simulate SUNAT processing
      setTimeout(async () => {
        try {
          await prisma.invoice_queue.update({
            where: { id: queueId },
            data: {
              status: 'COMPLETED',
              processed_at: new Date(),
            },
          });
          
          // Create CDR record (Constancia de Recepción)
          await prisma.invoice_cdr.create({
            data: {
              id: uuidv4(),
              tenant_id: tenantId,
              invoice_id: invoiceId,
              response_code: '0', // Success code
              response_message: 'La Comprobante fue registrada exitosamente',
              cdr_xml: '<CDR>Mock CDR for development</CDR>',
              hash: `HASH-${invoiceNumber}`,
            },
          });
          
          pinoLogger.info({ invoice_id: invoiceId }, 'SUNAT processing simulated (DEV)');
        } catch (error) {
          pinoLogger.error({ error, invoice_id: invoiceId }, 'SUNAT simulation failed');
        }
      }, 1000);
    }

    pinoLogger.info({
      invoice_id: invoiceId,
      order_id,
      check_id,
      series,
      invoice_number: invoiceNumber,
      invoice_type,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Invoice issued and queued for SUNAT');

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoiceId,
        order_id,
        check_id,
        invoice_type,
        series,
        invoice_number: invoiceNumber,
        total_cents: totalCents,
        status: 'ISSUED',
        customer_doc_type,
        customer_doc,
        customer_name,
        customer_email,
      },
      queue: {
        id: queueId,
        status: 'PENDING',
        action: 'EMIT',
      },
      message: 'Factura emitida exitosamente y en cola para procesamiento SUNAT',
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error issuing invoice');
    return NextResponse.json(
      { error: 'Error al emitir factura' },
      { status: 500 }
    );
  }
}
