# Tasks: Multi-Factor Security Implementation

## Phase 1: Database & Core Logic (CRITICAL)

- [x] 1.1 Create active_sessions table
  - [x] 1.1.1 Add migration for active_sessions
  - [x] 1.1.2 Add migration for security_alerts
  - [x] 1.1.3 Add migration for transaction_limits
  - [x] 1.1.4 Add migration for audit_log
  - [x] 1.1.5 Run migrations: `npx prisma migrate deploy`
  - [x] 1.1.6 Regenerate Prisma: `npx prisma generate`

- [x] 1.2 Create security validation services
  - [x] 1.2.1 Create src/core/security/session-validator.ts
  - [x] 1.2.2 Create src/core/security/ip-validator.ts
  - [x] 1.2.3 Create src/core/security/location-validator.ts
  - [x] 1.2.4 Create src/core/security/rate-limiter.ts
  - [x] 1.2.5 Create src/core/security/alert-service.ts

- [x] 1.3 Update login endpoint
  - [x] 1.3.1 Update POST /api/auth/login
  - [x] 1.3.2 Add IP validation
  - [x] 1.3.3 Add location validation
  - [x] 1.3.4 Add simultaneous login detection
  - [x] 1.3.5 Create active_sessions record
  - [x] 1.3.6 Generate session_token

- [x] 1.4 Create new endpoints
  - [x] 1.4.1 POST /api/auth/confirm-suspicious-login
  - [x] 1.4.2 POST /api/auth/logout
  - [x] 1.4.3 POST /api/auth/validate-session

## Phase 2: Admin Panel (HIGH PRIORITY)

- [ ] 2.1 Create admin security dashboard
  - [ ] 2.1.1 Create src/app/admin/security/page.tsx
  - [ ] 2.1.2 Add active sessions view
  - [ ] 2.1.3 Add alerts view
  - [ ] 2.1.4 Add audit log view

- [ ] 2.2 Create session management UI
  - [ ] 2.2.1 Create components/admin/SessionsList.tsx
  - [ ] 2.2.2 Add session details modal
  - [ ] 2.2.3 Add revoke session button
  - [ ] 2.2.4 Add real-time updates (SSE)

- [ ] 2.3 Create alerts management UI
  - [ ] 2.3.1 Create components/admin/AlertsList.tsx
  - [ ] 2.3.2 Add alert details modal
  - [ ] 2.3.3 Add mark as resolved button
  - [ ] 2.3.4 Add filter by type/date

- [ ] 2.4 Create admin endpoints
  - [ ] 2.4.1 GET /api/admin/security/sessions
  - [ ] 2.4.2 POST /api/admin/security/sessions/[id]/revoke
  - [ ] 2.4.3 GET /api/admin/security/alerts
  - [ ] 2.4.4 POST /api/admin/security/alerts/[id]/resolve

## Phase 3: Frontend Integration (MEDIUM PRIORITY)

- [ ] 3.1 Update TerminalSetup.tsx
  - [ ] 3.1.1 Get user's IP address
  - [ ] 3.1.2 Get user's location (geolocation API)
  - [ ] 3.1.3 Send IP + location in login request
  - [ ] 3.1.4 Handle suspicious login response
  - [ ] 3.1.5 Show confirmation code input

- [ ] 3.2 Update page.tsx
  - [ ] 3.2.1 Add session validation on app load
  - [ ] 3.2.2 Add session timeout logic
  - [ ] 3.2.3 Add logout on session expiry
  - [ ] 3.2.4 Add session refresh mechanism

- [ ] 3.3 Create session management UI
  - [ ] 3.3.1 Create components/auth/SessionInfo.tsx
  - [ ] 3.3.2 Show current session details
  - [ ] 3.3.3 Add logout button
  - [ ] 3.3.4 Add session timeout warning

## Phase 4: Rate Limiting (MEDIUM PRIORITY)

- [ ] 4.1 Implement rate limiting
  - [ ] 4.1.1 Create src/core/security/rate-limiter.ts
  - [ ] 4.1.2 Add transaction limit checks
  - [ ] 4.1.3 Add price change limit checks
  - [ ] 4.1.4 Add refund limit checks

- [ ] 4.2 Add rate limit endpoints
  - [ ] 4.2.1 GET /api/admin/limits/[employeeId]
  - [ ] 4.2.2 PUT /api/admin/limits/[employeeId]
  - [ ] 4.2.3 POST /api/admin/limits/[employeeId]/reset

- [ ] 4.3 Add rate limit UI
  - [ ] 4.3.1 Create components/admin/LimitsManager.tsx
  - [ ] 4.3.2 Show current usage
  - [ ] 4.3.3 Show limits
  - [ ] 4.3.4 Allow admin to adjust limits

## Phase 5: Alerts & Notifications (LOW PRIORITY)

- [ ] 5.1 Implement real-time alerts
  - [ ] 5.1.1 Create alert service
  - [ ] 5.1.2 Send email alerts
  - [ ] 5.1.3 Send push notifications
  - [ ] 5.1.4 Add to-do list in admin

- [ ] 5.2 Create alert rules
  - [ ] 5.2.1 Simultaneous login alert
  - [ ] 5.2.2 Suspicious IP alert
  - [ ] 5.2.3 Impossible travel alert
  - [ ] 5.2.4 Rate limit exceeded alert

## Phase 6: Testing & Validation (CRITICAL)

- [ ] 6.1 Unit tests
  - [ ] 6.1.1 Test IP validation
  - [ ] 6.1.2 Test location validation
  - [ ] 6.1.3 Test simultaneous login detection
  - [ ] 6.1.4 Test rate limiting

- [ ] 6.2 Integration tests
  - [ ] 6.2.1 Test complete login flow
  - [ ] 6.2.2 Test suspicious login flow
  - [ ] 6.2.3 Test session management
  - [ ] 6.2.4 Test admin endpoints

- [ ] 6.3 Security tests
  - [ ] 6.3.1 Test hacker scenario (simultaneous login)
  - [ ] 6.3.2 Test IP spoofing
  - [ ] 6.3.3 Test rate limit bypass
  - [ ] 6.3.4 Test session hijacking

- [ ] 6.4 E2E tests
  - [ ] 6.4.1 Test complete user flow
  - [ ] 6.4.2 Test admin security dashboard
  - [ ] 6.4.3 Test alert notifications

## Priority Order

**CRITICAL (Do First):**
1. Phase 1: Database & Core Logic
2. Phase 6: Testing & Validation

**HIGH (Do Second):**
3. Phase 2: Admin Panel

**MEDIUM (Do Third):**
4. Phase 3: Frontend Integration
5. Phase 4: Rate Limiting

**LOW (Do Last):**
6. Phase 5: Alerts & Notifications

## Estimated Time

- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 2 hours
- Phase 4: 1.5 hours
- Phase 5: 1.5 hours
- Phase 6: 2 hours

**Total: ~12 hours**

## Success Criteria

- ✅ Simultaneous login is detected and rejected
- ✅ Suspicious IP is detected and requires confirmation
- ✅ Impossible travel is detected and rejected
- ✅ Rate limiting works correctly
- ✅ All alerts are sent in real-time
- ✅ Admin dashboard shows all security info
- ✅ Audit log is complete
- ✅ All tests pass
