/**
 * Payment Service - Business Logic Layer
 * 
 * Implements comprehensive payment processing with support for multiple methods,
 * transaction safety, split payments, and integration with digital wallets.
 * 
 * Features:
 * - Multi-method payment processing (CASH, YAPE, PLIN, CARD, TRANSFER)
 * - Transaction-safe operations with automatic rollback
 * - Split payment support for shared bills
 * - Digital wallet integration (Yape/Plin simulation)
 * - Payment voiding with audit trail
 * - Change calculation and validation
 * - Event-driven architecture integration
 * 
 * @module core/services/payment.service
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError, ConflictError, ForbiddenError } from '@/core/result';
import { withTransaction, QueryMonitor } from '@/core/db/enhanced-prisma';
import { CacheService } from '@/core/cache/redis.service';
import { pinoLogger } from '@/core/observability/logger-pino';
import { PaymentMethod, PaymentMethodSchema } from '@/core/domain/events';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Payment method configuration
 */
export interface PaymentMethodConfig {
  id: PaymentMethod;
  name: string;
  description: string;
  requiresReference: boolean;
  allowChange: boolean;
  maxAmountCents: number;
  minAmountCents: number;
  isDigital: boolean;
  processingFeePercent: number;
}

/**
 * Payment input for processing
 */
export interface ProcessPaymentInput {
  orderId: string;
  checkId: string;
  amountCents: number;
  method: PaymentMethod;
  reference?: string;
  tenantId: string;
  actorId: string;
  terminalId: string;
  shiftId?: string;
}

/**
 * Payment result after processing
 */
export interface PaymentResult {
  paymentId: string;
  orderId: string;
  checkId: string;
  amountCents: number;
  method: PaymentMethod;
  reference?: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  processedAt: Date;
  changeCents: number;
}

/**
 * Void payment input
 */
export interface VoidPaymentInput {
  paymentId: string;
  reason: string;
  tenantId: string;
  actorId: string;
  terminalId: string;
  requiresApproval?: boolean;
  approvedBy?: string;
}

/**
 * Void payment result
 */
export interface VoidPaymentResult {
  paymentId: string;
  voidedAt: Date;
  reason: string;
  approvedBy?: string;
}

/**
 * Split payment entry
 */
export interface SplitPaymentEntry {
  method: PaymentMethod;
  amountCents: number;
  reference?: string;
}

/**
 * Split payment input
 */
export interface SplitPaymentInput {
  orderId: string;
  checkId: string;
  payments: SplitPaymentEntry[];
  tenantId: string;
  actorId: string;
  terminalId: string;
  shiftId?: string;
}

/**
 * Split payment result
 */
export interface SplitPaymentResult {
  paymentIds: string[];
  totalProcessedCents: number;
  processedAt: Date;
}

/**
 * Change calculation result
 */
export interface ChangeCalculation {
  amountPaidCents: number;
  totalCents: number;
  changeCents: number;
  isExact: boolean;
  breakdown: {
    coins: number;
    bills: { denomination: number; count: number }[];
  };
}

// ============================================================================
// Constants & Configuration
// ============================================================================

/**
 * Payment method configurations
 */
const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  CASH: {
    id: 'CASH',
    name: 'Efectivo',
    description: 'Pago en efectivo',
    requiresReference: false,
    allowChange: true,
    maxAmountCents: 100000000, // 100,000.00 PEN
    minAmountCents: 1, // 0.01 PEN
    isDigital: false,
    processingFeePercent: 0,
  },
  YAPE: {
    id: 'YAPE',
    name: 'Yape',
    description: 'Pago via Yape (BCP)',
    requiresReference: true,
    allowChange: false,
    maxAmountCents: 500000, // 5,000.00 PEN (Yape limit)
    minAmountCents: 1,
    isDigital: true,
    processingFeePercent: 0,
  },
  PLIN: {
    id: 'PLIN',
    name: 'Plin',
    description: 'Pago via Plin (Interbank)',
    requiresReference: true,
    allowChange: false,
    maxAmountCents: 500000, // 5,000.00 PEN (Plin limit)
    minAmountCents: 1,
    isDigital: true,
    processingFeePercent: 0,
  },
  CARD: {
    id: 'CARD',
    name: 'Tarjeta',
    description: 'Pago con tarjeta de crédito/débito',
    requiresReference: true,
    allowChange: false,
    maxAmountCents: 100000000, // 100,000.00 PEN
    minAmountCents: 100, // 1.00 PEN
    isDigital: true,
    processingFeePercent: 2.5, // Typical card processing fee
  },
  TRANSFER: {
    id: 'TRANSFER',
    name: 'Transferencia',
    description: 'Transferencia bancaria',
    requiresReference: true,
    allowChange: false,
    maxAmountCents: 1000000000, // 1,000,000.00 PEN
    minAmountCents: 100, // 1.00 PEN
    isDigital: true,
    processingFeePercent: 0,
  },
};

/**
 * Denominations for change calculation (Peruvian Soles)
 */
const DENOMINATIONS = {
  bills: [20000, 10000, 5000, 2000, 1000, 500], // 200, 100, 50, 20, 10, 5 soles
  coins: [200, 100, 50, 20, 10, 5, 1], // 2, 1, 0.50, 0.20, 0.10, 0.05, 0.01 soles
};

// ============================================================================
// Payment Service Class
// ============================================================================

export class PaymentService {
  private cache: CacheService;

  constructor(
    private prisma: PrismaClient,
    cache?: CacheService
  ) {
    this.cache = cache || new CacheService();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Process a single payment
   * 
   * Validates the payment, processes it through the appropriate channel,
   * and creates the CHECK_PAYMENT_ADDED event.
   * 
   * @param input - Payment processing input
   * @returns Result with payment details or error
   * 
   * @example
   * ```typescript
   * const result = await paymentService.processPayment({
   *   orderId: 'uuid',
   *   checkId: 'check-1',
   *   amountCents: 15000,
   *   method: 'YAPE',
   *   reference: '998877665',
   *   tenantId: 'tenant-uuid',
   *   actorId: 'user-uuid',
   *   terminalId: 'pos-01'
   * });
   * ```
   */
  async processPayment(input: ProcessPaymentInput): Promise<Result<PaymentResult, DomainError>> {
    // Validate input
    const validationResult = this.validateProcessPaymentInput(input);
    if (!validationResult.success) {
      return validationResult;
    }

    // Validate order and check exist
    const orderValidation = await this.validateOrderAndCheck(
      input.tenantId,
      input.orderId,
      input.checkId
    );
    if (!orderValidation.success) {
      return orderValidation;
    }

    const { order, check } = orderValidation.data;

    // Validate payment method and limits
    const methodConfig = PAYMENT_METHODS[input.method];
    if (input.amountCents < methodConfig.minAmountCents) {
      return err(new ValidationError(
        `Amount below minimum for ${methodConfig.name}: ${methodConfig.minAmountCents / 100} PEN`,
        'amountCents',
        { minAmount: methodConfig.minAmountCents, provided: input.amountCents }
      ));
    }
    if (input.amountCents > methodConfig.maxAmountCents) {
      return err(new ValidationError(
        `Amount exceeds maximum for ${methodConfig.name}: ${methodConfig.maxAmountCents / 100} PEN`,
        'amountCents',
        { maxAmount: methodConfig.maxAmountCents, provided: input.amountCents }
      ));
    }

    // Validate reference for methods that require it
    if (methodConfig.requiresReference && !input.reference) {
      return err(new ValidationError(
        `Reference required for ${methodConfig.name}`,
        'reference'
      ));
    }

    // Process digital wallet payment if applicable
    if (methodConfig.isDigital && (input.method === 'YAPE' || input.method === 'PLIN')) {
      const walletResult = await this.processDigitalWalletPayment(
        input.method,
        input.amountCents,
        input.reference!
      );
      if (!walletResult.success) {
        return walletResult;
      }
    }

    const paymentId = uuidv4();
    const processedAt = new Date();

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Create payment record
        const payment = await tx.payments.create({
          data: {
            id: paymentId,
            tenant_id: input.tenantId,
            order_id: input.orderId,
            check_id: input.checkId,
            amount_cents: input.amountCents,
            payment_method: input.method,
            reference: input.reference || null,
            status: 'COMPLETED',
            processed_at: processedAt,
            processed_by: input.actorId,
            shift_id: input.shiftId || null,
            terminal_id: input.terminalId,
          },
        });

        // Create CHECK_PAYMENT_ADDED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: processedAt,
            type: 'CHECK_PAYMENT_ADDED',
            entity_type: 'ORDER',
            entity_id: input.orderId,
            actor_id: input.actorId,
            actor_role_snapshot: 'CASHIER',
            terminal_id: input.terminalId,
            shift_id: input.shiftId || null,
            payload: {
              order_id: input.orderId,
              check_id: input.checkId,
              payment: {
                method: input.method,
                amount_cents: input.amountCents,
                ref: input.reference,
              },
            },
          },
        });

        return payment;
      },
      { maxRetries: 3 }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to process payment'
      );
      return err(new DomainError(
        'Failed to process payment',
        'PAYMENT_PROCESSING_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const payment = txResult.data;

    // Invalidate caches
    await this.invalidatePaymentCaches(input.tenantId, input.orderId, input.checkId);

    // Calculate change if applicable
    const changeCents = this.calculateChangeCents(check.total_cents, input.amountCents);

    const result: PaymentResult = {
      paymentId: payment.id,
      orderId: payment.order_id,
      checkId: payment.check_id,
      amountCents: payment.amount_cents,
      method: payment.payment_method as PaymentMethod,
      reference: payment.reference || undefined,
      status: payment.status as 'COMPLETED' | 'PENDING' | 'FAILED',
      processedAt: payment.processed_at,
      changeCents,
    };

    pinoLogger.info(
      { 
        paymentId: payment.id, 
        orderId: input.orderId, 
        checkId: input.checkId,
        amount: input.amountCents,
        method: input.method 
      },
      'Payment processed successfully'
    );

    return ok(result);
  }

  /**
   * Void (cancel) a payment
   * 
   * Creates an audit trail and emits CHECK_PAYMENT_VOIDED event.
   * May require approval for large amounts.
   * 
   * @param input - Void payment input
   * @returns Result with void details or error
   * 
   * @example
   * ```typescript
   * const result = await paymentService.voidPayment({
   *   paymentId: 'payment-uuid',
   *   reason: 'Customer request',
   *   tenantId: 'tenant-uuid',
   *   actorId: 'user-uuid',
   *   terminalId: 'pos-01'
   * });
   * ```
   */
  async voidPayment(input: VoidPaymentInput): Promise<Result<VoidPaymentResult, DomainError>> {
    // Validate input
    if (!input.reason || input.reason.trim().length < 5) {
      return err(new ValidationError(
        'Reason must be at least 5 characters',
        'reason'
      ));
    }

    // Fetch payment
    const payment = await this.prisma.payments.findFirst({
      where: {
        id: input.paymentId,
        tenant_id: input.tenantId,
      },
    });

    if (!payment) {
      return err(new NotFoundError('Payment', input.paymentId));
    }

    if (payment.status === 'VOIDED') {
      return err(new ConflictError(
        'Payment is already voided',
        'status'
      ));
    }

    // Check if voiding requires approval (amount > 500 PEN)
    const requiresApproval = payment.amount_cents > 50000;
    if (requiresApproval && !input.approvedBy) {
      return err(new ForbiddenError(
        'Voiding payments over 500 PEN requires manager approval',
        { requiresApproval: true }
      ));
    }

    const voidedAt = new Date();

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Update payment status
        const updated = await tx.payments.update({
          where: { id: input.paymentId },
          data: {
            status: 'VOIDED',
            voided_at: voidedAt,
            voided_by: input.actorId,
            void_reason: input.reason,
            approved_by: input.approvedBy || null,
          },
        });

        // Create CHECK_PAYMENT_VOIDED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: voidedAt,
            type: 'CHECK_PAYMENT_VOIDED',
            entity_type: 'ORDER',
            entity_id: payment.order_id,
            actor_id: input.actorId,
            actor_role_snapshot: 'CASHIER',
            terminal_id: input.terminalId,
            payload: {
              order_id: payment.order_id,
              check_id: payment.check_id,
              payment_id: input.paymentId,
              reason: input.reason,
              approved_by: input.approvedBy,
              amount_cents: payment.amount_cents,
              method: payment.payment_method,
            },
          },
        });

        return updated;
      },
      { maxRetries: 3 }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to void payment'
      );
      return err(new DomainError(
        'Failed to void payment',
        'PAYMENT_VOID_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    // Invalidate caches
    await this.invalidatePaymentCaches(input.tenantId, payment.order_id, payment.check_id);

    const result: VoidPaymentResult = {
      paymentId: input.paymentId,
      voidedAt,
      reason: input.reason,
      approvedBy: input.approvedBy,
    };

    pinoLogger.info(
      { 
        paymentId: input.paymentId, 
        orderId: payment.order_id,
        amount: payment.amount_cents,
        reason: input.reason
      },
      'Payment voided successfully'
    );

    return ok(result);
  }

  /**
   * Get all available payment methods
   * 
   * Returns configurations for all supported payment methods.
   * 
   * @returns Array of payment method configurations
   * 
   * @example
   * ```typescript
   * const methods = await paymentService.getPaymentMethods();
   * // [
   * //   { id: 'CASH', name: 'Efectivo', ... },
   * //   { id: 'YAPE', name: 'Yape', ... },
   * //   ...
   * // ]
   * ```
   */
  getPaymentMethods(): PaymentMethodConfig[] {
    return Object.values(PAYMENT_METHODS);
  }

  /**
   * Calculate change breakdown
   * 
   * Calculates the optimal change given amount paid and total amount.
   * Returns detailed breakdown of bills and coins needed.
   * 
   * @param amountPaidCents - Amount paid by customer (in cents)
   * @param totalCents - Total amount to pay (in cents)
   * @returns Change calculation result
   * 
   * @example
   * ```typescript
   * const change = paymentService.calculateChange(20000, 15750);
   * // {
   * //   amountPaidCents: 20000,
   * //   totalCents: 15750,
   * //   changeCents: 4250,
   * //   isExact: false,
   * //   breakdown: {
   * //     coins: 50,
   * //     bills: [{ denomination: 2000, count: 2 }, { denomination: 200, count: 1 }]
   * //   }
   * // }
   * ```
   */
  calculateChange(amountPaidCents: number, totalCents: number): ChangeCalculation {
    if (amountPaidCents < totalCents) {
      return {
        amountPaidCents,
        totalCents,
        changeCents: 0,
        isExact: false,
        breakdown: { coins: 0, bills: [] },
      };
    }

    const changeCents = amountPaidCents - totalCents;
    let remaining = changeCents;

    // Calculate bills
    const bills: { denomination: number; count: number }[] = [];
    for (const denom of DENOMINATIONS.bills) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        bills.push({ denomination: denom, count });
        remaining -= denom * count;
      }
    }

    // Calculate coins
    const coins = remaining;

    return {
      amountPaidCents,
      totalCents,
      changeCents,
      isExact: changeCents === 0,
      breakdown: {
        coins,
        bills,
      },
    };
  }

  /**
   * Process split payment (multiple payment methods)
   * 
   * Allows customers to pay using multiple methods (e.g., part cash, part card).
   * Validates total amount matches and processes each payment individually.
   * 
   * @param input - Split payment input
   * @returns Result with all payment IDs or error
   * 
   * @example
   * ```typescript
   * const result = await paymentService.splitPayment({
   *   orderId: 'uuid',
   *   checkId: 'check-1',
   *   payments: [
   *     { method: 'CASH', amountCents: 10000 },
   *     { method: 'YAPE', amountCents: 5750, reference: '998877665' }
   *   ],
   *   tenantId: 'tenant-uuid',
   *   actorId: 'user-uuid',
   *   terminalId: 'pos-01'
   * });
   * ```
   */
  async splitPayment(input: SplitPaymentInput): Promise<Result<SplitPaymentResult, DomainError>> {
    // Validate input
    if (!input.payments || input.payments.length === 0) {
      return err(new ValidationError(
        'At least one payment is required',
        'payments'
      ));
    }

    if (input.payments.length > 5) {
      return err(new ValidationError(
        'Maximum 5 payments allowed for split payment',
        'payments'
      ));
    }

    // Validate order and check exist
    const orderValidation = await this.validateOrderAndCheck(
      input.tenantId,
      input.orderId,
      input.checkId
    );
    if (!orderValidation.success) {
      return orderValidation;
    }

    const { check } = orderValidation.data;

    // Calculate total
    const totalSplitCents = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
    if (totalSplitCents !== check.total_cents) {
      return err(new ValidationError(
        `Split payment total (${totalSplitCents / 100} PEN) does not match check total (${check.total_cents / 100} PEN)`,
        'payments',
        { expected: check.total_cents, received: totalSplitCents }
      ));
    }

    // Validate each payment method
    for (const payment of input.payments) {
      const methodValidation = PaymentMethodSchema.safeParse(payment.method);
      if (!methodValidation.success) {
        return err(new ValidationError(
          `Invalid payment method: ${payment.method}`,
          'payments'
        ));
      }

      const config = PAYMENT_METHODS[payment.method];
      if (payment.amountCents < config.minAmountCents || payment.amountCents > config.maxAmountCents) {
        return err(new ValidationError(
          `Amount ${payment.amountCents / 100} PEN out of range for ${config.name}`,
          'payments'
        ));
      }

      if (config.requiresReference && !payment.reference) {
        return err(new ValidationError(
          `Reference required for ${config.name}`,
          'payments'
        ));
      }
    }

    const processedAt = new Date();
    const paymentIds: string[] = [];

    // Execute all payments in a single transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        for (const paymentInput of input.payments) {
          const paymentId = uuidv4();
          paymentIds.push(paymentId);

          // Create payment record
          await tx.payments.create({
            data: {
              id: paymentId,
              tenant_id: input.tenantId,
              order_id: input.orderId,
              check_id: input.checkId,
              amount_cents: paymentInput.amountCents,
              payment_method: paymentInput.method,
              reference: paymentInput.reference || null,
              status: 'COMPLETED',
              processed_at: processedAt,
              processed_by: input.actorId,
              shift_id: input.shiftId || null,
              terminal_id: input.terminalId,
            },
          });

          // Create CHECK_PAYMENT_ADDED event for each payment
          await tx.events.create({
            data: {
              id: uuidv4(),
              tenant_id: input.tenantId,
              occurred_at: processedAt,
              type: 'CHECK_PAYMENT_ADDED',
              entity_type: 'ORDER',
              entity_id: input.orderId,
              actor_id: input.actorId,
              actor_role_snapshot: 'CASHIER',
              terminal_id: input.terminalId,
              shift_id: input.shiftId || null,
              payload: {
                order_id: input.orderId,
                check_id: input.checkId,
                payment: {
                  method: paymentInput.method,
                  amount_cents: paymentInput.amountCents,
                  ref: paymentInput.reference,
                },
              },
            },
          });
        }

        return paymentIds;
      },
      { maxRetries: 3 }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to process split payment'
      );
      return err(new DomainError(
        'Failed to process split payment',
        'SPLIT_PAYMENT_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    // Invalidate caches
    await this.invalidatePaymentCaches(input.tenantId, input.orderId, input.checkId);

    const result: SplitPaymentResult = {
      paymentIds: txResult.data,
      totalProcessedCents: totalSplitCents,
      processedAt,
    };

    pinoLogger.info(
      { 
        paymentCount: input.payments.length,
        orderId: input.orderId,
        checkId: input.checkId,
        totalAmount: totalSplitCents
      },
      'Split payment processed successfully'
    );

    return ok(result);
  }

  /**
   * Get payment history for a check
   * 
   * Retrieves all payments (including voided) for a specific check.
   * 
   * @param tenantId - Tenant ID
   * @param checkId - Check ID
   * @returns Array of payments
   */
  async getCheckPayments(
    tenantId: string,
    checkId: string
  ): Promise<Result<PaymentResult[], DomainError>> {
    const payments = await QueryMonitor.measure(
      'getCheckPayments',
      async () => {
        return await this.prisma.payments.findMany({
          where: {
            tenant_id: tenantId,
            check_id: checkId,
          },
          orderBy: {
            processed_at: 'desc',
          },
        });
      }
    );

    const results: PaymentResult[] = payments.map(payment => ({
      paymentId: payment.id,
      orderId: payment.order_id,
      checkId: payment.check_id,
      amountCents: payment.amount_cents,
      method: payment.payment_method as PaymentMethod,
      reference: payment.reference || undefined,
      status: payment.status as 'COMPLETED' | 'PENDING' | 'FAILED',
      processedAt: payment.processed_at,
      changeCents: 0,
    }));

    return ok(results);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate process payment input
   */
  private validateProcessPaymentInput(
    input: ProcessPaymentInput
  ): Result<void, ValidationError> {
    if (!input.orderId) {
      return err(new ValidationError('Order ID is required', 'orderId'));
    }
    if (!input.checkId) {
      return err(new ValidationError('Check ID is required', 'checkId'));
    }
    if (!input.amountCents || input.amountCents <= 0) {
      return err(new ValidationError('Amount must be positive', 'amountCents'));
    }
    if (!input.tenantId) {
      return err(new ValidationError('Tenant ID is required', 'tenantId'));
    }
    if (!input.actorId) {
      return err(new ValidationError('Actor ID is required', 'actorId'));
    }
    if (!input.terminalId) {
      return err(new ValidationError('Terminal ID is required', 'terminalId'));
    }

    // Validate payment method
    const methodValidation = PaymentMethodSchema.safeParse(input.method);
    if (!methodValidation.success) {
      return err(new ValidationError(
        `Invalid payment method: ${input.method}. Valid: CASH, YAPE, PLIN, CARD, TRANSFER`,
        'method'
      ));
    }

    return ok(undefined);
  }

  /**
   * Validate order and check exist
   */
  private async validateOrderAndCheck(
    tenantId: string,
    orderId: string,
    checkId: string
  ): Promise<Result<{ order: any; check: any }, DomainError>> {
    const order = await this.prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId,
      },
    });

    if (!order) {
      return err(new NotFoundError('Order', orderId));
    }

    // Parse checks from order
    const checks = order.checks as any[] || [];
    const check = checks.find((c: any) => c.check_id === checkId);

    if (!check) {
      return err(new NotFoundError('Check', checkId));
    }

    return ok({ order, check });
  }

  /**
   * Process digital wallet payment (Yape/Plin simulation)
   * 
   * Simulates integration with Yape and Plin APIs.
   * In production, this would call actual wallet APIs.
   */
  private async processDigitalWalletPayment(
    method: 'YAPE' | 'PLIN',
    amountCents: number,
    reference: string
  ): Promise<Result<void, DomainError>> {
    // Validate reference format (phone number for Yape/Plin)
    const phoneRegex = /^9\d{8}$/;
    if (!phoneRegex.test(reference)) {
      return err(new ValidationError(
        `Invalid ${method} phone number. Must be 9 digits starting with 9`,
        'reference'
      ));
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate success/failure (99% success rate for demo)
    const isSuccess = Math.random() > 0.01;
    if (!isSuccess) {
      return err(new DomainError(
        `${method} payment failed. Please try again or use another method.`,
        'WALLET_PAYMENT_FAILED',
        { method, reference }
      ));
    }

    pinoLogger.info(
      { method, amount: amountCents, reference },
      'Digital wallet payment simulated successfully'
    );

    return ok(undefined);
  }

  /**
   * Calculate change in cents
   */
  private calculateChangeCents(totalCents: number, paidCents: number): number {
    if (paidCents <= totalCents) {
      return 0;
    }
    return paidCents - totalCents;
  }

  /**
   * Invalidate payment-related caches
   */
  private async invalidatePaymentCaches(
    tenantId: string,
    orderId: string,
    checkId: string
  ): Promise<void> {
    await this.cache.delete(`order:${tenantId}:${orderId}`);
    await this.cache.delete(`check:${tenantId}:${checkId}:payments`);
    await this.cache.deletePattern(`orders:active:${tenantId}:*`);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const paymentService = new PaymentService(
  new PrismaClient()
);
