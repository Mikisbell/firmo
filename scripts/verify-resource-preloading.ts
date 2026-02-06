#!/usr/bin/env tsx

/**
 * Verification Script: Resource Preloading Configuration
 * 
 * This script verifies that critical resources are properly preloaded
 * in the root layout to improve TTFB and FCP performance metrics.
 * 
 * Validates Requirements: 10.8
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface PreloadCheck {
  name: string;
  pattern: RegExp;
  required: boolean;
  description: string;
}

const PRELOAD_CHECKS: PreloadCheck[] = [
  {
    name: 'Font Preload',
    pattern: /<link[^>]*rel="preload"[^>]*as="font"[^>]*>/,
    required: true,
    description: 'Preload link for critical fonts (Inter)',
  },
  {
    name: 'CSS Preload',
    pattern: /<link[^>]*rel="preload"[^>]*as="style"[^>]*>/,
    required: true,
    description: 'Preload link for critical CSS',
  },
  {
    name: 'Preconnect Google Fonts',
    pattern: /<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.googleapis\.com"[^>]*>/,
    required: true,
    description: 'Preconnect to Google Fonts for faster font loading',
  },
  {
    name: 'Preconnect Google Fonts Static',
    pattern: /<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.gstatic\.com"[^>]*crossOrigin/,
    required: true,
    description: 'Preconnect to Google Fonts static CDN with CORS',
  },
  {
    name: 'DNS Prefetch',
    pattern: /<link[^>]*rel="dns-prefetch"[^>]*>/,
    required: false,
    description: 'DNS prefetch for external services',
  },
  {
    name: 'Font CrossOrigin',
    pattern: /<link[^>]*rel="preload"[^>]*as="font"[^>]*crossOrigin="anonymous"[^>]*>/,
    required: true,
    description: 'Font preload must have crossOrigin="anonymous" for CORS',
  },
];

interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    required: boolean;
    description: string;
    found?: string;
  }[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    requiredFailed: number;
  };
}

function verifyResourcePreloading(): VerificationResult {
  console.log('🔍 Verifying Resource Preloading Configuration...\n');

  const layoutPath = join(process.cwd(), 'src/app/layout.tsx');
  const layoutContent = readFileSync(layoutPath, 'utf-8');

  const checks = PRELOAD_CHECKS.map((check) => {
    const match = layoutContent.match(check.pattern);
    const passed = !!match;

    if (passed) {
      console.log(`✅ ${check.name}: PASSED`);
      console.log(`   ${check.description}`);
      if (match) {
        console.log(`   Found: ${match[0].substring(0, 80)}...`);
      }
    } else {
      const icon = check.required ? '❌' : '⚠️';
      console.log(`${icon} ${check.name}: ${check.required ? 'FAILED' : 'OPTIONAL'}`);
      console.log(`   ${check.description}`);
    }
    console.log('');

    return {
      name: check.name,
      passed,
      required: check.required,
      description: check.description,
      found: match ? match[0] : undefined,
    };
  });

  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
    requiredFailed: checks.filter((c) => !c.passed && c.required).length,
  };

  const allRequiredPassed = summary.requiredFailed === 0;

  console.log('📊 Summary:');
  console.log(`   Total Checks: ${summary.total}`);
  console.log(`   Passed: ${summary.passed}`);
  console.log(`   Failed: ${summary.failed}`);
  console.log(`   Required Failed: ${summary.requiredFailed}`);
  console.log('');

  if (allRequiredPassed) {
    console.log('✅ All required resource preloading checks passed!');
    console.log('');
    console.log('📈 Expected Performance Improvements:');
    console.log('   - TTFB (Time To First Byte): Reduced by preconnecting to external domains');
    console.log('   - FCP (First Contentful Paint): Reduced by preloading critical fonts and CSS');
    console.log('   - LCP (Largest Contentful Paint): Improved by faster font loading');
    console.log('   - CLS (Cumulative Layout Shift): Reduced by ensuring fonts load before render');
  } else {
    console.log('❌ Some required resource preloading checks failed!');
    console.log('');
    console.log('Failed Required Checks:');
    checks
      .filter((c) => !c.passed && c.required)
      .forEach((c) => {
        console.log(`   - ${c.name}: ${c.description}`);
      });
  }

  return {
    passed: allRequiredPassed,
    checks,
    summary,
  };
}

// Additional checks for best practices
function verifyBestPractices(layoutContent: string): void {
  console.log('\n🎯 Best Practices Verification:\n');

  const bestPractices = [
    {
      name: 'No blocking scripts in head',
      check: !layoutContent.includes('<script') || layoutContent.includes('defer') || layoutContent.includes('async'),
      description: 'Scripts should be deferred or async to avoid blocking rendering',
    },
    {
      name: 'Font display strategy',
      check: layoutContent.includes('Inter'),
      description: 'Using Next.js font optimization with Inter font',
    },
    {
      name: 'Minimal head elements',
      check: (layoutContent.match(/<link/g) || []).length < 10,
      description: 'Keep head elements minimal to reduce HTML parsing time',
    },
  ];

  bestPractices.forEach((practice) => {
    const icon = practice.check ? '✅' : '⚠️';
    console.log(`${icon} ${practice.name}`);
    console.log(`   ${practice.description}`);
    console.log('');
  });
}

// Performance recommendations
function printPerformanceRecommendations(): void {
  console.log('\n💡 Performance Recommendations:\n');

  const recommendations = [
    {
      title: 'Monitor Web Vitals',
      description: 'Use task 11.4 to implement Web Vitals tracking and measure the impact of preloading',
    },
    {
      title: 'Avoid Over-Preloading',
      description: 'Only preload truly critical resources. Over-preloading can hurt performance',
    },
    {
      title: 'Use Resource Hints Wisely',
      description: 'preconnect > dns-prefetch > prefetch. Use the strongest hint that makes sense',
    },
    {
      title: 'Test on Real Devices',
      description: 'Test performance on real devices with throttled networks (3G/4G)',
    },
    {
      title: 'Measure Before and After',
      description: 'Use Lighthouse or WebPageTest to measure performance improvements',
    },
  ];

  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title}`);
    console.log(`   ${rec.description}`);
    console.log('');
  });
}

// Main execution
function main(): void {
  try {
    const layoutPath = join(process.cwd(), 'src/app/layout.tsx');
    const layoutContent = readFileSync(layoutPath, 'utf-8');

    const result = verifyResourcePreloading();
    verifyBestPractices(layoutContent);
    printPerformanceRecommendations();

    console.log('\n' + '='.repeat(80));
    console.log('Verification Complete!');
    console.log('='.repeat(80) + '\n');

    if (!result.passed) {
      console.error('❌ Verification failed. Please fix the issues above.');
      process.exit(1);
    }

    console.log('✅ All verifications passed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Run `npm run build` to verify build succeeds');
    console.log('   2. Run `npm run dev` to test in development');
    console.log('   3. Use Lighthouse to measure performance improvements');
    console.log('   4. Implement task 11.4 (Web Vitals tracking) to monitor impact');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  }
}

main();
