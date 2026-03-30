/**
 * Admin HR Training Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - TYPE_LABELS completeness (7 tipos de capacitación)
 * - EMPTY_FORM defaults (training_type='OTHER', duration_hours=1)
 * - calcTotalHours: sum of hours for filtered trainings
 * - isExpiringSoon: expires_at within 30 days from today
 * - isExpired: expires_at in the past
 *
 * @module app/admin/hr/training/__tests__/training-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type TrainingType = 'SAFETY' | 'FOOD_HANDLING' | 'CUSTOMER_SERVICE' | 'TECHNICAL' | 'MANAGEMENT' | 'COMPLIANCE' | 'OTHER';

const TYPE_LABELS: Record<TrainingType, { label: string; color: string }> = {
  SAFETY:           { label: 'Seguridad',          color: 'bg-red-100 text-red-700'     },
  FOOD_HANDLING:    { label: 'Manipulación de alimentos', color: 'bg-amber-100 text-amber-700' },
  CUSTOMER_SERVICE: { label: 'Atención al cliente', color: 'bg-blue-100 text-blue-700'   },
  TECHNICAL:        { label: 'Técnico',             color: 'bg-indigo-100 text-indigo-700'},
  MANAGEMENT:       { label: 'Gestión',             color: 'bg-purple-100 text-purple-700'},
  COMPLIANCE:       { label: 'Cumplimiento',        color: 'bg-gray-100 text-gray-700'   },
  OTHER:            { label: 'Otro',                color: 'bg-zinc-100 text-zinc-700'   },
};

const TRAINING_TYPES = Object.keys(TYPE_LABELS) as TrainingType[];

const EMPTY_FORM = {
  employee_id:      '',
  training_type:    'OTHER' as TrainingType,
  title:            '',
  duration_hours:   1,
  completion_date:  new Date().toISOString().split('T')[0],
  provider:         '',
};

interface Training {
  id: string;
  employee_id: string;
  employee_name?: string;
  training_type: TrainingType;
  title: string;
  hours: number;
  completed_at: string;
  expires_at?: string | null;
}

const EXPIRING_SOON_DAYS = 30;

function calcTotalHours(trainings: Training[]): number {
  return trainings.reduce((sum, t) => sum + t.hours, 0);
}

function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= EXPIRING_SOON_DAYS;
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminHRTrainingPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — TYPE_LABELS
// ============================================================================

describe('AdminHRTrainingPage — TYPE_LABELS', () => {
  it('hay exactamente 7 tipos de capacitación', () => {
    expect(TRAINING_TYPES).toHaveLength(7);
  });

  it('incluye todos los tipos esperados', () => {
    for (const t of ['SAFETY', 'FOOD_HANDLING', 'CUSTOMER_SERVICE', 'TECHNICAL', 'MANAGEMENT', 'COMPLIANCE', 'OTHER']) {
      expect(TRAINING_TYPES).toContain(t);
    }
  });

  it('SAFETY es rojo (seguridad)', () => {
    expect(TYPE_LABELS.SAFETY.color).toContain('red');
  });

  it('MANAGEMENT es púrpura', () => {
    expect(TYPE_LABELS.MANAGEMENT.color).toContain('purple');
  });

  it('labels en español', () => {
    expect(TYPE_LABELS.SAFETY.label).toBe('Seguridad');
    expect(TYPE_LABELS.CUSTOMER_SERVICE.label).toBe('Atención al cliente');
    expect(TYPE_LABELS.OTHER.label).toBe('Otro');
  });

  it('property: todos los tipos tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TRAINING_TYPES),
        (type) => {
          expect(TYPE_LABELS[type].label.trim().length).toBeGreaterThan(0);
          expect(TYPE_LABELS[type].color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — EMPTY_FORM defaults
// ============================================================================

describe('AdminHRTrainingPage — EMPTY_FORM', () => {
  it('training_type default es OTHER', () => {
    expect(EMPTY_FORM.training_type).toBe('OTHER');
  });

  it('duration_hours default es 1', () => {
    expect(EMPTY_FORM.duration_hours).toBe(1);
  });

  it('employee_id vacío por defecto', () => {
    expect(EMPTY_FORM.employee_id).toBe('');
  });

  it('completion_date es hoy', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(EMPTY_FORM.completion_date).toBe(today);
  });
});

// ============================================================================
// Tests — calcTotalHours
// ============================================================================

describe('AdminHRTrainingPage — calcTotalHours', () => {
  const trainings: Training[] = [
    { id: '1', employee_id: 'e1', training_type: 'SAFETY',        title: 'Seguridad básica', hours: 4,  completed_at: '2026-01-01' },
    { id: '2', employee_id: 'e1', training_type: 'FOOD_HANDLING', title: 'Manejo alimentos', hours: 8,  completed_at: '2026-01-02' },
    { id: '3', employee_id: 'e2', training_type: 'TECHNICAL',     title: 'POS system',       hours: 2,  completed_at: '2026-01-03' },
  ];

  it('suma total de horas', () => {
    expect(calcTotalHours(trainings)).toBe(14);
  });

  it('sin capacitaciones → 0 horas', () => {
    expect(calcTotalHours([])).toBe(0);
  });

  it('property: total siempre >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 0, maxLength: 10 }),
        (hours) => {
          const ts = hours.map((h, i) => ({
            id: String(i), employee_id: 'e1', training_type: 'OTHER' as TrainingType,
            title: 'T', hours: h, completed_at: '2026-01-01'
          }));
          expect(calcTotalHours(ts)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — isExpiringSoon
// ============================================================================

describe('AdminHRTrainingPage — isExpiringSoon', () => {
  it('null → no expira pronto', () => {
    expect(isExpiringSoon(null)).toBe(false);
    expect(isExpiringSoon(undefined)).toBe(false);
  });

  it('vence mañana → expira pronto', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(tomorrow)).toBe(true);
  });

  it('vence en 29 días → expira pronto', () => {
    const soon = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(soon)).toBe(true);
  });

  it('vence en 31 días → NO expira pronto', () => {
    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(later)).toBe(false);
  });

  it('ya venció → NO expira pronto (isExpired en cambio)', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(past)).toBe(false);
  });
});

// ============================================================================
// Tests — isExpired
// ============================================================================

describe('AdminHRTrainingPage — isExpired', () => {
  it('null → no expirado', () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });

  it('fecha pasada → expirado', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('fecha futura → no expirado', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it('expirado y expiringSoon son mutuamente excluyentes', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(past)).toBe(true);
    expect(isExpiringSoon(past)).toBe(false);
  });
});
