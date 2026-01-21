/**
 * Cursor-Based Pagination Helpers (2026 Modern)
 * 
 * Features:
 * - Cursor-based pagination for infinite scroll
 * - Better performance for large datasets
 * - Real-time friendly (no page drift)
 * - Bi-directional scrolling support
 * 
 * Use cases:
 * - Infinite scroll lists
 * - Real-time feeds
 * - Large datasets (>10k items)
 * 
 * Requirements: FASE1 DÍA 4 PARTE 2 - Modernización
 */

export interface CursorPaginationParams {
  cursor?: string | null;
  limit: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  pagination: CursorPaginationMeta;
}

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/**
 * Parse cursor-based pagination parameters from URL search params
 * 
 * @param searchParams - URL search params object
 * @returns Validated cursor pagination parameters
 * 
 * @example
 * const params = parseCursorPaginationParams(request.nextUrl.searchParams);
 * const items = await prisma.items.findMany({
 *   cursor: params.cursor ? { id: params.cursor } : undefined,
 *   take: params.direction === 'backward' ? -params.limit : params.limit,
 *   skip: params.cursor ? 1 : 0, // Skip the cursor itself
 * });
 */
export function parseCursorPaginationParams(
  searchParams: URLSearchParams
): CursorPaginationParams {
  // Parse cursor (optional)
  const cursor = searchParams.get('cursor') || null;

  // Parse limit (default: 20, min: 1, max: 100)
  const limitParam = searchParams.get('limit');
  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  limit = isNaN(limit) ? DEFAULT_LIMIT : Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));

  // Parse direction (default: forward)
  const directionParam = searchParams.get('direction');
  const direction = directionParam === 'backward' ? 'backward' : 'forward';

  return {
    cursor,
    limit,
    direction,
  };
}

/**
 * Create a cursor-based paginated response
 * 
 * @param items - Array of items for current page
 * @param params - Cursor pagination parameters used for the query
 * @param getCursor - Function to extract cursor from an item
 * @returns Cursor paginated response with items and metadata
 * 
 * @example
 * const items = await prisma.items.findMany({ ... });
 * return createCursorPaginatedResponse(
 *   items,
 *   params,
 *   (item) => item.id
 * );
 */
export function createCursorPaginatedResponse<T>(
  items: T[],
  params: CursorPaginationParams,
  getCursor: (item: T) => string
): CursorPaginatedResponse<T> {
  const { limit, direction } = params;

  // Determine if there are more items
  const hasMore = items.length > limit;

  // Remove extra item if we fetched limit + 1
  const resultItems = hasMore ? items.slice(0, limit) : items;

  // Calculate cursors
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (resultItems.length > 0) {
    if (direction === 'forward') {
      nextCursor = hasMore ? getCursor(resultItems[resultItems.length - 1]) : null;
      prevCursor = getCursor(resultItems[0]);
    } else {
      nextCursor = getCursor(resultItems[resultItems.length - 1]);
      prevCursor = hasMore ? getCursor(resultItems[0]) : null;
    }
  }

  return {
    items: resultItems,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      limit,
    },
  };
}

/**
 * Encode cursor for URL safety
 * Converts any value to a base64-encoded string
 */
export function encodeCursor(value: string | number | Date): string {
  const str = typeof value === 'string' ? value : value.toString();
  return Buffer.from(str).toString('base64url');
}

/**
 * Decode cursor from URL-safe format
 * Converts base64-encoded string back to original value
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

/**
 * Helper to build Prisma cursor query
 * 
 * @example
 * const query = buildPrismaCursorQuery(params, 'id');
 * const items = await prisma.items.findMany({
 *   ...query,
 *   orderBy: { id: 'asc' },
 * });
 */
export function buildPrismaCursorQuery(
  params: CursorPaginationParams,
  cursorField: string = 'id'
): {
  cursor?: { [key: string]: string };
  take: number;
  skip?: number;
} {
  const { cursor, limit, direction } = params;

  const query: any = {
    take: direction === 'backward' ? -(limit + 1) : limit + 1,
  };

  if (cursor) {
    query.cursor = { [cursorField]: decodeCursor(cursor) };
    query.skip = 1; // Skip the cursor itself
  }

  return query;
}
