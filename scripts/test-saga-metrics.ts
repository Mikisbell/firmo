/**
 * Manual test script for Saga Metrics
 * 
 * Tests that saga metrics are correctly recorded during:
 * - Successful saga execution
 * - Failed saga with compensation
 * - Saga recovery
 * - Step retries
 */

import { SagaOrchestrator } from '@/src/core/saga/orchestrator';
import { SagaRecoveryService } from '@/src/core/saga/recovery';
import { sagaLogRepository } from '@/src/core/saga/repository';
import { metrics } from '@/src/core/observability/metrics';
import type { SagaDefinition, SagaContext, SagaStep } from '@/src/core/saga/types';

// Helper to print metrics
function printMetrics(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  const metricsData = metrics.getMetricsJSON();
  console.log(JSON.stringify(metricsData, null, 2));
}

// Test 1: Successful saga execution
async function testSuccessfulSaga() {
  console.log('\n🧪 TEST 1: Successful Saga Execution');
  console.log('Expected: saga_started, saga_completed, step_duration metrics');
  
  const orchestrator = new SagaOrchestrator();
  
  const steps: SagaStep<SagaContext>[] = [
    {
      name: 'step1',
      do: async () => ({ result: 'step1 done' }),
      undo: async () => {},
    },
    {
      name: 'step2',
      do: async () => ({ result: 'step2 done' }),
      undo: async () => {},
    },
    {
      name: 'step3',
      do: async () => ({ result: 'step3 done' }),
      undo: async () => {},
    },
  ];
  
  const definition: SagaDefinition<SagaContext> = {
    name: 'test-successful-saga',
    steps,
  };
  
  const context: SagaContext = {
    sagaId: 'test-saga-1',
    tenantId: 'test-tenant',
    startedAt: new Date(),
  };
  
  await orchestrator.execute(definition, context);
  
  printMetrics('📊 Metrics after successful saga');
}

// Test 2: Failed saga with compensation
async function testFailedSagaWithCompensation() {
  console.log('\n🧪 TEST 2: Failed Saga with Compensation');
  console.log('Expected: saga_started, saga_compensated, compensation_duration metrics');
  
  const orchestrator = new SagaOrchestrator();
  
  const steps: SagaStep<SagaContext>[] = [
    {
      name: 'step1',
      do: async () => ({ result: 'step1 done' }),
      undo: async () => { console.log('  ↩️  Compensating step1'); },
    },
    {
      name: 'step2',
      do: async () => ({ result: 'step2 done' }),
      undo: async () => { console.log('  ↩️  Compensating step2'); },
    },
    {
      name: 'step3-fails',
      do: async () => {
        throw new Error('Step 3 intentionally failed');
      },
      undo: async () => {},
    },
  ];
  
  const definition: SagaDefinition<SagaContext> = {
    name: 'test-failed-saga',
    steps,
  };
  
  const context: SagaContext = {
    sagaId: 'test-saga-2',
    tenantId: 'test-tenant',
    startedAt: new Date(),
  };
  
  await orchestrator.execute(definition, context);
  
  printMetrics('📊 Metrics after failed saga with compensation');
}

// Test 3: Saga with retries
async function testSagaWithRetries() {
  console.log('\n🧪 TEST 3: Saga with Step Retries');
  console.log('Expected: saga_step_retries_total metrics');
  
  const orchestrator = new SagaOrchestrator();
  
  let attemptCount = 0;
  
  const steps: SagaStep<SagaContext>[] = [
    {
      name: 'step1',
      do: async () => ({ result: 'step1 done' }),
      undo: async () => {},
    },
    {
      name: 'step2-retries',
      do: async () => {
        attemptCount++;
        console.log(`  🔄 Attempt ${attemptCount} for step2`);
        if (attemptCount < 3) {
          // Simulate transient error (network timeout)
          const error = new Error('Network timeout');
          error.name = 'NetworkError';
          throw error;
        }
        return { result: 'step2 done after retries' };
      },
      undo: async () => {},
      retryable: true,
      maxRetries: 3,
    },
    {
      name: 'step3',
      do: async () => ({ result: 'step3 done' }),
      undo: async () => {},
    },
  ];
  
  const definition: SagaDefinition<SagaContext> = {
    name: 'test-retry-saga',
    steps,
  };
  
  const context: SagaContext = {
    sagaId: 'test-saga-3',
    tenantId: 'test-tenant',
    startedAt: new Date(),
  };
  
  await orchestrator.execute(definition, context);
  
  printMetrics('📊 Metrics after saga with retries');
}

// Test 4: Saga recovery
async function testSagaRecovery() {
  console.log('\n🧪 TEST 4: Saga Recovery');
  console.log('Expected: saga_recovery_attempts_total metrics');
  
  const orchestrator = new SagaOrchestrator();
  
  // First, create an in-progress saga
  const steps: SagaStep<SagaContext>[] = [
    {
      name: 'step1',
      do: async () => ({ result: 'step1 done' }),
      undo: async () => {},
    },
    {
      name: 'step2',
      do: async () => ({ result: 'step2 done' }),
      undo: async () => {},
    },
    {
      name: 'step3',
      do: async () => ({ result: 'step3 done' }),
      undo: async () => {},
    },
  ];
  
  const definition: SagaDefinition<SagaContext> = {
    name: 'test-recovery-saga',
    steps,
  };
  
  const context: SagaContext = {
    sagaId: 'test-saga-4',
    tenantId: 'test-tenant',
    startedAt: new Date(),
  };
  
  // Execute first 2 steps
  console.log('  📝 Creating in-progress saga...');
  await sagaLogRepository.create({
    sagaId: context.sagaId,
    tenantId: context.tenantId,
    sagaName: definition.name,
    context,
  });
  
  await sagaLogRepository.recordStepCompletion(context.sagaId, 'step1', {
    stepName: 'step1',
    status: 'COMPLETED',
    result: { result: 'step1 done' },
    startedAt: new Date(),
    completedAt: new Date(),
    attempts: 1,
  });
  
  await sagaLogRepository.recordStepCompletion(context.sagaId, 'step2', {
    stepName: 'step2',
    status: 'COMPLETED',
    result: { result: 'step2 done' },
    startedAt: new Date(),
    completedAt: new Date(),
    attempts: 1,
  });
  
  // Now recover the saga
  console.log('  🔄 Recovering saga...');
  const recoveryService = new SagaRecoveryService(orchestrator, {
    'test-recovery-saga': definition,
  });
  
  await recoveryService.recoverInProgressSagas('test-tenant');
  
  printMetrics('📊 Metrics after saga recovery');
}

// Test 5: View all metrics summary
async function printMetricsSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📈 FINAL METRICS SUMMARY');
  console.log('='.repeat(60));
  
  const metricsData = metrics.getMetricsJSON();
  
  // Saga metrics
  console.log('\n🎯 Saga Execution Metrics:');
  if (metricsData.saga_started_total) {
    console.log(`  ✅ Sagas Started: ${JSON.stringify(metricsData.saga_started_total.values)}`);
  }
  if (metricsData.saga_completed_total) {
    console.log(`  ✅ Sagas Completed: ${JSON.stringify(metricsData.saga_completed_total.values)}`);
  }
  if (metricsData.saga_compensated_total) {
    console.log(`  ↩️  Sagas Compensated: ${JSON.stringify(metricsData.saga_compensated_total.values)}`);
  }
  if (metricsData.saga_failed_total) {
    console.log(`  ❌ Sagas Failed: ${JSON.stringify(metricsData.saga_failed_total.values)}`);
  }
  
  // Duration metrics
  console.log('\n⏱️  Duration Metrics:');
  if (metricsData.saga_duration_milliseconds) {
    console.log(`  Saga Duration: ${JSON.stringify(metricsData.saga_duration_milliseconds.values)}`);
  }
  if (metricsData.saga_step_duration_milliseconds) {
    console.log(`  Step Duration: ${JSON.stringify(metricsData.saga_step_duration_milliseconds.values)}`);
  }
  if (metricsData.saga_compensation_duration_milliseconds) {
    console.log(`  Compensation Duration: ${JSON.stringify(metricsData.saga_compensation_duration_milliseconds.values)}`);
  }
  
  // Retry metrics
  console.log('\n🔄 Retry Metrics:');
  if (metricsData.saga_step_retries_total) {
    console.log(`  Step Retries: ${JSON.stringify(metricsData.saga_step_retries_total.values)}`);
  }
  
  // Recovery metrics
  console.log('\n🔧 Recovery Metrics:');
  if (metricsData.saga_recovery_attempts_total) {
    console.log(`  Recovery Attempts: ${JSON.stringify(metricsData.saga_recovery_attempts_total.values)}`);
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Saga Metrics Manual Tests\n');
  
  try {
    // Clear metrics before starting
    metrics.clear();
    
    await testSuccessfulSaga();
    await testFailedSagaWithCompensation();
    await testSagaWithRetries();
    await testSagaRecovery();
    
    await printMetricsSummary();
    
    console.log('\n✅ All manual tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
runAllTests().catch(console.error);
