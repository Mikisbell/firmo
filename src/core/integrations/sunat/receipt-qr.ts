/**
 * SUNAT Receipt QR Code Generator
 *
 * Generates the QR code required on electronic receipts per SUNAT regulations.
 * Format: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|DOC_TIPO|DOC_NUM|HASH
 *
 * @module core/integrations/sunat/receipt-qr
 */

import { Result, ok, err, DomainError } from '@/src/core/result';
import { qrGeneratorService } from '@/src/core/payments/qr-generator.service';

export interface ReceiptQRParams {
  ruc: string;
  invoiceType: 'BOLETA' | 'FACTURA';
  series: string;
  number: string;
  igvCents: number;
  totalCents: number;
  date: Date;
  customerDocType: string;
  customerDoc: string;
  hash: string;
}

/**
 * Build the pipe-separated string for SUNAT QR code
 */
export function buildSunatQRString(params: ReceiptQRParams): string {
  const tipoDoc = params.invoiceType === 'FACTURA' ? '01' : '03';
  const igvSoles = (params.igvCents / 100).toFixed(2);
  const totalSoles = (params.totalCents / 100).toFixed(2);

  const d = params.date;
  const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const docTypeMap: Record<string, string> = { RUC: '6', DNI: '1', CE: '4', PASAPORTE: '7' };
  const docTipo = docTypeMap[params.customerDocType] ?? '-';

  return [
    params.ruc,
    tipoDoc,
    params.series,
    params.number,
    igvSoles,
    totalSoles,
    fecha,
    docTipo,
    params.customerDoc || '-',
    params.hash || '',
  ].join('|');
}

/**
 * Generate SUNAT receipt QR code as data URL
 */
export async function generateSunatReceiptQR(
  params: ReceiptQRParams,
): Promise<Result<string, DomainError>> {
  const qrString = buildSunatQRString(params);

  const result = await qrGeneratorService.generateGenericQR(qrString, {
    width: 200,
    errorCorrectionLevel: 'M',
  });

  if (!result.success) {
    return err(new DomainError('Error al generar QR SUNAT', 'SUNAT_QR_ERROR'));
  }

  return ok(result.data);
}
