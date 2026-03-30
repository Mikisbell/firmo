/**
 * HR Schedules Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - DAY_NAMES / DAY_FULL_NAMES completeness (7 days, 1-indexed)
 * - SCHEDULE_TYPE_LABELS completeness (FIXED, ROTATING)
 * - toggleDay logic (add/remove from set, keeps sorted)
 * - Form validation (name required, days required)
 * - Worked hours calculation from start/end time + break
 *
 * @module app/admin/hr/schedules/__tests__/schedules-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

// DAY_NAMES[0] is empty string (1-indexed: Mon=1..Sun=7)
const DAY_NAMES = ['', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAY_FULL_NAMES = ['', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fijo',
  ROTATING: 'Rotativo',
};

const SCHEDULE_TYPES = Object.keys(SCHEDULE_TYPE_LABELS);

// Default form values
const DEFAULT_FORM = {
  name: '',
  type: 'FIXED',
  days: [1, 2, 3, 4, 5],
  startTime: '08:00',
  endTime: '17:00',
  breakMinutes: 60,
};

function toggleDay(days: number[], day: number): number[] {
  if (days.includes(day)) {
    return days.filter(d => d !== day);
  }
  return [...days, day].sort((a, b) => a - b);
}

function isFormValid(name: string, days: number[]): boolean {
  return !!(name.trim() && days.length > 0);
}

// Worked minutes from HH:MM strings and break
function calcWorkedMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalStart = sh * 60 + sm;
  const totalEnd = eh * 60 + em;
  return Math.max(0, totalEnd - totalStart - breakMinutes);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('HRSchedulesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — DAY_NAMES (1-indexed)
// ============================================================================

describe('HRSchedulesPage — DAY_NAMES', () => {
  it('tiene 8 entradas (índice 0 vacío + 7 días)', () => {
    expect(DAY_NAMES).toHaveLength(8);
  });

  it('índice 0 está vacío', () => {
    expect(DAY_NAMES[0]).toBe('');
  });

  it('días 1-7 están definidos y no vacíos', () => {
    for (let i = 1; i <= 7; i++) {
      expect(DAY_NAMES[i]).toBeTruthy();
      expect(DAY_NAMES[i].length).toBeGreaterThan(0);
    }
  });

  it('Lunes es el día 1', () => {
    expect(DAY_NAMES[1]).toBe('Lun');
  });

  it('Domingo es el día 7', () => {
    expect(DAY_NAMES[7]).toBe('Dom');
  });

  it('días laborables (1-5) son Lun-Vie', () => {
    expect(DAY_NAMES.slice(1, 6)).toEqual(['Lun', 'Mar', 'Mie', 'Jue', 'Vie']);
  });

  it('fin de semana (6-7) es Sab-Dom', () => {
    expect(DAY_NAMES[6]).toBe('Sab');
    expect(DAY_NAMES[7]).toBe('Dom');
  });
});

describe('HRSchedulesPage — DAY_FULL_NAMES', () => {
  it('tiene 8 entradas (índice 0 vacío + 7 días)', () => {
    expect(DAY_FULL_NAMES).toHaveLength(8);
  });

  it('índice 0 está vacío', () => {
    expect(DAY_FULL_NAMES[0]).toBe('');
  });

  it('DAY_NAMES y DAY_FULL_NAMES tienen el mismo número de entradas', () => {
    expect(DAY_NAMES.length).toBe(DAY_FULL_NAMES.length);
  });

  it('nombres completos en español', () => {
    expect(DAY_FULL_NAMES[1]).toBe('Lunes');
    expect(DAY_FULL_NAMES[5]).toBe('Viernes');
    expect(DAY_FULL_NAMES[7]).toBe('Domingo');
  });
});

// ============================================================================
// Tests — SCHEDULE_TYPE_LABELS
// ============================================================================

describe('HRSchedulesPage — SCHEDULE_TYPE_LABELS', () => {
  it('cubre exactamente 2 tipos', () => {
    expect(SCHEDULE_TYPES).toHaveLength(2);
  });

  it('incluye FIXED y ROTATING', () => {
    expect(SCHEDULE_TYPE_LABELS.FIXED).toBeDefined();
    expect(SCHEDULE_TYPE_LABELS.ROTATING).toBeDefined();
  });

  it('labels en español', () => {
    expect(SCHEDULE_TYPE_LABELS.FIXED).toBe('Fijo');
    expect(SCHEDULE_TYPE_LABELS.ROTATING).toBe('Rotativo');
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(SCHEDULE_TYPE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — Valores por defecto del formulario
// ============================================================================

describe('HRSchedulesPage — DEFAULT_FORM', () => {
  it('tipo por defecto es FIXED', () => {
    expect(DEFAULT_FORM.type).toBe('FIXED');
  });

  it('días por defecto son los laborables (L-V)', () => {
    expect(DEFAULT_FORM.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('horario por defecto 08:00 - 17:00', () => {
    expect(DEFAULT_FORM.startTime).toBe('08:00');
    expect(DEFAULT_FORM.endTime).toBe('17:00');
  });

  it('break por defecto es 60 minutos', () => {
    expect(DEFAULT_FORM.breakMinutes).toBe(60);
  });

  it('nombre empieza vacío', () => {
    expect(DEFAULT_FORM.name).toBe('');
  });
});

// ============================================================================
// Tests — toggleDay
// ============================================================================

describe('HRSchedulesPage — toggleDay', () => {
  it('agrega un día que no estaba', () => {
    const result = toggleDay([1, 2, 3], 5);
    expect(result).toContain(5);
  });

  it('remueve un día que ya estaba', () => {
    const result = toggleDay([1, 2, 3], 2);
    expect(result).not.toContain(2);
  });

  it('resultado siempre está ordenado', () => {
    const result = toggleDay([1, 3, 5], 4);
    expect(result).toEqual([1, 3, 4, 5]);
  });

  it('togglear dos veces devuelve el array original', () => {
    const original = [1, 2, 3, 4, 5];
    const after = toggleDay(toggleDay(original, 6), 6);
    expect(after).toEqual(original);
  });

  it('toggle en lista vacía agrega el día', () => {
    expect(toggleDay([], 3)).toEqual([3]);
  });

  it('remover único día deja lista vacía', () => {
    expect(toggleDay([3], 3)).toHaveLength(0);
  });

  it('property: longitud cambia en ±1 con toggle', () => {
    fc.assert(
      fc.property(
        // Start with sorted unique arrays (as the component always maintains)
        fc.uniqueArray(fc.integer({ min: 1, max: 7 })).map(arr => [...arr].sort((a, b) => a - b)),
        fc.integer({ min: 1, max: 7 }),
        (days, day) => {
          const result = toggleDay(days, day);
          if (days.includes(day)) {
            expect(result.length).toBe(days.length - 1);
          } else {
            expect(result.length).toBe(days.length + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: resultado siempre está ordenado (dado input ordenado)', () => {
    fc.assert(
      fc.property(
        // toggleDay maintains sort order only when the input is already sorted
        fc.uniqueArray(fc.integer({ min: 1, max: 7 })).map(arr => [...arr].sort((a, b) => a - b)),
        fc.integer({ min: 1, max: 7 }),
        (days, day) => {
          const result = toggleDay(days, day);
          for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(result[i - 1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario
// ============================================================================

describe('HRSchedulesPage — Validación del formulario', () => {
  it('nombre vacío no es válido', () => {
    expect(isFormValid('', [1, 2, 3])).toBe(false);
  });

  it('días vacíos no es válido', () => {
    expect(isFormValid('Turno Mañana', [])).toBe(false);
  });

  it('nombre y días correctos es válido', () => {
    expect(isFormValid('Turno Mañana', [1, 2, 3, 4, 5])).toBe(true);
  });

  it('property: siempre inválido sin nombre', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1 }),
        (days) => {
          expect(isFormValid('', days)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: siempre inválido sin días', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (name) => {
          expect(isFormValid(name, [])).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Cálculo de horas trabajadas
// ============================================================================

describe('HRSchedulesPage — Cálculo de horas trabajadas', () => {
  it('08:00 - 17:00 con 60 min break = 480 min (8h)', () => {
    expect(calcWorkedMinutes('08:00', '17:00', 60)).toBe(480);
  });

  it('09:00 - 18:00 con 30 min break = 510 min (8.5h)', () => {
    expect(calcWorkedMinutes('09:00', '18:00', 30)).toBe(510);
  });

  it('sin break: 08:00 - 12:00 = 240 min', () => {
    expect(calcWorkedMinutes('08:00', '12:00', 0)).toBe(240);
  });

  it('no devuelve negativo si el break supera el tiempo', () => {
    expect(calcWorkedMinutes('08:00', '09:00', 120)).toBe(0);
  });

  it('property: resultado siempre >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 120 }),
        (sh, sm, eh, em, breakMin) => {
          const start = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
          const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          expect(calcWorkedMinutes(start, end, breakMin)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
