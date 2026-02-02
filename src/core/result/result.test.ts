/**
 * Unit Tests - Result Pattern
 * 
 * Tests for the Result type and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  map,
  flatMap,
  unwrap,
  unwrapOr,
  match,
  combine,
  tryCatch,
  tryCatchAsync,
  DomainError,
  ValidationError,
  NotFoundError,
} from '@/core/result';

describe('Result Pattern', () => {
  describe('ok() and err()', () => {
    it('should create successful result', () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should create failed result', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('map()', () => {
    it('should transform successful result', () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(mapped.success).toBe(true);
      expect(mapped.data).toBe(10);
    });

    it('should not transform failed result', () => {
      const error = new Error('test');
      const result = err(error);
      const mapped = map(result, (x: number) => x * 2);
      expect(mapped.success).toBe(false);
      expect(mapped.error).toBe(error);
    });
  });

  describe('flatMap()', () => {
    it('should chain successful operations', () => {
      const result = ok(5);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(chained.success).toBe(true);
      expect(chained.data).toBe(10);
    });

    it('should short-circuit on failure', () => {
      const error = new Error('test');
      const result = err(error);
      const chained = flatMap(result, (x: number) => ok(x * 2));
      expect(chained.success).toBe(false);
      expect(chained.error).toBe(error);
    });
  });

  describe('unwrap()', () => {
    it('should return data from successful result', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw error from failed result', () => {
      const error = new Error('test');
      const result = err(error);
      expect(() => unwrap(result)).toThrow(error);
    });
  });

  describe('unwrapOr()', () => {
    it('should return data from successful result', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default from failed result', () => {
      const error = new Error('test');
      const result = err(error);
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('match()', () => {
    it('should call ok handler for successful result', () => {
      const result = ok(42);
      const value = match(result, {
        ok: (data) => `success: ${data}`,
        err: () => 'failed',
      });
      expect(value).toBe('success: 42');
    });

    it('should call err handler for failed result', () => {
      const error = new Error('test');
      const result = err(error);
      const value = match(result, {
        ok: () => 'success',
        err: (e) => `failed: ${e.message}`,
      });
      expect(value).toBe('failed: test');
    });
  });

  describe('combine()', () => {
    it('should combine all successful results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(combined.success).toBe(true);
      expect(combined.data).toEqual([1, 2, 3]);
    });

    it('should return first error', () => {
      const error = new Error('first error');
      const results = [ok(1), err(error), ok(3)];
      const combined = combine(results);
      expect(combined.success).toBe(false);
      expect(combined.error).toBe(error);
    });
  });

  describe('tryCatch()', () => {
    it('should return success when function succeeds', () => {
      const result = tryCatch(() => 42);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should return error when function throws', () => {
      const result = tryCatch(() => {
        throw new Error('test');
      });
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('test');
    });
  });

  describe('tryCatchAsync()', async () => {
    it('should return success when async function succeeds', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should return error when async function throws', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('test');
      });
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('test');
    });
  });
});

describe('Error Types', () => {
  describe('DomainError', () => {
    it('should have correct properties', () => {
      const error = new DomainError('test message', 'TEST_CODE', { foo: 'bar' });
      expect(error.message).toBe('test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ foo: 'bar' });
      expect(error.name).toBe('DomainError');
    });
  });

  describe('ValidationError', () => {
    it('should have correct properties', () => {
      const error = new ValidationError('invalid', 'field', { value: 123 });
      expect(error.message).toBe('invalid');
      expect(error.field).toBe('field');
      expect(error.context).toEqual({ value: 123 });
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should have correct message with identifier', () => {
      const error = new NotFoundError('Order', 'order-123');
      expect(error.message).toBe('Order not found: order-123');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should have correct message without identifier', () => {
      const error = new NotFoundError('Order');
      expect(error.message).toBe('Order not found');
    });
  });
});
