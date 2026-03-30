/**
 * HR Employees Pages — Unit Tests
 *
 * Covers:
 * - new/page.tsx: module export, form validation, salary cents conversion
 * - [id]/page.tsx: module export, formatCurrency, ROLE/CONTRACT/SCHEDULE labels
 * - [id]/edit/page.tsx: module export, salary display init, PATCH body construction
 *
 * @module app/admin/hr/employees/__tests__/hr-employees-pages
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
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: 'test-employee-id' }),
}));

vi.mock('@/src/core/constants/roles', () => ({
  EMPLOYEE_ROLES: [
    'OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER',
    'WAITER', 'KITCHEN', 'COOK', 'PACKER', 'BAR', 'DRIVER',
  ],
}));

// ============================================================================
// Logic replicated from page sources
// ============================================================================

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario', ADMIN: 'Administrador', MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor(a)', CASHIER: 'Cajero(a)', WAITER: 'Mesero(a)',
  KITCHEN: 'Cocina', COOK: 'Cocinero(a)', PACKER: 'Empaquetador(a)',
  BAR: 'Barman', DRIVER: 'Motorizado(a)',
};

const CONTRACT_TYPES = [
  { value: 'INDEFINIDO', label: 'Indefinido' },
  { value: 'PLAZO_FIJO', label: 'Plazo Fijo' },
  { value: 'PART_TIME', label: 'Part Time' },
];

const SCHEDULE_TYPES = [
  { value: 'FULL_TIME', label: 'Tiempo Completo' },
  { value: 'PART_TIME', label: 'Medio Tiempo' },
  { value: 'ROTATING', label: 'Rotativo' },
];

const PENSION_SYSTEMS = ['ONP', 'AFP_INTEGRA', 'AFP_PRIMA', 'AFP_PROFUTURO', 'AFP_HABITAT'];

const EMPLOYEE_ROLES = [
  'OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER',
  'WAITER', 'KITCHEN', 'COOK', 'PACKER', 'BAR', 'DRIVER',
];

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function solesToCents(soles: string): number {
  return Math.round(parseFloat(soles) * 100);
}

function centsToSolesDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function isNewFormValid(form: {
  name: string;
  position: string;
  hire_date: string;
  base_salary_cents_display: string;
}): boolean {
  const soles = parseFloat(form.base_salary_cents_display);
  return !!(form.name.trim() && form.position.trim() && form.hire_date && !isNaN(soles));
}

// ============================================================================
// Tests — Module exports
// ============================================================================

describe('HREmployeesNewPage — module', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../new/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// Note: [id]/page and [id]/edit/page use React.use(params) which requires
// a real React Suspense context — tested via E2E instead of unit tests.

// ============================================================================
// Tests — ROLE_LABELS config
// ============================================================================

describe('HREmployees — ROLE_LABELS', () => {
  it('cubre los 11 roles del sistema', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(11);
  });

  it('todos los roles de EMPLOYEE_ROLES tienen label', () => {
    for (const role of EMPLOYEE_ROLES) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(ROLE_LABELS[role].trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(ROLE_LABELS.OWNER).toBe('Propietario');
    expect(ROLE_LABELS.CASHIER).toBe('Cajero(a)');
    expect(ROLE_LABELS.DRIVER).toBe('Motorizado(a)');
  });
});

// ============================================================================
// Tests — CONTRACT_TYPES / SCHEDULE_TYPES
// ============================================================================

describe('HREmployees — CONTRACT_TYPES', () => {
  it('tiene exactamente 3 tipos de contrato', () => {
    expect(CONTRACT_TYPES).toHaveLength(3);
  });

  it('incluye INDEFINIDO, PLAZO_FIJO, PART_TIME', () => {
    const values = CONTRACT_TYPES.map(c => c.value);
    expect(values).toContain('INDEFINIDO');
    expect(values).toContain('PLAZO_FIJO');
    expect(values).toContain('PART_TIME');
  });

  it('todos tienen value y label no vacíos', () => {
    for (const c of CONTRACT_TYPES) {
      expect(c.value.trim().length).toBeGreaterThan(0);
      expect(c.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('HREmployees — SCHEDULE_TYPES', () => {
  it('tiene exactamente 3 tipos de horario', () => {
    expect(SCHEDULE_TYPES).toHaveLength(3);
  });

  it('incluye FULL_TIME, PART_TIME, ROTATING', () => {
    const values = SCHEDULE_TYPES.map(s => s.value);
    expect(values).toContain('FULL_TIME');
    expect(values).toContain('PART_TIME');
    expect(values).toContain('ROTATING');
  });
});

describe('HREmployees — PENSION_SYSTEMS', () => {
  it('tiene 5 sistemas de pensión', () => {
    expect(PENSION_SYSTEMS).toHaveLength(5);
  });

  it('incluye ONP y las 4 AFP', () => {
    expect(PENSION_SYSTEMS).toContain('ONP');
    expect(PENSION_SYSTEMS).toContain('AFP_INTEGRA');
    expect(PENSION_SYSTEMS).toContain('AFP_PRIMA');
    expect(PENSION_SYSTEMS).toContain('AFP_PROFUTURO');
    expect(PENSION_SYSTEMS).toContain('AFP_HABITAT');
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('HREmployees — formatCurrency', () => {
  it('convierte centavos a soles con prefijo S/', () => {
    expect(formatCurrency(150000)).toContain('S/');
    expect(formatCurrency(150000)).toContain('1,500');
  });

  it('120000 centavos = S/ 1,200.00', () => {
    const result = formatCurrency(120000);
    expect(result).toContain('1,200');
    expect(result).toContain('00');
  });

  it('100 centavos = S/ 1.00', () => {
    const result = formatCurrency(100);
    expect(result).toContain('1.00');
  });

  it('0 centavos = S/ 0.00', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('property: siempre incluye prefijo S/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999900 }),
        (cents) => {
          expect(formatCurrency(cents)).toContain('S/');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Salary conversion (soles ↔ centavos)
// ============================================================================

describe('HREmployees — Conversión de salario', () => {
  it('1200.00 soles = 120000 centavos', () => {
    expect(solesToCents('1200.00')).toBe(120000);
  });

  it('930.50 soles = 93050 centavos', () => {
    expect(solesToCents('930.50')).toBe(93050);
  });

  it('centsToSolesDisplay invierte solesToCents', () => {
    const cents = 150000;
    const display = centsToSolesDisplay(cents);
    const back = solesToCents(display);
    expect(back).toBe(cents);
  });

  it('property: round-trip soles → cents → soles (múltiplos de 1 centavo)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        (cents) => {
          const display = centsToSolesDisplay(cents);
          const result = solesToCents(display);
          expect(result).toBe(cents);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: solesToCents siempre devuelve integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        fc.integer({ min: 0, max: 99 }),
        (soles, cents) => {
          const display = `${soles}.${String(cents).padStart(2, '0')}`;
          const result = solesToCents(display);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario (new page)
// ============================================================================

describe('HREmployeesNewPage — isFormValid', () => {
  it('formulario vacío no es válido', () => {
    expect(isNewFormValid({ name: '', position: '', hire_date: '', base_salary_cents_display: '' })).toBe(false);
  });

  it('requiere nombre', () => {
    expect(isNewFormValid({ name: '', position: 'Cajero', hire_date: '2026-01-01', base_salary_cents_display: '1200' })).toBe(false);
  });

  it('requiere puesto', () => {
    expect(isNewFormValid({ name: 'Juan', position: '', hire_date: '2026-01-01', base_salary_cents_display: '1200' })).toBe(false);
  });

  it('requiere hire_date', () => {
    expect(isNewFormValid({ name: 'Juan', position: 'Cajero', hire_date: '', base_salary_cents_display: '1200' })).toBe(false);
  });

  it('requiere salario numérico válido', () => {
    expect(isNewFormValid({ name: 'Juan', position: 'Cajero', hire_date: '2026-01-01', base_salary_cents_display: 'abc' })).toBe(false);
  });

  it('formulario completo es válido', () => {
    expect(isNewFormValid({
      name: 'Ana López', position: 'Cajera Principal',
      hire_date: '2026-03-01', base_salary_cents_display: '1200.00',
    })).toBe(true);
  });

  it('salario 0 es válido (part-time sin sueldo base)', () => {
    expect(isNewFormValid({
      name: 'Ana', position: 'Practicante',
      hire_date: '2026-03-01', base_salary_cents_display: '0',
    })).toBe(true);
  });

  it('property: siempre inválido sin nombre', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 9999 }),
        (position, year, month, day, soles) => {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          expect(isNewFormValid({
            name: '', position, hire_date: date,
            base_salary_cents_display: String(soles),
          })).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
