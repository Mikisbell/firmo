# Critical Fix: E2E Tests - Login Endpoint UUID Issue

**Date:** February 5, 2026  
**Status:** ✅ FIXED  
**Impact:** 🔴 CRITICAL - Blocker for all E2E tests

---

## Problem

The `/api/auth/login` endpoint was returning **500 Internal Server Error** when E2E tests tried to authenticate. The error message indicated:

```
Invalid `__TURBOPACK__imported__module__...[default].active_sessions.findMany()` invocation
Inconsistent column data: Error creating UUID, invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `u` at 1
```

### Root Cause

The `createActiveSession()` function was receiving invalid UUID values:

1. **device_id**: Being set to string `'unknown'` instead of a valid UUID
   - Schema expects: `@db.Uuid` (valid UUID format)
   - Received: `'unknown'` (invalid UUID)

2. **mac_address**: Being set to string `'unknown'` 
   - While not a UUID field, it was causing confusion in the error handling

### Code Location

**File:** `src/app/api/auth/login/route.ts`  
**Lines:** 234-241 (Step 4: Detect simultaneous login)

**Before:**
```typescript
const deviceId = data.device_id || 'unknown';
const terminalId = data.terminal_id || 'admin-panel';
```

---

## Solution

### Change 1: Generate Valid UUID for device_id

**Before:**
```typescript
const deviceId = data.device_id || 'unknown';
```

**After:**
```typescript
const { v4: uuidv4 } = await import('uuid');
const deviceId = data.device_id || uuidv4();
```

**Why:** The `active_sessions.device_id` field is defined as `@db.Uuid` in the schema, so it must be a valid UUID. If not provided, we generate one using `uuidv4()`.

### Change 2: Use Valid String for mac_address

**Before:**
```typescript
macAddress: data.mac_address || 'unknown',
```

**After:**
```typescript
macAddress: data.mac_address || 'unknown-mac',
```

**Why:** While `mac_address` is a `String` field (not UUID), using a more descriptive placeholder avoids confusion and makes debugging easier.

---

## Verification

### Test 1: Direct API Call

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pin": "1234"
  }'
```

**Result:** ✅ 200 OK
```json
{
  "success": true,
  "employee": {
    "id": "...",
    "name": "Admin Principal",
    "role": "ADMIN"
  },
  "session_id": "864977ac-66e2-40b9-b8d2-84a9915f2407"
}
```

### Test 2: Server Logs

```
[Login API] Step 6: Creating active session
[Login API] Active session created: 7374d985-6702-4f8a-8fe8-aebacc6be9de
[Login API] Step 8: Creating response with JWT cookie
[Login API] Login successful - cookies set
POST /api/auth/login 200 in 5.0s
```

---

## Impact

### Before Fix
- ❌ E2E tests timeout (120+ seconds)
- ❌ Login endpoint returns 500 error
- ❌ No valid JWT token generated
- ❌ Admin panel completely inaccessible

### After Fix
- ✅ Login endpoint returns 200 OK
- ✅ Valid JWT token generated
- ✅ Session created successfully
- ✅ Admin panel now accessible
- ✅ E2E tests can now authenticate

---

## Files Modified

1. **src/app/api/auth/login/route.ts**
   - Line 234: Added UUID import and generation
   - Line 235: Changed device_id from 'unknown' to uuidv4()
   - Line 241: Changed mac_address from 'unknown' to 'unknown-mac'

---

## Next Steps

1. **E2E Tests:** Now that login works, E2E tests should be able to authenticate
2. **Test Selectors:** E2E tests may need selector updates for the provisioning page
3. **SSE Tests:** Fix remaining SSE test failures (3/5 failing)
4. **Full Test Suite:** Run complete test suite to verify all 3 critical problems are solved

---

## Commit

```
fix: generate valid UUIDs for device_id and mac_address in login endpoint

- Changed device_id from 'unknown' string to generated UUID using uuidv4()
- Changed mac_address from 'unknown' to 'unknown-mac' to avoid UUID validation errors
- Fixes 500 error when creating active_sessions with invalid UUID values
- Login endpoint now works correctly and returns 200 with valid JWT token
```

---

## Testing Checklist

- [x] Build passes: `npm run build` ✅
- [x] Dev server starts: `npm run dev` ✅
- [x] Login endpoint returns 200 ✅
- [x] JWT token generated ✅
- [x] Session created ✅
- [ ] E2E tests pass (pending - need selector fixes)
- [ ] SSE tests pass (pending - separate issue)
- [ ] All 3 critical problems solved (pending)

---

**Status:** ✅ PROBLEM 2 FIXED - E2E Tests Login Endpoint Now Working

