/**
 * Promotion Service - Business Logic Layer
 * 
 * Handles promotion validation, application, and calculation.
 * Implements business rules for promotions.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, ConflictError } from '@/src/core/result';
import { CacheService } from '@/src/core/cache/redis.service';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { withTransaction } from '@/src/core/db/transaction';

export interface ApplyPromotionInput {
  tenantId: string;
  orderId: string;
  promotionId: string;
  source: 'ORDER_SCREEN' | 'CATALOG' | 'MANUAL';
  appliedBy: string;
  terminalId: string;
}

export interface ValidationResult {
  isValid: boolean;
  discountCents: number;
  newTotalCents: number;
  errors?: string[];
}

export class PromotionService {
  private cache: CacheService;
  
  constructor(
    private prisma: PrismaClient,
    cache?: CacheService
  ) {
    this.cache = cache || new CacheService();
  }

  /**
   * Get all active promotions for a tenant
   */
  async getActivePromotions(tenantId: string): Promise<Result<any[], DomainError>> {
    const cacheKey = `promotions:active:${tenantId}`;
    
    // Try cache
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) {
      return ok(cached);
    }

    try {
      const now = new Date();
      
      const promotions = await this.prisma.promotions.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
          OR: [
            { starts_at: null, ends_at: null },
            { starts_at: { lte: now }, ends_at: null },
            { starts_at: null, ends_at: { gte: now } },
            { starts_at: { lte: now }, ends_at: { gte: now } },
          ],
        },
        orderBy: [
          { priority: 'asc' },
          { created_at: 'desc' },
        ],
      });

      // Cache for 5 minutes
      await this.cache.set(cacheKey, promotions, 300);

      return ok(promotions);
    } catch (error) {
      return err(new DomainError(
        'Failed to fetch promotions',
        'PROMOTION_FETCH_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }

  /**
   * Validate promotion application
   */
  async validatePromotion(
    input: ApplyPromotionInput
  ): Promise<Result<ValidationResult, DomainError>> {
    // Get order
    const order = await this.prisma.orders.findFirst({
      where: {
        id: input.orderId,
        tenant_id: input.tenantId,
      },
    });

    if (!order) {
      return err(new ValidationError('Order not found'));
    }

    if (order.order_status === 'CANCELLED') {
      return err(new ValidationError('Cannot apply promotion to cancelled order'));
    }

    // Get promotion
    const promotion = await this.prisma.promotions.findFirst({
      where: {
        id: input.promotionId,
        tenant_id: input.tenantId,
        is_active: true,
      },
    });

    if (!promotion) {
      return err(new ValidationError('Promotion not found or inactive'));
    }

    // Check dates
    const now = new Date();
    if (promotion.starts_at && promotion.starts_at > now) {
      return err(new ValidationError('Promotion has not started yet'));
    }
    if (promotion.ends_at && promotion.ends_at < now) {
      return err(new ValidationError('Promotion has expired'));
    }

    // Check stackability
    if (order.promotion_id && !promotion.stackable) {
      const existingPromo = await this.prisma.promotions.findUnique({
        where: { id: order.promotion_id },
      });
      
      if (existingPromo && !existingPromo.stackable) {
        return err(new ConflictError(
          'Order already has a non-stackable promotion',
          'promotion_id'
        ));
      }
    }

    // Calculate discount
    const subtotal = order.subtotal_cents || 0;
    const discount = this.calculateDiscount(
      subtotal,
      promotion.type,
      promotion.value,
      promotion.rules as any
    );

    return ok({
      isValid: true,
      discountCents: discount,
      newTotalCents: subtotal - discount,
    });
  }

  /**
   * Apply promotion to order
   */
  async applyPromotion(
    input: ApplyPromotionInput
  ): Promise<Result<any, DomainError>> {
    // Validate first
    const validationResult = await this.validatePromotion(input);
    if (!validationResult.success) {
      return validationResult;
    }

    const validation = validationResult.data;

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Update order
        const updated = await tx.orders.update({
          where: { id: input.orderId },
          data: {
            promotion_id: input.promotionId,
            discount_cents: validation.discountCents,
            total_cents: validation.newTotalCents,
            promotion_snapshot: {
              id: input.promotionId,
              applied_at: new Date().toISOString(),
              tentative: true,
            },
            updated_at: new Date(),
          },
        });

        // Create tentative event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: new Date(),
            type: 'PROMOTION_APPLIED_TENTATIVE',
            entity_type: 'ORDER',
            entity_id: input.orderId,
            actor_id: input.appliedBy,
            actor_role_snapshot: 'USER',
            terminal_id: input.terminalId,
            payload: {
              order_id: input.orderId,
              promotion_id: input.promotionId,
              source: input.source,
            },
          },
        });

        return updated;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to apply promotion',
        'PROMOTION_APPLY_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    // Invalidate caches
    await this.cache.del(`order:${input.tenantId}:${input.orderId}`);

    pinoLogger.info(
      {
        orderId: input.orderId,
        promotionId: input.promotionId,
        discountCents: validation.discountCents,
      },
      'Promotion applied tentatively'
    );

    return ok({
      orderId: input.orderId,
      promotionId: input.promotionId,
      discountCents: validation.discountCents,
      newTotalCents: validation.newTotalCents,
      status: 'TENTATIVE',
    });
  }

  /**
   * Validate and finalize promotion at checkout
   */
  async validateAndApply(
    tenantId: string,
    orderId: string,
    validatedBy: string
  ): Promise<Result<any, DomainError>> {
    const order = await this.prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId,
      },
      include: {
        promotions: true,
      },
    });

    if (!order || !order.promotion_id) {
      return err(new ValidationError('Order has no tentative promotion'));
    }

    const promotion = order.promotions;
    if (!promotion) {
      return err(new ValidationError('Promotion not found'));
    }

    // Re-validate
    const subtotal = order.subtotal_cents || 0;
    const discount = this.calculateDiscount(
      subtotal,
      promotion.type,
      promotion.value,
      promotion.rules as any
    );

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.orders.update({
          where: { id: orderId },
          data: {
            discount_cents: discount,
            total_cents: subtotal - discount,
            promotion_snapshot: {
              ...(order.promotion_snapshot as any),
              tentative: false,
              validated_at: new Date().toISOString(),
              validated_by: validatedBy,
            },
            updated_at: new Date(),
          },
        });

        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'PROMOTION_VALIDATED_APPLIED',
            entity_type: 'ORDER',
            entity_id: orderId,
            actor_id: validatedBy,
            actor_role_snapshot: 'USER',
            terminal_id: 'system',
            payload: {
              order_id: orderId,
              promotion_id: order.promotion_id,
              recalculated_totals: {
                subtotal_cents: subtotal,
                discount_cents: discount,
                total_cents: subtotal - discount,
              },
            },
          },
        });

        return updated;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to validate promotion',
        'PROMOTION_VALIDATION_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    await this.cache.del(`order:${tenantId}:${orderId}`);

    return ok({
      orderId,
      validated: true,
      discountCents: discount,
      totalCents: subtotal - discount,
    });
  }

  /**
   * Remove promotion from order
   */
  async removePromotion(
    tenantId: string,
    orderId: string,
    reason: string,
    removedBy: string
  ): Promise<Result<any, DomainError>> {
    const order = await this.prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId,
      },
    });

    if (!order || !order.promotion_id) {
      return err(new ValidationError('Order has no promotion to remove'));
    }

    const subtotal = order.subtotal_cents || 0;

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.orders.update({
          where: { id: orderId },
          data: {
            promotion_id: null,
            discount_cents: 0,
            total_cents: subtotal,
            promotion_snapshot: undefined,
            updated_at: new Date(),
          },
        });

        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'PROMOTION_REMOVED',
            entity_type: 'ORDER',
            entity_id: orderId,
            actor_id: removedBy,
            actor_role_snapshot: 'USER',
            terminal_id: 'system',
            payload: {
              order_id: orderId,
              reason,
              previous_totals: {
                subtotal_cents: subtotal,
                discount_cents: order.discount_cents,
                total_cents: order.total_cents,
              },
            },
          },
        });

        return updated;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to remove promotion',
        'PROMOTION_REMOVE_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    await this.cache.del(`order:${tenantId}:${orderId}`);

    return ok({
      orderId,
      removed: true,
      previousDiscount: order.discount_cents,
    });
  }

  // Private helpers

  private calculateDiscount(
    subtotalCents: number,
    promotionType: string,
    promotionValue: number | null,
    rules: any
  ): number {
    if (!promotionValue) return 0;

    switch (promotionType) {
      case 'PERCENT':
        return Math.floor((subtotalCents * promotionValue) / 100);

      case 'FIXED':
        return Math.min(promotionValue, subtotalCents);

      case '2X1':
        return rules?.free_item_value || 0;

      case 'COMBO':
        return promotionValue;

      case 'HAPPY_HOUR':
        const now = new Date();
        const hour = now.getHours();
        if (hour >= (rules?.start_hour || 0) && hour <= (rules?.end_hour || 24)) {
          return Math.floor((subtotalCents * promotionValue) / 100);
        }
        return 0;

      default:
        return 0;
    }
  }
}

// Export singleton
export const promotionService = new PromotionService(
  new PrismaClient()
);
