# 🔒 Security Setup Guide - PARK POS

**CRITICAL:** Follow these steps BEFORE deploying to production.

---

## ⚠️ IMMEDIATE ACTIONS REQUIRED

### 1. Rotate Database Credentials (5 minutes)

**Current Status:** 🔴 Database credentials are exposed in `.env`

**Action:**
1. Go to Supabase Dashboard → Settings → Database
2. Click "Reset database password"
3. Copy the new password
4. Update in Vercel/hosting environment variables
5. **DO NOT** commit the new password to Git

---

### 2. Generate JWT Secret (2 minutes)

**Current Status:** 🔴 JWT_SECRET has insecure fallback

**Action:**
```bash
# Generate a strong secret (32+ characters)
openssl rand -base64 32
```

**Configure in Vercel:**
```
JWT_SECRET=<generated-secret-here>
```

**Validation:** The app will now throw an error if JWT_SECRET is not configured in production.

---

### 3. Generate PIN Salt (2 minutes)

**Current Status:** 🔴 PIN_SALT is hardcoded

**Action:**
```bash
# Generate a strong salt (32+ characters)
openssl rand -base64 32
```

**Configure in Vercel:**
```
PIN_SALT=<generated-salt-here>
```

**Validation:** The app will now throw an error if PIN_SALT is not configured in production.

---

### 4. Regenerate VAPID Keys (3 minutes)

**Current Status:** 🟡 VAPID keys are exposed in `.env`

**Action:**
```bash
# Install web-push if not already installed
npm install -g web-push

# Generate new keys
npx web-push generate-vapid-keys
```

**Configure in Vercel:**
```
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@parkpos.pe
```

---

### 5. Configure Tenant ID (1 minute)

**Current Status:** 🟡 Using hardcoded tenant ID

**Action:**
```
TENANT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Note:** For MVP, you can use the default. For multi-tenant, generate unique UUIDs per tenant.

---

## 📋 Vercel Environment Variables Checklist

Configure these in Vercel Dashboard → Settings → Environment Variables:

### Required (Production will fail without these):
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `DIRECT_URL` - PostgreSQL direct connection (same as DATABASE_URL for Supabase)
- [ ] `JWT_SECRET` - Strong random secret (32+ chars)
- [ ] `PIN_SALT` - Strong random salt (32+ chars)
- [ ] `TENANT_ID` - Your tenant UUID
- [ ] `LOCATION_ID` - Your location UUID

### Recommended:
- [ ] `PARK_API_SECRET` - API secret for admin endpoints
- [ ] `VAPID_PUBLIC_KEY` - Web push public key
- [ ] `VAPID_PRIVATE_KEY` - Web push private key
- [ ] `VAPID_SUBJECT` - mailto:your-email@domain.com
- [ ] `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

### Optional:
- [ ] `REDIS_URL` - Redis connection string (for caching)
- [ ] `ADMIN_API_KEY` - Admin API key (for cleanup endpoints)

---

## 🔍 Verify Git History

**CRITICAL:** Check if `.env` was ever committed to Git:

```bash
# Search Git history for .env
git log --all --full-history -- .env

# If found, credentials are compromised
# You MUST rotate all credentials immediately
```

**If `.env` was committed:**
1. Rotate ALL credentials (database, JWT, SALT, VAPID)
2. Consider using tools like `git-filter-repo` to remove from history
3. Force push to remote (⚠️ coordinate with team)

---

## ✅ Security Validation

After configuration, verify:

```bash
# 1. Check that .env is in .gitignore
cat .gitignore | grep .env

# 2. Verify no secrets in Git
git grep -i "password\|secret\|salt" -- '*.ts' '*.tsx' '*.js'

# 3. Test production build locally
NODE_ENV=production npm run build
# Should fail if JWT_SECRET or PIN_SALT not configured
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All Vercel environment variables configured
- [ ] Database credentials rotated
- [ ] JWT_SECRET generated and configured
- [ ] PIN_SALT generated and configured
- [ ] VAPID keys regenerated
- [ ] `.env` never committed to Git (verified)
- [ ] Production build passes locally
- [ ] Security validation tests pass

---

## 📚 Additional Security Measures

### Recommended for Production:

1. **Enable Supabase Row Level Security (RLS)**
   - Isolate tenant data at database level
   - See: `.kiro/specs/multi-tenant-improvements/`

2. **Configure Rate Limiting**
   - Already implemented in code
   - Configure Redis for distributed rate limiting

3. **Enable HTTPS Only**
   - Configure in Vercel (automatic)
   - Set secure cookie flags

4. **Monitor Security Logs**
   - Review audit logs regularly
   - Set up alerts for suspicious activity

5. **Backup Strategy**
   - Enable Supabase automatic backups
   - Test restore procedures

---

## 🆘 Emergency Contacts

If credentials are compromised:

1. **Immediately** rotate all credentials
2. Review audit logs for unauthorized access
3. Notify affected users if data breach occurred
4. Document incident for compliance

---

**Last Updated:** 22 Enero 2026  
**Status:** Security fixes implemented, awaiting production deployment  
**Next Review:** Before production deployment
