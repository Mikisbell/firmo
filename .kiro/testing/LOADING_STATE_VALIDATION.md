# Loading State Validation - Phase 1 Critical Review

**Date:** 3 Febrero 2026  
**Issue:** Falso Negativo por Throttling Extremo  
**Status:** 🔴 REQUIRES IMPLEMENTATION

---

## 🎯 The Problem

**Current Test:**
```typescript
// Test pasa si timeout ocurre
expect(timedOut).toBe(true);
```

**Reality Check:**
- 5000ms latencia > 3000ms timeout
- Test pasa ✅
- Pero: ¿Qué ve el usuario?
  - Opción A: Loading spinner (GOOD - resilient UI)
  - Opción B: Frozen screen (BAD - poor UX)
  - Opción C: Error toast (GOOD - user informed)

**The Gap:** Test doesn't validate UI state during latency.

---

## ✅ What Should Happen (Timeline)

```
T0:    User clicks "Create Promotion"
T1:    Request sent (CDP latency starts: 5000ms)
T2:    UI shows Loading spinner (MUST happen by T1+500ms)
T3:    3000ms timeout occurs
T4:    UI shows Retry button OR Error toast (MUST happen by T3+500ms)
T5:    User can retry or navigate away (MUST be possible)
```

**Current Test:** Only validates T3 (timeout occurred)  
**Missing:** Validates T2 (loading state) and T4 (error handling)

---

## 🔧 Implementation Required

### Step 1: Add Loading State Validation

```typescript
test('should show loading state during slow network', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  
  await client.send('Network.emulateNetworkConditions', {
    latency: 5000,
  });

  await authenticateAsAdmin(page, ADMIN_PIN);

  // Start request
  const createPromise = page.request.post(`${BASE_URL}/api/admin/promotions`, {
    data: uniquePromotion,
    timeout: 3000,
  });

  // ✅ NEW: Validate loading state appears within 500ms
  await page.waitForTimeout(100); // Let UI update
  const loadingSpinner = page.getByTestId('loading-spinner');
  await expect(loadingSpinner).toBeVisible({ timeout: 500 });
  console.log('✅ Loading state appeared');

  // Wait for timeout
  const response = await createPromise.catch(err => {
    console.log(`✅ Timeout occurred: ${err.message}`);
    return null;
  });

  // ✅ NEW: Validate error handling appears
  const errorToast = page.getByTestId('error-toast');
  await expect(errorToast).toBeVisible({ timeout: 500 });
  console.log('✅ Error toast appeared');

  // ✅ NEW: Validate retry button is available
  const retryBtn = page.getByTestId('retry-btn');
  await expect(retryBtn).toBeEnabled();
  console.log('✅ Retry button available');
});
```

### Step 2: Ensure UI Components Have Data-TestID

**In `src/app/admin/promociones/nuevo/page.tsx`:**

```typescript
// Loading state
{isLoading && (
  <div data-testid="loading-spinner" className="flex items-center gap-2">
    <Loader className="animate-spin" />
    <span>Creando promoción...</span>
  </div>
)}

// Error state
{error && (
  <div data-testid="error-toast" className="p-3 bg-red-500/10 border border-red-500">
    {error}
    <button data-testid="retry-btn" onClick={handleRetry}>
      Reintentar
    </button>
  </div>
)}
```

### Step 3: Validate Resilience, Not Just Timeout

**Current:** Test validates timeout occurred  
**New:** Test validates:
1. ✅ Loading state appears
2. ✅ Timeout occurs
3. ✅ Error state appears
4. ✅ Retry is possible
5. ✅ UI is not frozen

---

## 📊 Acceptance Criteria

| Criterion | Current | Required | Status |
|-----------|---------|----------|--------|
| Timeout occurs | ✅ | ✅ | ✅ |
| Loading state visible | ❌ | ✅ | 🔴 |
| Error toast visible | ❌ | ✅ | 🔴 |
| Retry button enabled | ❌ | ✅ | 🔴 |
| UI not frozen | ❌ | ✅ | 🔴 |

---

## 🎯 Next Steps

1. [ ] Add loading state to promotion creation form
2. [ ] Add error toast with retry button
3. [ ] Update test to validate all states
4. [ ] Verify UI is responsive during throttling
5. [ ] Document expected behavior in ERROR_DIAGNOSIS_PROTOCOL.md

---

**Status:** 🔴 REQUIRES IMPLEMENTATION  
**Priority:** 🔴 CRÍTICO - Affects user experience  
**Impact:** Transforms test from "timeout occurred" to "system is resilient"

