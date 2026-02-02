/**
 * Integration Tests - Service Layer
 * 
 * End-to-end tests with real database (Supabase test environment)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '@/core/services/order.service';
import { PromotionService } from '@/core/services/promotion.service';
import { InvoiceService } from '@/core/services/invoice.service';
import { PaymentService } from '@/core/services/payment.service';

const TEST_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Integration Tests - Complete Flow', () => {
  let prisma: PrismaClient;
  let orderService: OrderService;
  let promotionService: PromotionService;
  let invoiceService: InvoiceService;
  let paymentService: PaymentService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    orderService = new OrderService(prisma);
    promotionService = new PromotionService(prisma);
    invoiceService = new InvoiceService(prisma);
    paymentService = new PaymentService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete Sale Flow', () => {
    it('should create order, apply promotion, process payment, and emit invoice', async () => {
      // 1. Create order
      const orderResult = await orderService.createOrder({
        tenantId: TEST_TENANT_ID,
        orderType: 'DINE_IN',
        items: [
          {
            productId: 'prod-1',
            sku: 'POLLO_1_4',
            name: '1/4 Pollo con Papas',
            quantity: 2,
            unitPriceCents: 2500,
            station: 'PARRILLA',
          },
        ],
        tableNumber: '12',
        guestCount: 4,
        createdBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(orderResult.success).toBe(true);
      if (!orderResult.success) return;

      const orderId = orderResult.data.id;
      const originalTotal = orderResult.data.totalCents;

      // 2. Apply promotion (create one first if needed)
      const promotions = await promotionService.getActivePromotions(TEST_TENANT_ID);
      expect(promotions.success).toBe(true);

      if (promotions.success && promotions.data.length > 0) {
        const promotionId = promotions.data[0].id;
        
        const applyResult = await promotionService.applyPromotion({
          tenantId: TEST_TENANT_ID,
          orderId,
          promotionId,
          source: 'ORDER_SCREEN',
          appliedBy: TEST_USER_ID,
          terminalId: 'test-terminal',
        });

        expect(applyResult.success).toBe(true);

        // 3. Validate promotion
        const validateResult = await promotionService.validateAndApply(
          TEST_TENANT_ID,
          orderId,
          TEST_USER_ID
        );

        expect(validateResult.success).toBe(true);
        
        if (validateResult.success) {
          expect(validateResult.data.totalCents).toBeLessThan(originalTotal);
        }
      }

      // 4. Process payment
      const paymentResult = await paymentService.processPayment({
        tenantId: TEST_TENANT_ID,
        orderId,
        checkId: 'check-001',
        amountCents: orderResult.data.totalCents,
        method: 'CASH',
        reference: null,
        processedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(paymentResult.success).toBe(true);

      // 5. Emit invoice
      const invoiceResult = await invoiceService.emitInvoice({
        tenantId: TEST_TENANT_ID,
        orderId,
        checkId: 'check-001',
        invoiceType: 'BOLETA',
        customerDocType: 'DNI',
        customerDoc: '12345678',
        customerName: 'Cliente Test',
        customerEmail: 'test@example.com',
        emittedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(invoiceResult.success).toBe(true);
      if (invoiceResult.success) {
        expect(invoiceResult.data.series).toMatch(/^B/);
        expect(invoiceResult.data.invoiceNumber).toBeDefined();
        expect(invoiceResult.data.queueId).toBeDefined();
      }
    }, 30000); // 30s timeout for integration test

    it('should void invoice and create credit note', async () => {
      // First emit an invoice
      const orderResult = await orderService.createOrder({
        tenantId: TEST_TENANT_ID,
        orderType: 'DINE_IN',
        items: [
          {
            productId: 'prod-1',
            sku: 'ITEM_001',
            name: 'Test Item',
            quantity: 1,
            unitPriceCents: 1000,
            station: 'PARRILLA',
          },
        ],
        createdBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(orderResult.success).toBe(true);
      if (!orderResult.success) return;

      const invoiceResult = await invoiceService.emitInvoice({
        tenantId: TEST_TENANT_ID,
        orderId: orderResult.data.id,
        checkId: 'check-001',
        invoiceType: 'BOLETA',
        emittedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(invoiceResult.success).toBe(true);
      if (!invoiceResult.success) return;

      // Void the invoice
      const voidResult = await invoiceService.voidInvoice({
        tenantId: TEST_TENANT_ID,
        invoiceId: invoiceResult.data.id,
        reason: 'Anulación por prueba de integración',
        voidedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(voidResult.success).toBe(true);
      if (voidResult.success) {
        expect(voidResult.data.creditNoteId).toBeDefined();
        expect(voidResult.data.creditNoteNumber).toBeDefined();
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle duplicate invoice gracefully', async () => {
      // Create order
      const orderResult = await orderService.createOrder({
        tenantId: TEST_TENANT_ID,
        orderType: 'DINE_IN',
        items: [
          {
            productId: 'prod-1',
            sku: 'ITEM_001',
            name: 'Test Item',
            quantity: 1,
            unitPriceCents: 1000,
            station: 'PARRILLA',
          },
        ],
        createdBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(orderResult.success).toBe(true);
      if (!orderResult.success) return;

      // Emit first invoice
      const invoice1 = await invoiceService.emitInvoice({
        tenantId: TEST_TENANT_ID,
        orderId: orderResult.data.id,
        checkId: 'check-001',
        invoiceType: 'BOLETA',
        emittedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(invoice1.success).toBe(true);

      // Try to emit second invoice (should fail)
      const invoice2 = await invoiceService.emitInvoice({
        tenantId: TEST_TENANT_ID,
        orderId: orderResult.data.id,
        checkId: 'check-001',
        invoiceType: 'BOLETA',
        emittedBy: TEST_USER_ID,
        terminalId: 'test-terminal',
      });

      expect(invoice2.success).toBe(false);
      if (!invoice2.success) {
        expect(invoice2.error.code).toBe('CONFLICT');
      }
    }, 30000);
  });
});
