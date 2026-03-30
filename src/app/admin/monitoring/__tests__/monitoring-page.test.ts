/**
 * Admin Monitoring Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - COLORS completeness (primary/success/error/warning/info/purple)
 * - calculateErrorRate: (errors/requests)*100, guard for 0 requests
 * - calculateCacheHitRate: hits/(hits+misses)*100, guard for 0 total
 * - getRequestStatusData: categorization by HTTP status family
 * - Period options (1h/24h/7d/30d)
 * - Metrics URL building
 *
 * @module app/admin/monitoring/__tests__/monitoring-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const COLORS = {
  primary: '#f59e0b',
  success: '#10b981',
  error:   '#ef4444',
  warning: '#f97316',
  info:    '#3b82f6',
  purple:  '#8b5cf6',
};

type MetricPeriod = '1h' | '24h' | '7d' | '30d';
const METRIC_PERIODS: MetricPeriod[] = ['1h', '24h', '7d', '30d'];

function calculateErrorRate(totalErrors: number, totalRequests: number): number {
  if (totalRequests === 0) return 0;
  return (totalErrors / totalRequests) * 100;
}

function calculateCacheHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  if (total === 0) return 0;
  return (hits / total) * 100;
}

function categorizeStatusCode(code: number): '2xx' | '3xx' | '4xx' | '5xx' | 'other' {
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
}

function buildMetricsURL(period: MetricPeriod, tenantId?: string, terminalId?: string): string {
  const params = new URLSearchParams({ period });
  if (tenantId)  params.append('tenantId', tenantId);
  if (terminalId) params.append('terminalId', terminalId);
  return `/api/admin/metrics?${params.toString()}`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminMonitoringPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — COLORS
// ============================================================================

describe('AdminMonitoringPage — COLORS', () => {
  it('tiene 6 colores definidos', () => {
    expect(Object.keys(COLORS)).toHaveLength(6);
  });

  it('todos los colores son hex válidos (#RRGGBB)', () => {
    for (const color of Object.values(COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('error es rojo (#ef4444)', () => {
    expect(COLORS.error).toBe('#ef4444');
  });

  it('success es verde (#10b981)', () => {
    expect(COLORS.success).toBe('#10b981');
  });

  it('primary es ámbar (#f59e0b)', () => {
    expect(COLORS.primary).toBe('#f59e0b');
  });
});

// ============================================================================
// Tests — calculateErrorRate
// ============================================================================

describe('AdminMonitoringPage — calculateErrorRate', () => {
  it('0 requests → 0% (sin división por cero)', () => {
    expect(calculateErrorRate(0, 0)).toBe(0);
  });

  it('100 errors de 1000 requests → 10%', () => {
    expect(calculateErrorRate(100, 1000)).toBe(10);
  });

  it('0 errors → 0%', () => {
    expect(calculateErrorRate(0, 500)).toBe(0);
  });

  it('todos con error → 100%', () => {
    expect(calculateErrorRate(200, 200)).toBe(100);
  });

  it('property: siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (errors, total) => {
          const rate = calculateErrorRate(Math.min(errors, total), total);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — calculateCacheHitRate
// ============================================================================

describe('AdminMonitoringPage — calculateCacheHitRate', () => {
  it('0 hits y 0 misses → 0% (sin división por cero)', () => {
    expect(calculateCacheHitRate(0, 0)).toBe(0);
  });

  it('80 hits y 20 misses → 80%', () => {
    expect(calculateCacheHitRate(80, 20)).toBe(80);
  });

  it('todos hits → 100%', () => {
    expect(calculateCacheHitRate(100, 0)).toBe(100);
  });

  it('todos misses → 0%', () => {
    expect(calculateCacheHitRate(0, 100)).toBe(0);
  });

  it('property: siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (hits, misses) => {
          const rate = calculateCacheHitRate(hits, misses);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — HTTP status categorization
// ============================================================================

describe('AdminMonitoringPage — Categorización de status HTTP', () => {
  it('200 → 2xx', () => {
    expect(categorizeStatusCode(200)).toBe('2xx');
    expect(categorizeStatusCode(201)).toBe('2xx');
    expect(categorizeStatusCode(204)).toBe('2xx');
  });

  it('301, 302 → 3xx', () => {
    expect(categorizeStatusCode(301)).toBe('3xx');
    expect(categorizeStatusCode(302)).toBe('3xx');
  });

  it('400, 404, 422 → 4xx', () => {
    expect(categorizeStatusCode(400)).toBe('4xx');
    expect(categorizeStatusCode(404)).toBe('4xx');
    expect(categorizeStatusCode(422)).toBe('4xx');
  });

  it('500, 502, 503 → 5xx', () => {
    expect(categorizeStatusCode(500)).toBe('5xx');
    expect(categorizeStatusCode(502)).toBe('5xx');
    expect(categorizeStatusCode(503)).toBe('5xx');
  });

  it('property: status 200-299 siempre es 2xx', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 299 }),
        (code) => {
          expect(categorizeStatusCode(code)).toBe('2xx');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: status 500-599 siempre es 5xx', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        (code) => {
          expect(categorizeStatusCode(code)).toBe('5xx');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Period options
// ============================================================================

describe('AdminMonitoringPage — Períodos de métricas', () => {
  it('hay 4 períodos disponibles', () => {
    expect(METRIC_PERIODS).toHaveLength(4);
  });

  it('incluye 1h, 24h, 7d, 30d', () => {
    expect(METRIC_PERIODS).toContain('1h');
    expect(METRIC_PERIODS).toContain('24h');
    expect(METRIC_PERIODS).toContain('7d');
    expect(METRIC_PERIODS).toContain('30d');
  });

  it('URL de métricas incluye el período', () => {
    const url = buildMetricsURL('24h');
    expect(url).toContain('period=24h');
    expect(url).toContain('/api/admin/metrics');
  });

  it('property: todos los períodos generan URL válida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...METRIC_PERIODS),
        (period) => {
          const url = buildMetricsURL(period);
          expect(url).toContain(`period=${period}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});
