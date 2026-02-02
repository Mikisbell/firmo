# Next Steps: Phase 1 Remaining Tasks

**Status:** Phase 1 is 85% complete. Only 2 endpoints remain.

---

## Remaining Phase 1 Tasks (1-2 hours)

### Task 1.6.2: Create Logout Endpoint

**File:** `src/app/api/auth/logout/route.ts`

**Endpoint:** `POST /api/auth/logout`

**Request:**
```json
{
  "sessionToken": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

**Implementation:**
1. Receive sessionToken
2. Find active session
3. Update session: `is_active = false`, `ended_at = NOW()`
4. Clear httpOnly cookie
5. Return success

**Code Template:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionToken } = body;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'sessionToken requerido' },
      { status: 400 }
    );
  }

  // Close session
  await closeSession(sessionToken, 'User logout');

  // Clear cookie
  const response = NextResponse.json({
    success: true,
    message: 'Sesión cerrada exitosamente',
  });

  response.cookies.delete('auth_token');
  return response;
}
```

---

### Task 1.6.3: Create Session Validation Endpoint

**File:** `src/app/api/auth/validate-session/route.ts`

**Endpoint:** `POST /api/auth/validate-session`

**Request:**
```json
{
  "sessionToken": "uuid"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "session": {
    "id": "uuid",
    "employeeId": "uuid",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "startedAt": "2026-02-02T10:00:00Z",
    "lastActivityAt": "2026-02-02T10:05:00Z"
  }
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "reason": "Session expired or invalid"
}
```

**Implementation:**
1. Receive sessionToken
2. Call `validateSession(sessionToken)`
3. If valid: return session details
4. If invalid: return error
5. Update `last_activity_at` on each call

**Code Template:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionToken } = body;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'sessionToken requerido' },
      { status: 400 }
    );
  }

  const { valid, session } = await validateSession(sessionToken);

  if (!valid) {
    return NextResponse.json(
      { valid: false, reason: 'Session expired or invalid' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    valid: true,
    session: {
      id: session.id,
      employeeId: session.employee_id,
      macAddress: session.mac_address,
      startedAt: session.started_at,
      lastActivityAt: session.last_activity_at,
    },
  });
}
```

---

## Testing Phase 1

After completing the 2 endpoints, run these tests:

### 1. TypeScript Validation
```bash
npx tsc --noEmit
```

### 2. Build
```bash
npm run build
```

### 3. Dev Server
```bash
npm run dev
```

### 4. Manual Testing

**Test 1: Login with MAC Detection**
```bash
curl -X POST http://localhost:3000/api/auth/login-secure \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "1234",
    "deviceId": "device-123",
    "location": { "lat": -12.0, "lng": -77.0 }
  }'
```

**Expected Response:**
- If MAC is known: `{ success: true, sessionToken: "...", sessionId: "..." }`
- If MAC is unknown: `{ error: "UNKNOWN_DEVICE", requiresConfirmation: true, confirmationCode: "..." }`

**Test 2: Confirm Device**
```bash
curl -X POST http://localhost:3000/api/auth/confirm-device \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "...",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "confirmationCode": "ABC123"
  }'
```

**Expected Response:**
- `{ success: true, sessionToken: "...", sessionId: "..." }`

**Test 3: Validate Session**
```bash
curl -X POST http://localhost:3000/api/auth/validate-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "..."
  }'
```

**Expected Response:**
- `{ valid: true, session: { ... } }`

**Test 4: Logout**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "..."
  }'
```

**Expected Response:**
- `{ success: true, message: "Sesión cerrada exitosamente" }`

---

## Phase 2: Admin Panel (Next Priority)

Once Phase 1 is complete, move to Phase 2:

1. **Create admin security dashboard** - `/admin/security`
2. **Add active sessions view** - Show MAC addresses
3. **Add alerts view** - Show security alerts
4. **Add audit log view** - Show all access logs
5. **Create session management UI** - Revoke sessions
6. **Create alerts management UI** - Mark as resolved

---

## Estimated Time

- **Logout endpoint:** 15 minutes
- **Validate session endpoint:** 15 minutes
- **Testing:** 30 minutes
- **Total:** ~1 hour

**Phase 1 Total Time:** ~3 hours (including previous work)

---

## Success Criteria for Phase 1

✅ All endpoints working:
- `POST /api/auth/login-secure` - MAC detection
- `POST /api/auth/confirm-device` - Device confirmation
- `POST /api/auth/logout` - Session logout
- `POST /api/auth/validate-session` - Session validation

✅ All TypeScript errors resolved

✅ Build passes without errors

✅ Dev server starts without errors

✅ Manual testing passes

---

## Commands to Run

```bash
# 1. Create logout endpoint
# Create file: src/app/api/auth/logout/route.ts

# 2. Create validate-session endpoint
# Create file: src/app/api/auth/validate-session/route.ts

# 3. Validate TypeScript
npx tsc --noEmit

# 4. Build
npm run build

# 5. Start dev server
npm run dev

# 6. Test endpoints (in another terminal)
# Use curl commands above
```

---

**Ready to proceed?** Create the 2 remaining endpoints and we'll move to Phase 2!
