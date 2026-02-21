/**
 * Petty Cash Service
 *
 * Manages petty cash balance, transactions, approval flow, and reconciliation.
 * All amounts in centavos (integer).
 *
 * @module core/services/petty-cash.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, ValidationError, NotFoundError } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface PettyCashBalance {
  id: string;
  tenantId: string;
  locationId: string;
  currentBalance: number;
  maxBalance: number;
  minBalance: number;
  approvalThreshold: number;
  lastReconciledAt: string;
  lastReconciledBy: string | null;
}

export interface PettyCashTransaction {
  id: string;
  tenantId: string;
  locationId: string;
  shiftId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: PettyCashCategory;
  description: string;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  receiptPhotoUrl: string | null;
  receiptNumber: string | null;
  supplierName: string | null;
  createdBy: string;
  createdAt: string;
}

export type PettyCashCategory =
  | 'SUPPLIES'
  | 'TRANSPORT'
  | 'FOOD'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'OTHER';

export interface RecordTransactionInput {
  tenantId: string;
  locationId: string;
  shiftId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: PettyCashCategory;
  description: string;
  createdBy: string;
  receiptPhotoUrl?: string;
  receiptNumber?: string;
  supplierName?: string;
}

export interface ReconciliationResult {
  previousBalance: number;
  countedAmount: number;
  difference: number;
  reconciledAt: string;
  reconciledBy: string;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'INCOME' | 'EXPENSE';
  category?: PettyCashCategory;
  requiresApproval?: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class PettyCashService {
  constructor(private prisma: PrismaClient) {}

  async getBalance(
    tenantId: string,
    locationId: string,
  ): Promise<Result<PettyCashBalance, DomainError>> {
    const balance = await (this.prisma as any).petty_cash_balance.findUnique({
      where: { tenant_id_location_id: { tenant_id: tenantId, location_id: locationId } },
    });

    if (!balance) {
      return err(new NotFoundError('petty_cash_balance', `${tenantId}/${locationId}`));
    }

    return ok({
      id: balance.id,
      tenantId: balance.tenant_id,
      locationId: balance.location_id,
      currentBalance: balance.current_balance,
      maxBalance: balance.max_balance,
      minBalance: balance.min_balance,
      approvalThreshold: balance.approval_threshold,
      lastReconciledAt: balance.last_reconciled_at.toISOString(),
      lastReconciledBy: balance.last_reconciled_by,
    });
  }

  async recordTransaction(
    input: RecordTransactionInput,
  ): Promise<Result<PettyCashTransaction, DomainError>> {
    if (input.amount <= 0) {
      return err(new ValidationError('El monto debe ser mayor a 0', 'amount'));
    }

    if (!input.description.trim()) {
      return err(new ValidationError('La descripción es requerida', 'description'));
    }

    const balance = await (this.prisma as any).petty_cash_balance.findUnique({
      where: {
        tenant_id_location_id: {
          tenant_id: input.tenantId,
          location_id: input.locationId,
        },
      },
    });

    if (!balance) {
      return err(new NotFoundError('petty_cash_balance', `${input.tenantId}/${input.locationId}`));
    }

    if (input.type === 'EXPENSE') {
      const newBalance = balance.current_balance - input.amount;
      if (newBalance < balance.min_balance) {
        return err(
          new ValidationError(
            `El egreso excede el saldo mínimo. Saldo actual: ${balance.current_balance}, mínimo: ${balance.min_balance}`,
            'amount',
          ),
        );
      }
    }

    if (input.type === 'INCOME') {
      const newBalance = balance.current_balance + input.amount;
      if (newBalance > balance.max_balance) {
        return err(
          new ValidationError(
            `El ingreso excede el saldo máximo. Saldo actual: ${balance.current_balance}, máximo: ${balance.max_balance}`,
            'amount',
          ),
        );
      }
    }

    const requiresApproval = input.amount > balance.approval_threshold;
    const id = crypto.randomUUID();

    const [tx] = await (this.prisma as any).$transaction([
      (this.prisma as any).petty_cash_transactions.create({
        data: {
          id,
          tenant_id: input.tenantId,
          location_id: input.locationId,
          shift_id: input.shiftId,
          type: input.type,
          amount: input.amount,
          category: input.category,
          description: input.description.trim(),
          requires_approval: requiresApproval,
          created_by: input.createdBy,
          receipt_photo_url: input.receiptPhotoUrl ?? null,
          receipt_number: input.receiptNumber ?? null,
          supplier_name: input.supplierName ?? null,
        },
      }),
      (this.prisma as any).petty_cash_balance.update({
        where: {
          tenant_id_location_id: {
            tenant_id: input.tenantId,
            location_id: input.locationId,
          },
        },
        data: {
          current_balance:
            input.type === 'INCOME'
              ? balance.current_balance + input.amount
              : balance.current_balance - input.amount,
          updated_at: new Date(),
        },
      }),
    ]);

    return ok({
      id: tx.id,
      tenantId: tx.tenant_id,
      locationId: tx.location_id,
      shiftId: tx.shift_id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      requiresApproval: tx.requires_approval,
      approvedBy: tx.approved_by,
      approvedAt: tx.approved_at?.toISOString() ?? null,
      receiptPhotoUrl: tx.receipt_photo_url,
      receiptNumber: tx.receipt_number,
      supplierName: tx.supplier_name,
      createdBy: tx.created_by,
      createdAt: tx.created_at.toISOString(),
    });
  }

  async approveTransaction(
    tenantId: string,
    transactionId: string,
    approvedBy: string,
  ): Promise<Result<void, DomainError>> {
    const tx = await (this.prisma as any).petty_cash_transactions.findFirst({
      where: { id: transactionId, tenant_id: tenantId },
    });

    if (!tx) {
      return err(new NotFoundError('petty_cash_transaction', transactionId));
    }

    if (!tx.requires_approval) {
      return err(new ValidationError('Esta transacción no requiere aprobación'));
    }

    if (tx.approved_by) {
      return err(new ValidationError('Esta transacción ya fue aprobada'));
    }

    await (this.prisma as any).petty_cash_transactions.update({
      where: { id: transactionId },
      data: { approved_by: approvedBy, approved_at: new Date() },
    });

    return ok(undefined);
  }

  async reconcile(
    tenantId: string,
    locationId: string,
    countedAmount: number,
    reconciledBy: string,
  ): Promise<Result<ReconciliationResult, DomainError>> {
    if (countedAmount < 0) {
      return err(new ValidationError('El monto contado no puede ser negativo', 'countedAmount'));
    }

    const balance = await (this.prisma as any).petty_cash_balance.findUnique({
      where: {
        tenant_id_location_id: { tenant_id: tenantId, location_id: locationId },
      },
    });

    if (!balance) {
      return err(new NotFoundError('petty_cash_balance', `${tenantId}/${locationId}`));
    }

    const now = new Date();
    const difference = countedAmount - balance.current_balance;

    await (this.prisma as any).petty_cash_balance.update({
      where: {
        tenant_id_location_id: { tenant_id: tenantId, location_id: locationId },
      },
      data: {
        current_balance: countedAmount,
        last_reconciled_at: now,
        last_reconciled_by: reconciledBy,
        updated_at: now,
      },
    });

    return ok({
      previousBalance: balance.current_balance,
      countedAmount,
      difference,
      reconciledAt: now.toISOString(),
      reconciledBy,
    });
  }

  async getTransactions(
    tenantId: string,
    locationId: string,
    filters?: TransactionFilters,
  ): Promise<Result<PettyCashTransaction[], DomainError>> {
    const where: any = { tenant_id: tenantId, location_id: locationId };

    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.requiresApproval !== undefined) where.requires_approval = filters.requiresApproval;
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    const transactions = await (this.prisma as any).petty_cash_transactions.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return ok(
      transactions.map((tx: any) => ({
        id: tx.id,
        tenantId: tx.tenant_id,
        locationId: tx.location_id,
        shiftId: tx.shift_id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        requiresApproval: tx.requires_approval,
        approvedBy: tx.approved_by,
        approvedAt: tx.approved_at?.toISOString() ?? null,
        receiptPhotoUrl: tx.receipt_photo_url,
        receiptNumber: tx.receipt_number,
        supplierName: tx.supplier_name,
        createdBy: tx.created_by,
        createdAt: tx.created_at.toISOString(),
      })),
    );
  }
}
