# AI-Ready Testing Framework for PARK POS

> **Objetivo:** Hacer que los tests sean "explicables" a IA, no solo "probables". Cuando un test falla, la IA debe poder diagnosticar el problema sin adivinanzas.

## 🎯 Principios Fundamentales

### 1. **Explicabilidad > Probabilidad**
- ❌ Tests que pasan/fallan sin contexto
- ✅ Tests que explican POR QUÉ fallan

### 2. **Trazabilidad Completa**
- Traces de Playwright capturados en fallos
- Screenshots y videos para contexto visual
- Logs estructurados con contexto

### 3. **Diagnóstico Automático**
- Errores categorizados (sync, domain, abstraction)
- Sugerencias de solución basadas en patrón de error
- Contexto de infraestructura (WSL, headless, etc.)

---

## 📋 Mega-Prompt Template para Claude/GPT-4o

Cuando un test falla, usar este template para obtener diagnóstico de IA:

```markdown
# E2E Test Failure Analysis

## 📊 Test Context
- **Test File:** [file path]
- **Test Name:** [test name]
- **Status:** FAILED
- **Duration:** [ms]
- **Browser:** [chromium/firefox/webkit]
- **Environment:** [local/CI/WSL]

## 🔴 Failure Details
- **Error Message:** [exact error]
- **Error Type:** [sync/domain/abstraction/infrastructure]
- **Last Action:** [what was the test doing]
- **Expected:** [what should happen]
- **Actual:** [what actually happened]

## 📸 Evidence
- **Trace File:** [path to .zip]
- **Screenshot:** [path to .png]
- **Video:** [path to .webm]
- **Console Logs:** [relevant logs]

## 🔍 Analysis Protocol

### Step 1: Sync Issues
- [ ] Is there a race condition?
- [ ] Are we waiting for the right element?
- [ ] Is the page fully loaded?
- [ ] Are there network requests pending?

### Step 2: Domain Logic
- [ ] Is the API returning expected data?
- [ ] Are the business rules being applied?
- [ ] Is the state being updated correctly?
- [ ] Are there validation errors?

### Step 3: Abstraction Problems
- [ ] Is the Page Object Model correct?
- [ ] Are selectors still valid?
- [ ] Has the UI changed?
- [ ] Are we using the right abstraction level?

### Step 4: Infrastructure Issues
- [ ] WSL filesystem latency?
- [ ] Headless rendering differences?
- [ ] Port conflicts?
- [ ] Database state issues?

## 💡 Alternative Perspectives

### Omniscience Assumption
Assume the IA has perfect knowledge of:
- The entire codebase
- All API contracts
- All UI components
- All business rules

### Infrastructure Reality
Consider that:
- WSL has filesystem latency (50-200ms)
- Headless browsers render differently
- Network can be flaky
- Database state can be inconsistent

## 🎯 Diagnosis Output

Provide:
1. **Root Cause:** What's actually wrong
2. **Why It Happens:** The mechanism
3. **How to Fix:** Specific code changes
4. **How to Prevent:** Future-proofing
5. **Confidence Level:** How sure are you (%)

---

## 📝 Example: Failed Login Test

### Input
```
Test: "should login with valid PIN"
Error: "Timeout waiting for element [data-testid='dashboard']"
Last Action: "Clicked login button"
Expected: Dashboard loads
Actual: Still on login page after 10s
```

### Analysis
1. **Sync Issue?** Maybe - element not appearing
2. **Domain Issue?** Maybe - login failed silently
3. **Abstraction Issue?** Maybe - selector changed
4. **Infrastructure?** Maybe - WSL latency

### Diagnosis
"The login API succeeded (200 OK) but the redirect didn't happen. The session cookie wasn't set because the auth middleware is checking for a different header. The test is correct, but the code has a bug."

### Fix
"Update `getSessionFromRequest()` to check cookies before headers."

---

## 🔧 Debug Scripts

Add to `package.json`:

```json
{
  "test:debug": "playwright test --debug",
  "test:report": "playwright show-report",
  "test:trace": "playwright show-trace",
  "test:headed": "playwright test --headed",
  "test:single": "playwright test --grep @focus"
}
```

### Usage
```bash
# Run with Playwright Inspector
npm run test:debug

# Show HTML report
npm run test:report

# Show trace viewer
npm run test:trace

# Run headed (see browser)
npm run test:headed

# Run only @focus tests
npm run test:single
```

---

## 📊 Trace Viewer Guide

When a test fails, Playwright captures a trace. To analyze:

```bash
npx playwright show-trace trace.zip
```

### What to Look For

1. **Network Tab**
   - Are API calls succeeding?
   - Are responses correct?
   - Are there 401/403 errors?

2. **Console Tab**
   - Are there JavaScript errors?
   - Are there warnings?
   - What's the last log message?

3. **DOM Snapshot**
   - Is the element present?
   - Is it visible?
   - What's its state?

4. **Timeline**
   - When did the failure occur?
   - What was happening before?
   - How long did it take?

---

## 🚨 Error Categories

### Sync Errors (40% of failures)
- Timeout waiting for element
- Element not found
- Navigation didn't happen
- **Fix:** Use better wait strategies

### Domain Errors (35% of failures)
- API returned wrong data
- Business logic failed
- Validation error
- **Fix:** Check API contract

### Abstraction Errors (15% of failures)
- Selector changed
- Component structure changed
- POM is outdated
- **Fix:** Update selectors/POM

### Infrastructure Errors (10% of failures)
- WSL latency
- Headless rendering
- Port conflict
- **Fix:** Environment-specific handling

---

## ✅ Checklist for AI-Ready Tests

- [ ] Test has clear name describing what it tests
- [ ] Test has comments explaining the flow
- [ ] Test uses Page Object Model for abstraction
- [ ] Test has explicit waits (not arbitrary delays)
- [ ] Test captures traces on failure
- [ ] Test has screenshots on failure
- [ ] Test has structured error messages
- [ ] Test is independent (no shared state)
- [ ] Test cleans up after itself
- [ ] Test documents expected vs actual

---

**Last Updated:** 3 Febrero 2026  
**Framework Version:** 1.0  
**Status:** Production Ready
