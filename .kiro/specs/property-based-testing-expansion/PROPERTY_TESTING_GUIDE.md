# Property-Based Testing Guide

## Overview

This guide documents property-based testing patterns and best practices used in PARK POS. Property-based tests validate universal properties across many randomly generated inputs, complementing unit tests that validate specific examples.

## Quick Start

### Running Property Tests

```bash
# Run all property tests
npm run test:property

# Run property tests in watch mode
npm run test:property:watch

# Run specific property test file
npm run test:property -- src/core/domain/__tests__/money.property.test.ts
```

### Writing Your First Property Test

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { centavosArb, testInvariant } from '@/src/test-utils';

describe('My Feature - Property Tests', () => {
  it('validates my property', () => {
    testInvariant(
      centavosArb,
      (value) => value >= 0,
      'value must be non-negative'
    );
  });
});
```

## Core Concepts

### Properties vs Examples

**Unit Tests (Examples):**
```typescript
it('adds two numbers correctly', () => {
  expect(add(2, 3)).toBe(5);
  expect(add(0, 0)).toBe(0);
  expect(add(-1, 1)).toBe(0);
});
```

**Property Tests (Universal):**
```typescript
it('addition is commutative', () => {
  testCommutativity(
    centavosArb,
    centavosArb,
    (a, b) => add(a, b),
    (a, b) => a === b
  );
});
```

### Arbitraries (Generators)

Arbitraries generate random test data. PARK POS provides pre-built arbitraries:

```typescript
import {
  centavosArb,           // Non-negative integers (money)
  positiveCentavosArb,   // Positive integers
  orderIdArb,            // UUID strings
  terminalIdArb,         // Terminal IDs (CAJA-01, etc.)
  businessDateArb,       // Business dates (YYYY-MM-DD)
  orderLineArb,          // Order line objects
  checkArb,              // Check objects
} from '@/src/test-utils';
```

### Property Patterns

#### 1. Round-Trip (Encode/Decode)

```typescript
testRoundTrip(
  centavosArb,
  (c) => formatCents(c),      // encode
  (s) => parseCents(s),       // decode
  (a, b) => a === b           // equals
);
```

**Use when:** Testing serialization/deserialization, format conversions

#### 2. Idempotence (f(f(x)) === f(x))

```typescript
testIdempotence(
  orderArb,
  (order) => deduplicateItems(order),
  (a, b) => deepEqual(a, b)
);
```

**Use when:** Testing deduplication, normalization, cleanup operations

#### 3. Invariant (Property always holds)

```typescript
testInvariant(
  centavosArb,
  (c) => c >= 0 && Number.isInteger(c),
  'Centavos must be non-negative integer'
);
```

**Use when:** Testing constraints, validation rules, type safety

#### 4. Commutativity (f(a, b) === f(b, a))

```typescript
testCommutativity(
  centavosArb,
  centavosArb,
  (a, b) => add(a, b),
  (a, b) => a === b
);
```

**Use when:** Testing operations that should be order-independent

#### 5. Associativity ((f(f(a, b), c) === f(a, f(b, c)))

```typescript
testAssociativity(
  centavosArb,
  centavosArb,
  centavosArb,
  (a, b) => add(a, b),
  (a, b) => a === b
);
```

**Use when:** Testing operations that should be grouping-independent

## Test Organization

### File Structure

```
src/
├── core/
│   ├── domain/
│   │   └── __tests__/
│   │       ├── money.property.test.ts
│   │       ├── branded-types.property.test.ts
│   │       └── events.property.test.ts
│   ├── projection/
│   │   └── __tests__/
│   │       ├── order.property.test.ts
│   │       ├── shift.property.test.ts
│   │       └── rebuild.property.test.ts
│   └── validation/
│       └── __tests__/
│           ├── payment.property.test.ts
│           └── business-rules.property.test.ts
└── test-utils/
    ├── arbitraries/
    │   ├── domain.ts
    │   ├── events.ts
    │   └── inventory.ts
    ├── helpers/
    │   ├── property-patterns.ts
    │   └── assertions.ts
    └── fixtures/
        └── realistic-data.ts
```

### Naming Conventions

- **Test files:** `*.property.test.ts`
- **Describe blocks:** `"Module Name - Property Tests"`
- **Property tests:** `"Property N: Property Name"` (matches design doc)
- **Edge case tests:** `"Edge Cases"` section
- **Invariant tests:** `"Invariants"` section

## Creating Custom Arbitraries

### Simple Arbitrary

```typescript
import * as fc from 'fast-check';

// Generate positive integers 1-100
export const quantityArb = fc.integer({ min: 1, max: 100 });

// Generate valid email addresses
export const emailArb = fc.emailAddress();

// Generate UUIDs
export const uuidArb = fc.uuid();
```

### Complex Arbitrary

```typescript
// Generate order line objects
export const orderLineArb = fc.record({
  line_id: fc.uuid(),
  product_id: fc.uuid(),
  qty: fc.integer({ min: 1, max: 100 }),
  unit_price_cents: centavosArb,
  station: fc.constantFrom('PARRILLA', 'COCINA', 'BAR'),
  status: fc.constantFrom('PENDING', 'COOKING', 'READY', 'DONE'),
});
```

### Constrained Arbitrary

```typescript
// Generate valid money strings (N.DD format)
export const moneyStringArb = fc
  .tuple(
    fc.integer({ min: 0, max: 999 }),
    fc.integer({ min: 0, max: 99 })
  )
  .map(([i, d]) => `${i}.${String(d).padStart(2, '0')}`);

// Generate order numbers that don't exceed 99999
export const orderNumberArb = fc
  .integer({ min: 1, max: 99999 })
  .filter(n => n > 0);
```

## Common Patterns

### Testing Money Calculations

```typescript
describe('Money Calculations', () => {
  it('addition preserves integer type', () => {
    fc.assert(
      fc.property(centavosArb, centavosArb, (a, b) => {
        const result = add(a, b);
        expectCentavos(result);  // Custom assertion
      }),
      { numRuns: 100 }
    );
  });
});
```

### Testing Event Processing

```typescript
describe('Event Processing', () => {
  it('applying same event twice is idempotent', () => {
    testIdempotence(
      orderCreatedEventArb,
      (event) => applyEvent(initialState, event),
      (a, b) => deepEqual(a, b)
    );
  });
});
```

### Testing Validation Rules

```typescript
describe('Validation Rules', () => {
  it('payment must be >= total', () => {
    testForAll(
      fc.tuple(positiveCentavosArb, positiveCentavosArb),
      ([payment, total]) => {
        if (payment < total) {
          expect(validatePayment(payment, total)).toBe(false);
        }
      },
      'payment validation must reject insufficient amounts'
    );
  });
});
```

## Debugging Failed Properties

### 1. Understand the Failing Example

When a property test fails, fast-check provides a minimal failing example:

```
Property failed after 47 tests
Counterexample: [100, 50]
Shrunk 5 times
```

This means the property failed with inputs `[100, 50]` after 47 successful tests.

### 2. Reproduce Locally

```typescript
it('reproduces failing example', () => {
  const [a, b] = [100, 50];
  // Your test logic here
  expect(yourFunction(a, b)).toBe(expectedResult);
});
```

### 3. Analyze the Failure

Ask yourself:
- Is the property correct?
- Is the implementation correct?
- Is the arbitrary generating valid inputs?

### 4. Fix and Verify

```typescript
// If implementation is wrong:
export function add(a: Centavos, b: Centavos): Centavos {
  return cents((a as number) + (b as number));  // Fixed
}

// If property is wrong:
it('addition is commutative for positive numbers', () => {
  testCommutativity(
    positiveCentavosArb,  // Changed from centavosArb
    positiveCentavosArb,
    (a, b) => add(a, b),
    (a, b) => a === b
  );
});
```

## Performance Considerations

### Test Execution Time

- **Target:** < 5 seconds per property test
- **Iterations:** 100 by default (configurable)
- **Timeout:** 5 seconds per test

### Optimizing Slow Tests

```typescript
// Reduce iterations for expensive operations
fc.assert(
  fc.property(expensiveArb, (value) => {
    // Expensive computation
  }),
  { numRuns: 10 }  // Reduced from 100
);

// Use simpler arbitraries
// Instead of: fc.array(complexArb, { maxLength: 100 })
// Use: fc.array(simpleArb, { maxLength: 10 })
```

## Best Practices

### ✅ DO

- **Use realistic arbitraries** that match your domain
- **Test universal properties** not specific examples
- **Combine with unit tests** for comprehensive coverage
- **Document properties** with clear descriptions
- **Use custom assertions** for domain-specific validation
- **Keep tests focused** on single properties
- **Use fixtures** for complex test data

### ❌ DON'T

- **Mock everything** - test real behavior
- **Use overly complex arbitraries** - keep them simple
- **Test implementation details** - test behavior
- **Ignore failing examples** - investigate and fix
- **Skip edge cases** - add explicit edge case tests
- **Assume properties are obvious** - document them

## Integration with CI/CD

### GitHub Actions

Property tests run automatically on:
- Every commit to main
- Every pull request
- Manual trigger

### Local Pre-commit

```bash
# Run before committing
npm run test:property

# Or add to git hooks
# .git/hooks/pre-commit
npm run test:property || exit 1
```

## Resources

### Documentation
- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [PARK POS Design Document](.kiro/specs/property-based-testing-expansion/design.md)

### Examples
- Money calculations: `src/core/domain/__tests__/money.property.test.ts`
- Event sourcing: `src/core/projection/__tests__/rebuild.property.test.ts`
- Business rules: `src/core/validation/__tests__/business-rules.property.test.ts`

### Test Utilities
- Arbitraries: `src/test-utils/arbitraries/`
- Helpers: `src/test-utils/helpers/`
- Fixtures: `src/test-utils/fixtures/`

## Troubleshooting

### "Property failed after N tests"

The property is false for some input. Debug by:
1. Examining the counterexample
2. Adding explicit test for that case
3. Fixing implementation or property

### "Timeout exceeded"

Test is too slow. Fix by:
1. Reducing iterations: `{ numRuns: 10 }`
2. Simplifying arbitrary
3. Optimizing implementation

### "Arbitrary generates invalid data"

Arbitrary constraints are wrong. Fix by:
1. Adding filters: `.filter(x => x > 0)`
2. Using constrained generators
3. Validating in test

## Contributing

When adding new property tests:

1. **Follow naming conventions** - match design doc property names
2. **Use existing arbitraries** - reuse from `src/test-utils/`
3. **Add to appropriate module** - organize by feature
4. **Document the property** - explain what it validates
5. **Test locally first** - run `npm run test:property`
6. **Include edge cases** - add explicit edge case tests

## Questions?

Refer to:
- Design document: `.kiro/specs/property-based-testing-expansion/design.md`
- Requirements: `.kiro/specs/property-based-testing-expansion/requirements.md`
- Examples: `src/core/**/__tests__/*.property.test.ts`
