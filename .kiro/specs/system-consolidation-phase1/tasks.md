# Implementation Plan: System Consolidation Phase 1

## Overview

This implementation plan breaks down the System Consolidation Phase 1 into discrete, manageable tasks. The focus is on establishing production-grade observability, comprehensive API documentation, and performance optimization for the PARK POS system.

The implementation follows a phased approach:
1. **Phase 1 (Week 1)**: Observability infrastructure (logging, error tracking, metrics)
2. **Phase 2 (Week 1-2)**: API documentation (OpenAPI, Postman, TypeDoc)
3. **Phase 3 (Week 2)**: Performance optimization (caching, query optimization, code splitting)
4. **Phase 4 (Week 2)**: Monitoring and alerting (health checks, dashboard, alerts)

## Tasks

### Phase 1: Observability Infrastructure

- [x] 1. Implement Structured Logger
  - [x] 1.1 Create logger interface and implementation with Pino
    - Create `src/core/observability/logger.ts` with StructuredLogger class
    - Implement log methods (debug, info, warn, error, fatal)
    - Add JSON formatting for production, pretty formatting for development
    - Implement sensitive data redaction (PINs, tokens, payment details)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [x] 1.2 Write property test for log structure completeness
    - **Property 1: Log Structure Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
  
  - [x] 1.3 Write property test for log level support
    - **Property 2: Log Level Support**
    - **Validates: Requirements 1.5**
  
  - [x] 1.4 Write property test for non-blocking logging
    - **Property 3: Non-Blocking Logging**
    - **Validates: Requirements 1.7**
  
  - [x] 1.5 Integrate Logtail for production log aggregation
    - Add Logtail SDK dependency
    - Configure Logtail source token from environment
    - Implement sendToLogtail method with batching
    - Add error handling for Logtail failures
    - _Requirements: 1.1, 1.5_

- [x] 2. Implement Error Tracker
  - [x] 2.1 Create error tracker interface and Sentry integration
    - Create `src/core/observability/error-tracker.ts` with SentryErrorTracker class
    - Initialize Sentry SDK with DSN from environment
    - Implement captureException with context (tenantId, terminalId, userId)
    - Implement captureMessage for non-exception errors
    - Add breadcrumb tracking for business operations
    - Filter sensitive data from error reports (headers, cookies)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8_
  
  - [x] 2.2 Write property test for error capture completeness
    - **Property 4: Error Capture Completeness**
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 2.3 Write property test for error context preservation
    - **Property 25: Error Context Preservation**
    - **Validates: Requirements 2.2**
  
  - [x] 2.4 Configure Sentry performance monitoring
    - Set tracesSampleRate to 10%
    - Configure beforeSend hook for data filtering
    - Add custom tags for tenant and terminal
    - _Requirements: 2.7_

- [x] 3. Implement Metrics Collector
  - [x] 3.1 Create metrics collector interface and implementation
    - Create `src/core/observability/metrics.ts` with VercelMetricsCollector class
    - Implement increment, decrement, gauge, histogram, timing methods
    - Add metric tagging (tenantId, terminalId, eventType, endpoint)
    - Implement metric batching and flushing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [x] 3.2 Write property test for business event metrics
    - **Property 5: Business Event Metrics**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 3.3 Write property test for API response time metrics
    - **Property 6: API Response Time Metrics**
    - **Validates: Requirements 3.5**
  
  - [x] 3.4 Write property test for session tracking metrics
    - **Property 7: Session Tracking Metrics**
    - **Validates: Requirements 3.6**
  
  - [x] 3.5 Write property test for metrics idempotency
    - **Property 24: Metrics Idempotency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
  
  - [x] 3.6 Create metrics API endpoint
    - Create `src/app/api/metrics/route.ts` for metrics retrieval
    - Implement aggregation by tenant, terminal, time period
    - Add authentication check (admin only)
    - Return metrics in JSON format
    - _Requirements: 3.9_

- [x] 4. Checkpoint - Ensure observability tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: API Documentation

- [x] 5. Implement OpenAPI Documentation Generator
  - [x] 5.1 Create OpenAPI specification generator
    - Create `src/lib/openapi/generator.ts` with generateOpenAPISpec function
    - Define OpenAPI 3.0 document structure (info, servers, paths, components)
    - Add security schemes (bearerAuth)
    - Generate schemas from Zod types
    - Group endpoints by domain (auth, events, orders, inventory, admin)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_
  
  - [x] 5.2 Write property test for OpenAPI specification validity
    - **Property 8: OpenAPI Specification Validity**
    - **Validates: Requirements 6.1**
  
  - [x] 5.3 Write property test for API schema completeness
    - **Property 9: API Schema Completeness**
    - **Validates: Requirements 6.2, 6.3**
  
  - [x] 5.4 Write property test for API authentication documentation
    - **Property 10: API Authentication Documentation**
    - **Validates: Requirements 6.4**
  
  - [x] 5.5 Create Swagger UI endpoint
    - Create `src/app/api/docs/page.tsx` for Swagger UI
    - Integrate swagger-ui-react component
    - Load OpenAPI spec from generator
    - Add authentication support in UI
    - _Requirements: 5.5_

- [x] 6. Implement Postman Collection Generator
  - [x] 6.1 Create Postman collection exporter
    - Create `src/lib/openapi/postman-exporter.ts` with exportToPostman function
    - Convert OpenAPI spec to Postman Collection v2.1 format
    - Add environment variables (baseUrl, authToken)
    - Generate pre-request scripts for authentication
    - Generate test scripts for response validation
    - Organize requests by domain
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_
  
  - [x] 6.2 Write property test for Postman collection export
    - **Property 11: Postman Collection Export**
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 6.3 Create Postman collection download endpoint
    - Create `src/app/api/docs/postman/route.ts` for collection download
    - Generate collection on-demand
    - Return as downloadable JSON file
    - _Requirements: 6.5_

- [x] 7. Implement TypeDoc Code Documentation
  - [x] 7.1 Configure TypeDoc for code documentation
    - Add TypeDoc dependency to package.json
    - Create `typedoc.json` configuration file
    - Configure entry points (core domain models, services, projections)
    - Configure output directory (`public/docs/code`)
    - Add JSDoc comments to all exported functions and types                                                                                                                                                                te destuviste c
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_
  
  - [x] 7.2 Write property test for TypeDoc comment completeness
    - **Property 12: TypeDoc Comment Completeness**
    - **Validates: Requirements 8.3, 8.4**
  
  - [x] 7.3 Add TypeDoc generation to build process
    - Add `docs:generate` script to package.json
    - Integrate TypeDoc generation in build pipeline
    - Serve static TypeDoc site at `/docs/code`
    - _Requirements: 7.5_

- [x] 8. Checkpoint - Ensure documentation tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Performance Optimization

- [x] 9. Implement Redis Caching Layer
  - [x] 9.1 Create cache service interface and Redis implementation
    - Create `src/core/cache/cache-service.ts` with RedisCacheService class
    - Implement get, set, delete, deleteByTag, clear methods
    - Add TTL support (products: 3600s, tenants: 300s, terminals: 900s)
    - Implement tag-based cache invalidation
    - Add graceful degradation for Redis failures
    - Implement circuit breaker for Redis connection
    - Add compression for values > 1KB
    - Use tenant-namespaced keys
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 8.10_
  
  - [x] 9.2 Write property test for cache TTL correctness
    - **Property 13: Cache TTL Correctness**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  
  - [x] 9.3 Write property test for cache invalidation on update
    - **Property 14: Cache Invalidation on Update**
    - **Validates: Requirements 9.4**
  
  - [x] 9.4 Write property test for cache hit rate metrics
    - **Property 15: Cache Hit Rate Metrics**
    - **Validates: Requirements 9.6**
  
  - [x] 9.5 Write property test for cache graceful degradation
    - **Property 16: Cache Graceful Degradation**
    - **Validates: Requirements 9.7**
  
  - [x] 9.6 Write property test for cache round-trip consistency
    - **Property 23: Cache Round-Trip Consistency**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  
  - [x] 9.7 Integrate caching in product catalog service
    - Modify `src/core/services/product.service.ts` to use cache
    - Check cache before database query
    - Store results in cache after database query
    - Invalidate cache on product updates
    - _Requirements: 8.1_
  
  - [x] 9.8 Integrate caching in tenant configuration service
    - Modify tenant configuration queries to use cache
    - Invalidate cache on configuration updates
    - _Requirements: 8.2_
  
  - [x] 9.9 Integrate caching in terminal registration service
    - Modify terminal queries to use cache
    - Invalidate cache on terminal updates
    - _Requirements: 8.3_

- [x] 10. Optimize Database Queries
  - [x] 10.1 Add database indexes for performance
    - Create migration `prisma/migrations/add_performance_indexes.sql`
    - Add index on `orders(tenant_id, created_at DESC)`
    - Add index on `orders(status)`
    - Add index on `order_items(order_id)`
    - Add index on `events(tenant_id, event_type, created_at DESC)`
    - Add index on `events(aggregate_id, version)`
    - Add index on `products(tenant_id, is_active)`
    - Add index on `employees(tenant_id, is_active)`
    - Run migration
    - _Requirements: 9.4, 9.5_
  
  - [x] 10.2 Eliminate N+1 queries in order loading
    - Modify `src/core/services/order.service.ts` to use Prisma include
    - Load orders with items, payments in single query
    - Add unit test to verify single query execution
    - _Requirements: 9.1, 9.2_
  
  - [x] 10.3 Implement pagination for list endpoints
    - Add pagination parameters (page, pageSize) to all list endpoints
    - Enforce maximum page size of 100
    - Return pagination metadata (total, totalPages)
    - _Requirements: 9.6_
  
  - [x] 10.4 Write property test for pagination support
    - **Property 17: Pagination Support**
    - **Validates: Requirements 10.4**
  
  - [x] 10.5 Implement slow query logging
    - Add Prisma middleware for query timing
    - Log queries > 1000ms with query details
    - Emit metrics for query performance
    - _Requirements: 9.9_
  
  - [x] 10.6 Write property test for slow query logging
    - **Property 18: Slow Query Logging**
    - **Validates: Requirements 10.6**
  
  - [x] 10.7 Write property test for query performance metrics
    - **Property 19: Query Performance Metrics**
    - **Validates: Requirements 10.7**

- [x] 11. Implement Frontend Performance Optimizations
  - [x] 11.1 Configure code splitting for routes
    - Update `next.config.js` to enable code splitting
    - Use dynamic imports for route components
    - Verify route-based chunks are generated
    - _Requirements: 10.6_
  
  - [x] 11.2 Implement lazy loading for non-critical components
    - Use React.lazy for admin panels
    - Use React.lazy for reports
    - Add Suspense boundaries with loading states
    - _Requirements: 10.7_
  
  - [x] 11.3 Configure resource preloading
    - Add preload links for critical resources (fonts, CSS, main JS)
    - Configure in `src/app/layout.tsx`
    - _Requirements: 10.8_
  
  - [x] 11.4 Implement Web Vitals tracking
    - Create `src/lib/web-vitals.ts` for vitals collection
    - Track TTFB, FCP, LCP, TTI, CLS
    - Send vitals to metrics collector
    - _Requirements: 10.10_
  
  - [x] 11.5 Write unit tests for Web Vitals tracking
    - Test that vitals are collected on page load
    - Test that vitals are sent to metrics service
    - _Requirements: 10.10_

- [x] 12. Checkpoint - Ensure performance tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Monitoring and Alerting

- [x] 13. Implement Health Check System
  - [x] 13.1 Create health check service
    - Create `src/core/health/health-check.ts` with HealthCheckService class
    - Implement database connectivity check
    - Implement Redis connectivity check
    - Implement event sourcing health check
    - Calculate overall system status (healthy, degraded, unhealthy)
    - Track component response times
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 13.2 Write property test for health check component status
    - **Property 20: Health Check Component Status**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6**
  
  - [x] 13.3 Write property test for health check failure response
    - **Property 21: Health Check Failure Response**
    - **Validates: Requirements 13.7**
  
  - [x] 13.4 Create health check API endpoint
    - Create `src/app/api/health/route.ts` for health checks
    - Return health status with component details
    - Return HTTP 200 if healthy, 503 if unhealthy
    - Ensure response time < 2 seconds
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 13.5 Configure Uptime Robot monitoring
    - Create Uptime Robot account (free tier)
    - Add monitor for `/api/health` endpoint
    - Configure 5-minute check interval
    - Configure alert notifications (email)
    - _Requirements: 4.5, 4.6, 4.7_

- [x] 14. Implement Monitoring Dashboard
  - [x] 14.1 Create monitoring dashboard UI
    - Create `src/app/admin/monitoring/page.tsx` for dashboard
    - Display real-time error rate and trend chart
    - Display API response times by endpoint
    - Display cache hit rate and memory usage
    - Display database query performance statistics
    - Display Web Vitals scores for all pages
    - Add time range filter (1h, 24h, 7d, 30d)
    - Add tenant and terminal filters
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [x] 14.2 Write unit tests for dashboard components
    - Test that metrics are displayed correctly
    - Test that filters work correctly
    - Test that charts render correctly
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 14.3 Implement metrics export functionality
    - Add CSV export button to dashboard
    - Generate CSV from metrics data
    - Include all visible metrics in export
    - _Requirements: 11.10_

- [-] 15. Implement Alert Configuration System
  - [x] 15.1 Create alert configuration service
    - Create `src/core/alerts/alert-config.ts` with AlertConfigService class
    - Support configuration for error rate thresholds
    - Support configuration for response time thresholds
    - Support configuration for uptime thresholds
    - Support configuration for cache hit rate thresholds
    - Support configuration for database pool exhaustion
    - Persist configuration in database
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [x] 15.2 Implement alert notification system
    - Create `src/core/alerts/alert-notifier.ts` with AlertNotifier class
    - Support multiple notification channels (email, Slack, webhook)
    - Implement alert deduplication (5-minute window)
    - Implement alert escalation (15-minute timeout)
    - Support alert snoozing for maintenance windows
    - Log all alert events with timestamp and resolution status
    - _Requirements: 15.6, 15.7, 15.8, 15.9, 15.10_
  
  - [x] 15.3 Write property test for alert deduplication
    - **Property: Alert Deduplication**
    - Test that duplicate alerts within 5 minutes are suppressed
    - **Validates: Requirements 15.7**
  
  - [x] 15.4 Write property test for alert escalation
    - **Property: Alert Escalation**
    - Test that unacknowledged alerts escalate after 15 minutes
    - **Validates: Requirements 15.8**
  
  - [x] 15.5 Create alert configuration UI
    - Create `src/app/admin/alerts/page.tsx` for alert configuration
    - Display current alert thresholds
    - Allow editing of thresholds
    - Display alert history
    - Allow snoozing alerts
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.9_

- [ ] 16. Implement Log Level Configuration
  - [x] 16.1 Create log level configuration service
    - Create `src/core/observability/log-config.ts` with LogConfigService class
    - Support environment variable configuration
    - Support runtime configuration via API
    - Support per-module log levels (auth, sync, events, orders)
    - Persist configuration in database
    - Validate log level values
    - Log configuration changes to audit trail
    - Revert to default (info) on invalid configuration
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6, 12.7, 12.8_
  
  - [x] 16.2 Write property test for log level configuration
    - **Property: Log Level Configuration**
    - Test that log level changes are applied correctly
    - **Validates: Requirements 12.3**
  
  - [x] 16.3 Create log level configuration API endpoint
    - Create `src/app/api/admin/log-config/route.ts` for configuration
    - Support GET for current configuration
    - Support POST for updating configuration
    - Validate log level values
    - Apply changes within 30 seconds
    - _Requirements: 12.2, 12.3_

- [ ] 17. Implement Error Recovery System
  - [ ] 17.1 Create error recovery service
    - Create `src/core/recovery/recovery-service.ts` with RecoveryService class
    - Implement automatic retry with exponential backoff for transient errors
    - Provide manual recovery endpoints (clear cache, reset sync, rebuild projections)
    - Validate recovery action prerequisites
    - Provide rollback capability for destructive actions
    - Log all recovery actions with timestamp and user
    - Send notifications on recovery success/failure
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_
  
  - [ ] 17.2 Write property test for automatic recovery
    - **Property: Automatic Recovery**
    - Test that transient errors trigger retry with backoff
    - **Validates: Requirements 13.3**
  
  - [ ] 17.3 Write property test for recovery action logging
    - **Property: Recovery Action Logging**
    - Test that all recovery actions are logged
    - **Validates: Requirements 13.5**
  
  - [ ] 17.4 Create recovery action API endpoints
    - Create `src/app/api/admin/recovery/route.ts` for recovery actions
    - Implement POST /api/admin/recovery/clear-cache
    - Implement POST /api/admin/recovery/reset-sync
    - Implement POST /api/admin/recovery/rebuild-projections
    - Add authentication check (admin only)
    - _Requirements: 13.4_

- [ ] 18. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Integration and Deployment

- [ ] 19. Integration Testing
  - [ ] 19.1 Write integration tests for observability flow
    - Test that errors are logged, tracked, and metrics are emitted
    - Test that logs are sent to Logtail in production
    - Test that errors are sent to Sentry in production
    - _Requirements: 1.1, 2.1, 3.1_
  
  - [ ] 19.2 Write integration tests for caching flow
    - Test cache-aside pattern with real Redis
    - Test cache invalidation on updates
    - Test graceful degradation when Redis is down
    - _Requirements: 8.5, 8.6_
  
  - [ ] 19.3 Write integration tests for health check flow
    - Test health check with all components healthy
    - Test health check with database down
    - Test health check with Redis down
    - _Requirements: 4.2, 4.3_
  
  - [ ] 19.4 Write E2E tests for monitoring dashboard
    - Test dashboard loads and displays metrics
    - Test filters work correctly
    - Test CSV export works
    - _Requirements: 11.1, 11.7, 11.10_

- [ ] 20. Documentation and Deployment
  - [ ] 20.1 Create deployment guide
    - Document environment variables required
    - Document third-party service setup (Sentry, Logtail, Uptime Robot)
    - Document deployment steps
    - Document rollback procedure
    - _Requirements: All_
  
  - [ ] 20.2 Create runbook for common errors
    - Document database connection failure recovery
    - Document Redis unavailable recovery
    - Document sync backlog recovery
    - Link runbook sections in error tracker
    - _Requirements: 13.1, 13.2_
  
  - [ ] 20.3 Update MASTER.md checklist
    - Mark Phase 1 Consolidation as complete
    - Update status and metrics
    - Document next steps
    - _Requirements: All_
  
  - [ ] 20.4 Deploy to production
    - Deploy observability infrastructure
    - Deploy caching layer
    - Deploy API documentation
    - Deploy performance optimizations
    - Deploy monitoring dashboard
    - Verify all systems operational
    - _Requirements: All_

## Notes

- All tasks are required for comprehensive production-grade consolidation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (25 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All observability components must fail gracefully (no application failures)
- Free tier limits must be monitored (Sentry: 5k errors/month, Logtail: 1GB/month)
- Performance budgets are enforced in CI/CD (main bundle < 300KB gzipped)
- Zero downtime deployment strategy ensures backward compatibility
