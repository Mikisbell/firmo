# Requirements Document: Property-Based Testing Expansion

## Introduction

PARK POS is an offline-first Point of Sale system for Peruvian chicken restaurants using Event Sourcing architecture. The system currently has 1015 unit tests but limited property-based testing coverage (79 property tests in admin/inventory modules). Property-based tests are more effective at finding edge cases and validating universal invariants across the system. This spec expands property-based testing to cover core domain logic, Event Sourcing invariants, money calculations, offline sync, and business rule validation.

## Glossary

- **Property-Based Test (PBT)**: A test that validates a universal property across many randomly generated inputs (minimum 100 iterations)
- **fast-check**: The property-based testing library used in PARK POS (already installed)
- **Centavos**: Money representation as non-negative integers (never floats) to avoid rounding errors
- **Event Sourcing**: Architecture pattern where state changes are stored as immutable events
- **Projection**: The process of rebuilding current state from a sequence of events
- **Branded Type**: TypeScript type that adds nominal typing to prevent mixing semantically different values
- **Arbitrary**: A fast-check generator that produces random values for testing
- **Invariant**: A property that must always hold true regardless of operations performed
- **Round Trip Property**: A property where applying an operation and its inverse returns to the original value
- **Idempotence**: A property where applying an operation multiple times has the same effect as applying it once

## Requirements

### Requirement 1: Core Domain Property Tests

**User Story:** As a developer, I want property-based tests for core domain logic, so that I can validate universal invariants across all possible inputs.

#### Acceptance Criteria

1. THE System SHALL test money calculation properties for all arithmetic operations
2. WHEN converting between centavos and display format, THE System SHALL validate round-trip consistency
3. THE System SHALL test branded type constructors reject invalid inputs
4. THE System SHALL test branded type operations preserve type safety
5. WHEN performing money arithmetic, THE System SHALL validate results are always non-negative integers
6. THE System SHALL test money formatting produces consistent output for equivalent values

### Requirement 2: Event Sourcing Invariant Tests

**User Story:** As a developer, I want property-based tests for Event Sourcing invariants, so that I can ensure event ordering and causality are maintained.

#### Acceptance Criteria

1. WHEN projecting events in any order, THE System SHALL produce deterministic results for commutative operations
2. WHEN applying the same event twice, THE System SHALL produce idempotent results
3. THE System SHALL validate event deduplication prevents duplicate processing
4. WHEN rebuilding projections from events, THE System SHALL produce identical state to incremental updates
5. THE System SHALL test event versioning handles schema evolution correctly
6. WHEN events have causal dependencies, THE System SHALL validate ordering constraints

### Requirement 3: Projection Consistency Tests

**User Story:** As a developer, I want property-based tests for projection consistency, so that I can ensure derived state matches event history.

#### Acceptance Criteria

1. WHEN rebuilding order projections from events, THE System SHALL match current order state
2. WHEN rebuilding shift projections from events, THE System SHALL match current shift state
3. THE System SHALL validate derived fields (stations_active, unpaid_checks_count) are computed correctly
4. WHEN applying events incrementally, THE System SHALL produce same result as batch rebuild
5. THE System SHALL test projection snapshots can reconstruct full state
6. WHEN projections fail, THE System SHALL maintain data integrity

### Requirement 4: Money Safety Property Tests

**User Story:** As a developer, I want property-based tests for money safety, so that I can prevent financial calculation errors.

#### Acceptance Criteria

1. WHEN calculating order totals, THE System SHALL validate sum of items equals subtotal
2. WHEN applying discounts, THE System SHALL validate discount never exceeds subtotal
3. WHEN calculating change, THE System SHALL validate change equals payment minus total
4. THE System SHALL test split bill calculations sum to original total
5. WHEN converting prices, THE System SHALL validate no precision loss occurs
6. THE System SHALL test payment validation rejects insufficient amounts

### Requirement 5: Offline Sync Property Tests

**User Story:** As a developer, I want property-based tests for offline sync, so that I can ensure conflict resolution and event deduplication work correctly.

#### Acceptance Criteria

1. WHEN processing duplicate events, THE System SHALL deduplicate based on event_id
2. WHEN merging offline changes, THE System SHALL preserve all non-conflicting operations
3. THE System SHALL validate conflict resolution strategies maintain data integrity
4. WHEN syncing events out of order, THE System SHALL reorder based on occurred_at timestamp
5. THE System SHALL test outbox pattern guarantees at-least-once delivery
6. WHEN network fails during sync, THE System SHALL retry without data loss

### Requirement 6: Business Rule Validation Tests

**User Story:** As a developer, I want property-based tests for business rules, so that I can ensure validation logic is correct across all inputs.

#### Acceptance Criteria

1. WHEN validating payments, THE System SHALL reject payments less than check total
2. WHEN validating invoices, THE System SHALL reject invoices for unpaid checks
3. THE System SHALL validate item quantities are within allowed limits
4. WHEN validating voids, THE System SHALL require manager approval
5. THE System SHALL test role-based permissions enforce access control
6. WHEN validating order numbers, THE System SHALL prevent collisions across terminals

### Requirement 7: Inventory Deduction Property Tests

**User Story:** As a developer, I want property-based tests for inventory deductions, so that I can ensure stock levels are calculated correctly.

#### Acceptance Criteria

1. WHEN deducting ingredients for orders, THE System SHALL reduce stock by recipe quantities
2. WHEN recording waste, THE System SHALL calculate cost as quantity times unit cost
3. THE System SHALL validate stock levels never go negative without explicit override
4. WHEN processing purchase orders, THE System SHALL increase stock by received quantities
5. THE System SHALL test inventory counts reconcile with transaction history
6. WHEN calculating weighted average cost, THE System SHALL maintain precision

### Requirement 8: Data Integrity Constraint Tests

**User Story:** As a developer, I want property-based tests for data integrity constraints, so that I can ensure database invariants are maintained.

#### Acceptance Criteria

1. THE System SHALL validate tenant_id is present on all multi-tenant tables
2. WHEN creating orders, THE System SHALL validate order_number is unique within tenant
3. THE System SHALL test foreign key relationships are maintained
4. WHEN soft deleting records, THE System SHALL preserve referential integrity
5. THE System SHALL validate JSONB fields conform to expected schemas
6. WHEN updating derived fields, THE System SHALL maintain consistency with source data

### Requirement 9: Reusable Test Utilities

**User Story:** As a developer, I want reusable property test generators and utilities, so that I can write property tests efficiently.

#### Acceptance Criteria

1. THE System SHALL provide arbitraries for all core domain types (Centavos, OrderId, etc.)
2. THE System SHALL provide arbitraries for all event types
3. THE System SHALL provide helper functions for common property patterns
4. THE System SHALL provide fixtures for realistic test data generation
5. THE System SHALL provide assertion helpers for property test validation
6. THE System SHALL document property testing patterns and best practices

### Requirement 10: CI/CD Integration

**User Story:** As a developer, I want property tests integrated into CI/CD, so that I can catch regressions automatically.

#### Acceptance Criteria

1. THE System SHALL run all property tests in CI pipeline
2. WHEN property tests fail, THE System SHALL report failing examples
3. THE System SHALL enforce minimum 100 iterations per property test
4. THE System SHALL enforce 5-second timeout per property test
5. THE System SHALL track property test coverage metrics
6. THE System SHALL fail builds when property tests fail
