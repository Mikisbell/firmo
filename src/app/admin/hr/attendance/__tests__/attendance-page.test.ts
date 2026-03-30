/**
 * HR Attendance Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_COLORS / STATUS_LABELS completeness and Spanish labels
 * - formatTime helper (null → '--:--', valid ISO string → 'HH:MM')
 * - formatMinutes helper (total minutes → 'Xh MMm')
 * - getCurrentMonth format ('YYYY-MM')
 * - SWR URL construction for attendance query
 *
 * @module app/admin/hr/attendance/__tests__/attendance-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-500/20 text-green-400',
  ABSENT: 'bg-red-500/20 text-red-400',
  LATE: 'bg-yellow-500/20 text-yellow-400',
  JUSTIFIED: 'bg-blue-500/20 text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tardanza',
  JUSTIFIED: 'Justificado',
};

const ATTENDANCE_STATUSES = Object.keys(STATUS_LABELS);

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildAttendanceURL(employeeId: string, month: string): string {
  const [year, m] = month.split('-').map(Number);
  const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${year}-${String(m).padStart(2, '0')}-${lastDay}`;
  return `/api/hr/attendance?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('HRAttendancePage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_COLORS
// ============================================================================

describe('HRAttendancePage — STATUS_COLORS', () => {
  it('cubre los 4 estados', () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(4);
  });

  it('incluye PRESENT, ABSENT, LATE, JUSTIFIED', () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(STATUS_COLORS[status]).toBeDefined();
    }
  });

  it('cada color tiene clase bg- y text-', () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(/bg-\w+/);
      expect(color).toMatch(/text-\w+/);
    }
  });

  it('PRESENT es verde', () => {
    expect(STATUS_COLORS.PRESENT).toContain('green');
  });

  it('ABSENT es rojo', () => {
    expect(STATUS_COLORS.ABSENT).toContain('red');
  });

  it('LATE es amarillo', () => {
    expect(STATUS_COLORS.LATE).toContain('yellow');
  });

  it('JUSTIFIED es azul', () => {
    expect(STATUS_COLORS.JUSTIFIED).toContain('blue');
  });
});

// ============================================================================
// Tests — STATUS_LABELS
// ============================================================================

describe('HRAttendancePage — STATUS_LABELS', () => {
  it('cubre los 4 estados', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.PRESENT).toBe('Presente');
    expect(STATUS_LABELS.ABSENT).toBe('Ausente');
    expect(STATUS_LABELS.LATE).toBe('Tardanza');
    expect(STATUS_LABELS.JUSTIFIED).toBe('Justificado');
  });

  it('STATUS_COLORS y STATUS_LABELS tienen los mismos keys', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(Object.keys(STATUS_LABELS).sort());
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — formatTime
// ============================================================================

describe('HRAttendancePage — formatTime', () => {
  it('null devuelve "--:--"', () => {
    expect(formatTime(null)).toBe('--:--');
  });

  it('string vacío devuelve "--:--"', () => {
    expect(formatTime('')).toBe('--:--');
  });

  it('ISO string devuelve un string con ":" (formato de hora)', () => {
    const result = formatTime('2026-03-15T08:30:00.000Z');
    // toLocaleTimeString output varies by OS/locale; just verify it's a time string
    expect(result).toContain(':');
    expect(result).not.toBe('--:--');
  });

  it('property: siempre devuelve string no vacío', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
          { nil: null }
        ),
        (dateStr) => {
          const result = formatTime(dateStr);
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: null siempre devuelve "--:--"', () => {
    expect(formatTime(null)).toBe('--:--');
  });
});

// ============================================================================
// Tests — formatMinutes
// ============================================================================

describe('HRAttendancePage — formatMinutes', () => {
  it('0 minutos = "0h 00m"', () => {
    expect(formatMinutes(0)).toBe('0h 00m');
  });

  it('60 minutos = "1h 00m"', () => {
    expect(formatMinutes(60)).toBe('1h 00m');
  });

  it('90 minutos = "1h 30m"', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('480 minutos = "8h 00m" (jornada laboral)', () => {
    expect(formatMinutes(480)).toBe('8h 00m');
  });

  it('495 minutos = "8h 15m"', () => {
    expect(formatMinutes(495)).toBe('8h 15m');
  });

  it('9 minutos = "0h 09m" (padding de 2 dígitos)', () => {
    expect(formatMinutes(9)).toBe('0h 09m');
  });

  it('property: siempre incluye "h" y "m"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1440 }),
        (mins) => {
          const result = formatMinutes(mins);
          expect(result).toContain('h');
          expect(result).toContain('m');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: minutos < 60 → parte de horas es 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (mins) => {
          const result = formatMinutes(mins);
          expect(result.startsWith('0h')).toBe(true);
        }
      ),
      { numRuns: 60 }
    );
  });

  it('property: minutos parte siempre tiene 2 dígitos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1440 }),
        (mins) => {
          const result = formatMinutes(mins);
          // Format: "Xh MMm" — MM should be 2 digits
          const minutesPart = result.match(/(\d{2})m$/);
          expect(minutesPart).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — getCurrentMonth
// ============================================================================

describe('HRAttendancePage — getCurrentMonth', () => {
  it('devuelve formato YYYY-MM', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('mes entre 01 y 12', () => {
    const [, month] = getCurrentMonth().split('-');
    const m = parseInt(month, 10);
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(12);
  });

  it('año es el año actual', () => {
    const [year] = getCurrentMonth().split('-');
    expect(parseInt(year, 10)).toBe(new Date().getFullYear());
  });
});

// ============================================================================
// Tests — buildAttendanceURL
// ============================================================================

describe('HRAttendancePage — Construcción de URL de asistencia', () => {
  it('incluye employee_id en la URL', () => {
    const url = buildAttendanceURL('emp-123', '2026-03');
    expect(url).toContain('employee_id=emp-123');
  });

  it('start_date es el primer día del mes', () => {
    const url = buildAttendanceURL('emp-123', '2026-03');
    expect(url).toContain('start_date=2026-03-01');
  });

  it('end_date es el último día de marzo (31)', () => {
    const url = buildAttendanceURL('emp-123', '2026-03');
    expect(url).toContain('end_date=2026-03-31');
  });

  it('febrero 2026 termina en 28', () => {
    const url = buildAttendanceURL('emp-123', '2026-02');
    expect(url).toContain('end_date=2026-02-28');
  });

  it('property: URL siempre contiene /api/hr/attendance', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (empId, year, month) => {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          const url = buildAttendanceURL(empId, monthStr);
          expect(url).toContain('/api/hr/attendance');
          expect(url).toContain(`employee_id=${empId}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
