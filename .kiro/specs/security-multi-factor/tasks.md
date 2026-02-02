# Tasks: Multi-Factor Security Implementation (MAC-Based)

## Phase 1: Database & Core Logic (CRITICAL) - MAC Detection

- [x] 1.1 Create active_sessions table
  - [x] 1.1.1 Add migration for active_sessions
  - [x] 1.1.2 Add migration for security_alerts
  - [x] 1.1.3 Add migration for transaction_limits
  - [x] 1.1.4 Add migration for audit_log
  - [x] 1.1.5 Run migrations: `npx prisma migrate deploy`
  - [x] 1.1.6 Regenerate Prisma: `npx prisma generate`

- [ ] 1.2 Create device_mac_addresses table (HYBRID - Detecta dispositivos + terminales)
  - [ ] 1.2.1 Create migration for device_mac_addresses (HYBRID schema)
  - [ ] 1.2.2 Add columns: mac_address, employee_id, terminal_id (NULL = any), trust_level
  - [ ] 1.2.3 Add composite PRIMARY KEY: (mac_address, employee_id, COALESCE(terminal_id, '00000000...'))
  - [ ] 1.2.4 Add indexes: (tenant_id, employee_id), (terminal_id), (employee_id, last_seen DESC), (trust_level)
  - [ ] 1.2.5 Run migration: `npx prisma migrate deploy`
  - [ ] 1.2.6 Regenerate Prisma: `npx prisma generate`

- [ ] 1.2b Create terminal_mac_registry table (NEW - Auditoría de acceso por terminal)
  - [ ] 1.2b.1 Create migration for terminal_mac_registry
  - [ ] 1.2b.2 Add columns: id, terminal_id, mac_address, employee_id, access_count, is_authorized
  - [ ] 1.2b.3 Add indexes: (terminal_id, mac_address), (employee_id, terminal_id), (is_authorized)
  - [ ] 1.2b.4 Run migration: `npx prisma migrate deploy`
  - [ ] 1.2b.5 Regenerate Prisma: `npx prisma generate`

- [ ] 1.3 Create MAC detection service (NEW)
  - [ ] 1.3.1 Create src/core/security/mac-detector.ts
  - [ ] 1.3.2 Implement WebRTC-based MAC detection
  - [ ] 1.3.3 Add fallback to Device ID if MAC unavailable
  - [ ] 1.3.4 Add MAC validation logic
  - [ ] 1.3.5 Add MAC registration logic

- [ ] 1.3b Create hybrid MAC validator (HYBRID - Detecta dispositivos + terminales)
  - [ ] 1.3b.1 Create src/core/security/mac-validator-hybrid.ts
  - [ ] 1.3b.2 Implement validateMAC() - Hybrid check (employee + terminal)
  - [ ] 1.3b.3 Implement checkTerminalAuthorization() - Terminal access audit
  - [ ] 1.3b.4 Implement registerMAC() - Register with terminal_id (optional)
  - [ ] 1.3b.5 Implement blockMAC() - Block device
  - [ ] 1.3b.6 Implement getDevicesByEmployee() - List employee's devices
  - [ ] 1.3b.7 Implement getTerminalAccessLog() - Audit trail per terminal

- [x] 1.4 Create security validation services (MODIFIED)
  - [x] 1.4.1 Create src/core/security/session-validator.ts ✅
  - [x] 1.4.2 Create src/core/security/mac-validator.ts (REPLACES ip-validator)
  - [x] 1.4.3 Create src/core/security/location-validator.ts ✅
  - [x] 1.4.4 Create src/core/security/rate-limiter.ts ✅
  - [x] 1.4.5 Create src/core/security/alert-service.ts ✅

- [ ] 1.5 Update login endpoint (MODIFIED - Hybrid validation)
  - [ ] 1.5.1 Update POST /api/auth/login to use HYBRID MAC validation
  - [ ] 1.5.2 Add MAC detection (WebRTC)
  - [ ] 1.5.3 Add HYBRID MAC validation (employee + terminal)
  - [ ] 1.5.4 Add terminal authorization check
  - [ ] 1.5.5 Add simultaneous login detection (unchanged)
  - [ ] 1.5.6 Create active_sessions record with MAC + terminal_id
  - [ ] 1.5.7 Generate session_token
  - [ ] 1.5.8 Keep IP logging for auditoría (not validation)
  - [ ] 1.5.9 Handle warnings (DIFFERENT_TERMINAL) - Allow with alert

- [ ] 1.6 Create new endpoints (MODIFIED - Hybrid support)
  - [ ] 1.6.1 POST /api/auth/confirm-device (with terminal_id support)
  - [ ] 1.6.2 POST /api/auth/logout
  - [ ] 1.6.3 POST /api/auth/validate-session
  - [ ] 1.6.4 GET /api/admin/security/devices (list all devices)
  - [ ] 1.6.5 POST /api/admin/security/devices/[mac]/block (block device)
  - [ ] 1.6.6 GET /api/admin/security/terminals/[id]/access-log (terminal audit)

## Phase 2: Admin Panel (HIGH PRIORITY)

- [ ] 2.1 Create admin security dashboard
  - [ ] 2.1.1 Create src/app/admin/security/page.tsx
  - [ ] 2.1.2 Add active sessions view (show MAC instead of IP)
  - [ ] 2.1.3 Add alerts view
  - [ ] 2.1.4 Add audit log view

- [ ] 2.2 Create session management UI
  - [ ] 2.2.1 Create components/admin/SessionsList.tsx
  - [ ] 2.2.2 Add session details modal (show MAC address)
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

- [ ] 3.1 Update TerminalSetup.tsx (MODIFIED)
  - [ ] 3.1.1 Detect MAC address (WebRTC)
  - [ ] 3.1.2 Send MAC in login request (not IP)
  - [ ] 3.1.3 Handle unknown device response
  - [ ] 3.1.4 Show confirmation code input for new devices
  - [ ] 3.1.5 Handle device confirmation flow

- [ ] 3.2 Update page.tsx
  - [ ] 3.2.1 Add session validation on app load
  - [ ] 3.2.2 Add session timeout logic
  - [ ] 3.2.3 Add logout on session expiry
  - [ ] 3.2.4 Add session refresh mechanism

- [ ] 3.3 Create session management UI
  - [ ] 3.3.1 Create components/auth/SessionInfo.tsx
  - [ ] 3.3.2 Show current session details (MAC address)
  - [ ] 3.3.3 Add logout button
  - [ ] 3.3.4 Add session timeout warning

## Phase 4: Rate Limiting (MEDIUM PRIORITY)

- [ ] 4.1 Implement rate limiting
  - [ ] 4.1.1 Create src/core/security/rate-limiter.ts ✅
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

- [ ] 5.2 Create alert rules (MODIFIED)
  - [ ] 5.2.1 Simultaneous login alert
  - [ ] 5.2.2 Unknown device alert (REPLACES suspicious IP)
  - [ ] 5.2.3 Device mismatch alert (NEW)
  - [ ] 5.2.4 Rate limit exceeded alert

## Phase 6: Testing & Validation (CRITICAL)

- [ ] 6.1 Unit tests
  - [ ] 6.1.1 Test MAC detection
  - [ ] 6.1.2 Test MAC validation
  - [ ] 6.1.3 Test simultaneous login detection
  - [ ] 6.1.4 Test rate limiting

- [ ] 6.2 Integration tests
  - [ ] 6.2.1 Test complete login flow with MAC
  - [ ] 6.2.2 Test unknown device flow
  - [ ] 6.2.3 Test session management
  - [ ] 6.2.4 Test admin endpoints

- [ ] 6.3 Security tests
  - [ ] 6.3.1 Test hacker scenario (unknown MAC)
  - [ ] 6.3.2 Test MAC spoofing (should fail)
  - [ ] 6.3.3 Test rate limit bypass
  - [ ] 6.3.4 Test session hijacking

- [ ] 6.4 E2E tests
  - [ ] 6.4.1 Test complete user flow with MAC
  - [ ] 6.4.2 Test admin security dashboard
  - [ ] 6.4.3 Test alert notifications

## Priority Order

**CRITICAL (Do First):**
1. Phase 1: Database & Core Logic (MAC Detection)
2. Phase 6: Testing & Validation

**HIGH (Do Second):**
3. Phase 2: Admin Panel

**MEDIUM (Do Third):**
4. Phase 3: Frontend Integration
5. Phase 4: Rate Limiting

**LOW (Do Last):**
6. Phase 5: Alerts & Notifications

## Estimated Time

- Phase 1: 5 hours (Hybrid model is more complex)
  - Database: 1 hour
  - Core logic: 2 hours
  - Login integration: 1.5 hours
  - Endpoints: 0.5 hours
- Phase 2: 4 hours (Admin panel with device management)
- Phase 3: 2.5 hours (Frontend integration)
- Phase 4: 1.5 hours (Rate limiting)
- Phase 5: 1.5 hours (Alerts & notifications)
- Phase 6: 2.5 hours (Testing - more scenarios)

**Total: ~17 hours** (vs 13 hours for simple model)

## Success Criteria

- ✅ MAC address is detected and registered (per employee + terminal)
- ✅ Unknown devices require confirmation
- ✅ Known devices allow immediate access (no friction)
- ✅ Employees can rotate between terminals (no daily confirmation)
- ✅ Stolen devices are detected (MAC of different employee)
- ✅ Unauthorized terminal access is detected (MAC on wrong terminal)
- ✅ Simultaneous login is detected and rejected
- ✅ Rate limiting works correctly
- ✅ All alerts are sent in real-time
- ✅ Admin dashboard shows all security info
- ✅ Audit log is complete with MAC + terminal addresses
- ✅ All tests pass (including hybrid scenarios)

## Key Changes from IP Validation

**Removed:**
- ❌ IP validation on every login
- ❌ Suspicious IP alerts
- ❌ Impossible travel validation (optional, secondary)

**Added (Hybrid Model):**
- ✅ MAC address detection (hardware-bound, stable)
- ✅ MAC address registration (per employee + terminal)
- ✅ Unknown device alerts (only for new devices)
- ✅ Device mismatch alerts (MAC of different employee)
- ✅ Terminal access audit (which MACs accessed which terminals)
- ✅ Device confirmation flow (frictionless)
- ✅ Terminal rotation support (employees can move between terminals)
- ✅ Device blocking (admin can block stolen devices)

**Kept:**
- ✅ IP logging for auditoría (not validation)
- ✅ Simultaneous login detection
- ✅ Rate limiting
- ✅ Session management
- ✅ Audit trail

## Hybrid Model Benefits

| Scenario | Simple Model | Hybrid Model |
|----------|--------------|--------------|
| Stolen device | ✅ Detected | ✅ Detected |
| Unauthorized terminal | ❌ Not detected | ✅ Detected |
| Employee rotation | ⚠️ Requires confirmation | ✅ No confirmation |
| New terminal | ⚠️ Requires confirmation | ✅ Allowed with warning |
| Friction level | HIGH | LOW |
| Security level | MEDIUM | HIGH |
