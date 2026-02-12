import { describe, it, expect } from 'vitest';
import { 
  ok, 
  err, 
  Result, 
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
  NotFoundError 
} from './index';

describe('Result Type', () => {
  describe('ok', () => {
    it('should create a successful result', () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });
  });

  describe('err', () => {
    it('should create an error result', () => {
      const result = err('Something went wrong');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Something went wrong');
      }
    });
  });

  describe('map', () => {
    it('should transform ok value', () => {
      const result = ok(42);
      const mapped = map(result, (x) => x * 2);
      expect(unwrap(mapped as Result<number, Error>)).toBe(84);
    });

    it('should not transform err value', () => {
      const result = err('error');
      const mapped = map(result, (x: never) => x * 2);
      expect(mapped.success).toBe(false);
    });
  });

  describe('flatMap', () => {
    it('should chain ok results', () => {
      const result = ok(42);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(unwrap(chained as Result<number, Error>)).toBe(84);
    });

    it('should not chain err results', () => {
      const result = err('error');
      const chained = flatMap(result, (x: never) => ok(x * 2));
      expect(chained.success).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return value from ok result', () => {
      const result = ok(42);
      expect(unwrap(result as Result<number, Error>)).toBe(42);
    });

    it('should throw error from err result', () => {
      const result = err(new Error('test error'));
      expect(() => unwrap(result)).toThrow('test error');
    });
  });

  describe('unwrapOr', () => {
    it('should return value from ok result', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default value from err result', () => {
      const result = err('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('match', () => {
    it('should call ok handler for ok result', () => {
      const result = ok(42);
      const value = match(result, {
        ok: (x) => x * 2,
        err: () => 0,
      });
      expect(value).toBe(84);
    });

    it('should call err handler for err result', () => {
      const result = err('error');
      const value = match(result, {
        ok: (x: never) => x * 2,
        err: () => 0,
      });
      expect(value).toBe(0);
    });
  });

  describe('combine', () => {
    it('should combine multiple ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(unwrap(combined as Result<number[], Error>)).toEqual([1, 2, 3]);
    });

    it('should return first error if any result is err', () => {
      const results = [ok(1), err('error'), ok(3)];
      const combined = combine(results);
      expect(combined.success).toBe(false);
    });
  });

  describe('tryCatch', () => {
    it('should return ok for successful function', () => {
      const result = tryCatch(() => 42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should return err for throwing function', () => {
      const result = tryCatch(() => {
        throw new Error('test error');
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tryCatchAsync', () => {
    it('should return ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should return err for throwing async function', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('test error');
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Domain Errors', () => {
    it('should create ValidationError with field', () => {
      const error = new ValidationError('Invalid email', 'email');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('email');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create NotFoundError with resource', () => {
      const error = new NotFoundError('User', '123');
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toContain('User not found');
      expect(error.message).toContain('123');
    });
  });
});
