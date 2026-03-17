/**
 * Customers API - GET and POST
 * Gestión de clientes (identidad fiscal, contacto, historial)
 *
 * Requirements: Customer CRUD for POS and admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CustomerQuerySchema, CreateCustomerSchema } from '@/src/core/admin/schemas/customer.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

// GET - List customers with pagination and filters
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    log.info({ operation: 'list_customers' }, 'Listing customers');

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;

    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = CustomerQuerySchema.parse(queryParams);

    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key with tenantId
    const cacheKey = generateCacheKey(
      'customers',
      tenantId,
      params.page,
      params.limit,
      validatedQuery.search || 'none',
      validatedQuery.doc_type || 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_customers_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Customers retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause with tenantId from JWT
    const where: any = {
      tenant_id: tenantId,
    };

    if (validatedQuery.search) {
      where.OR = [
        { phone: { contains: validatedQuery.search } },
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { doc_number: { contains: validatedQuery.search } },
      ];
    }

    if (validatedQuery.doc_type) {
      where.doc_type = validatedQuery.doc_type;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.customers.count({ where });
    logPerformance('db_count_customers', Date.now() - dbStart, { total });

    // Get paginated customers
    const queryStart = Date.now();
    const customers = await prisma.customers.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: params.skip,
      take: params.limit,
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
    logPerformance('db_query_customers', Date.now() - queryStart, {
      count: customers.length,
      page: params.page,
      limit: params.limit,
    });

    // Create paginated response
    const response = createPaginatedResponse(customers, total, params);

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    log.info({
      operation: 'list_customers_success',
      count: customers.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Customers listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_customers_validation_error',
        errors: error.errors,
      }, 'Invalid query parameters');

      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    log.error({
      operation: 'list_customers_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list customers');

    return NextResponse.json(
      { error: 'Error al obtener clientes' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new customer
async function handlePOST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    log.info({ operation: 'create_customer' }, 'Creating new customer');

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;

    const body = await request.json();

    // Validate with Zod
    const validatedData = CreateCustomerSchema.parse(body);
    const { phone, name, email, doc_type, doc_number } = validatedData;

    const checkStart = Date.now();

    // Check for duplicate doc_number if provided
    if (doc_number) {
      const existingDoc = await prisma.customers.findFirst({
        where: {
          tenant_id: tenantId,
          doc_number,
        },
      });

      if (existingDoc) {
        log.warn({
          operation: 'create_customer_duplicate_doc',
          doc_number,
        }, 'Customer with this document number already exists');

        return NextResponse.json(
          { error: 'Ya existe un cliente con ese número de documento' },
          { status: 409 }
        );
      }
    }

    // Check for duplicate phone
    const existingPhone = await prisma.customers.findFirst({
      where: {
        tenant_id: tenantId,
        phone,
      },
    });
    logPerformance('db_check_duplicate_customer', Date.now() - checkStart);

    if (existingPhone) {
      log.warn({
        operation: 'create_customer_duplicate_phone',
        phone,
      }, 'Customer with this phone already exists');

      return NextResponse.json(
        { error: 'Ya existe un cliente con ese número de teléfono' },
        { status: 409 }
      );
    }

    // Create customer in transaction with audit trail
    const txStart = Date.now();
    const customer = await prisma.$transaction(async (tx: any) => {
      const newCustomer = await tx.customers.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          phone,
          name: name ?? null,
          email: email ?? null,
          doc_type: doc_type ?? null,
          doc_number: doc_number ?? null,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'customers',
          metadata: { record_id: newCustomer.id },
          created_at: new Date(),
        },
      });

      return newCustomer;
    });
    logPerformance('db_transaction_create_customer', Date.now() - txStart);

    // Invalidate customers cache
    await cache.invalidatePattern('customers:*');

    // Record business metrics
    metrics.increment('customers_created_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('CREATE', 'customers', authResult.user.id, {
      customerId: customer.id,
      customerPhone: customer.phone,
      customerName: customer.name,
    });

    log.info({
      operation: 'create_customer_success',
      customerId: customer.id,
      customerPhone: customer.phone,
      durationMs: Date.now() - startTime,
    }, 'Customer created successfully');

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_customer_validation_error',
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
      operation: 'create_customer_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create customer');

    return NextResponse.json(
      { error: 'Error al crear cliente' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
