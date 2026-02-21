/**
 * Invoice PDF/HTML Generator
 *
 * Generates an HTML representation of an invoice for printing or PDF conversion.
 * Includes SUNAT QR code and standard formatting.
 *
 * @module core/integrations/sunat/invoice-pdf
 */

export interface InvoicePDFData {
  invoiceType: 'BOLETA' | 'FACTURA';
  series: string;
  number: string;
  date: string;
  ruc: string;
  tenantName: string;
  tenantAddress: string;
  customerName: string;
  customerDoc: string;
  customerDocType: string;
  customerAddress?: string;
  items: Array<{
    code: string;
    name: string;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  subtotalCents: number;
  igvCents: number;
  totalCents: number;
  qrDataUrl?: string;
  logoUrl?: string;
}

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

/**
 * Generate an HTML document for an invoice (for printing or PDF export)
 */
export function generateInvoicePDFHtml(data: InvoicePDFData): string {
  const typeLabel = data.invoiceType === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';

  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${item.code}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${item.name}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${centsToSoles(item.unitPriceCents)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${centsToSoles(item.totalCents)}</td>
    </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} ${data.series}-${data.number}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 12px; }
    .header h1 { margin: 0; font-size: 14px; }
    .header h2 { margin: 4px 0; font-size: 16px; color: #c00; }
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .info-block { flex: 1; }
    .info-block p { margin: 2px 0; }
    .label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f5f5f5; padding: 6px 8px; text-align: left; border-bottom: 2px solid #333; font-size: 11px; }
    .totals { text-align: right; margin-top: 8px; }
    .totals p { margin: 2px 0; }
    .total-line { font-size: 16px; font-weight: bold; }
    .qr-section { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ccc; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 12px; }
    @media print { body { padding: 0; } .container { border: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" style="max-height:60px;margin-bottom:8px">` : ''}
      <h1>${data.tenantName}</h1>
      <p>${data.tenantAddress}</p>
      <p>RUC: ${data.ruc}</p>
      <h2>${typeLabel}</h2>
      <p style="font-size:14px;font-weight:bold">${data.series}-${data.number}</p>
      <p>Fecha: ${data.date}</p>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <p><span class="label">Cliente:</span> ${data.customerName || 'CONSUMIDOR FINAL'}</p>
        <p><span class="label">${data.customerDocType || 'Doc'}:</span> ${data.customerDoc || '-'}</p>
        ${data.customerAddress ? `<p><span class="label">Dirección:</span> ${data.customerAddress}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:50px">Cant.</th>
          <th style="width:80px">Código</th>
          <th>Descripción</th>
          <th style="text-align:right;width:100px">P. Unit.</th>
          <th style="text-align:right;width:100px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <p><span class="label">Op. Gravada:</span> ${centsToSoles(data.subtotalCents)}</p>
      <p><span class="label">IGV (18%):</span> ${centsToSoles(data.igvCents)}</p>
      <p class="total-line"><span class="label">TOTAL:</span> ${centsToSoles(data.totalCents)}</p>
    </div>

    ${data.qrDataUrl ? `
    <div class="qr-section">
      <img src="${data.qrDataUrl}" alt="QR SUNAT" style="width:150px;height:150px">
      <p style="font-size:10px;color:#666">Representación impresa de la ${data.invoiceType === 'FACTURA' ? 'factura' : 'boleta'} electrónica</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Documento generado electrónicamente - Válido como comprobante de pago</p>
    </div>
  </div>
</body>
</html>`;
}
