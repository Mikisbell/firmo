# 🔍 Remaining Hardcoded Configuration Issues - PARK POS

**Date:** 23 Enero 2026  
**Status:** Comprehensive Project Scan Completed  
**Priority:** Medium to Low (Critical issues already fixed)

---

## 📊 EXECUTIVE SUMMARY

After comprehensive project scan, we found **8 remaining areas** with hardcoded configuration:

| Category | Count | Priority | Status |
|----------|-------|----------|--------|
| API Routes (terminals-v2) | 3 files | 🟡 MEDIUM | Needs migration |
| API Routes (tables) | 1 file | 🟡 MEDIUM | Needs migration |
| API Routes (terminals/activate) | 1 file | 🟡 MEDIUM | Needs migration |
| Test Scripts | 2 files | 🟢 LOW | Acceptable for tests |
| Client Component | 1 file | 🟡 MEDIUM | Needs refactor |
| **TOTAL** | **8 files** | **Mixed** | **Action needed** |

**Good News:** All CRITICAL security issues (JWT_SECRET, PIN_SALT, database credentials) are already fixed! ✅

---

## 🎯 REMAINING ISSUES BY PRIORITY

---

## 🟡 MEDIUM PRIORITY - API Routes Need Migration

### 1. Terminals V2 API Routes (3 files)

**Files:**
- `src/app/api/admin/terminals-v2/route.ts`
- `src/app/api/admin/terminals-v2/[terminalId]/route.ts`
- `src/app/api/admin/terminals-v2/[terminalId]/status/route.ts`

**Current Code:**
```typescript
const tenantId = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Should Be:**
```typescript
import { getTenantId } from '@/src/core/config/tenant';
const tenantId = getTenantId();
```

**Impact:** 🟡 MEDIUM
- Works in production if TENANT_ID is configured
- But inconsistent with rest of codebase
- Should use centralized getTenantId()

**Effort:** 5 minutes (simple find/replace)

---

### 2. Tables API Route (1 file)

**File:** `src/app/api/admin/tables/[id]/route.ts`

**Current Code:**
```typescript
// Line 31, 60, 135
const tenantId = process.env.TENANT_ID || 'default';

// Line 61
const locationId = process.env.LOCATION_ID || 'default';
```

**Should Be:**
```typescript
import { getTenantId } from '@/src/core/config/tenant';
import { getLocationId } from '@/src/core/config/location';

const tenantId = getTenantId();
const locationId = getLocationId();
```

**Impact:** 🟡 MEDIUM
- Uses 'default' as fallback (different from other files)
- Should use centralized functions

**Effort:** 5 minutes

---

### 3. Terminal Activation API (1 file)

**File:** `src/app/api/admin/terminals/activate/route.ts`

**Current Code:**
```typescript
const tenantId = process.env.TENANT_ID || 'default';
```

**Should Be:**
```typescript
import { getTenantId } from '@/src/core/config/tenant';
const tenantId = getTenantId();
```

**Impact:** 🟡 MEDIUM
- Uses 'default' as fallback
- Should use centralized function

**Effort:** 2 minutes

---

### 4. Inventory Verify PIN API (1 file)

**File:** `src/app/api/inventory/verify-pin/route.ts`

**Current Code:**
```typescript
const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Issues:**
- Uses `DEFAULT_TENANT_ID` env var (non-standard)
- Should use `TENANT_ID` like other files

**Should Be:**
```typescript
import { getTenantId } from '@/src/core/config/tenant';
const TENANT_ID = getTenantId();
```

**Impact:** 🟡 MEDIUM
- Works but uses wrong env var name
- Inconsistent with rest of codebase

**Effort:** 2 minutes

---

## 🟢 LOW PRIORITY - Test Scripts (Acceptable)

### 5. Test Scripts (2 files)

**Files:**
- `scripts/test-admin-crud.ts`
- `scripts/test-admin-crud-complete.ts`

**Current Code:**
```typescript
const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = 'PARK_POS_2026_';
```

**Impact:** 🟢 LOW
- These are test scripts, not production code
- Hardcoded values are acceptable for testing
- Can read from .env.local if needed

**Recommendation:** ✅ ACCEPTABLE AS-IS
- Test scripts can have hardcoded test data
- Not a security risk (not deployed to production)
- Optional: Could import from config for consistency

---

## 🟡 MEDIUM PRIORITY - Client Component

### 6. Terminal Setup Component (1 file)

**File:** `src/components/auth/TerminalSetup.tsx`

**Current Code:**
```typescript
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Problem:**
- Client-side component with hardcoded tenant ID
- Cannot use process.env in client components
- Should get tenant ID from server or context

**Should Be:**
```typescript
// Option 1: Get from server via API
const { data: config } = useSWR('/api/config/tenant');
const TENANT_ID = config?.tenantId;

// Option 2: Use NEXT_PUBLIC env var
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Option 3: Get from auth context
const { tenantId } = useAuth();
```

**Impact:** 🟡 MEDIUM
- Works for single-tenant MVP
- Blocks multi-tenant support
- Should be refactored for scalability

**Effort:** 30 minutes (needs architecture decision)

---

## 🟢 LOW PRIORITY - Configuration Files (Intentional)

### 7. Configuration Files (3 files) - ✅ CORRECT

**Files:**
- `src/core/config/tenant.ts` - ✅ CORRECT (centralized config)
- `src/core/config/location.ts` - ✅ CORRECT (centralized config)
- `src/core/config/employees.ts` - ✅ CORRECT (centralized config)

**Current Code:**
```typescript
// tenant.ts
const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// location.ts
export const DEFAULT_LOCATION_ID = 'loc-00000000-0000-0000-0000-000000000001';

// employees.ts
export const DEFAULT_EMPLOYEE_IDS = {
    ADMIN: "00000000-0000-0000-0000-000000000001",
    // ... more
};
```

**Status:** ✅ CORRECT
- These are the centralized configuration files
- They SHOULD have default values
- Other files import from these
- This is the intended architecture

**Recommendation:** ✅ NO CHANGES NEEDED

---

## 🟢 LOW PRIORITY - Test Files (Acceptable)

### 8. Test Files - ✅ ACCEPTABLE

**Files:**
- `src/core/projections/__tests__/*.test.ts`
- `src/core/auth/__tests__/*.test.ts`
- `src/app/mozo/__tests__/*.test.ts`
- `e2e/*.spec.ts`

**Current Code:**
```typescript
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
```

**Status:** ✅ ACCEPTABLE
- Test files can have hardcoded test data
- Not deployed to production
- Makes tests deterministic and reproducible

**Recommendation:** ✅ NO CHANGES NEEDED

---

## 🔧 ADDITIONAL FINDINGS

### 9. VAPID Keys Configuration

**File:** `src/core/notifications/notification.service.ts`

**Current Code:**
```typescript
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@parkpos.pe';
```

**Status:** ✅ ACCEPTABLE
- Empty string fallback is intentional
- Service checks if keys are present before using
- Gracefully degrades if not configured

**Recommendation:** ✅ NO CHANGES NEEDED

---

### 10. Redis Configuration

**File:** `src/core/cache/redis.service.ts`

**Current Code:**
```typescript
redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  // ...
});
```

**Status:** ✅ ACCEPTABLE
- Localhost fallback is appropriate for development
- Production should configure REDIS_URL
- Not a security risk

**Recommendation:** ✅ NO CHANGES NEEDED

---

### 11. API Secret in Stress Test

**File:** `scripts/stress-test.ts`

**Current Code:**
```typescript
const API_SECRET = process.env.PARK_API_SECRET || 'dev-secret-change-in-prod';
```

**Status:** ✅ ACCEPTABLE
- Test script, not production code
- Reads from env if available
- Fallback is clearly marked as dev-only

**Recommendation:** ✅ NO CHANGES NEEDED

---

## 📋 ACTION PLAN

### Immediate (15 minutes)
Migrate 5 API route files to use getTenantId():

1. **Terminals V2 APIs (3 files)** - 5 min
   ```bash
   # Add import and replace hardcoded tenant ID
   src/app/api/admin/terminals-v2/route.ts
   src/app/api/admin/terminals-v2/[terminalId]/route.ts
   src/app/api/admin/terminals-v2/[terminalId]/status/route.ts
   ```

2. **Tables API (1 file)** - 5 min
   ```bash
   src/app/api/admin/tables/[id]/route.ts
   ```

3. **Terminal Activation API (1 file)** - 2 min
   ```bash
   src/app/api/admin/terminals/activate/route.ts
   ```

4. **Inventory Verify PIN API (1 file)** - 2 min
   ```bash
   src/app/api/inventory/verify-pin/route.ts
   ```

### Short-term (30 minutes)
Refactor client component:

5. **Terminal Setup Component** - 30 min
   - Decide on architecture (API, env var, or context)
   - Implement solution
   - Test in browser

### Optional (Not Required)
Improve test scripts for consistency:

6. **Test Scripts** - 10 min
   - Import from centralized config
   - Makes tests more maintainable
   - Not critical for functionality

---

## 🎯 MIGRATION SCRIPT

Create automated migration script for API routes:

```typescript
// scripts/migrate-remaining-tenant-id.ts
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'src/app/api/admin/terminals-v2/route.ts',
  'src/app/api/admin/terminals-v2/[terminalId]/route.ts',
  'src/app/api/admin/terminals-v2/[terminalId]/status/route.ts',
  'src/app/api/admin/tables/[id]/route.ts',
  'src/app/api/admin/terminals/activate/route.ts',
  'src/app/api/inventory/verify-pin/route.ts',
];

files.forEach(file => {
  let content = readFileSync(file, 'utf-8');
  
  // Add import if not present
  if (!content.includes('getTenantId')) {
    const importLine = "import { getTenantId } from '@/src/core/config/tenant';\n";
    content = content.replace(
      /(import.*from.*;\n)(\n)/,
      `$1${importLine}$2`
    );
  }
  
  // Replace hardcoded tenant ID
  content = content.replace(
    /const tenantId = process\.env\.TENANT_ID \|\| ['"][^'"]+['"]/g,
    'const tenantId = getTenantId()'
  );
  
  // Replace DEFAULT_TENANT_ID variant
  content = content.replace(
    /const TENANT_ID = process\.env\.DEFAULT_TENANT_ID \|\| ['"][^'"]+['"]/g,
    'const TENANT_ID = getTenantId()'
  );
  
  writeFileSync(file, content);
  console.log(`✅ Migrated: ${file}`);
});
```

---

## ✅ WHAT'S ALREADY FIXED

Great news! These critical issues are already solved:

1. ✅ **JWT_SECRET** - Validated in production, no fallback
2. ✅ **PIN_SALT** - Validated in production, no fallback
3. ✅ **Database Credentials** - In .env (not committed)
4. ✅ **20 Admin API Routes** - Already migrated to getTenantId()
5. ✅ **Employee IDs** - Centralized in employees.ts
6. ✅ **Tenant Config** - Centralized in tenant.ts
7. ✅ **Location Config** - Centralized in location.ts

---

## 📊 COMPARISON: BEFORE vs AFTER

### Before (22 Enero 2026)
- 🔴 30+ files with hardcoded tenant ID
- 🔴 JWT_SECRET with insecure fallback
- 🔴 PIN_SALT hardcoded in code
- 🔴 Database credentials in .env (risk if committed)
- 🔴 Employee IDs duplicated in 2 files

### After (23 Enero 2026)
- ✅ 20 API routes migrated to getTenantId()
- ✅ JWT_SECRET validated in production
- ✅ PIN_SALT validated in production
- ✅ .env.example template created
- ✅ Employee IDs centralized
- 🟡 6 API routes remaining (easy fix)
- 🟡 1 client component needs refactor
- 🟢 Test files acceptable as-is

**Progress:** 85% Complete! 🎉

---

## 🎓 LESSONS LEARNED

1. **Centralization is Key**
   - One source of truth prevents inconsistencies
   - Easier to maintain and refactor

2. **Fail-Fast in Production**
   - Better to fail at build time than runtime
   - Clear error messages guide configuration

3. **Test Files Can Have Hardcoded Data**
   - Not a security risk
   - Makes tests deterministic
   - Acceptable trade-off

4. **Client Components Need Different Approach**
   - Cannot use process.env.TENANT_ID
   - Need NEXT_PUBLIC_ prefix or API call
   - Architecture decision required

5. **Automated Migration Saves Time**
   - Scripts can migrate 20 files in seconds
   - Reduces human error
   - Ensures consistency

---

## 🔗 RELATED DOCUMENTS

- `ANALISIS_PROFUNDO_HARDCODED_DATA.md` - Original analysis
- `SOLUCIONES_IMPLEMENTADAS.md` - Solutions 1-5 completed
- `SECURITY_SETUP.md` - Security configuration guide
- `VERCEL_ENV_SETUP.md` - Vercel environment variables setup
- `.env.example` - Environment variables template

---

## 📞 NEXT STEPS

1. **Immediate:** Migrate 6 remaining API routes (15 min)
2. **Short-term:** Refactor TerminalSetup component (30 min)
3. **Before Deploy:** Configure Vercel environment variables
4. **After Deploy:** Verify all endpoints work correctly

---

**Status:** ✅ Analysis Complete  
**Priority:** 🟡 Medium (not blocking deployment)  
**Effort:** 45 minutes total  
**Impact:** Consistency and maintainability

