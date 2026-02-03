/**
 * Property Testing Patterns - Reusable helpers for common property test patterns
 * 
 * These helpers implement common property testing patterns to reduce boilerplate
 * and ensure consistent test structure across the codebase.
 */

import * as fc from 'fast-check';

/**
 * Tests a round-trip property: encode → decode → equals original
 * 
 * @example
 * testRoundTrip(
 *   centavosArb,
 *   (c) => formatCents(c),
 *   (s) => parseCents(s),
 *   (a, b) => a === b
 * );
 */
export function testRoundTrip<T>(
  arb: fc.Arbitrary<T>,
  encode: (value: T) => string,
  decode: (encoded: string) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      const encoded = encode(value);
      const decoded = decode(encoded);
      if (!equals(value, decoded)) {
        throw new Error(
          `Round-trip failed: ${value} → "${encoded}" → ${decoded}`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests an idempotence property: f(f(x)) === f(x)
 * 
 * @example
 * testIdempotence(
 *   orderArb,
 *   (order) => deduplicateItems(order),
 *   (a, b) => deepEqual(a, b)
 * );
 */
export function testIdempotence<T>(
  arb: fc.Arbitrary<T>,
  operation: (value: T) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      const once = operation(value);
      const twice = operation(once);
      if (!equals(once, twice)) {
        throw new Error(
          `Idempotence failed: f(x) !== f(f(x))`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests an invariant property: invariant(x) should always be true
 * 
 * @example
 * testInvariant(
 *   centavosArb,
 *   (c) => c >= 0 && Number.isInteger(c),
 *   'Centavos must be non-negative integer'
 * );
 */
export function testInvariant<T>(
  arb: fc.Arbitrary<T>,
  invariant: (value: T) => boolean,
  message: string,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      if (!invariant(value)) {
        throw new Error(`Invariant violated: ${message}`);
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests a commutativity property: f(a, b) === f(b, a)
 * 
 * @example
 * testCommutativity(
 *   centavosArb,
 *   centavosArb,
 *   (a, b) => add(a, b),
 *   (a, b) => a === b
 * );
 */
export function testCommutativity<T, R>(
  arbA: fc.Arbitrary<T>,
  arbB: fc.Arbitrary<T>,
  operation: (a: T, b: T) => R,
  equals: (a: R, b: R) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T, T]>
): void {
  fc.assert(
    fc.property(arbA, arbB, (a, b) => {
      const result1 = operation(a, b);
      const result2 = operation(b, a);
      if (!equals(result1, result2)) {
        throw new Error(
          `Commutativity failed: f(${a}, ${b}) !== f(${b}, ${a})`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests an associativity property: f(f(a, b), c) === f(a, f(b, c))
 * 
 * @example
 * testAssociativity(
 *   centavosArb,
 *   centavosArb,
 *   centavosArb,
 *   (a, b) => add(a, b),
 *   (a, b) => a === b
 * );
 */
export function testAssociativity<T, R>(
  arbA: fc.Arbitrary<T>,
  arbB: fc.Arbitrary<T>,
  arbC: fc.Arbitrary<T>,
  operation: (a: T, b: T) => R,
  equals: (a: R, b: R) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T, T, T]>
): void {
  fc.assert(
    fc.property(arbA, arbB, arbC, (a, b, c) => {
      const result1 = operation(operation(a, b), c);
      const result2 = operation(a, operation(b, c));
      if (!equals(result1, result2)) {
        throw new Error(
          `Associativity failed: f(f(a, b), c) !== f(a, f(b, c))`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests a distributivity property: f(a, g(b, c)) === g(f(a, b), f(a, c))
 * 
 * @example
 * testDistributivity(
 *   centavosArb,
 *   centavosArb,
 *   centavosArb,
 *   (a, b) => mul(a, b),
 *   (a, b) => add(a, b),
 *   (a, b) => a === b
 * );
 */
export function testDistributivity<T, R>(
  arbA: fc.Arbitrary<T>,
  arbB: fc.Arbitrary<T>,
  arbC: fc.Arbitrary<T>,
  operation1: (a: T, b: T) => R,
  operation2: (a: T, b: T) => R,
  equals: (a: R, b: R) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T, T, T]>
): void {
  fc.assert(
    fc.property(arbA, arbB, arbC, (a, b, c) => {
      const result1 = operation1(a, operation2(b, c));
      const result2 = operation2(operation1(a, b), operation1(a, c));
      if (!equals(result1, result2)) {
        throw new Error(
          `Distributivity failed: f(a, g(b, c)) !== g(f(a, b), f(a, c))`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests that a function never throws for valid inputs
 * 
 * @example
 * testNoThrow(
 *   centavosArb,
 *   (c) => formatCents(c)
 * );
 */
export function testNoThrow<T>(
  arb: fc.Arbitrary<T>,
  operation: (value: T) => void,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      try {
        operation(value);
      } catch (error) {
        throw new Error(
          `Operation threw unexpectedly: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests that a function throws for invalid inputs
 * 
 * @example
 * testThrows(
 *   fc.integer({ min: -100, max: -1 }),
 *   (n) => asCentavos(n),
 *   'Centavos must be non-negative'
 * );
 */
export function testThrows<T>(
  arb: fc.Arbitrary<T>,
  operation: (value: T) => void,
  expectedMessage?: string,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      let threw = false;
      let message = '';
      try {
        operation(value);
      } catch (error) {
        threw = true;
        message = error instanceof Error ? error.message : String(error);
      }
      if (!threw) {
        throw new Error(`Expected operation to throw, but it didn't`);
      }
      if (expectedMessage && !message.includes(expectedMessage)) {
        throw new Error(
          `Expected message to include "${expectedMessage}", got "${message}"`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests that a predicate holds for all generated values
 * 
 * @example
 * testForAll(
 *   centavosArb,
 *   (c) => c >= 0,
 *   'Centavos must be non-negative'
 * );
 */
export function testForAll<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => boolean,
  message: string,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      if (!predicate(value)) {
        throw new Error(`${message}: failed for ${value}`);
      }
    }),
    { numRuns: 100, ...options }
  );
}

/**
 * Tests that a predicate holds for at least one generated value
 * 
 * @example
 * testExists(
 *   centavosArb,
 *   (c) => c > 1000,
 *   'At least one Centavos value should be > 1000'
 * );
 */
export function testExists<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => boolean,
  message: string,
  options?: fc.Parameters<[T]>
): void {
  const found = fc.sample(arb, 100).some(predicate);
  if (!found) {
    throw new Error(`${message}: no value found matching predicate`);
  }
}

/**
 * Tests that two functions produce equivalent results
 * 
 * @example
 * testEquivalence(
 *   centavosArb,
 *   (c) => formatCents(c),
 *   (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`,
 *   (a, b) => a === b
 * );
 */
export function testEquivalence<T, R>(
  arb: fc.Arbitrary<T>,
  fn1: (value: T) => R,
  fn2: (value: T) => R,
  equals: (a: R, b: R) => boolean = (a, b) => a === b,
  options?: fc.Parameters<[T]>
): void {
  fc.assert(
    fc.property(arb, (value) => {
      const result1 = fn1(value);
      const result2 = fn2(value);
      if (!equals(result1, result2)) {
        throw new Error(
          `Functions not equivalent for ${value}: ${result1} !== ${result2}`
        );
      }
    }),
    { numRuns: 100, ...options }
  );
}
