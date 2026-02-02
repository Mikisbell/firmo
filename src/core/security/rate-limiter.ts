import prisma from '@/src/core/db/prisma';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
}

/**
 * Obtiene o crea los límites de transacción para un empleado
 */
export async function getOrCreateLimits(
  tenantId: string,
  employeeId: string
): Promise<any> {
  let limits = await prisma.transaction_limits.findUnique({
    where: {
      tenant_id_employee_id: {
        tenant_id: tenantId,
        employee_id: employeeId,
      },
    },
  });

  if (!limits) {
    limits = await prisma.transaction_limits.create({
      data: {
        tenant_id: tenantId,
        employee_id: employeeId,
        max_transactions_per_hour: 100,
        max_transactions_per_day: 500,
        max_amount_per_transaction: 100000,
        max_price_changes_per_hour: 20,
        max_refunds_per_day: 10,
      },
    });
  }

  return limits;
}

/**
 * Verifica si se puede realizar una transacción
 */
export async function checkTransactionLimit(
  tenantId: string,
  employeeId: string,
  amountCents: number
): Promise<RateLimitCheckResult> {
  const limits = await getOrCreateLimits(tenantId, employeeId);

  // Verificar límite por transacción
  if (amountCents > limits.max_amount_per_transaction) {
    return {
      allowed: false,
      reason: `Monto excede límite: ${amountCents} > ${limits.max_amount_per_transaction}`,
      limit: limits.max_amount_per_transaction,
    };
  }

  // Contar transacciones en la última hora
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const transactionsLastHour = await prisma.session_audit_log.count({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'TRANSACTION',
      created_at: {
        gte: oneHourAgo,
      },
    },
  });

  if (transactionsLastHour >= limits.max_transactions_per_hour) {
    return {
      allowed: false,
      reason: `Límite de transacciones por hora alcanzado: ${transactionsLastHour} >= ${limits.max_transactions_per_hour}`,
      limit: limits.max_transactions_per_hour,
      remaining: 0,
    };
  }

  // Contar transacciones en el día
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const transactionsToday = await prisma.session_audit_log.count({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'TRANSACTION',
      created_at: {
        gte: today,
      },
    },
  });

  if (transactionsToday >= limits.max_transactions_per_day) {
    return {
      allowed: false,
      reason: `Límite de transacciones por día alcanzado: ${transactionsToday} >= ${limits.max_transactions_per_day}`,
      limit: limits.max_transactions_per_day,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: limits.max_transactions_per_hour - transactionsLastHour,
    limit: limits.max_transactions_per_hour,
  };
}

/**
 * Verifica si se puede cambiar precios
 */
export async function checkPriceChangeLimit(
  tenantId: string,
  employeeId: string
): Promise<RateLimitCheckResult> {
  const limits = await getOrCreateLimits(tenantId, employeeId);

  // Contar cambios de precio en la última hora
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const priceChangesLastHour = await prisma.session_audit_log.count({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'PRICE_CHANGE',
      created_at: {
        gte: oneHourAgo,
      },
    },
  });

  if (priceChangesLastHour >= limits.max_price_changes_per_hour) {
    return {
      allowed: false,
      reason: `Límite de cambios de precio por hora alcanzado: ${priceChangesLastHour} >= ${limits.max_price_changes_per_hour}`,
      limit: limits.max_price_changes_per_hour,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: limits.max_price_changes_per_hour - priceChangesLastHour,
    limit: limits.max_price_changes_per_hour,
  };
}

/**
 * Verifica si se puede hacer una devolución
 */
export async function checkRefundLimit(
  tenantId: string,
  employeeId: string
): Promise<RateLimitCheckResult> {
  const limits = await getOrCreateLimits(tenantId, employeeId);

  // Contar devoluciones en el día
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const refundsToday = await prisma.session_audit_log.count({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'REFUND',
      created_at: {
        gte: today,
      },
    },
  });

  if (refundsToday >= limits.max_refunds_per_day) {
    return {
      allowed: false,
      reason: `Límite de devoluciones por día alcanzado: ${refundsToday} >= ${limits.max_refunds_per_day}`,
      limit: limits.max_refunds_per_day,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: limits.max_refunds_per_day - refundsToday,
    limit: limits.max_refunds_per_day,
  };
}

/**
 * Actualiza los límites de un empleado
 */
export async function updateLimits(
  tenantId: string,
  employeeId: string,
  updates: Partial<{
    max_transactions_per_hour: number;
    max_transactions_per_day: number;
    max_amount_per_transaction: number;
    max_price_changes_per_hour: number;
    max_refunds_per_day: number;
  }>
): Promise<any> {
  return prisma.transaction_limits.upsert({
    where: {
      tenant_id_employee_id: {
        tenant_id: tenantId,
        employee_id: employeeId,
      },
    },
    update: {
      ...updates,
      updated_at: new Date(),
    },
    create: {
      tenant_id: tenantId,
      employee_id: employeeId,
      ...updates,
    },
  });
}

/**
 * Registra una acción en el audit log
 */
export async function logAction(
  tenantId: string,
  employeeId: string,
  action: string,
  resource?: string,
  ipAddress?: string,
  details?: any
): Promise<void> {
  await prisma.session_audit_log.create({
    data: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action,
      resource,
      ip_address: ipAddress,
      details,
    },
  });
}
