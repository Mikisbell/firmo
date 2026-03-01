/**
 * Receipt Builder - Generates ESC/POS bytes for thermal receipts and kitchen tickets
 *
 * Uses ESCPOSBuilder for command generation.
 * All monetary values in centavos.
 *
 * @module core/printing/receipt-builder
 */

import { ESCPOSBuilder } from './escpos-builder';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptLine {
  name: string;
  qty: number;
  totalCents: number;
  taxCategory?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
}

export interface ReceiptPayment {
  method: string;
  amountCents: number;
}

export interface ReceiptData {
  tenantName: string;
  address?: string;
  ruc?: string;
  invoiceType?: 'BOLETA' | 'FACTURA' | 'PRE-CUENTA';
  invoiceSeries?: string;
  invoiceNumber?: string;
  orderNumber: number;
  tableNumber?: string;
  date: string;
  lines: ReceiptLine[];
  subtotalCents: number;
  discountCents?: number;
  totalCents: number;
  payments?: ReceiptPayment[];
  clientDoc?: string;
  clientName?: string;
  sunatQrString?: string;
  footerMessage?: string;
}

export interface KitchenTicketItem {
  name: string;
  qty: number;
  mods?: string[];
  notes?: string;
}

export interface KitchenTicketData {
  orderNumber: number;
  orderType: 'MESA' | 'DELIVERY' | 'LLEVAR';
  tableNumber?: string;
  station: string;
  items: KitchenTicketItem[];
  time: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCents(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

const RECEIPT_WIDTH = 48;

// ============================================================================
// Builders
// ============================================================================

/**
 * Build a thermal receipt (boleta, factura, or pre-cuenta)
 */
export function buildThermalReceipt(data: ReceiptData): Uint8Array {
  const b = new ESCPOSBuilder();

  b.initialize();

  // Header
  b.align('center');
  b.bold(true).fontSize(2, 2);
  b.text(data.tenantName).lineFeed();
  b.fontSize(1, 1).bold(false);

  if (data.address) {
    b.text(data.address).lineFeed();
  }
  if (data.ruc) {
    b.text(`RUC: ${data.ruc}`).lineFeed();
  }

  b.lineFeed();

  // Document type
  if (data.invoiceType) {
    b.bold(true);
    b.text(data.invoiceType).lineFeed();
    b.bold(false);
  }
  if (data.invoiceSeries && data.invoiceNumber) {
    b.text(`${data.invoiceSeries}-${data.invoiceNumber}`).lineFeed();
  }

  // Date + table/order
  b.align('left');
  b.text(`Fecha: ${data.date}`).lineFeed();
  if (data.tableNumber) {
    b.text(`Mesa: ${data.tableNumber}`).lineFeed();
  }
  b.text(`Orden: #${data.orderNumber}`).lineFeed();

  // Client info
  if (data.clientName) {
    b.text(`Cliente: ${data.clientName}`).lineFeed();
  }
  if (data.clientDoc) {
    b.text(`Doc: ${data.clientDoc}`).lineFeed();
  }

  b.separator('-', RECEIPT_WIDTH);

  // Items
  for (const line of data.lines) {
    const qty = `${line.qty}x`;
    const total = formatCents(line.totalCents);
    const nameMaxLen = RECEIPT_WIDTH - qty.length - total.length - 2;
    const name = line.name.length > nameMaxLen
      ? line.name.slice(0, nameMaxLen)
      : line.name;
    b.textColumns(`${qty} ${name}`, total, RECEIPT_WIDTH);
  }

  b.separator('-', RECEIPT_WIDTH);

  // Totals with IGV breakdown per SUNAT
  const gravadoCents = data.lines
    .filter(l => !l.taxCategory || l.taxCategory === 'GRAVADO')
    .reduce((s, l) => s + l.totalCents, 0);
  const exoneradoCents = data.lines
    .filter(l => l.taxCategory === 'EXONERADO')
    .reduce((s, l) => s + l.totalCents, 0);
  const inafectoCents = data.lines
    .filter(l => l.taxCategory === 'INAFECTO')
    .reduce((s, l) => s + l.totalCents, 0);

  b.textColumns('Subtotal', formatCents(data.subtotalCents), RECEIPT_WIDTH);
  if (data.discountCents && data.discountCents > 0) {
    b.textColumns('Descuento', `-${formatCents(data.discountCents)}`, RECEIPT_WIDTH);
  }

  // IGV breakdown (only show relevant categories)
  if (gravadoCents > 0) {
    const baseCents = Math.round(gravadoCents / 1.18);
    const igvCents = gravadoCents - baseCents;
    b.textColumns('Op. Gravada', formatCents(baseCents), RECEIPT_WIDTH);
    b.textColumns('IGV 18%', formatCents(igvCents), RECEIPT_WIDTH);
  }
  if (exoneradoCents > 0) {
    b.textColumns('Op. Exonerada', formatCents(exoneradoCents), RECEIPT_WIDTH);
  }
  if (inafectoCents > 0) {
    b.textColumns('Op. Inafecta', formatCents(inafectoCents), RECEIPT_WIDTH);
  }

  b.bold(true).fontSize(1, 2);
  b.textColumns('TOTAL', formatCents(data.totalCents), RECEIPT_WIDTH);
  b.fontSize(1, 1).bold(false);

  // Payments
  if (data.payments && data.payments.length > 0) {
    b.lineFeed();
    for (const pay of data.payments) {
      b.textColumns(pay.method, formatCents(pay.amountCents), RECEIPT_WIDTH);
    }
  }

  // SUNAT QR
  if (data.sunatQrString) {
    b.lineFeed();
    b.align('center');
    b.qrCode(data.sunatQrString, 5);
    b.lineFeed();
  }

  // Footer
  b.align('center');
  b.text(data.footerMessage || 'Gracias por su preferencia').lineFeed();
  b.lineFeed();

  b.cut(true);

  return b.build();
}

/**
 * Build a kitchen ticket for a specific station
 */
export function buildKitchenTicket(data: KitchenTicketData): Uint8Array {
  const b = new ESCPOSBuilder();

  b.initialize();

  // Order number (large)
  b.align('center');
  b.bold(true).fontSize(3, 3);
  b.text(`#${data.orderNumber}`).lineFeed();
  b.fontSize(1, 1);

  // Order type badge
  b.fontSize(1, 2);
  b.text(data.orderType).lineFeed();
  b.fontSize(1, 1).bold(false);

  if (data.tableNumber) {
    b.text(`Mesa: ${data.tableNumber}`).lineFeed();
  }

  b.separator('=', RECEIPT_WIDTH);

  // Station header
  b.bold(true);
  b.align('center');
  b.text(data.station).lineFeed();
  b.bold(false);
  b.separator('-', RECEIPT_WIDTH);

  // Items
  b.align('left');
  for (const item of data.items) {
    b.bold(true).fontSize(1, 2);
    b.text(`${item.qty}x ${item.name}`).lineFeed();
    b.fontSize(1, 1).bold(false);

    if (item.mods && item.mods.length > 0) {
      for (const mod of item.mods) {
        b.text(`  + ${mod}`).lineFeed();
      }
    }
    if (item.notes) {
      b.text(`  * ${item.notes}`).lineFeed();
    }
  }

  b.separator('-', RECEIPT_WIDTH);

  // Time
  b.align('right');
  b.text(data.time).lineFeed();

  b.cut(true);

  return b.build();
}
