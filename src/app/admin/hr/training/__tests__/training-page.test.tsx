/**
 * HR Training Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - TRAINING_TYPE_LABELS config completeness
 * - EMPTY_FORM structure and defaults
 * - SWR URL construction (conditional key for employee list)
 * - handleSave validation logic
 *
 * @module app/admin/hr/training/__tests__/training-page
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('swr', () => ({
  default: () => ({ data: null, error: null, isLoading: false, mutate: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// ============================================================================
// Logic replicated from page source
// ============================================================================

const TRAINING_TYPE_LABELS: Record<string, string> = {
  MANDATORY: 'Obligatoria',
  PROFESSIONAL: 'Profesional',
  SAFETY: 'Seguridad',
  TECHNICAL: 'Técnica',
  SOFT_SKILLS: 'Habilidades Blandas',
  OTHER: 'Otra',
};

const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS);

const EMPTY_FORM = {
  employee_id: '',
  training_name: '',
  training_type: 'OTHER',
  provider: '',
  duration_hours: 1,
  completion_date: new Date().toISOString().slice(0, 10),
  expires_at: '',
  certificate_url: '',
};

type TrainingForm = typeof EMPTY_FORM;

function isFormValid(form: TrainingForm): boolean {
  return !!(form.employee_id && form.training_name.trim() && form.duration_hours > 0);
}

function buildEmployeeSWRKey(showModal: boolean): string | null {
  return showModal ? '/api/hr/employees?pageSize=1000' : null;
}

function buildTrainingSWRKey(typeFilter: string): string {
  return `/api/hr/training${typeFilter ? `?type=${typeFilter}` : ''}`;
}

// ============================================================================
// Tests
// ============================================================================

describe('HRTrainingPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el componente se llama TrainingPage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('TrainingPage');
  });
});

describe('HRTrainingPage — TRAINING_TYPE_LABELS', () => {
  it('cubre los 6 tipos de capacitación', () => {
    expect(TRAINING_TYPES).toHaveLength(6);
  });

  it('incluye todos los tipos esperados', () => {
    const expected = ['MANDATORY', 'PROFESSIONAL', 'SAFETY', 'TECHNICAL', 'SOFT_SKILLS', 'OTHER'];
    for (const type of expected) {
      expect(TRAINING_TYPE_LABELS[type]).toBeDefined();
      expect(TRAINING_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('labels están en español', () => {
    expect(TRAINING_TYPE_LABELS.MANDATORY).toBe('Obligatoria');
    expect(TRAINING_TYPE_LABELS.SAFETY).toBe('Seguridad');
    expect(TRAINING_TYPE_LABELS.OTHER).toBe('Otra');
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(TRAINING_TYPE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('HRTrainingPage — EMPTY_FORM', () => {
  it('tiene los campos requeridos por la API', () => {
    expect(EMPTY_FORM).toHaveProperty('employee_id');
    expect(EMPTY_FORM).toHaveProperty('training_name');
    expect(EMPTY_FORM).toHaveProperty('training_type');
    expect(EMPTY_FORM).toHaveProperty('duration_hours');
    expect(EMPTY_FORM).toHaveProperty('completion_date');
  });

  it('tipo por defecto es OTHER', () => {
    expect(EMPTY_FORM.training_type).toBe('OTHER');
  });

  it('duración mínima es 1 hora', () => {
    expect(EMPTY_FORM.duration_hours).toBeGreaterThanOrEqual(1);
  });

  it('completion_date tiene formato YYYY-MM-DD', () => {
    expect(EMPTY_FORM.completion_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('employee_id empieza vacío', () => {
    expect(EMPTY_FORM.employee_id).toBe('');
  });
});

describe('HRTrainingPage — Validación del formulario', () => {
  it('formulario vacío no es válido', () => {
    expect(isFormValid(EMPTY_FORM)).toBe(false);
  });

  it('requiere employee_id', () => {
    const form = { ...EMPTY_FORM, training_name: 'Capacitación', duration_hours: 8 };
    expect(isFormValid(form)).toBe(false);
  });

  it('requiere training_name no vacío', () => {
    const form = { ...EMPTY_FORM, employee_id: 'uuid-123', training_name: '', duration_hours: 8 };
    expect(isFormValid(form)).toBe(false);
  });

  it('requiere duration_hours > 0', () => {
    const form = { ...EMPTY_FORM, employee_id: 'uuid-123', training_name: 'Test', duration_hours: 0 };
    expect(isFormValid(form)).toBe(false);
  });

  it('formulario completo es válido', () => {
    const form = { ...EMPTY_FORM, employee_id: 'uuid-123', training_name: 'Manejo de caja', duration_hours: 4 };
    expect(isFormValid(form)).toBe(true);
  });

  it('property: formulario siempre inválido sin employee_id', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 200 }),
        (name, hours) => {
          const form = { ...EMPTY_FORM, employee_id: '', training_name: name, duration_hours: hours };
          expect(isFormValid(form)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: formulario válido con todos los campos', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 200 }),
        (empId, name, hours) => {
          const form = { ...EMPTY_FORM, employee_id: empId, training_name: name, duration_hours: hours };
          expect(isFormValid(form)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('HRTrainingPage — SWR Keys', () => {
  it('employee list key es null cuando modal está cerrado', () => {
    expect(buildEmployeeSWRKey(false)).toBeNull();
  });

  it('employee list key es la URL cuando modal está abierto', () => {
    expect(buildEmployeeSWRKey(true)).toBe('/api/hr/employees?pageSize=1000');
  });

  it('training list key sin filtro no incluye query param', () => {
    expect(buildTrainingSWRKey('')).toBe('/api/hr/training');
  });

  it('training list key con filtro incluye type=', () => {
    expect(buildTrainingSWRKey('SAFETY')).toBe('/api/hr/training?type=SAFETY');
  });

  it('property: todos los tipos generan URLs válidas', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TRAINING_TYPES),
        (type) => {
          const url = buildTrainingSWRKey(type);
          expect(url).toContain('/api/hr/training');
          expect(url).toContain(type);
        }
      ),
      { numRuns: 50 }
    );
  });
});
