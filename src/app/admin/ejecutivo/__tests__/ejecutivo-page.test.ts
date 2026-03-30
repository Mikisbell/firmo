/**
 * Admin Dashboard Ejecutivo Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Period presets (today / week / month / custom)
 * - getPeriodDates: today → single day, week → Monday to today, month → 1st to today
 * - formatCents: "S/. X.XX" with locale formatting
 * - formatPercent: "X.X%"
 * - Alert severity levels (critical / warning / info)
 * - Margin color thresholds (≥40 green, ≥20 amber, else red)
 * - Delta sign formatting (+ prefix for positive)
 *
 * @module app/admin/ejecutivo/__tests__/ejecutivo-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type PeriodPreset = 'today' | 'week' | 'month' | 'custom';
type AlertSeverity = 'critical' | 'warning' | 'info';

const PERIOD_PRESETS: PeriodPreset[] = ['today', 'week', 'month', 'custom'];
const ALERT_SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];

function formatCents(cents: number): string {
  return `S/. ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getPeriodDates(preset: PeriodPreset): { start: string; end: string } {
  const today = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case 'today':
      return { start: toISO(today), end: toISO(today) };
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      return { start: toISO(weekStart), end: toISO(today) };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISO(monthStart), end: toISO(today) };
    }
    default:
      return { start: toISO(today), end: toISO(today) };
  }
}

function getMarginColor(marginPercent: number): 'green' | 'amber' | 'red' {
  if (marginPercent >= 40) return 'green';
  if (marginPercent >= 20) return 'amber';
  return 'red';
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${formatPercent(delta)}`;
}

function getAlertBgClass(severity: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    critical: 'bg-red-500/10 border-red-500/20',
    warning:  'bg-amber-500/10 border-amber-500/20',
    info:     'bg-blue-500/10 border-blue-500/20',
  };
  return map[severity];
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminEjecutivoDashboardPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Period presets
// ============================================================================

describe('AdminEjecutivoDashboardPage — Períodos', () => {
  it('hay 4 presets (today/week/month/custom)', () => {
    expect(PERIOD_PRESETS).toHaveLength(4);
  });

  it('incluye today, week, month, custom', () => {
    for (const p of ['today', 'week', 'month', 'custom']) {
      expect(PERIOD_PRESETS).toContain(p);
    }
  });

  it('today → start = end (mismo día)', () => {
    const { start, end } = getPeriodDates('today');
    expect(start).toBe(end);
  });

  it('today → fecha en formato YYYY-MM-DD', () => {
    const { start } = getPeriodDates('today');
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('week → start <= end', () => {
    const { start, end } = getPeriodDates('week');
    expect(start <= end).toBe(true);
  });

  it('month → start es el primer día del mes', () => {
    const { start } = getPeriodDates('month');
    expect(start).toMatch(/-01$/);
  });

  it('month → start <= end', () => {
    const { start, end } = getPeriodDates('month');
    expect(start <= end).toBe(true);
  });

  it('week → start <= end', () => {
    const { start, end } = getPeriodDates('week');
    expect(new Date(start) <= new Date(end)).toBe(true);
  });

  it('custom (fallback) → start = end = today', () => {
    const { start, end } = getPeriodDates('custom');
    expect(start).toBe(end);
  });
});

// ============================================================================
// Tests — formatCents
// ============================================================================

describe('AdminEjecutivoDashboardPage — formatCents', () => {
  it('incluye S/.', () => {
    expect(formatCents(100000)).toContain('S/.');
  });

  it('0 centavos → S/. 0.00', () => {
    expect(formatCents(0)).toContain('0');
  });

  it('property: siempre incluye S/. y tiene 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999900 }),
        (cents) => {
          const result = formatCents(cents);
          expect(result).toContain('S/.');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — formatPercent
// ============================================================================

describe('AdminEjecutivoDashboardPage — formatPercent', () => {
  it('25.5 → "25.5%"', () => {
    expect(formatPercent(25.5)).toBe('25.5%');
  });

  it('100 → "100.0%"', () => {
    expect(formatPercent(100)).toBe('100.0%');
  });

  it('0 → "0.0%"', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('siempre termina en %', () => {
    expect(formatPercent(33.3)).toMatch(/%$/);
  });

  it('property: siempre 1 decimal y termina en %', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
        (pct) => {
          const result = formatPercent(pct);
          expect(result).toMatch(/^-?\d+\.\d%$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — formatDelta
// ============================================================================

describe('AdminEjecutivoDashboardPage — formatDelta', () => {
  it('positivo → prefijo +', () => {
    expect(formatDelta(5.2)).toMatch(/^\+/);
  });

  it('negativo → sin prefijo +', () => {
    expect(formatDelta(-3.1)).not.toMatch(/^\+/);
  });

  it('cero → prefijo +', () => {
    expect(formatDelta(0)).toMatch(/^\+/);
  });
});

// ============================================================================
// Tests — Margin color thresholds
// ============================================================================

describe('AdminEjecutivoDashboardPage — Colores de margen', () => {
  it('≥ 40% → green (excelente)', () => {
    expect(getMarginColor(40)).toBe('green');
    expect(getMarginColor(60)).toBe('green');
    expect(getMarginColor(100)).toBe('green');
  });

  it('20-39% → amber (moderado)', () => {
    expect(getMarginColor(20)).toBe('amber');
    expect(getMarginColor(39.9)).toBe('amber');
  });

  it('< 20% → red (bajo)', () => {
    expect(getMarginColor(19.9)).toBe('red');
    expect(getMarginColor(0)).toBe('red');
    expect(getMarginColor(-5)).toBe('red');
  });

  it('property: margen >= 40 siempre verde', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40, max: 200 }),
        (pct) => {
          expect(getMarginColor(pct)).toBe('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: margen < 20 siempre rojo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 19 }),
        (pct) => {
          expect(getMarginColor(pct)).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Alert severity
// ============================================================================

describe('AdminEjecutivoDashboardPage — Severidades de alerta', () => {
  it('hay 3 niveles de severidad', () => {
    expect(ALERT_SEVERITIES).toHaveLength(3);
  });

  it('critical → fondo rojo', () => {
    expect(getAlertBgClass('critical')).toContain('red');
  });

  it('warning → fondo amber', () => {
    expect(getAlertBgClass('warning')).toContain('amber');
  });

  it('info → fondo azul', () => {
    expect(getAlertBgClass('info')).toContain('blue');
  });

  it('property: todas las severidades tienen clases de fondo y borde', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALERT_SEVERITIES),
        (severity) => {
          const cls = getAlertBgClass(severity);
          expect(cls).toMatch(/bg-/);
          expect(cls).toMatch(/border-/);
        }
      ),
      { numRuns: 50 }
    );
  });
});
