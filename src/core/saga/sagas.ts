/**
 * Saga Definitions
 * 
 * Defines the three main sagas: CompleteSale, VoidSale, and ApplyPromotion
 */

import { SagaDefinition, SagaContext } from './types';
import { logger } from '@/src/core/observability/logger';

/**
 * Complete Sale Saga Context
 */
export interface CompleteSaleContext extends SagaContext {
  orderId: string;
  checkId: string;
  paymentMethod: string;
  amountCents: number;
  couponId?: string;
  actorId: string;
}

/**
 * Void Sale Saga Context
 */
export interface VoidSaleContext extends SagaContext {
  orderId: string;
  invoiceId: string;
  reason: string;
  approvedBy: string;
  actorId: string;
}

/**
 * Apply Promotion Saga Context
 */
export interface ApplyPromotionContext extends SagaContext {
  orderId: string;
  promotionId: string;
  actorId: string;
}

/**
 * Complete Sale Saga
 * 
 * Orchestrates: payment validation → coupon reservation → invoice generation → ticket printing
 */
export const completeSaleSaga: SagaDefinition<CompleteSaleContext> = {
  name: 'COMPLETE_SALE',
  timeout: 30000, // 30 seconds
  steps: [
    {
      name: 'validate_payment',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_VALIDATE_PAYMENT', 'Validating payment', {
          orderId: ctx.orderId,
          amountCents: ctx.amountCents,
        });

        // Validate payment sufficiency
        if (ctx.amountCents <= 0) {
          throw new Error('Invalid payment amount');
        }

        return {
          paymentId: `PAY-${Date.now()}`,
          validated: true,
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_VALIDATE_PAYMENT', 'Refunding payment', {
          orderId: ctx.orderId,
          paymentId: (result as any)?.paymentId,
        });

        // Refund payment
        // Implementation would call payment service
      },
      retryable: true,
      maxRetries: 3,
    },
    {
      name: 'reserve_coupon',
      do: async (ctx) => {
        if (!ctx.couponId) {
          return { couponReserved: false };
        }

        logger.debug('SAGA_STEP_RESERVE_COUPON', 'Reserving coupon', {
          orderId: ctx.orderId,
          couponId: ctx.couponId,
        });

        // Reserve coupon
        // Implementation would call coupon service
        return {
          couponReserved: true,
          couponId: ctx.couponId,
        };
      },
      undo: async (ctx, result) => {
        if (!(result as any)?.couponReserved) return;

        logger.debug('SAGA_STEP_UNDO_RESERVE_COUPON', 'Releasing coupon', {
          orderId: ctx.orderId,
          couponId: ctx.couponId,
        });

        // Release coupon
        // Implementation would call coupon service
      },
      retryable: true,
      maxRetries: 3,
    },
    {
      name: 'issue_invoice',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_ISSUE_INVOICE', 'Generating invoice', {
          orderId: ctx.orderId,
          checkId: ctx.checkId,
        });

        // Generate invoice
        // Implementation would call invoice service
        return {
          invoiceId: `INV-${Date.now()}`,
          invoiceNumber: Math.floor(Math.random() * 1000000),
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_ISSUE_INVOICE', 'Voiding invoice', {
          orderId: ctx.orderId,
          invoiceId: (result as any)?.invoiceId,
        });

        // Void invoice
        // Implementation would call invoice service
      },
      retryable: false, // Invoice generation is not retryable
      maxRetries: 1,
    },
    {
      name: 'queue_print',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_QUEUE_PRINT', 'Queuing ticket for printing', {
          orderId: ctx.orderId,
          invoiceId: (ctx as any).invoiceId,
        });

        // Queue ticket for printing
        // Implementation would call print service
        return {
          printJobId: `PRINT-${Date.now()}`,
          queued: true,
        };
      },
      undo: async (ctx) => {
        logger.debug('SAGA_STEP_UNDO_QUEUE_PRINT', 'Canceling print job', {
          orderId: ctx.orderId,
        });

        // Cancel print job
        // Implementation would call print service
      },
      retryable: true,
      maxRetries: 3,
    },
  ],
};

/**
 * Void Sale Saga
 * 
 * Orchestrates: authorization validation → invoice voiding → payment refund → coupon release
 */
export const voidSaleSaga: SagaDefinition<VoidSaleContext> = {
  name: 'VOID_SALE',
  timeout: 30000,
  steps: [
    {
      name: 'validate_authorization',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_VALIDATE_AUTHORIZATION', 'Validating manager authorization', {
          orderId: ctx.orderId,
          approvedBy: ctx.approvedBy,
        });

        // Validate manager authorization
        if (!ctx.approvedBy) {
          throw new Error('Manager approval required');
        }

        return {
          authorized: true,
          approver: ctx.approvedBy,
        };
      },
      undo: async () => {
        // No compensation needed for authorization check
      },
      retryable: false,
      maxRetries: 1,
    },
    {
      name: 'void_invoice',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_VOID_INVOICE', 'Voiding invoice', {
          orderId: ctx.orderId,
          invoiceId: ctx.invoiceId,
        });

        // Void invoice
        // Implementation would call invoice service
        return {
          voidId: `VOID-${Date.now()}`,
          voided: true,
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_VOID_INVOICE', 'Restoring invoice', {
          orderId: ctx.orderId,
          invoiceId: ctx.invoiceId,
        });

        // Restore invoice
        // Implementation would call invoice service
      },
      retryable: false,
      maxRetries: 1,
    },
    {
      name: 'refund_payment',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_REFUND_PAYMENT', 'Processing refund', {
          orderId: ctx.orderId,
        });

        // Process refund
        // Implementation would call payment service
        return {
          refundId: `REFUND-${Date.now()}`,
          refunded: true,
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_REFUND_PAYMENT', 'Reversing refund', {
          orderId: ctx.orderId,
          refundId: (result as any)?.refundId,
        });

        // Reverse refund
        // Implementation would call payment service
      },
      retryable: true,
      maxRetries: 3,
    },
    {
      name: 'release_coupon',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_RELEASE_COUPON', 'Releasing coupon', {
          orderId: ctx.orderId,
        });

        // Release coupon
        // Implementation would call coupon service
        return {
          released: true,
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_RELEASE_COUPON', 'Re-reserving coupon', {
          orderId: ctx.orderId,
        });

        // Re-reserve coupon
        // Implementation would call coupon service
      },
      retryable: true,
      maxRetries: 3,
    },
  ],
};

/**
 * Apply Promotion Saga
 * 
 * Orchestrates: eligibility validation → promotion reservation → discount application → notification
 */
export const applyPromotionSaga: SagaDefinition<ApplyPromotionContext> = {
  name: 'APPLY_PROMOTION',
  timeout: 15000,
  steps: [
    {
      name: 'validate_eligibility',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_VALIDATE_ELIGIBILITY', 'Validating promotion eligibility', {
          orderId: ctx.orderId,
          promotionId: ctx.promotionId,
        });

        // Validate promotion eligibility
        if (!ctx.promotionId) {
          throw new Error('Invalid promotion');
        }

        return {
          eligible: true,
          promotionId: ctx.promotionId,
        };
      },
      undo: async () => {
        // No compensation needed for eligibility check
      },
      retryable: false,
      maxRetries: 1,
    },
    {
      name: 'reserve_promotion',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_RESERVE_PROMOTION', 'Reserving promotion', {
          orderId: ctx.orderId,
          promotionId: ctx.promotionId,
        });

        // Reserve promotion usage
        // Implementation would call promotion service
        return {
          reservationId: `RES-${Date.now()}`,
          reserved: true,
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_RESERVE_PROMOTION', 'Releasing promotion', {
          orderId: ctx.orderId,
          reservationId: (result as any)?.reservationId,
        });

        // Release promotion
        // Implementation would call promotion service
      },
      retryable: true,
      maxRetries: 3,
    },
    {
      name: 'apply_discount',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_APPLY_DISCOUNT', 'Applying discount', {
          orderId: ctx.orderId,
          promotionId: ctx.promotionId,
        });

        // Apply discount to order
        // Implementation would call order service
        return {
          discountApplied: true,
          discountAmount: 1000, // cents
        };
      },
      undo: async (ctx, result) => {
        logger.debug('SAGA_STEP_UNDO_APPLY_DISCOUNT', 'Removing discount', {
          orderId: ctx.orderId,
        });

        // Remove discount
        // Implementation would call order service
      },
      retryable: false,
      maxRetries: 1,
    },
    {
      name: 'send_notification',
      do: async (ctx) => {
        logger.debug('SAGA_STEP_SEND_NOTIFICATION', 'Sending promotion notification', {
          orderId: ctx.orderId,
          promotionId: ctx.promotionId,
        });

        // Send notification
        // Implementation would call notification service
        return {
          notificationSent: true,
        };
      },
      undo: async () => {
        // Notification failure doesn't require compensation
        logger.debug('SAGA_STEP_UNDO_SEND_NOTIFICATION', 'Notification undo (no-op)');
      },
      retryable: true,
      maxRetries: 3,
    },
  ],
};
