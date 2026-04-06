/**
 * Team API — Unified employees + drivers endpoint
 * GET /api/admin/team — List all employees with driver relations
 *
 * Replaces separate /api/admin/employees and /api/drivers calls
 * for the unified /admin/equipo page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);

  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const tenantId = authResult.user.tenantId;
    log.info({ operation: 'list_team', tenantId }, 'Listing team members');

    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Cache key for team endpoint
    const cacheKey = generateCacheKey('team', tenantId, params.page, params.limit);

    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_team_cache_hit',
        cacheKey,
        tenantId,
        durationMs: Date.now() - startTime,
      }, 'Team retrieved from cache');
      return NextResponse.json(cached);
    }

    // Count ALL employees (active + inactive) for the unified view
    const dbStart = Date.now();
    const total = await prisma.employees.count({
      where: { tenant_id: tenantId },
    });
    logPerformance('db_count_team', Date.now() - dbStart, { total, tenantId });

    // Fetch employees with driver relations
    const queryStart = Date.now();
    const employees = await prisma.employees.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
        phone: true,
        email: true,
        profile_photo_url: true,
        hire_date: true,
        dni: true,
        drivers: {
          select: {
            id: true,
            name: true,
            is_active: true,
          },
        },
      },
    });
    logPerformance('db_query_team', Date.now() - queryStart, {
      count: employees.length,
      page: params.page,
      limit: params.limit,
      tenantId,
    });

    const response = createPaginatedResponse(employees, total, params);

    // Cache for 30 seconds
    await cache.set(cacheKey, response, { ttl: 30, tags: ['employees', 'team'] });

    log.info({
      operation: 'list_team_success',
      count: employees.length,
      total,
      tenantId,
      durationMs: Date.now() - startTime,
    }, 'Team listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    log.error({
      operation: 'list_team_error',
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    }, 'Failed to list team');

    return NextResponse.json(
      { error: 'Error al obtener el equipo' },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging(handleGET);
