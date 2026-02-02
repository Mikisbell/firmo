/**
 * Order Service - Business Logic Layer
 * 
 * Implements the Service Layer Pattern for order management.
 * Centralizes business logic, validation, and orchestration.
 * 
 * Benefits:
 * - Separation of concerns
 * - Reusable business logic
 * - Easier testing
 * - Transaction management
 * - Event publishing
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { CacheService } from '@/src/core/cache/redis.service';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { withTransaction } from '@/src/core/db/transaction';

// Types
export interface CreateOrderInput {
  tenantId: string;
  orderType: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
  items: OrderItemInput[];
  tableNumber?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
  createdBy: string;
  terminalId: string;
}

export interface OrderItemInput {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  station: string;
  mods?: string[];
  notes?: string;
}

export interface OrderResult {
  id: string;
  orderNumber: number;
  orderType: string;
  status: string;
  totalCents: number;
  items: any[];
  createdAt: Date;
}

export class OrderService {
  private cache: CacheService;
  
  constructor(
    private prisma: PrismaClient,
    cache?: CacheService
  ) {
    this.cache = cache || new CacheService();
  }

  /**
   * Create a new order with full validation and event publishing
   */
  async createOrder(input: CreateOrderInput): Promise<Result<OrderResult, DomainError>> {
    // Validate input
    const validationResult = this.validateCreateOrderInput(input);
    if (!validationResult.success) {
      return validationResult;
    }

    // Generate order number atomically
    const orderNumberResult = await this.generateOrderNumber(input.tenantId);
    if (!orderNumberResult.success) {
      return orderNumberResult;
    }

    const orderNumber = orderNumberResult.data;
    const orderId = uuidv4();

    // Calculate totals
    const { subtotalCents, totalCents } = this.calculateTotals(input.items);

    // Build order data
    const orderData = {
      id: orderId,
      tenant_id: input.tenantId,
      order_number: orderNumber,
      order_type: input.orderType,
      order_status: 'OPEN',
      fulfillment_status: 'COOKING',
      terminal_id: input.terminalId,
      items: this.buildItemsJson(input.items),
      checks: this.buildChecksJson(input.items, totalCents),
      fulfillment: this.buildFulfillmentJson(input),
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      total_cents: totalCents,
      stations_active: this.extractStations(input.items),
      unpaid_checks_count: 1,
    };

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Create order
        const order = await tx.orders.create({
          data: orderData,
        });

        // Create event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: new Date(),
            type: 'ORDER_CREATED',
            entity_type: 'ORDER',
            entity_id: orderId,
            actor_id: input.createdBy,
            actor_role_snapshot: 'USER',
            terminal_id: input.terminalId,
            payload: {
              order_id: orderId,
              order_number: orderNumber,
              order_type: input.orderType,
              item_count: input.items.length,
              total_cents: totalCents,
            },
          },
        });

        return order;
      },
      { maxRetries: 3 }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to create order'
      );
      return err(new DomainError(
        'Failed to create order',
        'ORDER_CREATION_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const order = txResult.data;

    // Invalidate relevant caches
    await this.invalidateOrderCaches(input.tenantId);

    // Build result
    const result: OrderResult = {
      id: order.id,
      orderNumber: order.order_number,
      orderType: order.order_type,
      status: order.order_status,
      totalCents: order.total_cents,
      items: order.items as any[],
      createdAt: order.created_at,
    };

    pinoLogger.info(
      { orderId: order.id, orderNumber, tenantId: input.tenantId },
      'Order created successfully'
    );

    return ok(result);
  }

  /**
   * Get order by ID with caching
   */
  async getOrder(
    tenantId: string,
    orderId: string
  ): Promise<Result<OrderResult, NotFoundError>> {
    const cacheKey = `order:${tenantId}:${orderId}`;
    
    // Try cache first
    const cached = await this.cache.get<OrderResult>(cacheKey);
    if (cached) {
      return ok(cached);
    }

    // Query database
    const order = await this.prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId,
      },
    });

    if (!order) {
      return err(new NotFoundError('Order', orderId));
    }

    const result: OrderResult = {
      id: order.id,
      orderNumber: order.order_number,
      orderType: order.order_type,
      status: order.order_status,
      totalCents: order.total_cents,
      items: order.items as any[],
      createdAt: order.created_at,
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, result, 300);

    return ok(result);
  }

  /**
   * Update order status
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    newStatus: string,
    updatedBy: string
  ): Promise<Result<OrderResult, DomainError>> {
    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      'OPEN': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': [],
      'CANCELLED': [],
    };

    const orderResult = await this.getOrder(tenantId, orderId);
    if (!orderResult.success) {
      return orderResult;
    }

    const currentStatus = orderResult.data.status;
    
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return err(new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        'status',
        { currentStatus, newStatus }
      ));
    }

    // Update in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.orders.update({
          where: { id: orderId },
          data: {
            order_status: newStatus,
            updated_at: new Date(),
          },
        });

        // Create status change event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'ORDER_STATUS_CHANGED',
            entity_type: 'ORDER',
            entity_id: orderId,
            actor_id: updatedBy,
            actor_role_snapshot: 'USER',
            terminal_id: 'system',
            payload: {
              order_id: orderId,
              from_status: currentStatus,
              to_status: newStatus,
            },
          },
        });

        return updated;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to update order status',
        'STATUS_UPDATE_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    // Invalidate cache
    await this.cache.del(`order:${tenantId}:${orderId}`);

    const result: OrderResult = {
      id: txResult.data.id,
      orderNumber: txResult.data.order_number,
      orderType: txResult.data.order_type,
      status: txResult.data.order_status,
      totalCents: txResult.data.total_cents,
      items: txResult.data.items as any[],
      createdAt: txResult.data.created_at,
    };

    return ok(result);
  }

  // Private helper methods

  private validateCreateOrderInput(
    input: CreateOrderInput
  ): Result<void, ValidationError> {
    if (!input.items || input.items.length === 0) {
      return err(new ValidationError(
        'Order must have at least one item',
        'items'
      ));
    }

    if (input.items.some(item => item.quantity <= 0)) {
      return err(new ValidationError(
        'All items must have positive quantity',
        'items'
      ));
    }

    if (input.orderType === 'DINE_IN' && !input.tableNumber) {
      return err(new ValidationError(
        'Table number is required for dine-in orders',
        'tableNumber'
      ));
    }

    return ok(undefined);
  }

  private async generateOrderNumber(
    tenantId: string
  ): Promise<Result<number, DomainError>> {
    try {
      const result = await this.prisma.$queryRaw<{ max_num: number }[]>`
        SELECT MAX(order_number) as max_num 
        FROM orders 
        WHERE tenant_id = ${tenantId}::uuid
      `;
      
      const nextNumber = (result[0]?.max_num || 1000) + 1;
      return ok(nextNumber);
    } catch (error) {
      return err(new DomainError(
        'Failed to generate order number',
        'ORDER_NUMBER_GENERATION_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }

  private calculateTotals(items: OrderItemInput[]): {
    subtotalCents: number;
    totalCents: number;
  } {
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );

    return {
      subtotalCents,
      totalCents: subtotalCents,
    };
  }

  private buildItemsJson(items: OrderItemInput[]): any[] {
    return items.map(item => ({
      line_id: uuidv4(),
      product_id: item.productId,
      sku: item.sku,
      name: item.name,
      short_name: item.name.substring(0, 20),
      qty: item.quantity,
      unit_price_cents: item.unitPriceCents,
      station: item.station,
      status: 'PENDING',
      mods: item.mods || [],
      notes: item.notes || '',
      added_at: new Date().toISOString(),
    }));
  }

  private buildChecksJson(items: OrderItemInput[], totalCents: number): any[] {
    return [{
      check_id: uuidv4(),
      name: 'Main',
      mode: 'ITEMS',
      lines: items.map(item => ({
        line_id: uuidv4(),
        qty: item.quantity,
      })),
      subtotal_cents: totalCents,
      discount_cents: 0,
      total_cents: totalCents,
      payment: {
        status: 'UNPAID',
        payments: [],
      },
    }];
  }

  private buildFulfillmentJson(input: CreateOrderInput): any {
    if (input.orderType === 'DINE_IN') {
      return {
        table_number: input.tableNumber,
        guest_count: input.guestCount || 1,
      };
    }
    
    if (input.orderType === 'DELIVERY') {
      return {
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        address: input.deliveryAddress,
      };
    }
    
    return {};
  }

  private extractStations(items: OrderItemInput[]): string[] {
    return [...new Set(items.map(item => item.station))];
  }

  private async invalidateOrderCaches(tenantId: string): Promise<void> {
    // Invalidate active orders list
    await this.cache.invalidatePattern(`orders:active:${tenantId}:*`);
  }
}

// Export singleton instance
export const orderService = new OrderService(
  new PrismaClient()
);
