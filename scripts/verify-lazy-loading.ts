#!/usr/bin/env tsx

/**
 * Verification Script for Lazy Loading Implementation
 * 
 * Task 11.2: Implement lazy loading for non-critical components
 * Requirements: 10.7
 * 
 * This script verifies that:
 * 1. All admin pages are properly lazy-loaded
 * 2. Suspense boundaries are in place
 * 3. Loading fallbacks are implemented
 * 4. Preload functions exist for all routes
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: string[];
}

const results: VerificationResult[] = [];

function checkFile(path: string, description: string): boolean {
  const fullPath = join(process.cwd(), path);
  const exists = existsSync(fullPath);
  
  results.push({
    passed: exists,
    message: `${description}: ${path}`,
  });
  
  return exists;
}

function checkFileContains(path: string, patterns: string[], description: string): boolean {
  const fullPath = join(process.cwd(), path);
  
  if (!existsSync(fullPath)) {
    results.push({
      passed: false,
      message: `${description}: File not found - ${path}`,
    });
    return false;
  }
  
  const content = readFileSync(fullPath, 'utf-8');
  const missingPatterns: string[] = [];
  
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      missingPatterns.push(pattern);
    }
  }
  
  const passed = missingPatterns.length === 0;
  
  results.push({
    passed,
    message: `${description}: ${path}`,
    details: passed ? undefined : [`Missing patterns: ${missingPatterns.join(', ')}`],
  });
  
  return passed;
}

console.log('🔍 Verifying Lazy Loading Implementation...\n');

// 1. Check lazy-admin-components module exists
console.log('📦 Checking lazy loading module...');
checkFile('src/lib/lazy-admin-components.tsx', 'Lazy loading module');

// 2. Check lazy loading module has required exports
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  [
    'AdminLoadingFallback',
    'withLazyLoading',
    'LazyReportsPage',
    'LazyAnalyticsDashboard',
    'LazyAuditoriaPage',
    'LazySecurityPage',
    'preloadAdminComponents',
    'useAdminPreload',
    'React.lazy',
    'Suspense',
  ],
  'Lazy loading exports'
);

// 3. Check all admin pages are exported as lazy components
const adminPages = [
  'LazyReportsPage',
  'LazyAnalyticsDashboard',
  'LazyAuditoriaPage',
  'LazySecurityPage',
  'LazyCrossTenantDashboard',
  'LazyTenantDashboard',
  'LazyTenantProvisioning',
  'LazyDeliveryPage',
  'LazyDeliveryHistory',
  'LazyNotificationsPage',
];

console.log('\n📄 Checking lazy-loaded admin pages...');
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  adminPages,
  'All admin pages exported'
);

// 4. Check preload functions exist for all pages
const preloadFunctions = [
  'reports:',
  'dashboard:',
  'auditoria:',
  'security:',
  'crossTenant:',
  'tenantDashboard:',
  'tenantProvisioning:',
  'delivery:',
  'deliveryHistory:',
  'notifications:',
];

console.log('\n⚡ Checking preload functions...');
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  preloadFunctions,
  'All preload functions defined'
);

// 5. Check AdminSidebar uses preloading
console.log('\n🔗 Checking sidebar integration...');
checkFileContains(
  'src/app/admin/components/AdminSidebar.tsx',
  [
    'useAdminPreload',
    'preloadOnHover',
    'onMouseEnter',
  ],
  'Sidebar uses preloading'
);

// 6. Check unit tests exist
console.log('\n🧪 Checking unit tests...');
checkFile('src/lib/__tests__/lazy-admin-components.unit.test.tsx', 'Unit tests');

checkFileContains(
  'src/lib/__tests__/lazy-admin-components.unit.test.tsx',
  [
    'AdminLoadingFallback',
    'withLazyLoading',
    'useAdminPreload',
    'preloadAdminComponents',
  ],
  'Unit test coverage'
);

// 7. Check property-based tests exist
console.log('\n🎲 Checking property-based tests...');
checkFile('src/lib/__tests__/lazy-admin-components.property.test.tsx', 'Property tests');

checkFileContains(
  'src/lib/__tests__/lazy-admin-components.property.test.tsx',
  [
    'fc.assert',
    'fc.property',
    '**Validates: Requirements 10.7**',
  ],
  'Property test coverage'
);

// 8. Check loading fallback has good UX
console.log('\n🎨 Checking loading fallback UX...');
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  [
    'Loader2',
    'animate-spin',
    'Cargando panel',
    'min-h-[400px]',
  ],
  'Loading fallback UX'
);

// 9. Check mobile optimization (no preload on mobile)
console.log('\n📱 Checking mobile optimization...');
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  [
    'window.innerWidth',
    '>= 1024',
  ],
  'Mobile bandwidth optimization'
);

// 10. Check TypeScript types are preserved
console.log('\n🔒 Checking TypeScript type safety...');
checkFileContains(
  'src/lib/lazy-admin-components.tsx',
  [
    'ComponentType',
    '<P extends object>',
    'React.ReactNode',
  ],
  'TypeScript type safety'
);

// Print results
console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION RESULTS');
console.log('='.repeat(60) + '\n');

const passed = results.filter(r => r.passed).length;
const total = results.length;
const percentage = ((passed / total) * 100).toFixed(1);

results.forEach(result => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.message}`);
  
  if (result.details) {
    result.details.forEach(detail => {
      console.log(`   ${detail}`);
    });
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📈 Score: ${passed}/${total} checks passed (${percentage}%)`);
console.log('='.repeat(60) + '\n');

if (passed === total) {
  console.log('🎉 All checks passed! Lazy loading is properly implemented.');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please review the implementation.');
  process.exit(1);
}
