/**
 * Simplified manual test for Saga Metrics
 * 
 * Tests metrics recording without database dependencies
 */

import { metrics, metricsHelpers } from '@/src/core/observability/metrics';

// Helper to print metrics
function printMetrics(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  const metricsData = metrics.getMetricsJSON();
  
  // Pretty print each metric
  for (const [metricName, metricData] of Object.entries(metricsData)) {
    console.log(`\n📊 ${metricName}:`);
    console.log(`   Type: ${metricData.type}`);
    console.log(`   Values:`);
    metricData.values.forEach((v: any) => {
      const labels = Object.entries(v.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      console.log(`     - ${v.value} {${labels}}`);
    });
  }
}

// Test 1: Record saga lifecycle metrics
function testSagaLifecycleMetrics() {
  console.log('\n🧪 TEST 1: Saga Lifecycle Metrics');
  console.log('Recording: started → completed');
  
  const sagaType = 'test-complete-sale';
  const tenantId = 'tenant-123';
  
  // Record saga started
  metricsHelpers.recordSagaStarted(sagaType, tenantId);
  console.log('  ✅ Recorded saga started');
  
  // Simulate some execution time
  const duration = 1500; // 1.5 seconds
  
  // Record saga completed
  metricsHelpers.recordSagaCompleted(sagaType, tenantId, duration);
  console.log('  ✅ Recorded saga completed (1500ms)');
  
  printMetrics('📈 Metrics after successful saga');
}

// Test 2: Record failed saga with compensation
function testFailedSagaMetrics() {
  console.log('\n🧪 TEST 2: Failed Saga with Compensation');
  console.log('Recording: started → compensated');
  
  const sagaType = 'test-void-sale';
  const tenantId = 'tenant-123';
  
  // Record saga started
  metricsHelpers.recordSagaStarted(sagaType, tenantId);
  console.log('  ✅ Recorded saga started');
  
  // Simulate execution and compensation
  const duration = 2000; // 2 seconds
  const compensationDuration = 500; // 0.5 seconds
  
  // Record saga compensated
  metricsHelpers.recordSagaCompensated(sagaType, tenantId, duration, compensationDuration);
  console.log('  ✅ Recorded saga compensated (2000ms total, 500ms compensation)');
  
  printMetrics('📈 Metrics after compensated saga');
}

// Test 3: Record step metrics
function testStepMetrics() {
  console.log('\n🧪 TEST 3: Step Duration Metrics');
  console.log('Recording: step durations');
  
  const sagaType = 'test-apply-promotion';
  const tenantId = 'tenant-123';
  
  // Record saga started
  metricsHelpers.recordSagaStarted(sagaType, tenantId);
  
  // Record step durations
  metricsHelpers.recordSagaStepDuration(sagaType, 'validate_eligibility', tenantId, 100, 'completed');
  console.log('  ✅ Recorded step: validate_eligibility (100ms, completed)');
  
  metricsHelpers.recordSagaStepDuration(sagaType, 'reserve_promotion', tenantId, 50, 'completed');
  console.log('  ✅ Recorded step: reserve_promotion (50ms, completed)');
  
  metricsHelpers.recordSagaStepDuration(sagaType, 'apply_discount', tenantId, 75, 'completed');
  console.log('  ✅ Recorded step: apply_discount (75ms, completed)');
  
  // Record saga completed
  metricsHelpers.recordSagaCompleted(sagaType, tenantId, 225);
  
  printMetrics('📈 Metrics after step tracking');
}

// Test 4: Record retry metrics
function testRetryMetrics() {
  console.log('\n🧪 TEST 4: Step Retry Metrics');
  console.log('Recording: step retries');
  
  const sagaType = 'test-complete-sale';
  const tenantId = 'tenant-123';
  
  // Record saga started
  metricsHelpers.recordSagaStarted(sagaType, tenantId);
  
  // Record retries for a step
  metricsHelpers.recordSagaStepRetry(sagaType, 'validate_payment', tenantId, 'NetworkError');
  console.log('  🔄 Recorded retry: validate_payment (NetworkError)');
  
  metricsHelpers.recordSagaStepRetry(sagaType, 'validate_payment', tenantId, 'NetworkError');
  console.log('  🔄 Recorded retry: validate_payment (NetworkError)');
  
  // Eventually succeeds
  metricsHelpers.recordSagaStepDuration(sagaType, 'validate_payment', tenantId, 300, 'completed');
  console.log('  ✅ Recorded step: validate_payment (300ms, completed after retries)');
  
  metricsHelpers.recordSagaCompleted(sagaType, tenantId, 300);
  
  printMetrics('📈 Metrics after retry tracking');
}

// Test 5: Record recovery metrics
function testRecoveryMetrics() {
  console.log('\n🧪 TEST 5: Recovery Metrics');
  console.log('Recording: recovery attempts');
  
  const sagaType = 'test-complete-sale';
  const tenantId = 'tenant-123';
  
  // Record successful recovery
  metricsHelpers.recordSagaRecoveryAttempt(sagaType, tenantId, true);
  console.log('  ✅ Recorded recovery: success');
  
  // Record failed recovery
  metricsHelpers.recordSagaRecoveryAttempt(sagaType, tenantId, false);
  console.log('  ❌ Recorded recovery: failure');
  
  // Record another successful recovery
  metricsHelpers.recordSagaRecoveryAttempt(sagaType, tenantId, true);
  console.log('  ✅ Recorded recovery: success');
  
  printMetrics('📈 Metrics after recovery tracking');
}

// Test 6: Record failed saga
function testFailedSagaMetrics2() {
  console.log('\n🧪 TEST 6: Failed Saga Metrics');
  console.log('Recording: started → failed');
  
  const sagaType = 'test-void-sale';
  const tenantId = 'tenant-456';
  
  // Record saga started
  metricsHelpers.recordSagaStarted(sagaType, tenantId);
  console.log('  ✅ Recorded saga started');
  
  // Simulate failure
  const duration = 800;
  const failureReason = 'ValidationError';
  
  // Record saga failed
  metricsHelpers.recordSagaFailed(sagaType, tenantId, duration, failureReason);
  console.log('  ❌ Recorded saga failed (800ms, ValidationError)');
  
  printMetrics('📈 Metrics after failed saga');
}

// Test 7: Multiple tenants
function testMultiTenantMetrics() {
  console.log('\n🧪 TEST 7: Multi-Tenant Metrics');
  console.log('Recording: metrics for multiple tenants');
  
  const sagaType = 'test-complete-sale';
  
  // Tenant 1
  metricsHelpers.recordSagaStarted(sagaType, 'tenant-001');
  metricsHelpers.recordSagaCompleted(sagaType, 'tenant-001', 1000);
  console.log('  ✅ Tenant 001: saga completed');
  
  // Tenant 2
  metricsHelpers.recordSagaStarted(sagaType, 'tenant-002');
  metricsHelpers.recordSagaCompleted(sagaType, 'tenant-002', 1200);
  console.log('  ✅ Tenant 002: saga completed');
  
  // Tenant 3
  metricsHelpers.recordSagaStarted(sagaType, 'tenant-003');
  metricsHelpers.recordSagaFailed(sagaType, 'tenant-003', 500, 'TimeoutError');
  console.log('  ❌ Tenant 003: saga failed');
  
  printMetrics('📈 Metrics for multiple tenants');
}

// Print final summary
function printFinalSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL METRICS SUMMARY');
  console.log('='.repeat(60));
  
  const metricsData = metrics.getMetricsJSON();
  
  console.log('\n🎯 Saga Execution Metrics:');
  if (metricsData.saga_started_total) {
    const total = metricsData.saga_started_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Sagas Started: ${total}`);
  }
  if (metricsData.saga_completed_total) {
    const total = metricsData.saga_completed_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Sagas Completed: ${total}`);
  }
  if (metricsData.saga_compensated_total) {
    const total = metricsData.saga_compensated_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Sagas Compensated: ${total}`);
  }
  if (metricsData.saga_failed_total) {
    const total = metricsData.saga_failed_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Sagas Failed: ${total}`);
  }
  
  console.log('\n⏱️  Duration Metrics:');
  if (metricsData.saga_duration_milliseconds) {
    console.log(`  Saga Duration samples: ${metricsData.saga_duration_milliseconds.values.length}`);
  }
  if (metricsData.saga_step_duration_milliseconds) {
    console.log(`  Step Duration samples: ${metricsData.saga_step_duration_milliseconds.values.length}`);
  }
  if (metricsData.saga_compensation_duration_milliseconds) {
    console.log(`  Compensation Duration samples: ${metricsData.saga_compensation_duration_milliseconds.values.length}`);
  }
  
  console.log('\n🔄 Retry & Recovery Metrics:');
  if (metricsData.saga_step_retries_total) {
    const total = metricsData.saga_step_retries_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Step Retries: ${total}`);
  }
  if (metricsData.saga_recovery_attempts_total) {
    const total = metricsData.saga_recovery_attempts_total.values.reduce((sum: number, v: any) => sum + v.value, 0);
    console.log(`  Total Recovery Attempts: ${total}`);
  }
  
  console.log('\n📈 Prometheus Export Format:');
  console.log('─'.repeat(60));
  console.log(metrics.getMetrics());
  console.log('─'.repeat(60));
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting Saga Metrics Manual Tests (Simplified)\n');
  
  try {
    // Clear metrics before starting
    metrics.clear();
    
    testSagaLifecycleMetrics();
    testFailedSagaMetrics();
    testStepMetrics();
    testRetryMetrics();
    testRecoveryMetrics();
    testFailedSagaMetrics2();
    testMultiTenantMetrics();
    
    printFinalSummary();
    
    console.log('\n✅ All manual tests completed successfully!');
    console.log('\n💡 These metrics can be exported to Prometheus for monitoring');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
runAllTests();
