/**
 * QR Generator Service - Tests
 *
 * @module core/payments/__tests__/qr-generator.service.test
 */

import { describe, it, expect } from 'vitest';
import { QrGeneratorService } from '../qr-generator.service';

describe('QrGeneratorService', () => {
  const service = new QrGeneratorService();

  describe('generateYapeQR', () => {
    it('debe generar QR Yape válido con data URL', async () => {
      const result = await service.generateYapeQR('987654321', 2500, 42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(result.data.paymentUrl).toContain('https://yape.pe/pay');
        expect(result.data.paymentUrl).toContain('phone=987654321');
        expect(result.data.paymentUrl).toContain('amount=25.00');
        expect(result.data.paymentUrl).toContain('concept=Orden');
      }
    });

    it('debe convertir centavos a soles en la URL', async () => {
      const result = await service.generateYapeQR('912345678', 1050, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentUrl).toContain('amount=10.50');
      }
    });

    it('debe retornar error si phone no tiene 9 dígitos', async () => {
      const result = await service.generateYapeQR('12345', 1000, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('teléfono');
      }
    });

    it('debe retornar error si phone no empieza con 9', async () => {
      const result = await service.generateYapeQR('123456789', 1000, 1);

      expect(result.success).toBe(false);
    });

    it('debe retornar error si amount es 0', async () => {
      const result = await service.generateYapeQR('987654321', 0, 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('monto');
      }
    });

    it('debe retornar error si amount es negativo', async () => {
      const result = await service.generateYapeQR('987654321', -100, 1);

      expect(result.success).toBe(false);
    });

    it('debe URL-encodear el concepto con número de orden', async () => {
      const result = await service.generateYapeQR('987654321', 1000, 999);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentUrl).toContain('concept=Orden%20999');
      }
    });
  });

  describe('generatePlinQR', () => {
    it('debe generar QR Plin válido con data URL', async () => {
      const result = await service.generatePlinQR('987654321', 3500, 10);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(result.data.paymentUrl).toContain('https://plin.pe/pay');
        expect(result.data.paymentUrl).toContain('phone=987654321');
        expect(result.data.paymentUrl).toContain('amount=35.00');
        expect(result.data.paymentUrl).toContain('description=Orden');
      }
    });

    it('debe retornar error si phone inválido', async () => {
      const result = await service.generatePlinQR('abc', 1000, 1);

      expect(result.success).toBe(false);
    });

    it('debe retornar error si amount inválido', async () => {
      const result = await service.generatePlinQR('987654321', 0, 1);

      expect(result.success).toBe(false);
    });
  });

  describe('generateGenericQR', () => {
    it('debe generar QR genérico desde texto', async () => {
      const result = await service.generateGenericQR('https://example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatch(/^data:image\/png;base64,/);
      }
    });

    it('debe respetar opciones de ancho', async () => {
      const result = await service.generateGenericQR('test', { width: 200 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatch(/^data:image\/png;base64,/);
      }
    });

    it('debe generar QRs diferentes para textos diferentes', async () => {
      const result1 = await service.generateGenericQR('texto-1');
      const result2 = await service.generateGenericQR('texto-2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data).not.toBe(result2.data);
      }
    });

    it('debe generar QR con error correction level configurable', async () => {
      const result = await service.generateGenericQR('test', { errorCorrectionLevel: 'H' });

      expect(result.success).toBe(true);
    });
  });

  describe('diferencias Yape vs Plin', () => {
    it('debe generar URLs diferentes para Yape y Plin', async () => {
      const yape = await service.generateYapeQR('987654321', 1000, 1);
      const plin = await service.generatePlinQR('987654321', 1000, 1);

      expect(yape.success).toBe(true);
      expect(plin.success).toBe(true);
      if (yape.success && plin.success) {
        expect(yape.data.paymentUrl).toContain('yape.pe');
        expect(plin.data.paymentUrl).toContain('plin.pe');
        expect(yape.data.qrDataUrl).not.toBe(plin.data.qrDataUrl);
      }
    });
  });
});
