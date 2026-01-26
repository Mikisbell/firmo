/**
 * Employees API - GET (list) and POST (create)
 * Requirements: 1.1, 1.2, 1.5, 1.6, 10.1
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/src/lib/rate-limit-response';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreateEmployeeSchema, EmployeeQuerySchema } from '@/src/core/admin/schemas/employee.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics, MetricNames } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();
const SALT = 'PARK_POS_2026_'; // Must match seed.ts

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

// GET - List all employees with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_employees' }, 'Listing employees');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = EmployeeQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'employees',
      params.page,
      params.limit,
      validatedQuery.is_active !== undefined ? String(validatedQuery.is_active) : 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_employees_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Employees retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = { tenant_id: TENANT_ID };
    if (validatedQuery.is_active !== undefined) {
      where.is_active = validatedQuery.is_active;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.employees.count({ where });
    logPerformance('db_count_employees', Date.now() - dbStart, { total });

    // Get paginated employees
    const queryStart = Date.now();
    const employees = await prisma.employees.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
    logPerformance('db_query_employees', Date.now() - queryStart, { 
      count: employees.length,
      page: params.page,
      limit: params.limit,
    });

    // Create response
    const response = createPaginatedResponse(employees, total, params);

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    log.info({
      operation: 'list_employees_success',
      count: employees.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Employees listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_employees_validation_error',
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
      operation: 'list_employees_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list employees');
    
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new employee
async function handlePOST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // ✅ PASO 1: Rate limiting (10 requests por minuto)
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.MUTATION);
  if (rateLimitResponse) {
    return rateLimitResponse; // Retorna 429 si excede el límite
  }

  // ✅ PASO 2: Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    log.info({ operation: 'create_employee' }, 'Creating new employee');
    
    const body = await request.json();
    
    // ✅ PASO 3: Validate with Zod
    const validatedData = CreateEmployeeSchema.parse(body);
    const { name, role, pin, is_active = true } = validatedData;

    // Hash PIN
    const pin_hash = hashPin(pin);

    // Check PIN uniqueness
    const existingPin = await prisma.employees.findFirst({
      where: {
        tenant_id: TENANT_ID,
        pin_hash,
        is_active: true,
      },
    });

    if (existingPin) {
      log.warn({
        operation: 'create_employee_duplicate_pin',
        name,
        role,
      }, 'Attempted to create employee with duplicate PIN');
      
      return NextResponse.json(
        { error: 'Este PIN ya está en uso' },
        { status: 409 }
      );
    }

    // Create employee in transaction with audit trail
    const txStart = Date.now();
    const employee = await prisma.$transaction(async (tx: any) => {
      const newEmployee = await tx.employees.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          name,
          role,
          pin_hash,
          is_active,
        },
      });

      // Log audit trail in database
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'employees',
          metadata: { record_id: newEmployee.id },
          created_at: new Date(),
        },
      });

      return newEmployee;
    });
    logPerformance('db_transaction_create_employee', Date.now() - txStart);

    // Invalidate employees cache
    await cache.invalidatePattern('employees:*');

    // Record business metrics
    metrics.increment(MetricNames.EMPLOYEES_CREATED_TOTAL, {
      role: employee.role,
      tenant_id: TENANT_ID,
    });

    // Update active employees gauge
    const activeCount = await prisma.employees.count({
      where: { tenant_id: TENANT_ID, is_active: true },
    });
    metrics.set(MetricNames.EMPLOYEES_ACTIVE, activeCount, {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('CREATE', 'employees', authResult.user.id, {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeRole: employee.role,
    });

    log.info({
      operation: 'create_employee_success',
      employeeId: employee.id,
      employeeName: employee.name,
      employeeRole: employee.role,
      durationMs: Date.now() - startTime,
    }, 'Employee created successfully');

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_employee_validation_error',
        errors: error.errors,
      }, 'Invalid employee data');
      
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
      operation: 'create_employee_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create employee');
    
    return NextResponse.json(
      { error: 'Error al crear empleado' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
