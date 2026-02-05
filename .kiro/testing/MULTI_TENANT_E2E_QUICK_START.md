# Multi-Tenant E2E Tests - Quick Start Guide

**File:** `e2e/multi-tenant-rls-isolation.spec.ts`  
**Tests:** 20 E2E tests for RLS isolation  
**Status:** ✅ Ready to execute

---

## Quick Commands

### 1. Start Development Server
```bash
npm run dev
```

### 2. Run All Multi-Tenant E2E Tests
```bash
npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts
```

### 3. Run Specific Test
```bash
npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts -g "cannot see"
```

### 4. Run with Headed Browser (see what's happening)
```bash
npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts --headed
```

### 5. Run with Debug Mode
```bash
npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts --debug
```

---

## Test Categories

### Data Isolation (3 tests)
- Employees isolation
- Products isolation
- Orders isolation

### Direct URL Access (2 tests)
- Employee direct URL
- Product direct URL

### API Modifications (3 tests)
- Edit employee
- Delete product
- Create for other tenant

### Analytics & Audit (2 tests)
- Analytics data
- Audit logs

### Configuration (2 tests)
- Settings visibility
- Configuration modification

### Cross-Tenant API (1 test)
- API call blocking

### Tenant Switching (1 test)
- Data clearing on switch

### Data Operations (4 tests)
- Bulk import
- Export
- Restore
- Quotas

---

## Prerequisites

### 1. Two Test Tenants
```
Tenant 1:
- PIN: 1111
- Name: Pollería Test 1

Tenant 2:
- PIN: 2222
- Name: Pollería Test 2
```

### 2. Test Data
Each tenant needs:
- ✅ At least 1 employee
- ✅ At least 1 product
- ✅ At least 1 order
- ✅ Audit log entries

### 3. Running Services
- ✅ Development server running (`npm run dev`)
- ✅ Database connected
- ✅ Redis running (if needed)

---

## Expected Results

### Success
```
✅ 20 tests passed
✅ No cross-tenant data leakage
✅ All API calls properly scoped
✅ Tenant switching works correctly
```

### Failure
```
❌ Tests fail → RLS not enforced
❌ Data visible → Tenant context not set
❌ API succeeds → Validation missing
```

---

## Troubleshooting

### "Cannot find element"
- Check test data is seeded
- Verify data-testid attributes exist
- Ensure elements are visible

### "Cross-tenant access not blocked"
- Verify RLS policies enabled
- Check tenant_id in JWT
- Verify middleware sets session variables

### "Authentication fails"
- Verify PIN is correct (1111/2222)
- Check /api/auth/login works
- Ensure auth_token cookie set

---

## Test Execution Flow

```
1. Authenticate as Tenant 1
   ↓
2. Navigate to resource page
   ↓
3. Get Tenant 1 data
   ↓
4. Logout
   ↓
5. Authenticate as Tenant 2
   ↓
6. Navigate to same resource page
   ↓
7. Get Tenant 2 data
   ↓
8. Verify Tenant 2 cannot see Tenant 1 data
   ↓
9. ✅ Test passes
```

---

## Integration with Other Tests

```
Unit Tests (5/5)
    ↓
Integration Tests (10/10)
    ↓
E2E Tests (20 NEW) ← You are here
    ↓
Total Coverage: 35 tests
```

---

## Next Steps

1. **Provision Tenants**
   ```bash
   # Use provisioning API or UI
   POST /api/admin/tenants/provision
   ```

2. **Seed Test Data**
   ```bash
   # Create employees, products, orders
   npm run seed
   ```

3. **Run Tests**
   ```bash
   npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts
   ```

4. **Review Results**
   - Check test output
   - Fix any failures
   - Verify all 20 tests pass

---

## Performance Expectations

| Metric | Value |
|--------|-------|
| Total Duration | 5-10 minutes |
| Per Test | 15-30 seconds |
| Parallel Tests | 4 (default) |
| Timeout | 30 seconds per test |

---

## Documentation

- Full Details: `E2E_TESTS_MULTI_TENANT_RLS_ISOLATION.md`
- Test File: `e2e/multi-tenant-rls-isolation.spec.ts`
- Utilities: `e2e/helpers/test-utils.ts`

---

**Created:** 4 February 2026  
**Status:** ✅ Ready to execute  
**Next:** Run tests and verify RLS isolation

