# Implementation Plan: Admin Panel CRUD

## Overview

This implementation plan breaks down the complete CRUD functionality for the Admin Panel into discrete, incremental tasks. The implementation follows the established pattern from the Mesas module and prioritizes critical modules (Employees, Products) before moving to high-priority (Promotions, Drivers) and medium-priority (Configuration) modules.

## Tasks

- [x] 1. Set up shared components and utilities
  - Create reusable modal form component following TableModal pattern
  - Create shared validation utilities for common patterns
  - Create shared API error handling utilities
  - Set up TypeScript interfaces for all data models
  - _Requirements: 6.6, 6.7_

- [x] 2. Implement Employee CRUD (CRITICAL)
  - [x] 2.1 Create Employee API endpoints
    - Implement POST /api/admin/employees with PIN hashing and uniqueness validation
    - Implement GET /api/admin/employees/[id] for fetching single employee
    - Implement PUT /api/admin/employees/[id] with field-level permissions (no PIN changes)
    - Implement DELETE /api/admin/employees/[id] with soft delete
    - Add audit trail logging for all operations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 10.1, 10.2, 10.3_

  - [ ]* 2.2 Write property test for PIN uniqueness
    - **Property 1: PIN Uniqueness Enforcement**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test for PIN hashing
    - **Property 2: PIN Hashing Security**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Create Employee frontend pages
    - Create src/app/admin/empleados/nuevo/page.tsx with form for name, role, PIN, active status
    - Create src/app/admin/empleados/[id]/page.tsx with edit form (no PIN field)
    - Add modal-based forms following TableModal pattern
    - Implement client-side validation with Zod
    - Add loading states and error handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.5 Write unit tests for Employee API
    - Test successful employee creation
    - Test duplicate PIN rejection
    - Test invalid role rejection
    - Test soft delete behavior
    - Test audit trail logging
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ]* 2.6 Write E2E test for Employee CRUD flow
    - Test complete create → edit → deactivate flow
    - Test permission enforcement
    - _Requirements: 1.1, 1.3, 1.4, 7.1_

- [x] 3. Implement Product CRUD (CRITICAL)
  - [x] 3.1 Create Product API endpoints
    - Implement POST /api/admin/products with SKU uniqueness validation
    - Implement GET /api/admin/products/[id] for fetching single product
    - Implement PUT /api/admin/products/[id] with all field updates
    - Implement DELETE /api/admin/products/[id] with soft delete
    - Add catalog_version increment on create/update
    - Add audit trail logging for all operations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 10.4, 10.5, 10.6_

  - [ ]* 3.2 Write property test for SKU uniqueness
    - **Property 8: SKU Uniqueness Enforcement**
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for price integer type safety
    - **Property 9: Price Integer Type Safety**
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 Write property test for catalog version increment
    - **Property 14: Catalog Version Increment**
    - **Validates: Requirements 2.7**

  - [x] 3.5 Create Product frontend pages
    - Create src/app/admin/productos/nuevo/page.tsx with form for all product fields
    - Create src/app/admin/productos/[id]/page.tsx with edit form
    - Add dropdowns for category and station enums
    - Add price input with centavos conversion (display as decimal, store as integer)
    - Implement client-side validation
    - Add loading states and error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.6 Write unit tests for Product API
    - Test successful product creation
    - Test duplicate SKU rejection
    - Test price as integer validation
    - Test category and station enum validation
    - Test catalog version increment
    - Test soft delete behavior
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.7 Write E2E test for Product CRUD flow
    - Test complete create → edit → deactivate flow
    - Test price display and storage
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Checkpoint - Ensure critical modules work
  - Ensure all tests pass for Employees and Products modules
  - Verify audit trail logging is working
  - Verify soft deletes preserve data
  - Ask the user if questions arise

- [ ] 5. Implement Promotion CRUD (HIGH PRIORITY)
  - [ ] 5.1 Create Promotion API endpoints
    - Implement POST /api/admin/promotions with date range validation
    - Implement GET /api/admin/promotions/[id] for fetching single promotion
    - Implement PUT /api/admin/promotions/[id] with all field updates
    - Implement DELETE /api/admin/promotions/[id] with soft delete
    - Add automatic deactivation for expired promotions in GET endpoint
    - Add audit trail logging for all operations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.7, 10.8, 10.9_

  - [ ]* 5.2 Write property test for date range validation
    - **Property 17: Promotion Date Range Validation**
    - **Validates: Requirements 3.1**

  - [ ]* 5.3 Write property test for promotion type validation
    - **Property 18: Promotion Type Validation**
    - **Validates: Requirements 3.2**

  - [ ] 5.4 Create Promotion frontend pages
    - Create src/app/admin/promociones/nuevo/page.tsx with form for all promotion fields
    - Create src/app/admin/promociones/[id]/page.tsx with edit form
    - Add date pickers for starts_at and ends_at
    - Add dropdown for promotion type enum
    - Add JSON editor for rules field with validation
    - Implement client-side validation including date range check
    - Add loading states and error handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.9, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 5.5 Write unit tests for Promotion API
    - Test successful promotion creation
    - Test date range validation
    - Test promotion type enum validation
    - Test JSON rules validation
    - Test automatic expiration
    - Test soft delete behavior
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.9_

  - [ ]* 5.6 Write E2E test for Promotion CRUD flow
    - Test complete create → edit → deactivate flow
    - Test date range validation
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Implement Driver CRUD (HIGH PRIORITY)
  - [ ] 6.1 Create Driver API endpoints
    - Implement POST /api/drivers with name required, phone optional
    - Implement GET /api/drivers/[id] for fetching single driver
    - Implement PUT /api/drivers/[id] with all field updates
    - Implement DELETE /api/drivers/[id] with soft delete
    - Add audit trail logging for all operations
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.10, 10.11, 10.12_

  - [ ]* 6.2 Write property test for driver required fields
    - **Property 24: Driver Required Field Validation**
    - **Validates: Requirements 4.1**

  - [ ] 6.3 Create Driver frontend pages
    - Create src/app/admin/drivers/nuevo/page.tsx with form for name and phone
    - Create src/app/admin/drivers/[id]/page.tsx with edit form
    - Mark phone field as optional
    - Implement client-side validation
    - Add loading states and error handling
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.4 Write unit tests for Driver API
    - Test successful driver creation with and without phone
    - Test name required validation
    - Test soft delete behavior
    - _Requirements: 4.1, 4.3_

  - [ ]* 6.5 Write E2E test for Driver CRUD flow
    - Test complete create → edit → deactivate flow
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Checkpoint - Ensure high-priority modules work
  - Ensure all tests pass for Promotions and Drivers modules
  - Verify all CRUD operations work end-to-end
  - Ask the user if questions arise

- [ ] 8. Implement Configuration Edit (MEDIUM PRIORITY)
  - [ ] 8.1 Create Configuration API endpoint
    - Implement PUT /api/admin/config with validation for all config values
    - Add range validation for numeric values
    - Add audit trail logging with old and new values
    - _Requirements: 5.1, 5.3, 5.5, 10.13_

  - [ ]* 8.2 Write property test for configuration validation
    - **Property 29: Configuration Value Validation**
    - **Property 31: Configuration Range Validation**
    - **Validates: Requirements 5.1, 5.5**

  - [ ] 8.3 Update Configuration frontend page
    - Modify src/app/admin/configuracion/page.tsx to make fields editable
    - Add form with current configuration values
    - Add validation for all fields
    - Add confirmation dialog for critical settings
    - Add loading states and error handling
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.4 Write unit tests for Configuration API
    - Test successful configuration update
    - Test validation for invalid values
    - Test range validation for numeric values
    - Test audit trail with change tracking
    - _Requirements: 5.1, 5.3, 5.5_

- [ ] 9. Implement permission enforcement across all modules
  - [ ] 9.1 Add role-based access control middleware
    - Create middleware to check ADMIN/MANAGER roles
    - Apply to all POST, PUT, DELETE endpoints
    - Return 403 for unauthorized requests
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 9.2 Write property test for role-based access control
    - **Property 33: Role-Based Access Control**
    - **Property 34: Unauthorized Access Error Code**
    - **Validates: Requirements 7.1, 7.2**

  - [ ] 9.3 Add client-side permission checks
    - Hide create/edit/delete buttons for non-admin users
    - Show appropriate error messages
    - _Requirements: 7.3_

  - [ ]* 9.4 Write unit tests for permission enforcement
    - Test ADMIN role can perform all operations
    - Test MANAGER role can perform all operations
    - Test other roles receive 403 errors
    - _Requirements: 7.1, 7.2_

- [ ] 10. Implement data integrity features
  - [ ] 10.1 Add transaction support to all API endpoints
    - Wrap create/update operations in Prisma transactions
    - Ensure audit trail logging is part of transaction
    - Add rollback on validation failure
    - _Requirements: 8.1, 8.2_

  - [ ]* 10.2 Write property test for transaction atomicity
    - **Property 37: Transaction Atomicity**
    - **Validates: Requirements 8.1, 8.2**

  - [ ] 10.3 Add dependency checking for soft deletes
    - Check for dependent records before soft delete
    - Show warning to user if dependencies exist
    - Prevent deletion of in-use records
    - _Requirements: 8.4, 8.5_

  - [ ]* 10.4 Write unit tests for data integrity
    - Test transaction rollback on failure
    - Test foreign key constraint enforcement
    - Test dependency checking
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Implement offline-first features (OPTIONAL)
  - [ ] 11.1 Add operation queueing for offline mode
    - Create IndexedDB queue for pending operations
    - Queue create/update/delete operations when offline
    - Show sync status indicators
    - _Requirements: 9.1, 9.3_

  - [ ] 11.2 Add automatic sync on reconnection
    - Detect connectivity restoration
    - Process queued operations in order
    - Use server state for conflict resolution
    - _Requirements: 9.2, 9.4_

  - [ ]* 11.3 Write unit tests for offline sync
    - Test operation queueing
    - Test automatic sync
    - Test conflict resolution
    - _Requirements: 9.1, 9.2, 9.4_

- [ ] 12. Final integration and testing
  - [ ]* 12.1 Write comprehensive property tests for all modules
    - Implement all 46 correctness properties
    - Run each property test with 100+ iterations
    - Tag each test with feature name and property number

  - [ ]* 12.2 Write E2E tests for complete workflows
    - Test admin creates employee, product, promotion, driver
    - Test admin edits all entity types
    - Test admin deactivates all entity types
    - Test permission denied for non-admin users
    - Test audit trail logging for all operations

  - [ ] 12.3 Verify all requirements are met
    - Review all 10 requirements
    - Verify all acceptance criteria are satisfied
    - Check audit trail completeness
    - Verify soft deletes work correctly

- [ ] 13. Final checkpoint - Production readiness
  - Ensure all tests pass (unit, property, integration, E2E)
  - Verify audit trail logging works for all operations
  - Verify permission enforcement works correctly
  - Verify data integrity features work correctly
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Follow the Mesas module pattern for consistency
- All money values must be stored as integer centavos
- All deletes are soft deletes (is_active = false)
- All operations must be logged in audit trail
- All operations require ADMIN or MANAGER role
