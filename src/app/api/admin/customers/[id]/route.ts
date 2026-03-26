/**
 * Customer API - GET, PUT and DELETE by ID
 * Consulta, actualización y eliminación de clientes
 *
 * Requirements: Customer CRUD for POS and admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { UpdateCustomerSchema } from '@/src/core/admin/schemas/customer.schema';
import { ZodError } from 'zod';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get single customer by ID
async function handleGET(
  request: NextRequest,
  { params }: RouteContext
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id } = await params;

  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Extract tenantId from JWT
  const tenantId = authResult.user.tenantId;

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
    customerId: id,
  });

  try {
    log.info({ operation: 'get_customer', customerId: id }, 'Getting customer');

    const checkStart = Date.now();
    const customer = await prisma.customers.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        doc_type: true,
        doc_number: true,
        total_orders: true,
        total_spent: true,
        last_order_at: true,
        updated_at: true,
      },
    });
    logPerformance('db_get_customer', Date.now() - checkStart);

    if (!customer) {
      log.warn({
        operation: 'get_customer_not_found',
        customerId: id,
      }, 'Customer not found');

      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    log.info({
      operation: 'get_customer_success',
      customerId: id,
      durationMs: Date.now() - startTime,
    }, 'Customer retrieved successfully');

    return NextResponse.json(customer);
  } catch (error) {
    log.error({
      operation: 'get_customer_error',
      customerId: id,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to get customer');

    return NextResponse.json(
      { error: 'Error al obtener cliente' },
      { status: 500 }
    );
  }
}

export const GET = handleGET;

// PUT - Update customer
async function handlePUT(
  request: NextRequest,
  { params }: RouteContext
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id } = await params;

  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Extract tenantId from JWT
  const tenantId = authResult.user.tenantId;

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
    customerId: id,
  });

  try {
    log.info({ operation: 'update_customer', customerId: id }, 'Updating customer');

    const body = await request.json();

    // Validate with Zod
    const validatedData = UpdateCustomerSchema.parse(body);

    // Check if customer exists and belongs to this tenant
    const checkStart = Date.now();
    const existing = await prisma.customers.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });
    logPerformance('db_check_customer_exists', Date.now() - checkStart);

    if (!existing) {
      log.warn({
        operation: 'update_customer_not_found',
        customerId: id,
      }, 'Customer not found');

      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // If doc_number is changing, check for duplicates (exclude self)
    if (validatedData.doc_number && validatedData.doc_number !== existing.doc_number) {
      const dupStart = Date.now();
      const duplicateDoc = await prisma.customers.findFirst({
        where: {
          tenant_id: tenantId,
          doc_number: validatedData.doc_number,
          id: { not: id },
        },
      });
      logPerformance('db_check_duplicate_doc', Date.now() - dupStart);

      if (duplicateDoc) {
        log.warn({
          operation: 'update_customer_duplicate_doc',
          customerId: id,
          doc_number: validatedData.doc_number,
        }, 'Document number already in use by another customer');

        return NextResponse.json(
          { error: 'Ya existe un cliente con ese número de documento' },
          { status: 409 }
        );
      }
    }

    // Update customer in transaction with audit trail
    const txStart = Date.now();
    const customer = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.customers.update({
        where: { id, tenant_id: tenantId },
        data: validatedData,
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'customers',
          metadata: {
            record_id: updated.id,
            changes: validatedData,
          },
          created_at: new Date(),
        },
      });

      return updated;
    });
    logPerformance('db_transaction_update_customer', Date.now() - txStart);

    // Invalidate customers cache
    await cache.deleteByTag('customers');

    // Log audit event
    logAudit('UPDATE', 'customers', authResult.user.id, {
      customerId: customer.id,
      customerPhone: customer.phone,
      changes: validatedData,
    });

    log.info({
      operation: 'update_customer_success',
      customerId: customer.id,
      durationMs: Date.now() - startTime,
    }, 'Customer updated successfully');

    return NextResponse.json(customer);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'update_customer_validation_error',
        errors: error.errors,
      }, 'Invalid customer data');

      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    log.error({
      operation: 'update_customer_error',
      customerId: id,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to update customer');

    return NextResponse.json(
      { error: 'Error al actualizar cliente' },
      { status: 500 }
    );
  }
}

export const PUT = handlePUT;

// DELETE - Delete customer (hard delete, guarded by open orders check)
async function handleDELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id } = await params;

  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Extract tenantId from JWT
  const tenantId = authResult.user.tenantId;

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
    customerId: id,
  });

  try {
    log.info({ operation: 'delete_customer', customerId: id }, 'Deleting customer');

    // Check if customer exists and belongs to this tenant
    const checkStart = Date.now();
    const existing = await prisma.customers.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });
    logPerformance('db_check_customer_exists', Date.now() - checkStart);

    if (!existing) {
      log.warn({
        operation: 'delete_customer_not_found',
        customerId: id,
      }, 'Customer not found');

      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Check for open orders linked to this customer
    const ordersStart = Date.now();
    const openOrdersCount = await prisma.orders.count({
      where: {
        customer_id: id,
        tenant_id: tenantId,
        order_status: { not: 'CLOSED' },
      },
    });
    logPerformance('db_check_open_orders', Date.now() - ordersStart);

    if (openOrdersCount > 0) {
      log.warn({
        operation: 'delete_customer_has_open_orders',
        customerId: id,
        openOrdersCount,
      }, 'Cannot delete customer with active orders');

      return NextResponse.json(
        { error: 'Cliente tiene pedidos activos' },
        { status: 409 }
      );
    }

    // Delete customer in transaction with audit trail
    const txStart = Date.now();
    const customer = await prisma.$transaction(async (tx: any) => {
      const deleted = await tx.customers.delete({
        where: { id },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'customers',
          metadata: { record_id: deleted.id },
          created_at: new Date(),
        },
      });

      return deleted;
    });
    logPerformance('db_transaction_delete_customer', Date.now() - txStart);

    // Invalidate customers cache
    await cache.deleteByTag('customers');

    // Record business metrics
    metrics.increment('customers_deleted_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('DELETE', 'customers', authResult.user.id, {
      customerId: customer.id,
      customerPhone: customer.phone,
      customerName: customer.name,
    });

    log.info({
      operation: 'delete_customer_success',
      customerId: customer.id,
      durationMs: Date.now() - startTime,
    }, 'Customer deleted successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({
      operation: 'delete_customer_error',
      customerId: id,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to delete customer');

    return NextResponse.json(
      { error: 'Error al eliminar cliente' },
      { status: 500 }
    );
  }
}

export const DELETE = handleDELETE;
