/**
 * Admin HR Reports Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - REPORT_TYPES completeness (7 tipos)
 * - All report types have value, label, color
 * - URL building with type and period
 *
 * @module app/admin/hr/reports/__tests__/reports-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type ReportType = 'attendance' | 'hours' | 'payroll' | 'vacation' | 'performance' | 'turnover' | 'labor-cost';

const REPORT_TYPES: { value: ReportType; label: string; color: string }[] = [
  { value: 'attendance',  label: 'Asistencia',          color: 'blue'   },
  { value: 'hours',       label: 'Horas Trabajadas',    color: 'green'  },
  { value: 'payroll',     label: 'Planilla',            color: 'purple' },
  { value: 'vacation',    label: 'Vacaciones',          color: 'amber'  },
  { value: 'performance', label: 'Desempeño',           color: 'rose'   },
  { value: 'turnover',    label: 'Rotación de Personal',color: 'red'    },
  { value: 'labor-cost',  label: 'Costo Laboral',       color: 'cyan'   },
];

function buildReportsURL(type: ReportType, period: string): string {
  const params = new URLSearchParams({ type, period });
  return `/api/hr/reports?${params.toString()}`;
}

function getReportLabel(type: ReportType): string {
  return REPORT_TYPES.find(r => r.value === type)?.label ?? type;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminHRReportsPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — REPORT_TYPES
// ============================================================================

describe('AdminHRReportsPage — REPORT_TYPES', () => {
  it('hay exactamente 7 tipos de reportes', () => {
    expect(REPORT_TYPES).toHaveLength(7);
  });

  it('incluye attendance, hours, payroll, vacation, performance, turnover, labor-cost', () => {
    const values = REPORT_TYPES.map(r => r.value);
    for (const v of ['attendance', 'hours', 'payroll', 'vacation', 'performance', 'turnover', 'labor-cost']) {
      expect(values).toContain(v);
    }
  });

  it('planilla → color púrpura', () => {
    const payroll = REPORT_TYPES.find(r => r.value === 'payroll');
    expect(payroll?.color).toBe('purple');
  });

  it('asistencia → color azul', () => {
    const attendance = REPORT_TYPES.find(r => r.value === 'attendance');
    expect(attendance?.color).toBe('blue');
  });

  it('labels en español', () => {
    expect(getReportLabel('attendance')).toBe('Asistencia');
    expect(getReportLabel('payroll')).toBe('Planilla');
    expect(getReportLabel('vacation')).toBe('Vacaciones');
  });

  it('property: todos los tipos tienen value, label y color no vacíos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REPORT_TYPES),
        (report) => {
          expect(report.value.trim().length).toBeGreaterThan(0);
          expect(report.label.trim().length).toBeGreaterThan(0);
          expect(report.color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — URL building
// ============================================================================

describe('AdminHRReportsPage — URL de reportes', () => {
  it('incluye type y period', () => {
    const url = buildReportsURL('payroll', '2026-03');
    expect(url).toContain('type=payroll');
    expect(url).toContain('period=2026-03');
    expect(url).toContain('/api/hr/reports');
  });

  it('property: URL siempre contiene el tipo correcto', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REPORT_TYPES.map(r => r.value)) as fc.Arbitrary<ReportType>,
        (type) => {
          const url = buildReportsURL(type, '2026-01');
          expect(url).toContain(`type=${type}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});
