# Stress Test Strategy - CDP Throttling + Concurrent Workers

**Date:** 3 Febrero 2026  
**Issue:** Can backend handle 58 tests simultaneously with throttling?  
**Status:** 🔴 REQUIRES IMPLEMENTATION

---

## 🎯 The Challenge

**Current Setup:**
- 58 E2E tests
- Sequential execution (1 worker)
- No throttling
- Backend connection pool: 20 connections

**Stress Scenario:**
- 4 workers (parallel)
- CDP throttling (5000ms latency)
- 58 tests × 4 workers = 232 concurrent requests
- Connection pool: 20 connections
- **Result:** 🔴 POOL EXHAUSTION

---

## 📊 Connection Pool Analysis

### Current Configuration

```typescript
// .env
DATABASE_URL="postgresql://...?connection_limit=20"
DIRECT_URL="postgresql://...?connection_limit=20"
```

**With 4 workers + throttling:**
```
Worker 1: 15 tests × 2 requests/test = 30 requests
Worker 2: 15 tests × 2 requests/test = 30 requests
Worker 3: 14 tests × 2 requests/test = 28 requests
Worker 4: 14 tests × 2 requests/test = 28 requests
─────────────────────────────────────────────────
Total: 116 concurrent requests
Pool: 20 connections
Ratio: 116/20 = 5.8x OVERSUBSCRIBED
```

**Expected Failures:**
- ❌ "ECONNREFUSED" errors
- ❌ "Connection timeout" errors
- ❌ "Pool exhaustion" errors
- ❌ Cascading failures

---

## ✅ Solution: Progressive Stress Testing

### Phase 1: Baseline (Current)

```bash
npm run test:e2e -- --workers=1
# Expected: 58/58 passing
# Duration: ~5 minutes
# Pool usage: 1-2 connections
```

### Phase 2: Moderate Load (2 workers)

```bash
npm run test:e2e -- --workers=2
# Expected: 58/58 passing
# Duration: ~3 minutes
# Pool usage: 4-6 connections
```

### Phase 3: High Load (4 workers)

```bash
npm run test:e2e -- --workers=4
# Expected: Some failures (pool exhaustion)
# Duration: ~2 minutes
# Pool usage: 20+ connections (EXHAUSTED)
```

### Phase 4: Stress with Throttling (4 workers + CDP)

```bash
npm run test:e2e -- --workers=4 --throttle
# Expected: Cascading failures
# Duration: ~5 minutes (due to throttling)
# Pool usage: 20+ connections (EXHAUSTED)
```

---

## 🔧 Implementation: Stress Test Script

```typescript
// scripts/stress-test-e2e.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface StressTestConfig {
  workers: number;
  throttle: boolean;
  duration: number;
}

async function runStressTest(config: StressTestConfig) {
  console.log(`🔥 Starting stress test: ${config.workers} workers, throttle=${config.throttle}`);
  
  const cmd = [
    'npm run test:e2e',
    `--workers=${config.workers}`,
    config.throttle ? '--throttle' : '',
  ].filter(Boolean).join(' ');

  const startTime = Date.now();
  
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: config.duration * 1000,
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Completed in ${duration}ms`);
    console.log(stdout);
    
    return { success: true, duration, output: stdout };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Failed after ${duration}ms`);
    console.error(error);
    
    return { success: false, duration, error: String(error) };
  }
}

async function main() {
  const results = [];
  
  // Phase 1: Baseline
  console.log('\n📊 PHASE 1: Baseline (1 worker, no throttle)');
  results.push(await runStressTest({ workers: 1, throttle: false, duration: 600 }));
  
  // Phase 2: Moderate
  console.log('\n📊 PHASE 2: Moderate (2 workers, no throttle)');
  results.push(await runStressTest({ workers: 2, throttle: false, duration: 300 }));
  
  // Phase 3: High
  console.log('\n📊 PHASE 3: High (4 workers, no throttle)');
  results.push(await runStressTest({ workers: 4, throttle: false, duration: 300 }));
  
  // Phase 4: Stress
  console.log('\n📊 PHASE 4: Stress (4 workers, WITH throttle)');
  results.push(await runStressTest({ workers: 4, throttle: true, duration: 600 }));
  
  // Summary
  console.log('\n📈 SUMMARY');
  results.forEach((r, i) => {
    console.log(`Phase ${i + 1}: ${r.success ? '✅' : '❌'} (${r.duration}ms)`);
  });
}

main().catch(console.error);
```

---

## 📋 Expected Results & Fixes

### Current (Without Fixes)
```
Phase 1: ✅ (300s)
Phase 2: ✅ (150s)
Phase 3: ❌ (120s) - Pool exhaustion
Phase 4: ❌ (300s) - Cascading failures
```

### After Fixes

**Fix 1: Increase Connection Pool**
```typescript
// .env
DATABASE_URL="postgresql://...?connection_limit=50"
```

**Fix 2: Implement Connection Pooling**
```typescript
// src/core/db/pool.ts
import { Pool } from 'pg';

const pool = new Pool({
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Fix 3: Add Retry Logic**
```typescript
// src/core/db/retry.ts
async function queryWithRetry(query, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pool.query(query, params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
}
```

### After Fixes
```
Phase 1: ✅ (300s)
Phase 2: ✅ (150s)
Phase 3: ✅ (120s) - Pool handles load
Phase 4: ✅ (300s) - Resilient under throttling
```

---

## 🎯 Acceptance Criteria

| Phase | Workers | Throttle | Expected | Status |
|-------|---------|----------|----------|--------|
| 1 | 1 | No | ✅ 58/58 | ✅ |
| 2 | 2 | No | ✅ 58/58 | 🔴 |
| 3 | 4 | No | ✅ 58/58 | 🔴 |
| 4 | 4 | Yes | ✅ 58/58 | 🔴 |

---

## 📋 Implementation Checklist

- [ ] Create stress-test-e2e.ts script
- [ ] Run Phase 1 baseline
- [ ] Run Phase 2 moderate
- [ ] Identify pool exhaustion point
- [ ] Increase connection pool to 50
- [ ] Implement retry logic
- [ ] Run Phase 3 high load
- [ ] Run Phase 4 stress with throttling
- [ ] Document results
- [ ] Update MASTER.md with findings

---

**Status:** 🔴 REQUIRES IMPLEMENTATION  
**Priority:** 🔴 CRÍTICO - Affects production readiness  
**Impact:** Ensures backend can handle real-world concurrent load

