/**
 * Property-Based Tests for Pagination
 * 
 * Tests universal properties that should hold for all pagination operations
 * 
 * Property 17: Pagination Support
 * For any list endpoint that can return more than 100 records, the API SHALL 
 * support pagination parameters (page, pageSize) and return paginated results 
 * with metadata (total, totalPages).
 * 
 * Requirements: 9.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parsePaginationParams,
  createPaginatedResponse,
  getPaginationMeta,
  PaginationParams,
} from '../pagination';

describe('Pagination Property Tests', () => {
  describe('Property 17: Pagination Support', () => {
    it('should enforce maximum page size of 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }), // page
          fc.integer({ min: 1, max: 500 }), // requested limit
          (page, requestedLimit) => {
            const searchParams = new URLSearchParams({
              page: page.toString(),
              pageSize: requestedLimit.toString(),
            });

            const params = parsePaginationParams(searchParams);

            // Property: limit should never exceed 100
            expect(params.limit).toBeLessThanOrEqual(100);
            expect(params.limit).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct pagination metadata', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          fc.integer({ min: 0, max: 10000 }), // total items
          (page, limit, total) => {
            const params: PaginationParams = {
              page,
              limit,
              skip: (page - 1) * limit,
            };

            const meta = getPaginationMeta(total, params);

            // Property: totalPages should be correct
            const expectedTotalPages = Math.ceil(total / limit);
            expect(meta.totalPages).toBe(expectedTotalPages);

            // Property: hasNext should be true if not on last page
            const expectedHasNext = page < expectedTotalPages;
            expect(meta.hasNext).toBe(expectedHasNext);

            // Property: hasPrev should be true if not on first page
            const expectedHasPrev = page > 1;
            expect(meta.hasPrev).toBe(expectedHasPrev);

            // Property: metadata should include all required fields
            expect(meta).toHaveProperty('page');
            expect(meta).toHaveProperty('limit');
            expect(meta).toHaveProperty('total');
            expect(meta).toHaveProperty('totalPages');
            expect(meta).toHaveProperty('hasNext');
            expect(meta).toHaveProperty('hasPrev');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate skip offset correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          (page, limit) => {
            const searchParams = new URLSearchParams({
              page: page.toString(),
              pageSize: limit.toString(),
            });

            const params = parsePaginationParams(searchParams);

            // Property: skip should equal (page - 1) * limit
            const expectedSkip = (page - 1) * limit;
            expect(params.skip).toBe(expectedSkip);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('0'),
            fc.constant('-1'),
            fc.constant('abc'),
            fc.constant(''),
            fc.constant(null)
          ), // invalid page
          fc.oneof(
            fc.constant('0'),
            fc.constant('-1'),
            fc.constant('xyz'),
            fc.constant(''),
            fc.constant(null)
          ), // invalid limit
          (invalidPage, invalidLimit) => {
            const searchParams = new URLSearchParams();
            if (invalidPage) searchParams.set('page', invalidPage);
            if (invalidLimit) searchParams.set('pageSize', invalidLimit);

            const params = parsePaginationParams(searchParams);

            // Property: should always return valid defaults for invalid inputs
            expect(params.page).toBeGreaterThanOrEqual(1);
            expect(params.limit).toBeGreaterThanOrEqual(1);
            expect(params.limit).toBeLessThanOrEqual(100);
            expect(params.skip).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should support both pageSize and limit parameters', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (pageSize, limit) => {
            // Test with pageSize (should take precedence)
            const searchParams1 = new URLSearchParams({
              pageSize: pageSize.toString(),
              limit: limit.toString(),
            });
            const params1 = parsePaginationParams(searchParams1);
            expect(params1.limit).toBe(pageSize);

            // Test with only limit
            const searchParams2 = new URLSearchParams({
              limit: limit.toString(),
            });
            const params2 = parsePaginationParams(searchParams2);
            expect(params2.limit).toBe(limit);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create consistent paginated responses', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 200 }), // items
          fc.integer({ min: 1, max: 50 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          (allItems, page, limit) => {
            const total = allItems.length;
            const skip = (page - 1) * limit;
            const items = allItems.slice(skip, skip + limit);

            const params: PaginationParams = { page, limit, skip };
            const response = createPaginatedResponse(items, total, params);

            // Property: response should have correct structure
            expect(response).toHaveProperty('items');
            expect(response).toHaveProperty('pagination');

            // Property: items should match input
            expect(response.items).toEqual(items);

            // Property: pagination metadata should be consistent
            expect(response.pagination.page).toBe(page);
            expect(response.pagination.limit).toBe(limit);
            expect(response.pagination.total).toBe(total);
            expect(response.pagination.totalPages).toBe(Math.ceil(total / limit));

            // Property: hasNext should be correct
            const expectedHasNext = skip + items.length < total;
            expect(response.pagination.hasNext).toBe(expectedHasNext);

            // Property: hasPrev should be correct
            const expectedHasPrev = page > 1;
            expect(response.pagination.hasPrev).toBe(expectedHasPrev);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty result sets correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          (page, limit) => {
            const params: PaginationParams = {
              page,
              limit,
              skip: (page - 1) * limit,
            };

            const response = createPaginatedResponse([], 0, params);

            // Property: empty results should have correct metadata
            expect(response.items).toEqual([]);
            expect(response.pagination.total).toBe(0);
            expect(response.pagination.totalPages).toBe(0);
            expect(response.pagination.hasNext).toBe(false);
            expect(response.pagination.hasPrev).toBe(page > 1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain invariant: skip + items.length <= total (or skip >= total for empty pages)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 500 }), // all items
          fc.integer({ min: 1, max: 50 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          (allItems, page, limit) => {
            const total = allItems.length;
            const skip = (page - 1) * limit;
            const items = allItems.slice(skip, skip + limit);

            const params: PaginationParams = { page, limit, skip };
            const response = createPaginatedResponse(items, total, params);

            // Property: skip + items.length should never exceed total
            // OR skip >= total (which means we're on an empty page beyond the data)
            const condition = skip + response.items.length <= total || skip >= total;
            expect(condition).toBe(true);
            
            // Additional property: if skip >= total, items should be empty
            if (skip >= total) {
              expect(response.items).toEqual([]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle page 1 correctly', () => {
      const searchParams = new URLSearchParams({ page: '1', pageSize: '20' });
      const params = parsePaginationParams(searchParams);

      expect(params.page).toBe(1);
      expect(params.skip).toBe(0);
      expect(params.limit).toBe(20);
    });

    it('should handle maximum page size', () => {
      const searchParams = new URLSearchParams({ page: '1', pageSize: '100' });
      const params = parsePaginationParams(searchParams);

      expect(params.limit).toBe(100);
    });

    it('should enforce maximum page size when exceeded', () => {
      const searchParams = new URLSearchParams({ page: '1', pageSize: '500' });
      const params = parsePaginationParams(searchParams);

      expect(params.limit).toBe(100); // Should be capped at 100
    });

    it('should use defaults when no parameters provided', () => {
      const searchParams = new URLSearchParams();
      const params = parsePaginationParams(searchParams);

      expect(params.page).toBe(1);
      expect(params.limit).toBe(10); // Default limit
      expect(params.skip).toBe(0);
    });

    it('should handle single item per page', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const params: PaginationParams = { page: 3, limit: 1, skip: 2 };
      const response = createPaginatedResponse([items[2]], items.length, params);

      expect(response.items).toEqual(['c']);
      expect(response.pagination.totalPages).toBe(5);
      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.hasPrev).toBe(true);
    });

    it('should handle last page with partial results', () => {
      const items = ['a', 'b', 'c'];
      const params: PaginationParams = { page: 2, limit: 2, skip: 2 };
      const response = createPaginatedResponse([items[2]], items.length, params);

      expect(response.items).toEqual(['c']);
      expect(response.pagination.totalPages).toBe(2);
      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(true);
    });
  });
});
