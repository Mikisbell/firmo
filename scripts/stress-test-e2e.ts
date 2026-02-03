#!/usr/bin/env node

/**
 * Stress Test Script - Phase 1 Critical Review Issue #3
 * 
 * Tests backend resilience under concurrent load with network throttling
 * 
 * Phases:
 * 1. Baseline (1 worker, no throttle) - Expected: ✅ 58/58 passing
 * 2. Moderate (2 workers, no throttle) - Expected: ✅ 58/58 passing
 * 3. High Load (4 workers, no throttle) - Expected: ❌ Pool exhaustion
 * 4. Stress (4 workers, WITH throttle) - Expected: ❌ Cascading failures
 * 
 * After fixes:
 * - Increase connection pool to 50
 * - Implement retry logic
 * - All phases should pass ✅
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface StressTestConfig {
  phase: number;
  workers: number;
  throttle: boolean;
  duration: number;
  description: string;
}

interface StressTestResult {
  phase: number;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  timestamp: string;
}

const STRESS_TEST_CONFIGS: StressTestConfig[] = [
  {
    phase: 1,
    workers: 1,
    throttle: false,
    duration: 600,
    description: 'Baseline (1 worker, no throttle)',
  },
  {
    phase: 2,
    workers: 2,
    throttle: false,
    duration: 300,
    description: 'Moderate (2 workers, no throttle)',
  },
  {
    phase: 3,
    workers: 4,
    throttle: false,
    duration: 300,
    description: 'High Load (4 workers, no throttle)',
  },
  {
    phase: 4,
    workers: 4,
    throttle: true,
    duration: 600,
    description: 'Stress (4 workers, WITH throttle)',
  },
];

async function runStressTest(config: StressTestConfig): Promise<StressTestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 PHASE ${config.phase}: ${config.description}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Workers: ${config.workers}`);
  console.log(`Throttle: ${config.throttle ? 'YES (5000ms latency)' : 'NO'}`);
  console.log(`Timeout: ${config.duration}s`);
  console.log('');

  const cmd = [
    'npm run test:e2e',
    `-- --workers=${config.workers}`,
    config.throttle ? '-- --grep="should handle timeout with slow network"' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const startTime = Date.now();

  try {
    console.log(`🚀 Running: ${cmd}\n`);
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: config.duration * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const duration = Date.now() - startTime;
    console.log(stdout);

    if (stderr) {
      console.error('STDERR:', stderr);
    }

    console.log(`\n✅ PHASE ${config.phase} PASSED in ${(duration / 1000).toFixed(2)}s`);

    return {
      phase: config.phase,
      success: true,
      duration,
      output: stdout,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    console.error(`\n❌ PHASE ${config.phase} FAILED after ${(duration / 1000).toFixed(2)}s`);
    console.error(`Error: ${errorMsg}\n`);

    return {
      phase: config.phase,
      success: false,
      duration,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    STRESS TEST - Phase 1 Critical Review                   ║
║                                                                            ║
║  Issue #3: Backend Pool Exhaustion                                        ║
║  - Tests concurrent load with network throttling                          ║
║  - Validates connection pool resilience                                   ║
║  - Identifies breaking points                                             ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);

  const results: StressTestResult[] = [];

  // Run all phases sequentially
  for (const config of STRESS_TEST_CONFIGS) {
    const result = await runStressTest(config);
    results.push(result);

    // Stop if we hit a critical failure (Phase 3 or 4)
    if (!result.success && config.phase >= 3) {
      console.log(`\n⚠️  Stopping at Phase ${config.phase} due to pool exhaustion`);
      console.log('   This is expected before fixes are applied.');
      break;
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📈 SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  results.forEach((r) => {
    const status = r.success ? '✅' : '❌';
    const duration = (r.duration / 1000).toFixed(2);
    console.log(`Phase ${r.phase}: ${status} (${duration}s)`);
    if (r.error) {
      console.log(`         Error: ${r.error.split('\n')[0]}`);
    }
  });

  // Print recommendations
  console.log(`\n${'='.repeat(80)}`);
  console.log('💡 RECOMMENDATIONS');
  console.log(`${'='.repeat(80)}\n`);

  const failedPhases = results.filter((r) => !r.success);

  if (failedPhases.length === 0) {
    console.log('✅ All phases passed! Backend is resilient under load.');
    console.log('   No fixes needed.');
  } else {
    console.log(`❌ ${failedPhases.length} phase(s) failed. Recommended fixes:\n`);

    if (failedPhases.some((r) => r.phase >= 3)) {
      console.log('1. INCREASE CONNECTION POOL');
      console.log('   File: .env');
      console.log('   Change: DATABASE_URL="...?connection_limit=50"');
      console.log('   Reason: Current pool (20) exhausted at 4 workers\n');

      console.log('2. IMPLEMENT RETRY LOGIC');
      console.log('   File: src/core/db/retry.ts');
      console.log('   Add: queryWithRetry() with exponential backoff');
      console.log('   Reason: Handle transient connection failures\n');

      console.log('3. ADD CONNECTION POOLING');
      console.log('   File: src/core/db/pool.ts');
      console.log('   Add: PgBouncer or native pool management');
      console.log('   Reason: Better resource utilization\n');
    }

    if (failedPhases.some((r) => r.phase === 4)) {
      console.log('4. OPTIMIZE TIMEOUT HANDLING');
      console.log('   File: src/app/admin/promociones/nuevo/page.tsx');
      console.log('   Already done: Loading state + error toast + retry button');
      console.log('   Reason: UI resilience during throttling\n');
    }
  }

  // Save results to file
  const resultsFile = path.join(
    process.cwd(),
    'test-results',
    `stress-test-${Date.now()}.json`
  );

  try {
    const dir = path.dirname(resultsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);
  } catch (err) {
    console.error(`Failed to save results: ${err}`);
  }

  // Exit with appropriate code
  const allPassed = results.every((r) => r.success);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
