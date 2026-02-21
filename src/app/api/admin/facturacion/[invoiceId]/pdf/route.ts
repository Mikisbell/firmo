/**
 * Admin Invoice PDF API - GET
 *
 * Returns HTML representation of an invoice for printing/PDF.
 * Includes SUNAT QR code if available.
 * Requires admin auth.
 *
 * @module app/api/admin/facturacion/[invoiceId]/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { generateInvoicePDFHtml } from '@/src/core/integrations/sunat/invoice-pdf';
import { generateSunatReceiptQR, type ReceiptQRParams } from '@/src/core/integrations/sunat/receipt-qr';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { invoiceId } = await context.params;
    const tenantId = authResult.user.tenantId;

    const invoice = await prisma.invoices.findFirst({
      where: { id: invoiceId, tenant_id: tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Get tenant settings
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { legal_name: true, address_text: true, ruc: true, logo_url: true },
    });

    // Get CDR for hash
    const cdr = await prisma.invoice_cdr.findFirst({
      where: { tenant_id: tenantId, invoice_id: invoiceId },
    });

    // Generate SUNAT QR if we have the data
    let qrDataUrl: string | undefined;
    if (settings?.ruc && invoice.series && invoice.invoice_number) {
      const paymentSummary = invoice.payment_summary as any;
      const qrParams: ReceiptQRParams = {
        ruc: settings.ruc,
        invoiceType: invoice.invoice_type as 'BOLETA' | 'FACTURA',
        series: invoice.series,
        number: invoice.invoice_number,
        igvCents: paymentSummary?.taxCents ?? 0,
        totalCents: invoice.total_cents,
        date: new Date(invoice.created_at),
        customerDocType: invoice.customer_doc_type ?? '',
        customerDoc: invoice.customer_doc ?? '',
        hash: cdr?.hash ?? '',
      };

      const qrResult = await generateSunatReceiptQR(qrParams);
      if (qrResult.success) {
        qrDataUrl = qrResult.data;
      }
    }

    // Get order items for the invoice
    const order = await prisma.orders.findFirst({
      where: { id: invoice.order_id, tenant_id: tenantId },
    });

    const items = (order?.items as any[])?.map((item: any) => ({
      code: item.product_id?.slice(0, 8) ?? '-',
      name: item.name ?? 'Producto',
      qty: item.quantity ?? 1,
      unitPriceCents: item.price_cents ?? 0,
      totalCents: (item.price_cents ?? 0) * (item.quantity ?? 1),
    })) ?? [];

    const paymentSummary = invoice.payment_summary as any;

    const html = generateInvoicePDFHtml({
      invoiceType: invoice.invoice_type as 'BOLETA' | 'FACTURA',
      series: invoice.series ?? '',
      number: invoice.invoice_number ?? '',
      date: new Date(invoice.created_at).toLocaleDateString('es-PE'),
      ruc: settings?.ruc ?? '',
      tenantName: settings?.legal_name ?? '',
      tenantAddress: settings?.address_text ?? '',
      customerName: (invoice as any).customer_name ?? '',
      customerDoc: invoice.customer_doc ?? '',
      customerDocType: invoice.customer_doc_type ?? '',
      items,
      subtotalCents: paymentSummary?.subtotalCents ?? 0,
      igvCents: paymentSummary?.taxCents ?? 0,
      totalCents: invoice.total_cents,
      qrDataUrl,
      logoUrl: settings?.logo_url ?? undefined,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
