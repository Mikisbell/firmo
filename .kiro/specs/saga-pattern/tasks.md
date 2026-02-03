# Implementation Plan: Saga Pattern for Complex Flows

## Overview

This implementation plan breaks down the Saga Pattern feature into discrete, incremental coding tasks. Each task builds on previous work and includes testing to validate functionality early. The implementation integrates with the existing PARK POS Event Sourcing system, using TypeScript, IndexedDB (Dexie), and PostgreSQL (Prisma).

## Tasks

- [x] 1. Set up saga core infrastructure
  - Create directory structure: `src/core/saga/`
  - Define core TypeScript types and interfaces for saga orchestration
  - Set up testing framework with fast-check for property-based testing
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement SagaOrchestrator core
  - [x] 2.1 Create SagaOrchestrator class with execute method
    - Implement sequential step execution logic
    - Add step result handling and error propagation
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Write property test for sequential execution
    - **Property 1: Sequential Step Execution**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.3 Implement compensation logic
    - Add reverse-order compensation execution
    - Handle compensation failures with retry
    - _Requirements: 1.3_

  - [x] 2.4 Write property test for complete compensation
    - **Property 2: Complete Compensation on Failure**
    - **Validates: Requirements 1.3**

  - [x] 2.5 Add timeout support
    - Implement timeout wrapper for saga execution
    - Trigger automatic rollback on timeout
    - _Requirements: 1.7_

  - [x] 2.6 Write property test for timeout enforcement
    - **Property 5: Timeout Enforcement**
    - **Validates: Requirements 1.7**

- [x] 3. Checkpoint - Ensure orchestrator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement saga persistence layer
  - [x] 4.1 Create SagaLog data models
    - Define SagaLogEntity for IndexedDB
    - Define Prisma schema for saga_logs table
    - Add Dexie schema updates for saga_logs store
    - _Requirements: 2.1, 2.4_

  - [x] 4.2 Implement SagaLogRepository
    - Create repository with create, update, query methods
    - Implement dual storage (IndexedDB + PostgreSQL)
    - Add sync support for saga logs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 4.3 Write property test for saga log creation
    - **Property 6: Saga Log Creation**
    - **Validates: Requirements 2.1**

  - [x] 4.4 Write property test for step outcome recording
    - **Property 7: Step Outcome Recording**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 4.5 Write property test for dual storage consistency
    - **Property 8: Dual Storage Consistency**
    - **Validates: Requirements 2.4**

- [x] 5. Integrate saga state persistence with orchestrator
  - [x] 5.1 Add saga log persistence to orchestrator
    - Persist saga state before and after each step
    - Update saga status on completion/failure
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 5.2 Write property test for saga state persistence
    - **Property 3: Saga State Persistence**
    - **Validates: Requirements 1.4**

  - [x] 5.3 Write property test for saga completion status
    - **Property 4: Saga Completion Status**
    - **Validates: Requirements 1.5, 1.6**

- [x] 6. Checkpoint - Ensure persistence tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement saga recovery mechanism
  - [x] 7.1 Create saga recovery service
    - Implement findInProgress query
    - Add resume logic for in-progress sagas
    - Handle recovery on system restart
    - _Requirements: 2.5_

  - [x] 7.2 Write property test for saga recovery
    - **Property 9: Saga Recovery**
    - **Validates: Requirements 2.5**

  - [x] 7.3 Write unit tests for recovery edge cases
    - Test recovery from each step
    - Test recovery with partial compensations
    - Test recovery with failed compensations

- [x] 8. Implement error handling and retry logic
  - [x] 8.1 Create error classification system
    - Define error types (ValidationError, NetworkError, etc.)
    - Implement isRetryable classification logic
    - _Requirements: 8.5_

  - [x] 8.2 Implement retry strategy
    - Add exponential backoff with jitter
    - Implement retry limits per step
    - Add compensation retry logic
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.3 Write property test for retry behavior
    - **Property 16: Retry Behavior**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 8.4 Write property test for compensation retry
    - **Property 17: Compensation Retry**
    - **Validates: Requirements 8.3, 8.4**

  - [x] 8.5 Write property test for error classification
    - **Property 18: Error Classification**
    - **Validates: Requirements 8.5**

- [x] 9. Checkpoint - Ensure error handling tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement saga event integration
  - [x] 10.1 Create saga event schemas
    - Define SAGA_STARTED, SAGA_STEP_COMPLETED, SAGA_STEP_FAILED events
    - Define SAGA_COMPENSATED, SAGA_COMPLETED, SAGA_FAILED events
    - Add saga context fields (saga_id, step_name) to event payloads
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.2 Integrate saga events with Event Sourcing system
    - Emit events through existing event bus
    - Use Outbox Pattern for reliable publishing
    - Ensure events are synced to server
    - _Requirements: 7.4, 7.5_

  - [x] 10.3 Write property test for event emission
    - **Property 11: Event Emission for Saga Operations**
    - **Validates: Requirements 3.9, 7.1, 7.2, 7.3**

  - [x] 10.4 Write property test for outbox integration
    - **Property 14: Outbox Pattern Integration**
    - **Validates: Requirements 7.4**

  - [x] 10.5 Write property test for event projection compatibility
    - **Property 15: Event Projection Compatibility**
    - **Validates: Requirements 7.5**

- [x] 11. Implement offline saga support
  - [x] 11.1 Add offline detection to orchestrator
    - Check network status before saga execution
    - Queue saga events for sync when offline
    - _Requirements: 6.1, 6.2_

  - [x] 11.2 Implement saga event synchronization
    - Sync queued saga events when online
    - Handle sync conflicts and resolution
    - _Requirements: 6.3, 6.4_

  - [x] 11.3 Write property test for offline execution
    - **Property 12: Offline Saga Execution**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 11.4 Write property test for event synchronization
    - **Property 13: Saga Event Synchronization**
    - **Validates: Requirements 6.3**

  - [x] 11.5 Write unit tests for conflict resolution
    - Test conflicting sagas from multiple terminals
    - Test conflict detection and resolution strategies

- [x] 12. Checkpoint - Ensure offline support tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Complete Sale Saga
  - [x] 13.1 Create CompleteSaleSaga definition
    - Define saga steps: validate_payment, reserve_coupon, issue_invoice, queue_print
    - Implement do and undo functions for each step
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 13.2 Implement saga step functions
    - validatePayment: check payment sufficiency
    - reserveCoupon: mark coupon as reserved
    - issueInvoice: generate invoice record
    - queuePrint: add to print queue
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 13.3 Implement compensation functions
    - refundPayment: reverse payment
    - releaseCoupon: unreserve coupon
    - voidInvoice: cancel invoice
    - cancelPrint: remove from print queue
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 13.4 Write unit tests for Complete Sale Saga
    - Test successful completion
    - Test failure at each step with compensation
    - Test early failure without side effects
    - _Requirements: 3.1-3.9_

- [x] 14. Implement Void Sale Saga
  - [x] 14.1 Create VoidSaleSaga definition
    - Define saga steps: validate_authorization, void_invoice, refund_payment, release_coupon
    - Implement do and undo functions for each step
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 14.2 Implement saga step functions
    - validateAuthorization: check manager approval
    - voidInvoice: cancel invoice
    - refundPayment: process refund
    - releaseCoupon: unreserve coupon
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 14.3 Implement compensation functions
    - restoreInvoice: reactivate invoice
    - reverseRefund: cancel refund
    - reserveCoupon: re-reserve coupon
    - _Requirements: 4.7_

  - [x] 14.4 Write unit tests for Void Sale Saga
    - Test successful void
    - Test authorization failure
    - Test failure at each step with compensation
    - _Requirements: 4.1-4.8_

- [x] 15. Implement Apply Promotion Saga
  - [x] 15.1 Create ApplyPromotionSaga definition
    - Define saga steps: validate_eligibility, reserve_promotion, apply_discount, send_notification
    - Implement do and undo functions for each step
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 15.2 Implement saga step functions
    - validateEligibility: check promotion rules
    - reservePromotion: mark promotion as used
    - applyDiscount: update order totals
    - sendNotification: queue notification
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 15.3 Implement compensation functions
    - releasePromotion: unreserve promotion
    - removeDiscount: revert order totals
    - _Requirements: 5.7, 5.8_

  - [x] 15.4 Write unit tests for Apply Promotion Saga
    - Test successful application
    - Test eligibility failure
    - Test failure at each step with compensation
    - _Requirements: 5.1-5.8_

- [x] 16. Checkpoint - Ensure all saga implementations pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Add saga query and monitoring support
  - [x] 17.1 Implement saga query API
    - Add query methods to SagaLogRepository
    - Support filtering by tenant, type, status, date range
    - _Requirements: 2.6_

  - [x] 17.2 Write property test for saga query correctness
    - **Property 10: Saga Query Correctness**
    - **Validates: Requirements 2.6**

  - [x] 17.3 Add saga metrics collection
    - Track saga execution count, duration, failure rate
    - Integrate with existing observability system
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 17.4 Write unit tests for metrics collection
    - Test metric updates on saga events
    - Test metric aggregation

- [x] 18. Create saga test utilities
  - [x] 18.1 Implement test helper functions
    - createMockStep: generate mock saga steps
    - verifySagaLog: assert saga log state
    - simulateRestart: test recovery scenarios
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 18.2 Create saga test fixtures
    - Common saga scenarios for testing
    - Mock implementations of saga steps
    - _Requirements: 10.4_

- [x] 19. Integration and wiring
  - [x] 19.1 Wire saga orchestrator into application
    - Export saga orchestrator instance
    - Register saga definitions
    - Add saga execution to relevant handlers (cashier, manager)
    - _Requirements: 1.1-1.7_

  - [x] 19.2 Add saga UI integration points
    - Show saga status in UI during execution
    - Display errors and compensation status
    - Add manual intervention UI for failed sagas
    - _Requirements: 8.4_

  - [x] 19.3 Write integration tests
    - Test end-to-end saga execution from UI
    - Test saga recovery after system restart
    - Test offline saga execution and sync

- [x] 20. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit + property + integration)
  - Verify saga logs in both IndexedDB and PostgreSQL
  - Test saga execution in offline mode
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality with existing Event Sourcing system
