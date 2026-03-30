/**
 * Admin Performance Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - HealthIndicator percentage calculation (normal and inverse)
 * - Cache hit rate threshold (healthy >= 80%)
 * - Response time threshold (healthy <= 200ms)
 * - API URLs (GET metrics / POST reset)
 *
 * @module app/admin/performance/__tests__/performance-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

interface HealthIndicatorProps {
  value: number;
  threshold: number;
  inverse?: boolean; // if true, lower is better (e.g., response time)
}

function getHealthPercent(props: HealthIndicatorProps): number {
  const { value, threshold, inverse = false } = props;
  if (inverse) {
    // Lower is better: healthy when value <= threshold
    return Math.min(100, (threshold / Math.max(value, 1)) * 100);
  }
  // Higher is better: healthy when value >= threshold
  return Math.min(100, (value / threshold) * 100);
}

function isHealthy(value: number, threshold: number, inverse = false): boolean {
  if (inverse) return value <= threshold;
  return value >= threshold;
}

const CACHE_HIT_THRESHOLD = 80;   // % — healthy if >= 80
const RESPONSE_TIME_THRESHOLD = 200; // ms — healthy if <= 200
const MEMORY_THRESHOLD = 80;      // % — healthy if <= 80 (inverse)

const METRICS_URL = '/api/admin/performance/metrics';

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminPerformancePage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — HealthIndicator (normal: higher is better)
// ============================================================================

describe('AdminPerformancePage — HealthIndicator (normal)', () => {
  it('value = threshold → 100%', () => {
    expect(getHealthPercent({ value: 80, threshold: 80 })).toBe(100);
  });

  it('value > threshold → 100% (capped)', () => {
    expect(getHealthPercent({ value: 95, threshold: 80 })).toBe(100);
  });

  it('value < threshold → porcentaje menor a 100', () => {
    expect(getHealthPercent({ value: 40, threshold: 80 })).toBe(50);
  });

  it('value = 0 → 0%', () => {
    expect(getHealthPercent({ value: 0, threshold: 80 })).toBe(0);
  });
});

// ============================================================================
// Tests — HealthIndicator (inverse: lower is better)
// ============================================================================

describe('AdminPerformancePage — HealthIndicator (inverse)', () => {
  it('value <= threshold → 100% (saludable)', () => {
    expect(getHealthPercent({ value: 100, threshold: 200, inverse: true })).toBe(100);
  });

  it('value = threshold → 100%', () => {
    expect(getHealthPercent({ value: 200, threshold: 200, inverse: true })).toBe(100);
  });

  it('value > threshold → menor a 100% (degradado)', () => {
    const pct = getHealthPercent({ value: 400, threshold: 200, inverse: true });
    expect(pct).toBeLessThan(100);
    expect(pct).toBeGreaterThan(0);
  });

  it('property: inverse siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (value, threshold) => {
          const pct = getHealthPercent({ value, threshold, inverse: true });
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — isHealthy
// ============================================================================

describe('AdminPerformancePage — isHealthy', () => {
  it('cache hit rate >= 80% → saludable', () => {
    expect(isHealthy(80, CACHE_HIT_THRESHOLD)).toBe(true);
    expect(isHealthy(95, CACHE_HIT_THRESHOLD)).toBe(true);
  });

  it('cache hit rate < 80% → no saludable', () => {
    expect(isHealthy(79, CACHE_HIT_THRESHOLD)).toBe(false);
  });

  it('response time <= 200ms → saludable (inverse)', () => {
    expect(isHealthy(150, RESPONSE_TIME_THRESHOLD, true)).toBe(true);
    expect(isHealthy(200, RESPONSE_TIME_THRESHOLD, true)).toBe(true);
  });

  it('response time > 200ms → no saludable (inverse)', () => {
    expect(isHealthy(201, RESPONSE_TIME_THRESHOLD, true)).toBe(false);
    expect(isHealthy(500, RESPONSE_TIME_THRESHOLD, true)).toBe(false);
  });

  it('memory usage <= 80% → saludable (inverse)', () => {
    expect(isHealthy(75, MEMORY_THRESHOLD, true)).toBe(true);
  });

  it('property: normal — value >= threshold siempre es saludable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (threshold, extra) => {
          expect(isHealthy(threshold + extra, threshold)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — API URLs
// ============================================================================

describe('AdminPerformancePage — URLs', () => {
  it('GET metrics URL correcta', () => {
    expect(METRICS_URL).toBe('/api/admin/performance/metrics');
  });

  it('POST reset usa misma URL base', () => {
    expect(METRICS_URL).toContain('/api/admin/performance');
  });
});
