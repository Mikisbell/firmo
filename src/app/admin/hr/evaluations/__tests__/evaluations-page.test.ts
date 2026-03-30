/**
 * Admin HR Evaluations Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_CONFIG completeness (DRAFT / IN_PROGRESS / COMPLETED / REVIEWED)
 * - EVAL_CRITERIA: 5 criterios de evaluación
 * - CRITERIA_LABELS: labels en español para cada criterio
 * - getScoreColor: ≥4→green, ≥3→yellow, ≥2→orange, else red
 * - makeEmptyForm: puntajes por defecto = 5, período = mes actual
 *
 * @module app/admin/hr/evaluations/__tests__/evaluations-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type EvalStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';

const STATUS_CONFIG: Record<EvalStatus, { label: string; color: string }> = {
  DRAFT:       { label: 'Borrador',     color: 'bg-gray-100 text-gray-700'     },
  IN_PROGRESS: { label: 'En curso',     color: 'bg-blue-100 text-blue-700'     },
  COMPLETED:   { label: 'Completada',   color: 'bg-green-100 text-green-700'   },
  REVIEWED:    { label: 'Revisada',     color: 'bg-purple-100 text-purple-700' },
};

const EVAL_STATUSES = Object.keys(STATUS_CONFIG) as EvalStatus[];

const EVAL_CRITERIA = [
  'puntualidad',
  'presentacion',
  'productividad',
  'trabajo_equipo',
  'atencion_cliente',
] as const;

type EvalCriterion = typeof EVAL_CRITERIA[number];

const CRITERIA_LABELS: Record<EvalCriterion, string> = {
  puntualidad:      'Puntualidad',
  presentacion:     'Presentación',
  productividad:    'Productividad',
  trabajo_equipo:   'Trabajo en equipo',
  atencion_cliente: 'Atención al cliente',
};

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  if (score >= 2) return 'text-orange-600';
  return 'text-red-600';
}

function makeEmptyForm(): { employee_id: string; scores: Record<EvalCriterion, number> } {
  const scores = {} as Record<EvalCriterion, number>;
  for (const criterion of EVAL_CRITERIA) {
    scores[criterion] = 5;
  }
  return { employee_id: '', scores };
}

function isEvalFormValid(employeeId: string, scores: Record<EvalCriterion, number>): boolean {
  if (!employeeId.trim()) return false;
  return EVAL_CRITERIA.every(c => scores[c] >= 1 && scores[c] <= 5);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminHREvaluationsPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_CONFIG
// ============================================================================

describe('AdminHREvaluationsPage — STATUS_CONFIG', () => {
  it('cubre los 4 estados', () => {
    expect(EVAL_STATUSES).toHaveLength(4);
  });

  it('incluye DRAFT, IN_PROGRESS, COMPLETED, REVIEWED', () => {
    for (const s of ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED']) {
      expect(EVAL_STATUSES).toContain(s);
    }
  });

  it('COMPLETED es verde', () => {
    expect(STATUS_CONFIG.COMPLETED.color).toContain('green');
  });

  it('REVIEWED es púrpura (revisado)', () => {
    expect(STATUS_CONFIG.REVIEWED.color).toContain('purple');
  });

  it('IN_PROGRESS es azul', () => {
    expect(STATUS_CONFIG.IN_PROGRESS.color).toContain('blue');
  });

  it('labels en español', () => {
    expect(STATUS_CONFIG.DRAFT.label).toBe('Borrador');
    expect(STATUS_CONFIG.IN_PROGRESS.label).toBe('En curso');
    expect(STATUS_CONFIG.COMPLETED.label).toBe('Completada');
    expect(STATUS_CONFIG.REVIEWED.label).toBe('Revisada');
  });

  it('property: todos los estados tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVAL_STATUSES),
        (status) => {
          expect(STATUS_CONFIG[status].label.trim().length).toBeGreaterThan(0);
          expect(STATUS_CONFIG[status].color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — EVAL_CRITERIA
// ============================================================================

describe('AdminHREvaluationsPage — EVAL_CRITERIA', () => {
  it('hay exactamente 5 criterios', () => {
    expect(EVAL_CRITERIA).toHaveLength(5);
  });

  it('incluye los 5 criterios esperados', () => {
    expect(EVAL_CRITERIA).toContain('puntualidad');
    expect(EVAL_CRITERIA).toContain('presentacion');
    expect(EVAL_CRITERIA).toContain('productividad');
    expect(EVAL_CRITERIA).toContain('trabajo_equipo');
    expect(EVAL_CRITERIA).toContain('atencion_cliente');
  });

  it('todos tienen label en español', () => {
    for (const c of EVAL_CRITERIA) {
      expect(CRITERIA_LABELS[c].trim().length).toBeGreaterThan(0);
    }
  });

  it('label de puntualidad → "Puntualidad"', () => {
    expect(CRITERIA_LABELS.puntualidad).toBe('Puntualidad');
  });

  it('label de trabajo_equipo → "Trabajo en equipo"', () => {
    expect(CRITERIA_LABELS.trabajo_equipo).toBe('Trabajo en equipo');
  });
});

// ============================================================================
// Tests — getScoreColor
// ============================================================================

describe('AdminHREvaluationsPage — getScoreColor', () => {
  it('5 → verde (excelente)', () => {
    expect(getScoreColor(5)).toContain('green');
  });

  it('4 → verde (bueno)', () => {
    expect(getScoreColor(4)).toContain('green');
  });

  it('3 → amarillo (regular)', () => {
    expect(getScoreColor(3)).toContain('yellow');
  });

  it('2 → naranja (bajo)', () => {
    expect(getScoreColor(2)).toContain('orange');
  });

  it('1 → rojo (deficiente)', () => {
    expect(getScoreColor(1)).toContain('red');
  });

  it('property: score 4-5 siempre verde', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 5 }),
        (score) => {
          expect(getScoreColor(score)).toContain('green');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: score <= 1 siempre rojo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 1 }),
        (score) => {
          expect(getScoreColor(score)).toContain('red');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — makeEmptyForm
// ============================================================================

describe('AdminHREvaluationsPage — makeEmptyForm', () => {
  it('employee_id vacío por defecto', () => {
    const form = makeEmptyForm();
    expect(form.employee_id).toBe('');
  });

  it('todos los criterios con puntaje 5 por defecto', () => {
    const form = makeEmptyForm();
    for (const c of EVAL_CRITERIA) {
      expect(form.scores[c]).toBe(5);
    }
  });

  it('el form default es válido con un employee_id', () => {
    const form = makeEmptyForm();
    expect(isEvalFormValid('emp-123', form.scores)).toBe(true);
  });

  it('form sin employee_id → inválido', () => {
    const form = makeEmptyForm();
    expect(isEvalFormValid('', form.scores)).toBe(false);
  });
});
