# Implementation Plan: Multi-Tenant Improvements

## Overview

This implementation plan breaks down the multi-tenant improvements into discrete coding tasks. The approach follows a layered implementation strategy: database layer (RLS policies) → API layer (middleware) → service layer (provisioning, quotas) → UI layer (admin interfaces) → testing.

## Tasks

- [ ] 1. Database Layer: Row-Level Security Policies
  - Create RLS policy migration script for all tenant-scoped tables
  - Implement policy templates for SELECT, INSERT, UPDATE, DELETE
  - Add cross-tenant admin policies for read-only access
  - Test RLS policies with direct database queries
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 1.1 Write property test for RLS isolation
  - **Property 1: RLS Enforces Tenant Isolation**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [ ] 1.2 Write property test for cross-tenant access blocking
  - **Property 2: Cross-Tenant Access Attempts Are Blocked**
  - **Validates: Requirements 1.3, 2.3**

- [ ] 1.3 Write property test for RLS violation logging
  - **Property 3: RLS Violations Are Logged**
  - **Validates: Requirements 1.6**

- [ ] 2. Create Tenant Context Middleware
  - [ ] 2.1 Implement JWT tenant_id extraction
    - Create withTenantContext middleware function
    - Extract and validate tenant_id from JWT token
    - Set PostgreSQL session variables for RLS
    - Handle missing or invalid tenant context with 401 error
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.2 Write property test for tenant context extraction
    - **Property 4: Tenant Context Extraction From JWT**
    - **Validates: Requirements 2.1**

  - [ ] 2.3 Implement tenant context logging
    - Add tenant_id to all API request logs
    - Create audit trail for tenant access
    - _Requirements: 2.5_

  - [ ] 2.4 Write property test for API request logging
    - **Property 5: API Requests Include Tenant Context**
    - **Validates: Requirements 2.5**

  - [ ] 2.5 Integrate middleware with Prisma
    - Ensure Prisma queries respect RLS session variables
    - Add tenant_id validation to Prisma queries
    - _Requirements: 2.6_

  - [ ] 2.6 Write property test for Prisma query scoping
    - **Property 6: Prisma Queries Are Tenant-Scoped**
    - **Validates: Requirements 2.6**

- [ ] 3. Checkpoint - Ensure tenant isolation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Tenant Provisioning Service
  - [ ] 4.1 Create tenant provisioning function
    - Implement provisionTenant with transaction
    - Generate unique tenant_id
    - Create tenant_settings record
    - Create catalog_meta with version 1
    - Create default stations (PARRILLA, COCINA, BAR, EMPAQUE)
    - Create admin employee with hashed PIN
    - Allocate terminal number ranges
    - Create default terminal
    - Generate activation code
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 4.2 Write property test for tenant ID uniqueness
    - **Property 7: Tenant IDs Are Unique**
    - **Validates: Requirements 3.1**

  - [ ] 4.3 Write property test for provisioning atomicity
    - **Property 8: Provisioning Is Atomic**
    - **Validates: Requirements 3.8**

  - [ ] 4.4 Write unit tests for provisioning completeness
    - Test tenant_settings creation
    - Test admin employee creation
    - Test default stations creation
    - Test terminal number range allocation
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 4.5 Create provisioning API endpoint
    - POST /api/admin/tenants/provision
    - Validate provisioning request
    - Call provisionTenant service
    - Return tenant credentials
    - _Requirements: 3.7_

- [ ] 5. Resource Quota Management
  - [ ] 5.1 Create quota schema migrations
    - Create tenant_quotas table
    - Create tenant_usage table
    - Add indexes for performance
    - _Requirements: 5.1_

  - [ ] 5.2 Implement quota checking service
    - Create checkQuota function
    - Create incrementUsage function
    - Create decrementUsage function
    - Create resetDailyQuotas function
    - _Requirements: 5.2, 5.4_

  - [ ] 5.3 Write property test for quota enforcement
    - **Property 9: Quota Enforcement Prevents Overuse**
    - **Validates: Requirements 5.2, 5.3**

  - [ ] 5.4 Write property test for usage tracking accuracy
    - **Property 10: Resource Usage Tracking Is Accurate**
    - **Validates: Requirements 5.4**

  - [ ] 5.5 Create quota middleware
    - Implement withQuotaCheck middleware
    - Integrate with resource creation endpoints
    - Return 429 error when quota exceeded
    - _Requirements: 5.3_

  - [ ] 5.6 Write unit test for quota exceeded error
    - Test error message format
    - Test HTTP status code
    - _Requirements: 5.3_

  - [ ] 5.7 Implement quota notification system
    - Create quota threshold monitoring
    - Send notifications at 80% usage
    - _Requirements: 5.6_

- [ ] 6. Checkpoint - Ensure quota management tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 7. Tenant Configuration Service
  - [ ] 7.1 Implement configuration management
    - Create getTenantConfiguration function
    - Create updateTenantConfiguration function
    - Add validation for logo_url, timezone, currency
    - Implement configuration history logging
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 7.2 Write unit tests for configuration validation
    - Test logo URL validation (size, format)
    - Test timezone validation
    - Test currency validation
    - _Requirements: 4.7_

  - [ ] 7.3 Create configuration API endpoints
    - GET /api/tenant/configuration
    - PUT /api/tenant/configuration
    - Add authentication and authorization
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 8. Tenant Analytics and Monitoring
  - [ ] 8.1 Create analytics schema
    - Create tenant_analytics table
    - Create tenant_health_checks table
    - Add indexes for performance
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 8.2 Implement metrics collection service
    - Create collectDailyMetrics function
    - Implement countActiveTerminals
    - Implement countOrders
    - Implement countEvents
    - Implement calculateRevenue
    - Implement countErrors
    - Implement calculateStorage
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.3 Implement health check service
    - Create checkTenantHealth function
    - Implement active terminals check
    - Implement recent orders check
    - Implement sync errors check
    - Implement storage usage check
    - _Requirements: 7.5, 7.6_

  - [ ] 8.4 Write unit tests for health checks
    - Test each health check type
    - Test overall status determination
    - _Requirements: 7.6_

  - [ ] 8.5 Create analytics API endpoints
    - GET /api/admin/tenants/:id/metrics
    - GET /api/admin/tenants/:id/health
    - Add cross-tenant admin authorization
    - _Requirements: 7.6, 7.7_

- [ ] 9. Tenant Backup and Restore
  - [ ] 9.1 Create backup schema
    - Create tenant_backups table
    - Add indexes for performance
    - _Requirements: 8.1, 8.2_

  - [ ] 9.2 Implement backup service
    - Create createBackup function
    - Implement exportTenantData
    - Implement data encryption
    - Implement backup upload to storage
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.3 Write unit tests for backup creation
    - Test full backup
    - Test incremental backup
    - Test encryption
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 9.4 Implement restore service
    - Create restoreBackup function
    - Implement backup download
    - Implement data decryption
    - Implement data validation
    - Implement atomic restore transaction
    - _Requirements: 8.5, 8.6_

  - [ ] 9.5 Write unit tests for restore
    - Test restore validation
    - Test restore to same tenant
    - Test restore to different tenant
    - _Requirements: 8.5, 8.6_

  - [ ] 9.6 Create backup API endpoints
    - POST /api/tenant/backup
    - POST /api/tenant/restore
    - GET /api/tenant/backups
    - Add authentication and authorization
    - _Requirements: 8.1, 8.3, 8.7_

- [ ] 10. Checkpoint - Ensure backup and monitoring tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Cross-Tenant Administration
  - [ ] 11.1 Create cross-tenant admin schema
    - Create cross_tenant_admins table
    - Create cross_tenant_audit_log table
    - Add indexes for performance
    - _Requirements: 9.1, 9.2, 9.7_

  - [ ] 11.2 Implement cross-tenant admin middleware
    - Create withCrossTenantAdmin function
    - Verify admin permissions
    - Set target tenant context
    - Implement audit logging
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 11.3 Write unit tests for permission checks
    - Test each permission type
    - Test permission denial
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

  - [ ] 11.4 Create cross-tenant admin API endpoints
    - GET /api/admin/tenants
    - GET /api/admin/tenants/:id/configuration
    - GET /api/admin/tenants/:id/events
    - GET /api/admin/tenants/:id/orders
    - Add cross-tenant admin authorization
    - _Requirements: 9.5, 9.6_

  - [ ] 11.5 Implement admin grant/revoke functions
    - Create grantCrossTenantAdmin
    - Create revokeCrossTenantAdmin
    - Add expiration handling
    - _Requirements: 9.1, 9.2_

- [ ] 12. Tenant Migration and Export
  - [ ] 12.1 Implement export service
    - Create exportTenantData function
    - Implement collectExportData
    - Implement validateExportCompleteness
    - Implement formatAsJSON
    - Implement formatAsSQL
    - Implement data encryption
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 12.2 Write unit tests for export
    - Test JSON export format
    - Test SQL export format
    - Test data completeness validation
    - Test encryption
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

  - [ ] 12.3 Create export API endpoints
    - POST /api/tenant/export
    - GET /api/tenant/exports
    - GET /api/tenant/exports/:id/download
    - Add authentication and authorization
    - _Requirements: 10.1, 10.6, 10.7_

- [ ] 13. Event Sourcing Tenant Isolation
  - [ ] 13.1 Implement event validation
    - Add tenant_id validation to event ingestion
    - Validate entity_id belongs to same tenant
    - Prevent cross-tenant event references
    - _Requirements: 11.1, 11.4, 11.5_

  - [ ] 13.2 Write property test for event ingestion validation
    - **Property 11: Event Ingestion Validates Tenant**
    - **Validates: Requirements 11.1**

  - [ ] 13.3 Write property test for cross-tenant event references
    - **Property 14: Cross-Tenant Event References Are Rejected**
    - **Validates: Requirements 11.4, 11.5**

  - [ ] 13.4 Implement tenant-scoped event streaming
    - Add tenant_id filtering to SSE endpoint
    - Ensure only tenant's events are streamed
    - _Requirements: 11.2_

  - [ ] 13.5 Write property test for event stream filtering
    - **Property 12: Event Streams Are Tenant-Filtered**
    - **Validates: Requirements 11.2**

  - [ ] 13.6 Implement tenant-scoped projection rebuild
    - Add tenant_id filtering to projection rebuild
    - Ensure only tenant's events are processed
    - _Requirements: 11.3_

  - [ ] 13.7 Write property test for projection rebuild scoping
    - **Property 13: Projection Rebuild Is Tenant-Scoped**
    - **Validates: Requirements 11.3**

  - [ ] 13.8 Implement tenant-scoped conflict resolution
    - Ensure conflict resolution doesn't affect other tenants
    - Add tenant_id validation to conflict resolution
    - _Requirements: 11.6_

  - [ ] 13.9 Write property test for conflict resolution scoping
    - **Property 15: Conflict Resolution Is Tenant-Scoped**
    - **Validates: Requirements 11.6**

- [ ] 14. Checkpoint - Ensure event sourcing isolation tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 15. Tenant-Scoped Authentication
  - [ ] 15.1 Implement tenant-scoped login validation
    - Validate employee belongs to specified tenant
    - Add tenant_id to JWT token claims
    - _Requirements: 12.1, 12.2_

  - [ ] 15.2 Write property test for login tenant validation
    - **Property 16: Login Validates Tenant Membership**
    - **Validates: Requirements 12.1**

  - [ ] 15.3 Write unit test for JWT tenant_id inclusion
    - Test token structure
    - Test tenant_id claim presence
    - _Requirements: 12.2_

  - [ ] 15.4 Implement token tenant validation
    - Verify token tenant_id matches requested resource
    - Prevent token reuse across tenants
    - _Requirements: 12.3, 12.4_

  - [ ] 15.5 Write property test for token tenant mismatch
    - **Property 17: Token Tenant Mismatch Is Rejected**
    - **Validates: Requirements 12.3, 12.4**

  - [ ] 15.6 Implement tenant-specific PIN policies
    - Add PIN policy configuration to tenant_settings
    - Enforce policies during PIN validation
    - _Requirements: 12.5_

  - [ ] 15.7 Write property test for PIN policy enforcement
    - **Property 18: Tenant-Specific PIN Policies Are Enforced**
    - **Validates: Requirements 12.5**

  - [ ] 15.8 Write unit test for session expiration
    - Test session expiration behavior
    - Test re-authentication requirement
    - _Requirements: 12.6_

- [ ] 16. Tenant Onboarding Workflow
  - [ ] 16.1 Create onboarding checklist schema
    - Add onboarding_status to tenant_settings
    - Create onboarding_steps table
    - _Requirements: 13.1_

  - [ ] 16.2 Implement onboarding service
    - Create createOnboardingChecklist function
    - Implement step completion tracking
    - Implement onboarding validation
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 16.3 Write unit tests for onboarding workflow
    - Test checklist creation
    - Test step completion
    - Test onboarding validation
    - _Requirements: 13.1, 13.6_

  - [ ] 16.4 Create onboarding UI components
    - Create onboarding wizard component
    - Create step progress indicator
    - Create configuration forms
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

- [ ] 17. Tenant Deactivation and Deletion
  - [ ] 17.1 Implement tenant deactivation
    - Create deactivateTenant function
    - Prevent logins for deactivated tenants
    - Prevent API access for deactivated tenants
    - _Requirements: 14.1, 14.2_

  - [ ] 17.2 Write unit tests for deactivation
    - Test login prevention
    - Test API access prevention
    - _Requirements: 14.2_

  - [ ] 17.3 Implement tenant reactivation
    - Create reactivateTenant function
    - Restore full access
    - _Requirements: 14.3_

  - [ ] 17.4 Implement tenant deletion
    - Create deleteTenant function
    - Create final backup before deletion
    - Implement data purge
    - Require explicit confirmation
    - _Requirements: 14.4, 14.5, 14.6_

  - [ ] 17.5 Write unit tests for deletion
    - Test backup creation
    - Test data purge completeness
    - Test confirmation requirement
    - _Requirements: 14.5, 14.6_

  - [ ] 17.6 Create deactivation/deletion API endpoints
    - POST /api/admin/tenants/:id/deactivate
    - POST /api/admin/tenants/:id/reactivate
    - DELETE /api/admin/tenants/:id
    - Add cross-tenant admin authorization
    - _Requirements: 14.7_

- [ ] 18. IndexedDB Tenant Isolation
  - [ ] 18.1 Implement tenant-specific database naming
    - Create getTenantDatabaseName function
    - Initialize tenant-specific IndexedDB
    - _Requirements: 15.1_

  - [ ] 18.2 Write property test for database name uniqueness
    - **Property 19: IndexedDB Database Names Are Tenant-Specific**
    - **Validates: Requirements 15.1**

  - [ ] 18.3 Implement tenant validation middleware for IndexedDB
    - Add tenant_id validation to all operations
    - Prevent cross-tenant data access
    - _Requirements: 15.2, 15.4_

  - [ ] 18.4 Write property test for local storage isolation
    - **Property 20: Local Storage Isolation Prevents Cross-Tenant Access**
    - **Validates: Requirements 15.2, 15.4**

  - [ ] 18.5 Implement tenant switching
    - Create switchTenant function
    - Clear previous tenant's data
    - Initialize new tenant's database
    - _Requirements: 15.3_

  - [ ] 18.6 Write property test for tenant switch cleanup
    - **Property 21: Tenant Switch Clears Previous Data**
    - **Validates: Requirements 15.3**

  - [ ] 18.7 Implement data encryption for IndexedDB
    - Create encryptTenantData function
    - Create decryptTenantData function
    - Implement tenant-specific encryption keys
    - _Requirements: 15.5_

  - [ ] 18.8 Write unit test for data encryption
    - Test encryption/decryption round trip
    - Test tenant-specific keys
    - _Requirements: 15.5_

  - [ ] 18.9 Implement tenant data purge
    - Create purgeTenantData function
    - Clear IndexedDB database
    - Clear localStorage entries
    - Clear sessionStorage
    - _Requirements: 15.6_

  - [ ] 18.10 Write unit test for data purge
    - Test complete data removal
    - Test logout cleanup
    - _Requirements: 15.6_

- [ ] 19. Checkpoint - Ensure all isolation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Integration and UI
  - [ ] 20.1 Create tenant admin dashboard
    - Display tenant configuration
    - Display quota usage
    - Display health metrics
    - Display recent activity
    - _Requirements: 4.1, 5.7, 7.6_

  - [ ] 20.2 Create cross-tenant admin dashboard
    - List all tenants
    - Display tenant health status
    - Provide tenant access controls
    - Display audit logs
    - _Requirements: 9.5, 9.6, 9.7_

  - [ ] 20.3 Implement tenant branding in UI
    - Display tenant logo
    - Use tenant legal_name
    - Display tenant address and RUC
    - Display tenant receipt_footer_text
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 20.4 Write integration tests for tenant branding
    - Test logo display
    - Test branding updates
    - _Requirements: 6.5_

  - [ ] 20.5 Create tenant provisioning UI
    - Create provisioning form
    - Display provisioning progress
    - Display tenant credentials
    - _Requirements: 3.7_

- [ ] 21. Final Checkpoint - End-to-end testing
  - [ ] 21.1 Run complete tenant lifecycle test
    - Provision tenant
    - Configure settings
    - Create resources
    - Verify isolation
    - Export data
    - Deactivate tenant

  - [ ] 21.2 Run cross-tenant admin workflow test
    - Grant admin access
    - Access multiple tenants
    - Verify audit logs
    - Revoke access

  - [ ] 21.3 Run quota management workflow test
    - Set quotas
    - Create resources to quota
    - Verify enforcement
    - Increase quota
    - Verify new resources

  - [ ] 21.4 Run performance benchmarks
    - Measure tenant provisioning time
    - Measure RLS query overhead
    - Measure quota check latency
    - Measure event filtering latency
    - Measure IndexedDB tenant switch time

  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Performance benchmarks ensure acceptable latency
- All tests are required for comprehensive multi-tenant security and isolation


