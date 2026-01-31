/**
 * Enhanced Pagination Service
 * 
 * Implements efficient pagination with:
 * - Cursor-based pagination for large datasets
 * - Offset-based pagination for small datasets
 * - Metadata for UI (total pages, hasNext, etc.)
 * - Performance optimizations
 */

import { PrismaClient } from '@prisma/client';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
  includeTotal?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page?: number;
    limit: number;
    total?: number;
    totalPages?: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

export interface CursorInfo {
  id: string;
  created_at: Date;
}

/**
 * Generic pagination function for any Prisma model
 */
export async function paginate<T, K extends keyof T>(
  model: any,
  options: PaginationOptions = {},
  where: any = {},
  select?: any,
  include?: any
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    limit = 20,
    cursor,
    orderBy = { created_at: 'desc' as const },
    includeTotal = true
  } = options;

  // Validate limits
  const safeLimit = Math.min(Math.max(limit, 1), 100); // Max 100 items per page
  const safePage = Math.max(page, 1);

  let query: any = {
    where,
    select,
    include,
    orderBy,
    take: safeLimit + 1, // +1 to check if there's a next page
  };

  // Handle cursor-based pagination (for large datasets)
  if (cursor) {
    const cursorInfo: CursorInfo = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query.where = {
      ...where,
      created_at: {
        lt: cursorInfo.created_at,
        ...(cursorInfo.id && { id: { lt: cursorInfo.id } })
      }
    };
  }

  // Handle offset-based pagination (for small datasets)
  else {
    query.skip = (safePage - 1) * safeLimit;
    query.take = safeLimit;
  }

  const results = await model.findMany(query);
  
  // Determine if there are more results
  const hasNext = results.length > safeLimit;
  const data = hasNext ? results.slice(0, -1) : results;

  const pagination: any = {
    limit: safeLimit,
    hasNext,
    hasPrevious: cursor ? true : safePage > 1,
  };

  // Add cursor info
  if (cursor || hasNext) {
    const lastItem = data[data.length - 1];
    if (lastItem?.id && lastItem?.created_at) {
      pagination.nextCursor = Buffer.from(JSON.stringify({
        id: lastItem.id,
        created_at: lastItem.created_at
      })).toString('base64');
    }
  }

  // Add page info for offset pagination
  if (!cursor) {
    pagination.page = safePage;
    pagination.hasPrevious = safePage > 1;
    
    if (includeTotal) {
      const total = await model.count({ where });
      pagination.total = total;
      pagination.totalPages = Math.ceil(total / safeLimit);
    }
  }

  return { data, pagination };
}

/**
 * Specialized pagination for Orders (most common use case)
 */
export async function paginateOrders(
  prisma: PrismaClient,
  tenantId: string,
  options: PaginationOptions = {},
  filters: {
    status?: string[];
    businessDate?: Date;
    terminalId?: string;
    customerId?: string;
  } = {}
): Promise<PaginatedResult<any>> {
  const where: any = {
    tenant_id: tenantId,
    ...filters.status && { order_status: { in: filters.status } },
    ...filters.businessDate && { business_date: filters.businessDate },
    ...filters.terminalId && { terminal_id: filters.terminalId },
    ...filters.customerId && { customer_id: filters.customerId },
  };

  const orderBy = options.orderBy || {
    created_at: 'desc' as const,
    order_number: 'desc' as const
  };

  return paginate(
    prisma.orders,
    { ...options, orderBy },
    where,
    {
      id: true,
      order_number: true,
      order_status: true,
      order_type: true,
      total_cents: true,
      created_at: true,
      customer_id: true,
      terminal_id: true,
    }
  );
}

/**
 * Specialized pagination for Products
 */
export async function paginateProducts(
  prisma: PrismaClient,
  tenantId: string,
  options: PaginationOptions = {},
  filters: {
    category?: string;
    station?: string;
    search?: string;
    isActive?: boolean;
  } = {}
): Promise<PaginatedResult<any>> {
  const where: any = {
    tenant_id: tenantId,
    ...filters.category && { category: filters.category },
    ...filters.station && { station: filters.station },
    ...filters.isActive !== undefined && { is_active: filters.isActive },
    ...filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { short_name: { contains: filters.search, mode: 'insensitive' } }
      ]
    }
  };

  const orderBy = options.orderBy || {
    name: 'asc' as const,
    category: 'asc' as const
  };

  return paginate(
    prisma.products,
    { ...options, orderBy },
    where,
    {
      id: true,
      sku: true,
      name: true,
      short_name: true,
      price_cents: true,
      category: true,
      station: true,
      is_active: true,
      images: true,
    }
  );
}

/**
 * Specialized pagination for Inventory
 */
export async function paginateInventory(
  prisma: PrismaClient,
  tenantId: string,
  options: PaginationOptions = {},
  filters: {
    locationId?: string;
    lowStock?: boolean;
    search?: string;
    expiring?: boolean;
  } = {}
): Promise<PaginatedResult<any>> {
  const where: any = {
    tenant_id: tenantId,
    ...filters.locationId && { location_id: filters.locationId },
    ...filters.lowStock && {
      min_stock: { not: null },
      stock: { lte: { path: 'min_stock' } }
    },
    ...filters.search && {
      OR: [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } }
      ]
    },
    ...filters.expiring && {
      expiry_date: { 
        not: null,
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    }
  };

  const orderBy = options.orderBy || {
    code: 'asc' as const,
    name: 'asc' as const
  };

  return paginate(
    prisma.inventory,
    { ...options, orderBy },
    where,
    {
      id: true,
      code: true,
      name: true,
      stock: true,
      min_stock: true,
      cost_cents: true,
      expiry_date: true,
      location_id: true,
    }
  );
}

/**
 * Performance metrics for pagination
 */
export function getPaginationMetrics(): any {
  return {
    defaultPageSize: 20,
    maxPageSize: 100,
    recommendedPageSizes: [10, 20, 50, 100],
    performanceHints: {
      useCursorForLargeDatasets: true,
      useOffsetForSmallDatasets: false,
      includeTotalCountSparingly: true,
      cachePopularQueries: true
    }
  };
}