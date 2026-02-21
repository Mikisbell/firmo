/**
 * QR Code Generator Service
 *
 * Genera códigos QR como data URLs para pagos Yape/Plin y uso genérico.
 * Stateless - no requiere DI.
 *
 * @module core/payments/qr-generator.service
 */

import QRCode from 'qrcode';
import { Result, ok, err, DomainError, ValidationError } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface QROptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const DEFAULT_OPTIONS: Required<QROptions> = {
  width: 300,
  margin: 2,
  errorCorrectionLevel: 'M',
};

// ============================================================================
// Validation
// ============================================================================

const PERU_PHONE_REGEX = /^9\d{8}$/;

function validatePhone(phone: string): Result<string, ValidationError> {
  if (!PERU_PHONE_REGEX.test(phone)) {
    return err(new ValidationError(
      'Número de teléfono inválido. Debe ser 9 dígitos empezando con 9',
      'phone',
    ));
  }
  return ok(phone);
}

function validateAmount(amountCents: number): Result<number, ValidationError> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return err(new ValidationError(
      'El monto debe ser mayor a 0',
      'amountCents',
    ));
  }
  return ok(amountCents);
}

// ============================================================================
// QR Generator Service
// ============================================================================

export class QrGeneratorService {
  /**
   * Genera QR de pago Yape
   *
   * URL format: https://yape.pe/pay?phone={PHONE}&amount={SOLES}&concept=Orden+{NUM}
   */
  async generateYapeQR(
    phone: string,
    amountCents: number,
    orderNumber: number | string,
    options?: QROptions,
  ): Promise<Result<{ qrDataUrl: string; paymentUrl: string }, DomainError>> {
    const phoneResult = validatePhone(phone);
    if (!phoneResult.success) return phoneResult;

    const amountResult = validateAmount(amountCents);
    if (!amountResult.success) return amountResult;

    const soles = (amountCents / 100).toFixed(2);
    const concept = encodeURIComponent(`Orden ${orderNumber}`);
    const paymentUrl = `https://yape.pe/pay?phone=${phone}&amount=${soles}&concept=${concept}`;

    const qrResult = await this.generateGenericQR(paymentUrl, options);
    if (!qrResult.success) return qrResult;

    return ok({ qrDataUrl: qrResult.data, paymentUrl });
  }

  /**
   * Genera QR de pago Plin
   *
   * URL format: https://plin.pe/pay?phone={PHONE}&amount={SOLES}&description=Orden+{NUM}
   */
  async generatePlinQR(
    phone: string,
    amountCents: number,
    orderNumber: number | string,
    options?: QROptions,
  ): Promise<Result<{ qrDataUrl: string; paymentUrl: string }, DomainError>> {
    const phoneResult = validatePhone(phone);
    if (!phoneResult.success) return phoneResult;

    const amountResult = validateAmount(amountCents);
    if (!amountResult.success) return amountResult;

    const soles = (amountCents / 100).toFixed(2);
    const description = encodeURIComponent(`Orden ${orderNumber}`);
    const paymentUrl = `https://plin.pe/pay?phone=${phone}&amount=${soles}&description=${description}`;

    const qrResult = await this.generateGenericQR(paymentUrl, options);
    if (!qrResult.success) return qrResult;

    return ok({ qrDataUrl: qrResult.data, paymentUrl });
  }

  /**
   * Genera QR genérico desde cualquier texto
   */
  async generateGenericQR(
    text: string,
    options?: QROptions,
  ): Promise<Result<string, DomainError>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: opts.width,
        margin: opts.margin,
        errorCorrectionLevel: opts.errorCorrectionLevel,
      });
      return ok(dataUrl);
    } catch (error) {
      return err(new DomainError(
        `Error al generar código QR: ${(error as Error).message}`,
        'QR_GENERATION_FAILED',
      ));
    }
  }
}

// Singleton
export const qrGeneratorService = new QrGeneratorService();
