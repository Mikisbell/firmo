# Implementation Plan: Property-Based Testing Expansion

## Overview

This plan implements comprehensive property-based testing across PARK POS core domain, Event Sourcing, money calculations, offline sync, and business rules. The implementation follows a phased approach, starting with test utilities and core domain tests, then expanding to Event Sourcing, business rules, sync, and inventory. Each phase builds on the previous, with checkpoints to ensure quality.

## Tasks

- [ ] 1. Set up test utilities infrastructure
  - Create directory structure for test utilities
  - Set up arbitraries, helpers, and fixtures modules
  - Configure Vitest for property tests
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 2. Implement core domain arbitraries
  - [ ] 2.1 Create branded type arbitraries (Centavos, OrderId, ShiftId, TenantId, TerminalId, BusinessDate)
    - Implement centavosArb, orderIdArb, shiftIdArb, tenantIdArb, terminalIdArb, businessDateArb
    - _Requirements: 9.1_
  
  - [ ] 2.2 Create event arbitraries (PaymentMethod, OrderType, ItemStatus, OrderLine, Check, Event)
    - Implement paymentMethodArb, orderTypeArb, itemStatusArb, orderLineArb, checkArb, eventArb
    - _Requirements: 9.2_
  
  - [ ] 2.3 Create inventory arbitraries (InventoryItem, Recipe, WasteLog, PurchaseOrder)
    - Implement inventoryItemArb, recipeArb, wasteLogArb, purchaseOrderArb
    - _Requirements: 9.2_

- [ ] 3. Implement property test helpers
  - [ ] 3.1 Create property pattern helpers (testRoundTrip, testIdempotence, testInvariant)
    - Implement reusable property testing patterns
    - _Requirements: 9.3_
  
  - [ ] 3.2 Create assertion helpers (expectCentavos, expectValidEvent, expectProjectionConsistency)
    - Implement custom assertions for property tests
    - _Requirements: 9.5_
  
  - [ ] 3.3 Create realistic fixtures (generateRealisticOrder, generateRealisticShift)
    - Implement realistic test data generators
    - _Requirements: 9.4_

- [ ] 4. Checkpoint - Ensure test utilities are working
  - Verify arbitraries generate valid data
  - Verify helpers work correctly
  - Ask user if questions arise

- [ ] 5. Implement core domain property tests
  - [ ] 5.1 Create money calculation property tests
    - Implement Property 1: Money Arithmetic Preserves Integer Invariant
    - Implement Property 2: Centavos Round-Trip Consistency
    - Implement Property 4: Money Formatting Determinism
    - _Requirements: 1.1, 1.2, 1.5, 1.6_
  
  - [ ] 5.2 Write property test for branded type validation
    - **Property 3: Branded Type Constructor Validation**
    - **Validates: Requirements 1.3**
  
  - [ ] 5.3 Create event validation property tests
    - Test event structure and Zod schema conformance
    - _Requirements: 1.1_

- [ ] 6. Implement Event Sourcing property tests
  - [ ] 6.1 Create event processing idempotence tests
    - Implement Property 6: Event Processing Idempotence
    - _Requirements: 2.2, 2.3, 5.1_
  
  - [ ] 6.2 Write property test for commutative operations
    - **Property 5: Commutative Operations Order Independence**
    - **Validates: Requirements 2.1**
  
  - [ ] 6.3 Write property test for projection rebuild consistency
    - **Property 7: Projection Rebuild Consistency**
    - **Validates: Requirements 2.4, 3.1, 3.2, 3.4**
  
  - [ ] 6.4 Write property test for event schema versioning
    - **Property 8: Event Schema Versioning Compatibility**
    - **Validates: Requirements 2.5**
  
  - [ ] 6.5 Write property test for causal event ordering
    - **Property 9: Causal Event Ordering**
    - **Validates: Requirements 2.6**

- [ ] 7. Implement projection consistency property tests
  - [ ] 7.1 Create derived field computation tests
    - Implement Property 10: Derived Field Computation Correctness
    - Test stations_active and unpaid_checks_count calculation
    - _Requirements: 3.3, 8.6_
  
  - [ ] 7.2 Write property test for snapshot reconstruction
    - **Property 11: Snapshot Reconstruction Completeness**
    - **Validates: Requirements 3.5**

- [ ] 8. Checkpoint - Ensure Event Sourcing tests pass
  - Run all Event Sourcing property tests
  - Verify 100+ iterations per test
  - Ask user if questions arise

- [ ] 9. Implement money safety property tests
  - [ ] 9.1 Create order total calculation tests
    - Implement Property 12: Order Subtotal Equals Item Sum
    - Implement Property 13: Discount Never Exceeds Subtotal
    - _Requirements: 4.1, 4.2_
  
  - [ ] 9.2 Write property test for change calculation
    - **Property 14: Change Calculation Correctness**
    - **Validates: Requirements 4.3**
  
  - [ ] 9.3 Write property test for split bill sum
    - **Property 15: Split Bill Sum Equals Order Total**
    - **Validates: Requirements 4.4**
  
  - [ ] 9.4 Write property test for payment validation
    - **Property 16: Payment Validation Rejects Insufficient Amounts**
    - **Validates: Requirements 4.6, 6.1**

- [ ] 10. Implement offline sync property tests
  - [ ] 10.1 Create event deduplication tests (already covered in Property 6)
    - Verify deduplication logic works correctly
    - _Requirements: 5.1_
  
  - [ ] 10.2 Write property test for non-conflicting changes preservation
    - **Property 17: Non-Conflicting Changes Preservation**
    - **Validates: Requirements 5.2**
  
  - [ ] 10.3 Write property test for conflict resolution invariants
    - **Property 18: Conflict Resolution Maintains Invariants**
    - **Validates: Requirements 5.3**
  
  - [ ] 10.4 Write property test for event reordering
    - **Property 19: Event Reordering by Timestamp**
    - **Validates: Requirements 5.4**

- [ ] 11. Implement business rule validation property tests
  - [ ] 11.1 Create invoice validation tests
    - Implement Property 20: Invoice Requires Paid Check
    - _Requirements: 6.2_
  
  - [ ] 11.2 Write property test for item quantity limits
    - **Property 21: Item Quantity Within Limits**
    - **Validates: Requirements 6.3**
  
  - [ ] 11.3 Write property test for void manager approval
    - **Property 22: Void Requires Manager Approval**
    - **Validates: Requirements 6.4**
  
  - [ ] 11.4 Write property test for role-based permissions
    - **Property 23: Role-Based Permission Enforcement**
    - **Validates: Requirements 6.5**
  
  - [ ] 11.5 Write property test for order number uniqueness
    - **Property 24: Order Number Uniqueness Within Tenant**
    - **Validates: Requirements 6.6, 8.2**

- [ ] 12. Checkpoint - Ensure business rule tests pass
  - Run all business rule property tests
  - Verify validation logic is correct
  - Ask user if questions arise

- [ ] 13. Implement inventory property tests
  - [ ] 13.1 Create recipe deduction tests
    - Implement Property 25: Recipe Deduction Correctness
    - _Requirements: 7.1_
  
  - [ ] 13.2 Write property test for stock non-negativity
    - **Property 26: Stock Never Negative Without Override**
    - **Validates: Requirements 7.3**
  
  - [ ] 13.3 Write property test for purchase order stock increase
    - **Property 27: Purchase Order Increases Stock**
    - **Validates: Requirements 7.4**
  
  - [ ] 13.4 Write property test for inventory count reconciliation
    - **Property 28: Inventory Count Reconciliation**
    - **Validates: Requirements 7.5**
  
  - [ ] 13.5 Write property test for weighted average cost precision
    - **Property 29: Weighted Average Cost Precision**
    - **Validates: Requirements 7.6**

- [ ] 14. Implement data integrity property tests
  - [ ] 14.1 Create tenant ID presence tests
    - Implement Property 30: Tenant ID Presence
    - _Requirements: 8.1_
  
  - [ ] 14.2 Write property test for foreign key validity
    - **Property 31: Foreign Key Validity**
    - **Validates: Requirements 8.3**
  
  - [ ] 14.3 Write property test for soft delete referential integrity
    - **Property 32: Soft Delete Preserves References**
    - **Validates: Requirements 8.4**
  
  - [ ] 14.4 Write property test for JSONB schema conformance
    - **Property 33: JSONB Schema Conformance**
    - **Validates: Requirements 8.5**

- [ ] 15. Checkpoint - Ensure all property tests pass
  - Run full property test suite
  - Verify 100+ iterations per test
  - Verify < 5 second timeout per test
  - Ask user if questions arise

- [ ] 16. Integrate property tests into CI/CD
  - [ ] 16.1 Add property test script to package.json
    - Add `test:property` command
    - _Requirements: 10.1_
  
  - [ ] 16.2 Configure GitHub Actions workflow
    - Add property test job to CI pipeline
    - Configure failure reporting
    - _Requirements: 10.1, 10.2, 10.6_
  
  - [ ] 16.3 Set up test coverage reporting
    - Track property test coverage metrics
    - _Requirements: 10.5_
  
  - [ ] 16.4 Configure test timeouts and iteration counts
    - Enforce 100 iterations minimum
    - Enforce 5-second timeout
    - _Requirements: 10.3, 10.4_

- [ ] 17. Document property testing patterns
  - [ ] 17.1 Create property testing guide
    - Document common property patterns
    - Document arbitrary creation
    - Document helper usage
    - _Requirements: 9.6_
  
  - [ ] 17.2 Add examples to documentation
    - Add example property tests
    - Add troubleshooting guide
    - _Requirements: 9.6_
  
  - [ ] 17.3 Create team training materials
    - Create property testing workshop
    - Create reference documentation
    - _Requirements: 9.6_

- [ ] 18. Final checkpoint - Verify complete implementation
  - Run all property tests in CI/CD
  - Verify coverage metrics meet 80% target
  - Verify all documentation is complete
  - Ask user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases (not included in this plan, already exist)
- All property tests should run with minimum 100 iterations
- All property tests should complete in < 5 seconds
- Test utilities (arbitraries, helpers, fixtures) are reusable across all property tests
- CI/CD integration ensures property tests run on every commit
