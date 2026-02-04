# Tasks: Multi-Factor Security Implementation (MAC-Based)

## Phase 1: Database & Core Logic (CRITICAL) - MAC Detection

- [x] 1.1 Create active_sessions table
  - [x] 1.1.1 Add migration for active_sessions
  - [x] 1.1.2 Add migration for security_alerts
  - [x] 1.1.3 Add migration for transaction_limits
  - [x] 1.1.4 Add migration for audit_log
  - [x] 1.1.5 Run migrations: `npx prisma migrate deploy`
  - [x] 1.1.6 Regenerate Prisma: `npx prisma generate`

- [x] 1.2 Create device_mac_addresses table (HYBRID - Detecta dispositivos + terminales)
  - [x] 1.2.1 Create migration for device_mac_addresses (HYBRID schema)
  - [x] 1.2.2 Add columns: mac_address, employee_id, terminal_id (NULL = any), trust_level
  - [x] 1.2.3 Add composite PRIMARY KEY: (mac_address, employee_id, COALESCE(terminal_id, '00000000...'))
  - [x] 1.2.4 Add indexes: (tenant_id, employee_id), (terminal_id), (employee_id, last_seen DESC), (trust_level)
  - [x] 1.2.5 Run migration: `npx prisma migrate deploy`
  - [x] 1.2.6 Regenerate Prisma: `npx prisma generate`

- [x] 1.2b Create terminal_mac_registry table (NEW - Auditoría de acceso por terminal)
  - [x] 1.2b.1 Create migration for terminal_mac_registry
  - [x] 1.2b.2 Add columns: id, terminal_id, mac_address, employee_id, access_count, is_authorized
  - [x] 1.2b.3 Add indexes: (terminal_id, mac_address), (employee_id, terminal_id), (is_authorized)
  - [x] 1.2b.4 Run migration: `npx prisma migrate deploy`
  - [x] 1.2b.5 Regenerate Prisma: `npx prisma generate`

- [x] 1.3 Create MAC detection service (NEW)
  - [x] 1.3.1 Create src/core/security/mac-detector.ts
  - [x] 1.3.2 Implement WebRTC-based MAC detection
  - [x] 1.3.3 Add fallback to Device ID if MAC unavailable
  - [x] 1.3.4 Add MAC validation logic
  - [x] 1.3.5 Add MAC registration logic

- [x] 1.3b Create hybrid MAC validator (HYBRID - Detecta dispositivos + terminales)
  - [x] 1.3b.1 Create src/core/security/mac-validator-hybrid.ts
  - [x] 1.3b.2 Implement validateMAC() - Hybrid check (employee + terminal)
  - [x] 1.3b.3 Implement checkTerminalAuthorization() - Terminal access audit
  - [x] 1.3b.4 Implement registerMAC() - Register with terminal_id (optional)
  - [x] 1.3b.5 Implement blockMAC() - Block device
  - [x] 1.3b.6 Implement getDevicesByEmployee() - List employee's devices
  - [x] 1.3b.7 Implement getTerminalAccessLog() - Audit trail per terminal

- [x] 1.4 Create security validation services (MODIFIED)
  - [x] 1.4.1 Create src/core/security/session-validator.ts ✅
  - [x] 1.4.2 Create src/core/security/mac-validator.ts (REPLACES ip-validator)
  - [x] 1.4.3 Create src/core/security/location-validator.ts ✅
  - [x] 1.4.4 Create src/core/security/rate-limiter.ts ✅
  - [x] 1.4.5 Create src/core/security/alert-service.ts ✅

- [x] 1.5 Update login endpoint (MODIFIED - Hybrid validation)
  - [x] 1.5.1 Update POST /api/auth/login to use HYBRID MAC validation
  - [x] 1.5.2 Add MAC detection (WebRTC)
  - [x] 1.5.3 Add HYBRID MAC validation (employee + terminal)
  - [x] 1.5.4 Add terminal authorization check
  - [x] 1.5.5 Add simultaneous login detection (unchanged)
  - [x] 1.5.6 Create active_sessions record with MAC + terminal_id
  - [x] 1.5.7 Generate session_token
  - [x] 1.5.8 Keep IP logging for auditoría (not validation)
  - [x] 1.5.9 Handle warnings (DIFFERENT_TERMINAL) - Allow with alert

- [x] 1.6 Create new endpoints (MODIFIED - Hybrid support)
  - [x] 1.6.1 POST /api/auth/confirm-device (with terminal_id support)
  - [x] 1.6.2 POST /api/auth/logout
  - [x] 1.6.3 POST /api/auth/validate-session
  - [x] 1.6.4 GET /api/admin/security/devices (list all devices)
  - [x] 1.6.5 POST /api/admin/security/devices/[mac]/block (block device)
  - [x] 1.6.6 GET /api/admin/security/terminals/[id]/access-log (terminal audit)

## Phase 2: Admin Panel (HIGH PRIORITY)

- [x] 2.1 Create admin security dashboard
  - [x] 2.1.1 Create src/app/admin/security/page.tsx
  - [x] 2.1.2 Add active sessions view (show MAC instead of IP)
  - [x] 2.1.3 Add alerts view
  - [x] 2.1.4 Add audit log view

- [x] 2.2 Create session management UI
  - [x] 2.2.1 Create components/admin/SessionsList.tsx
  - [x] 2.2.2 Add session details modal (show MAC address)
  - [x] 2.2.3 Add revoke session button
  - [x] 2.2.4 Add real-time updates (SSE)

- [x] 2.3 Create alerts management UI
  - [x] 2.3.1 Create components/admin/AlertsList.tsx
  - [x] 2.3.2 Add alert details modal
  - [x] 2.3.3 Add mark as resolved button
  - [x] 2.3.4 Add filter by type/date

- [x] 2.4 Create admin endpoints
  - [x] 2.4.1 GET /api/admin/security/sessions
  - [x] 2.4.2 POST /api/admin/security/sessions/[id]/revoke
  - [x] 2.4.3 GET /api/admin/security/alerts
  - [x] 2.4.4 POST /api/admin/security/alerts/[id]/resolve

## Phase 3: Frontend Integration (MEDIUM PRIORITY)

- [x] 3.1 Update TerminalSetup.tsx (MODIFIED)
  - [x] 3.1.1 Detect MAC address (WebRTC)
  - [x] 3.1.2 Send MAC in login request (not IP)
  - [x] 3.1.3 Handle unknown device response
  - [x] 3.1.4 Show confirmation code input for new devices
  - [x] 3.1.5 Handle device confirmation flow

- [x] 3.2 Update page.tsx
  - [x] 3.2.1 Add session validation on app load
  - [x] 3.2.2 Add session timeout logic
  - [x] 3.2.3 Add logout on session expiry
  - [x] 3.2.4 Add session refresh mechanism

- [x] 3.3 Create session management UI
  - [x] 3.3.1 Create components/auth/SessionInfo.tsx
  - [x] 3.3.2 Show current session details (MAC address)
  - [x] 3.3.3 Add logout button
  - [x] 3.3.4 Add session timeout warning

## Phase 4: Rate Limiting (MEDIUM PRIORITY)

- [x] 4.1 Implement rate limiting
  - [x] 4.1.1 Create src/core/security/rate-limiter.ts ✅
  - [x] 4.1.2 Add transaction limit checks
  - [x] 4.1.3 Add price change limit checks
  - [x] 4.1.4 Add refund limit checks

- [x] 4.2 Add rate limit endpoints
  - [x] 4.2.1 GET /api/admin/limits/[employeeId]
  - [x] 4.2.2 PUT /api/admin/limits/[employeeId]
  - [x] 4.2.3 POST /api/admin/limits/[employeeId]/reset

- [x] 4.3 Add rate limit UI
  - [x] 4.3.1 Create components/admin/LimitsManager.tsx
  - [x] 4.3.2 Show current usage
  - [x] 4.3.3 Show limits
  - [x] 4.3.4 Allow admin to adjust limits

## Phase 5: Alerts & Notifications (LOW PRIORITY)

- [x] 5.1 Implement real-time alerts
  - [x] 5.1.1 Create alert service
  - [x] 5.1.2 Send email alerts
  - [x] 5.1.3 Send push notifications
  - [x] 5.1.4 Add to-do list in admin

- [x] 5.2 Create alert rules (MODIFIED)
  - [x] 5.2.1 Simultaneous login alert
  - [x] 5.2.2 Unknown device alert (REPLACES suspicious IP)
  - [x] 5.2.3 Device mismatch alert (NEW)
  - [x] 5.2.4 Rate limit exceeded alert

## Phase 6: Testing & Validation (CRITICAL)

- [x] 6.1 Unit tests
  - [x] 6.1.1 Test MAC detection
  - [x] 6.1.2 Test MAC validation
  - [x] 6.1.3 Test simultaneous login detection
  - [x] 6.1.4 Test rate limiting

- [x] 6.2 Integration tests
  - [x] 6.2.1 Test complete login flow with MAC
  - [x] 6.2.2 Test unknown device flow
  - [x] 6.2.3 Test session management
  - [x] 6.2.4 Test admin endpoints

- [x] 6.3 Security tests
  - [x] 6.3.1 Test hacker scenario (unknown MAC)
  - [x] 6.3.2 Test MAC spoofing (should fail)
  - [x] 6.3.3 Test rate limit bypass
  - [x] 6.3.4 Test session hijacking

- [x] 6.4 E2E tests
  - [x] 6.4.1 Test complete user flow with MAC
  - [x] 6.4.2 Test admin security dashboard
  - [x] 6.4.3 Test alert notifications

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
