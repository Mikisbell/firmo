/**
 * SUNAT API - Void Electronic Invoice
 * 
 * POST /api/sunat/void
 * 
 * Voids a SUNAT electronic invoice (generates nota de crédito)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

const VoidInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = user.tenantId;
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = VoidInvoiceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { invoice_id, reason } = validationResult.data;

    // Verify invoice exists and belongs to tenant
    const invoice = await prisma.invoices.findFirst({
      where: { 
        id: invoice_id, 
        tenant_id: tenantId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if already voided
    if (invoice.status === 'VOIDED') {
      return NextResponse.json(
        { error: 'Invoice is already voided' },
        { status: 409 }
      );
    }

    // Update invoice status
    await prisma.invoices.update({
      where: { id: invoice_id },
      data: {
        status: 'VOIDED',
        void_reason: reason,
        voided_by: user.id,
        voided_at: new Date(),
      },
    });

    // Create credit note
    const creditNoteId = uuidv4();
    const creditNoteNumber = await getNextCreditNoteNumber(tenantId, invoice.series || 'B001');
    
    await prisma.credit_notes.create({
      data: {
        id: creditNoteId,
        tenant_id: tenantId,
        invoice_id: invoice_id,
        series: `N${invoice.series?.charAt(0) || 'B'}001`, // NC001 for credit notes
        number: creditNoteNumber,
        reason: reason,
        total_cents: invoice.total_cents,
        status: 'ISSUED',
        created_by: user.id,
      },
    });

    // Add to invoice queue for SUNAT processing
    const queueId = uuidv4();
    await prisma.invoice_queue.create({
      data: {
        id: queueId,
        tenant_id: tenantId,
        invoice_id: invoice_id,
        action: 'VOID',
        priority: 10, // High priority for voids
        attempts: 0,
        max_attempts: 3,
        scheduled_at: new Date(),
        status: 'PENDING',
      },
    });

    pinoLogger.info({
      invoice_id,
      credit_note_id: creditNoteId,
      credit_note_number: creditNoteNumber,
      reason,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Invoice voided and credit note issued');

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice_id,
        status: 'VOIDED',
        void_reason: reason,
        voided_at: new Date().toISOString(),
      },
      credit_note: {
        id: creditNoteId,
        credit_note_number: creditNoteNumber,
        series: `N${invoice.series?.charAt(0) || 'B'}001`,
        total_cents: invoice.total_cents,
        reason,
        status: 'ISSUED',
      },
      queue: {
        id: queueId,
        status: 'PENDING',
        action: 'VOID',
      },
      message: 'Factura anulada exitosamente y nota de crédito en cola para procesamiento SUNAT',
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error voiding invoice');
    return NextResponse.json(
      { error: 'Error al anular factura' },
      { status: 500 }
    );
  }
}

// Generate next credit note number
async function getNextCreditNoteNumber(tenantId: string, series: string): Promise<string> {
  const creditNoteSeries = `N${series.charAt(0)}001`;
  
  const lastCreditNote = await prisma.credit_notes.findFirst({
    where: {
      tenant_id: tenantId,
      series: creditNoteSeries,
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      number: true,
    },
  });

  if (!lastCreditNote?.number) {
    return '00000001';
  }

  const lastNumber = parseInt(lastCreditNote.number, 10);
  const nextNumber = lastNumber + 1;
  return nextNumber.toString().padStart(8, '0');
}
