/**
 * Pagination Helpers Tests
 * Unit tests for pagination utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  createPaginatedResponse,
  getPaginationMeta,
} from './pagination';

describe('parsePaginationParams', () => {
  it('should use default values when no params provided', () => {
    const searchParams = new URLSearchParams();
    const result = parsePaginationParams(searchParams);

    expect(result).toEqual({
      page: 1,
      limit: 10,
      skip: 0,
    });
  });

  it('should parse valid page and limit', () => {
    const searchParams = new URLSearchParams('page=3&limit=20');
    const result = parsePaginationParams(searchParams);

    expect(result).toEqual({
      page: 3,
      limit: 20,
      skip: 40, // (3-1) * 20
    });
  });

  it('should enforce minimum page of 1', () => {
    const searchParams = new URLSearchParams('page=0');
    const result = parsePaginationParams(searchParams);

    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('should enforce minimum page of 1 for negative values', () => {
    const searchParams = new URLSearchParams('page=-5');
    const result = parsePaginationParams(searchParams);

    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('should enforce minimum limit of 1', () => {
    const searchParams = new URLSearchParams('limit=0');
    const result = parsePaginationParams(searchParams);

    expect(result.limit).toBe(1);
  });

  it('should enforce maximum limit of 100', () => {
    const searchParams = new URLSearchParams('limit=200');
    const result = parsePaginationParams(searchParams);

    expect(result.limit).toBe(100);
  });

  it('should handle invalid page parameter', () => {
    const searchParams = new URLSearchParams('page=invalid');
    const result = parsePaginationParams(searchParams);

    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('should handle invalid limit parameter', () => {
    const searchParams = new URLSearchParams('limit=invalid');
    const result = parsePaginationParams(searchParams);

    expect(result.limit).toBe(10);
  });

  it('should calculate skip correctly for various pages', () => {
    const testCases = [
      { page: 1, limit: 10, expectedSkip: 0 },
      { page: 2, limit: 10, expectedSkip: 10 },
      { page: 5, limit: 20, expectedSkip: 80 },
      { page: 10, limit: 5, expectedSkip: 45 },
    ];

    testCases.forEach(({ page, limit, expectedSkip }) => {
      const searchParams = new URLSearchParams(`page=${page}&limit=${limit}`);
      const result = parsePaginationParams(searchParams);
      expect(result.skip).toBe(expectedSkip);
    });
  });
});

describe('createPaginatedResponse', () => {
  it('should create response with correct pagination metadata', () => {
    const items = [1, 2, 3, 4, 5];
    const total = 50;
    const params = { page: 1, limit: 10, skip: 0 };

    const result = createPaginatedResponse(items, total, params);

    expect(result.items).toEqual(items);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('should indicate no next page on last page', () => {
    const items = [1, 2, 3];
    const total = 23;
    const params = { page: 3, limit: 10, skip: 20 };

    const result = createPaginatedResponse(items, total, params);

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('should handle single page of results', () => {
    const items = [1, 2, 3];
    const total = 3;
    const params = { page: 1, limit: 10, skip: 0 };

    const result = createPaginatedResponse(items, total, params);

    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('should handle empty results', () => {
    const items: number[] = [];
    const total = 0;
    const params = { page: 1, limit: 10, skip: 0 };

    const result = createPaginatedResponse(items, total, params);

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('should calculate totalPages correctly', () => {
    const testCases = [
      { total: 100, limit: 10, expectedPages: 10 },
      { total: 95, limit: 10, expectedPages: 10 },
      { total: 91, limit: 10, expectedPages: 10 },
      { total: 23, limit: 10, expectedPages: 3 },
      { total: 1, limit: 10, expectedPages: 1 },
    ];

    testCases.forEach(({ total, limit, expectedPages }) => {
      const params = { page: 1, limit, skip: 0 };
      const result = createPaginatedResponse([], total, params);
      expect(result.pagination.totalPages).toBe(expectedPages);
    });
  });
});

describe('getPaginationMeta', () => {
  it('should return pagination metadata without items', () => {
    const total = 50;
    const params = { page: 2, limit: 10, skip: 10 };

    const result = getPaginationMeta(total, params);

    expect(result).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('should match createPaginatedResponse pagination', () => {
    const total = 100;
    const params = { page: 3, limit: 20, skip: 40 };

    const meta = getPaginationMeta(total, params);
    const response = createPaginatedResponse([], total, params);

    expect(meta).toEqual(response.pagination);
  });
});

