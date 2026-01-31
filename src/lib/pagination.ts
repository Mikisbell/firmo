/**
 * Pagination Helpers
 * Utilities for handling pagination in API endpoints
 * 
 * Features:
 * - Parse pagination parameters from query string
 * - Validate page and limit values
 * - Calculate skip offset
 * - Create standardized paginated responses
 * 
 * Requirements: FASE1 DÍA 3 - Paginación
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/**
 * Parse and validate pagination parameters from URL search params
 * 
 * @param searchParams - URL search params object
 * @returns Validated pagination parameters with skip offset
 * 
 * @example
 * const params = parsePaginationParams(request.nextUrl.searchParams);
 * const items = await prisma.items.findMany({
 *   skip: params.skip,
 *   take: params.limit,
 * });
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  // Parse page (default: 1, min: 1)
  const pageParam = searchParams.get('page');
  let page = pageParam ? parseInt(pageParam, 10) : DEFAULT_PAGE;
  page = isNaN(page) ? DEFAULT_PAGE : Math.max(1, page);

  // Parse limit (default: 10, min: 1, max: 100)
  const limitParam = searchParams.get('limit');
  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  limit = isNaN(limit) ? DEFAULT_LIMIT : Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));

  // Calculate skip offset
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Create a standardized paginated response
 * 
 * @param items - Array of items for current page
 * @param total - Total count of items across all pages
 * @param params - Pagination parameters used for the query
 * @returns Paginated response with items and metadata
 * 
 * @example
 * const items = await prisma.items.findMany({ skip, take: limit });
 * const total = await prisma.items.count();
 * return createPaginatedResponse(items, total, params);
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
}

/**
 * Helper to get pagination info without items
 * Useful for count-only queries
 */
export function getPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
}

