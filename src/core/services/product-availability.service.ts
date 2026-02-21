/**
 * Product Availability Service - Auto-86
 *
 * Marca productos como no disponibles/disponibles en TODOS los terminales
 * simultáneamente vía Event Bus broadcast.
 *
 * "86" es jerga de restaurante para "se acabó / no disponible".
 *
 * Flujo:
 * 1. Actualizar is_available en la BD
 * 2. Emitir evento por Event Bus → todos los terminales se enteran
 *
 * @module core/services/product-availability.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, NotFoundError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import prisma from '@/src/core/db/prisma';
import { eventBus } from '@/src/core/infra/event-bus';
import type { ParkEvent } from '@/src/core/domain/events';

// ============================================================================
// Types
// ============================================================================

export type UnavailableReason = 'MANUAL' | 'LOW_STOCK' | 'INGREDIENT_OUT';

export interface UnavailableProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  station: string;
  is_available: boolean;
}

// ============================================================================
// ProductAvailabilityService
// ============================================================================

export class ProductAvailabilityService {
  constructor(
    private prisma: PrismaClient,
    private bus: typeof eventBus,
  ) {}

  // ==========================================================================
  // Mark Unavailable (86)
  // ==========================================================================

  async markUnavailable(
    tenantId: string,
    productId: string,
    reason: UnavailableReason,
    userId?: string,
  ): Promise<Result<{ id: string; is_available: boolean }, DomainError>> {
    const product = await this.prisma.products.findFirst({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      return err(new NotFoundError('Producto', productId));
    }

    await this.prisma.products.update({
      where: { id: productId },
      data: { is_available: false },
    });

    const eventId = uuidv4();
    const now = new Date().toISOString();
    const event = {
      event_id: eventId,
      event_type: 'PRODUCT_MARKED_UNAVAILABLE' as const,
      aggregate_type: 'CATALOG' as const,
      aggregate_id: productId,
      tenant_id: tenantId,
      terminal_id: 'SERVER',
      terminal_sequence: 0,
      occurred_at: now,
      correlation_id: eventId,
      schema_version: 1,
      payload_version: 1,
      payload: {
        product_id: productId,
        reason,
        disabled_by: userId ?? null,
        disabled_at: now,
      },
    } satisfies ParkEvent;

    await this.bus.publish(tenantId, event);

    pinoLogger.info(
      { productId, tenantId, reason, userId },
      `Product marked unavailable (86'd): ${product.name}`,
    );

    return ok({ id: productId, is_available: false });
  }

  // ==========================================================================
  // Mark Available (un-86)
  // ==========================================================================

  async markAvailable(
    tenantId: string,
    productId: string,
    userId?: string,
  ): Promise<Result<{ id: string; is_available: boolean }, DomainError>> {
    const product = await this.prisma.products.findFirst({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      return err(new NotFoundError('Producto', productId));
    }

    await this.prisma.products.update({
      where: { id: productId },
      data: { is_available: true },
    });

    const eventId = uuidv4();
    const now = new Date().toISOString();
    const event = {
      event_id: eventId,
      event_type: 'PRODUCT_MARKED_AVAILABLE' as const,
      aggregate_type: 'CATALOG' as const,
      aggregate_id: productId,
      tenant_id: tenantId,
      terminal_id: 'SERVER',
      terminal_sequence: 0,
      occurred_at: now,
      correlation_id: eventId,
      schema_version: 1,
      payload_version: 1,
      payload: {
        product_id: productId,
        enabled_by: userId ?? null,
        enabled_at: now,
      },
    } satisfies ParkEvent;

    await this.bus.publish(tenantId, event);

    pinoLogger.info(
      { productId, tenantId, userId },
      `Product marked available: ${product.name}`,
    );

    return ok({ id: productId, is_available: true });
  }

  // ==========================================================================
  // Get Unavailable Products (lista de productos 86'd)
  // ==========================================================================

  async getUnavailableProducts(
    tenantId: string,
  ): Promise<Result<UnavailableProduct[], DomainError>> {
    try {
      const products = await this.prisma.products.findMany({
        where: { tenant_id: tenantId, is_active: true, is_available: false },
        select: { id: true, name: true, sku: true, category: true, station: true, is_available: true },
        orderBy: { name: 'asc' },
      });

      return ok(products);
    } catch (error) {
      pinoLogger.error({ error, tenantId }, 'Error listing unavailable products');
      return err(new DomainError('Error al listar productos no disponibles', 'LIST_UNAVAILABLE_FAILED'));
    }
  }

  // ==========================================================================
  // Auto Check Availability (revisa stock de ingredientes → auto-86)
  // ==========================================================================

  async autoCheckAvailability(
    tenantId: string,
    productId: string,
  ): Promise<Result<{ is_available: boolean; reason?: string }, DomainError>> {
    const recipe = await this.prisma.recipes.findFirst({
      where: { tenant_id: tenantId, product_id: productId, is_active: true },
    });

    if (!recipe) {
      return ok({ is_available: true }); // Sin receta → no se puede verificar
    }

    const ingredients = recipe.ingredients as Array<{ inventory_code: string; quantity: number; unit: string; is_optional?: boolean }>;
    const requiredIngredients = ingredients.filter((i) => !i.is_optional);

    for (const ingredient of requiredIngredients) {
      const inv = await this.prisma.inventory.findFirst({
        where: { tenant_id: tenantId, code: ingredient.inventory_code },
        select: { stock: true, min_stock: true },
      });

      if (!inv || Number(inv.stock) <= 0) {
        // Ingrediente agotado → auto-86
        await this.markUnavailable(tenantId, productId, 'INGREDIENT_OUT');
        return ok({
          is_available: false,
          reason: `Ingrediente agotado: ${ingredient.inventory_code}`,
        });
      }
    }

    return ok({ is_available: true });
  }
}

// Singleton
export const productAvailabilityService = new ProductAvailabilityService(prisma, eventBus);
