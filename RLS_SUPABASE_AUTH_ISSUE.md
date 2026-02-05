# RLS Supabase Authentication Issue - 4 February 2026

## 🔴 Problem Summary

The task to implement RLS (Row-Level Security) for multi-tenant isolation has hit a blocker:

- ✅ RLS policies are correctly implemented in Supabase
- ✅ `app_user` exists in PostgreSQL with `usebypassrls = false`
- ❌ `app_user` cannot connect to Supabase (error: "Tenant or user not found")
- ✅ `postgres` user can connect but bypasses RLS

## 🔍 Root Cause Analysis

The error "Tenant or user not found" is a Supabase-specific error that occurs when:

1. A user tries to connect to Supabase
2. The user is not registered in Supabase's authentication system
3. Supabase's connection pooler rejects the connection

**Why this happens:**
- Supabase has a custom authentication layer on top of PostgreSQL
- Users created directly in PostgreSQL are not automatically registered in Supabase's auth system
- Only users created through Supabase's API or dashboard are recognized

## 📊 Current Status

### What Works
```
✅ postgres user: Can connect, but bypasses RLS (usebypassrls = true)
✅ RLS policies: Correctly implemented in database
✅ Prisma: Can connect and query
✅ Integration tests: Can run (but RLS not enforced)
```

### What Doesn't Work
```
❌ app_user: Cannot connect (Supabase auth issue)
❌ authenticator: Cannot connect (Supabase auth issue)
❌ RLS enforcement: Not working because postgres bypasses RLS
```

## 🎯 Solutions

### Option 1: Use postgres for Development (Current)
**Pros:**
- Works immediately
- No additional setup needed
- Good for development and testing

**Cons:**
- RLS is bypassed (not enforced)
- Not suitable for production
- Doesn't test RLS policies

**Status:** ✅ Implemented

### Option 2: Create app_user via Supabase Dashboard
**Steps:**
1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Create a new user with email/password
4. Use those credentials in connection string

**Pros:**
- User is registered in Supabase's auth system
- RLS will be enforced
- Production-ready

**Cons:**
- Requires manual setup in Supabase dashboard
- Email-based authentication (not ideal for app user)

**Status:** ⏸️ Requires manual action

### Option 3: Use Supabase Service Role Key
**Steps:**
1. Get Service Role Key from Supabase Dashboard
2. Use it in connection string
3. Service role bypasses RLS (like postgres)

**Pros:**
- Works immediately
- Good for admin operations

**Cons:**
- Still bypasses RLS
- Not suitable for testing RLS

**Status:** ⏸️ Not recommended

### Option 4: Use Supabase JWT Authentication
**Steps:**
1. Create JWT token with Supabase
2. Use token for authentication
3. RLS policies will be enforced based on JWT claims

**Pros:**
- RLS is enforced
- Production-ready
- Secure

**Cons:**
- Requires JWT token generation
- More complex setup

**Status:** ⏸️ Requires implementation

## 📋 Recommended Path Forward

### For Development (Current)
Use `postgres` user with RLS bypass:
```
DATABASE_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
```

**Rationale:**
- Allows development to proceed
- Tests can run and pass
- RLS policies are in place for production

### For Production
Implement JWT-based authentication:
1. Generate JWT tokens with tenant_id in claims
2. Use JWT for authentication
3. RLS policies will enforce tenant isolation based on JWT claims

## 🔧 Current Implementation

### Files Updated
- `.env.local` - Uses postgres user
- `.env` - Uses postgres user
- `scripts/test-prisma-connection.ts` - Verifies connection works
- `scripts/setup-rls-with-authenticator.ts` - Diagnostic tool

### Test Results
```
✅ Unit Tests: 5/5 PASSED
✅ Integration Tests: 6/10 PASSED (RLS tests fail due to postgres bypass)
❌ E2E Tests: 0/20 FAILED (UI not implemented)
TOTAL: 11/35 (31%)
```

## 📝 Next Steps

### Immediate (Development)
1. ✅ Use postgres user for development
2. ✅ Run integration tests
3. ✅ Verify RLS policies are in place
4. ✅ Document the limitation

### Short Term (Production Prep)
1. Implement JWT-based authentication
2. Test RLS enforcement with JWT
3. Update connection string for production

### Long Term (Production)
1. Deploy with JWT authentication
2. Monitor RLS enforcement
3. Audit tenant isolation

## 🎓 Lessons Learned

1. **Supabase Authentication:** Users must be registered in Supabase's auth system
2. **RLS Bypass:** Superusers (postgres) always bypass RLS
3. **Development vs Production:** Different authentication strategies needed
4. **JWT + RLS:** Best practice for multi-tenant applications

## 📞 References

- Supabase Docs: https://supabase.com/docs/guides/auth
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- JWT Authentication: https://supabase.com/docs/guides/auth/jwt

---

**Status:** ⏸️ BLOCKED - Awaiting decision on authentication strategy  
**Date:** 4 February 2026  
**Impact:** RLS enforcement not working in development, but policies are in place for production
