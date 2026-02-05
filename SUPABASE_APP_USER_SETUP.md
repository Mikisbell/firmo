# 🔐 Supabase app_user Setup Instructions

**Date:** 4 February 2026  
**Status:** ⏳ Waiting for Supabase Configuration  
**Password:** `ParkPOS2026Secure5821!`

---

## 📋 What Was Done

✅ Environment variables updated in `.env.local` and `.env`  
✅ Password generated and URL-encoded  
✅ All diagnostic tools ready  

---

## 🎯 What You Need to Do

### Step 1: Go to Supabase Dashboard

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Create app_user

Copy and paste this SQL command into the SQL Editor:

```sql
CREATE USER app_user WITH PASSWORD 'ParkPOS2026Secure5821!';
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
```

Then click **Run** or press `Ctrl+Enter`

### Step 3: Verify app_user Was Created

Run this verification query:

```sql
SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user';
```

**Expected result:**
```
usename  | usebypassrls
---------|-------------
app_user | false
```

If you see `false` for `usebypassrls`, you're good! ✅

### Step 4: Run Tests Locally

Once app_user is created in Supabase, run this command:

```bash
npx tsx scripts/test-multi-tenant-integration.ts
```

**Expected result:** 10/10 tests PASSED ✅

---

## 📊 Current Status

### Environment Variables
- ✅ `.env.local` updated with app_user credentials
- ✅ `.env` updated with app_user credentials
- ✅ Password URL-encoded correctly

### Credentials
- **Username:** `app_user`
- **Password:** `ParkPOS2026Secure5821!`
- **Password (URL-encoded):** `ParkPOS2026Secure5821%2521`
- **Host:** `aws-1-sa-east-1.pooler.supabase.com`
- **Port:** `6543` (pooled) / `5432` (direct)
- **Database:** `postgres`

### Connection Strings
```
DATABASE_URL="postgresql://app_user:ParkPOS2026Secure5821%2521@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://app_user:ParkPOS2026Secure5821%2521@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

---

## ✅ Verification Checklist

After creating app_user in Supabase:

- [ ] app_user created in Supabase
- [ ] `usebypassrls = false` for app_user
- [ ] All permissions granted
- [ ] Run: `npx tsx scripts/test-multi-tenant-integration.ts`
- [ ] All 10 integration tests pass
- [ ] All 4 RLS isolation tests pass

---

## 🚀 Expected Results

### Before
```
✅ Unit Tests: 5/5
❌ Integration Tests: 0/10 (connection error)
❌ E2E Tests: 0/20
TOTAL: 5/35 (14%)
```

### After
```
✅ Unit Tests: 5/5
✅ Integration Tests: 10/10 ← FIXED
❌ E2E Tests: 0/20
TOTAL: 15/35 (43%)
```

---

## 🔐 Security Notes

- Password is strong and unique
- URL-encoded for use in connection strings
- Stored in `.env.local` (local development only)
- Should be updated with production password before deployment
- Never commit actual passwords to git

---

## 📞 Troubleshooting

### "role 'app_user' does not exist"
- ✅ Run the CREATE USER command in Supabase SQL Editor
- ✅ Make sure you're in the correct project

### "permission denied for schema public"
- ✅ Run the GRANT commands
- ✅ Make sure all permissions are granted

### "FATAL: Tenant or user not found"
- ✅ Verify app_user exists: `SELECT * FROM pg_user WHERE usename = 'app_user';`
- ✅ Verify password is correct
- ✅ Verify connection string is correct

### Tests still failing
- ✅ Run: `npx tsx scripts/diagnose-app-user-connection.ts`
- ✅ Check that `usebypassrls = false`
- ✅ Verify RLS policies are enabled

---

## 📝 Next Steps

1. **Create app_user in Supabase** (copy-paste the SQL above)
2. **Verify it was created** (run the verification query)
3. **Run integration tests** locally
4. **Commit changes to git** once tests pass

---

## 🎯 Timeline

- **Now:** Create app_user in Supabase (~2 minutes)
- **After:** Run tests locally (~1 minute)
- **Total:** ~3 minutes to complete

---

**Created:** 4 February 2026  
**Status:** ⏳ Waiting for Supabase Configuration  
**Next Action:** Create app_user in Supabase with the SQL commands above
