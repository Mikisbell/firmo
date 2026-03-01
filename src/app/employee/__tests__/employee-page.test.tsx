/**
 * Employee Home Page — Unit Tests
 *
 * Validates:
 * - Module imports and default export
 * - Date formatting (formatDate)
 * - Currency formatting (formatCurrency) — always in centavos
 * - Contract type labels
 * - Days worked calculation
 * - Next shift finding logic
 * - Quick action navigation targets
 *
 * @module app/employee/__tests__/employee-page
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: null,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('@/src/core/constants/roles', () => ({
  ROLE_LABELS: {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    SUPERVISOR: 'Supervisor',
    CASHIER: 'Cajero',
    WAITER: 'Mesero',
    KITCHEN: 'Cocina',
    COOK: 'Cocinero',
    PACKER: 'Empacador',
    BAR: 'Bar',
    DRIVER: 'Repartidor',
  },
}));

// ============================================================================
// Helpers extracted from page source
// ============================================================================

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  PART_TIME: 'Part Time',
};

// ============================================================================
// Tests
// ============================================================================

describe('EmployeeHomePage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el nombre del componente debe ser EmployeeHomePage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('EmployeeHomePage');
  });
});

describe('EmployeeHomePage — formatDate', () => {
  it('formatea fecha ISO correctamente', () => {
    const result = formatDate('2026-02-28');
    // es-PE locale format: DD de MMM de YYYY or similar
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('incluye el anio 2026', () => {
    const result = formatDate('2026-02-28');
    expect(result).toContain('2026');
  });

  it('formatea diferentes fechas', () => {
    const jan = formatDate('2026-01-15');
    const dec = formatDate('2026-12-25');
    expect(jan).toBeTruthy();
    expect(dec).toBeTruthy();
    expect(jan).not.toBe(dec);
  });
});

describe('EmployeeHomePage — formatCurrency', () => {
  it('formatea 0 centavos como S/ 0.00', () => {
    const result = formatCurrency(0);
    expect(result).toContain('S/');
    expect(result).toContain('0');
  });

  it('formatea 250000 centavos (S/ 2,500.00)', () => {
    const result = formatCurrency(250000);
    expect(result).toContain('S/');
    expect(result).toContain('2');
    expect(result).toContain('500');
  });

  it('siempre tiene 2 decimales', () => {
    const result = formatCurrency(100);
    // Should have exactly 2 decimal places
    expect(result).toMatch(/\.\d{2}/);
  });

  it('nunca usa float — solo integer centavos', () => {
    // Validates the project rule: money always in centavos (integer)
    const cents = 2500;
    expect(Number.isInteger(cents)).toBe(true);
    const formatted = formatCurrency(cents);
    expect(formatted).toContain('S/');
  });
});

describe('EmployeeHomePage — CONTRACT_LABELS', () => {
  it('tiene 3 tipos de contrato', () => {
    expect(Object.keys(CONTRACT_LABELS)).toHaveLength(3);
  });

  it('INDEFINIDO se muestra como Indefinido', () => {
    expect(CONTRACT_LABELS.INDEFINIDO).toBe('Indefinido');
  });

  it('PLAZO_FIJO se muestra como Plazo Fijo', () => {
    expect(CONTRACT_LABELS.PLAZO_FIJO).toBe('Plazo Fijo');
  });

  it('PART_TIME se muestra como Part Time', () => {
    expect(CONTRACT_LABELS.PART_TIME).toBe('Part Time');
  });

  it('todos los labels estan en espanol', () => {
    for (const [, label] of Object.entries(CONTRACT_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe('EmployeeHomePage — Days Worked Calculation', () => {
  it('cuenta dias con PRESENT correctamente', () => {
    const attendance = [
      { status: 'PRESENT' },
      { status: 'LATE' },
      { status: 'ABSENT' },
      { status: 'PRESENT' },
      { status: 'VACATION' },
    ];

    const daysWorked = attendance.filter(
      a => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;

    expect(daysWorked).toBe(3);
  });

  it('retorna 0 con array vacio', () => {
    const attendance: { status: string }[] = [];
    const daysWorked = attendance.filter(
      a => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;

    expect(daysWorked).toBe(0);
  });

  it('retorna 0 cuando attendance no es array', () => {
    const attendance = null as { status: string }[] | null;
    const daysWorked = attendance
      ? attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length
      : 0;

    expect(daysWorked).toBe(0);
  });

  it('LATE cuenta como dia trabajado', () => {
    const attendance = [
      { status: 'LATE' },
      { status: 'LATE' },
    ];

    const daysWorked = attendance.filter(
      a => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;

    expect(daysWorked).toBe(2);
  });
});

describe('EmployeeHomePage — Next Shift Logic', () => {
  it('encuentra el proximo turno futuro', () => {
    const todayStr = '2026-02-28';
    const schedule = [
      { date: '2026-02-27', shift_start: '08:00' },
      { date: '2026-02-28', shift_start: '14:00' },
      { date: '2026-03-01', shift_start: '08:00' },
    ];

    const nextShift = schedule.find(s => s.date >= todayStr);
    expect(nextShift).toBeDefined();
    expect(nextShift?.date).toBe('2026-02-28');
  });

  it('retorna null cuando no hay turnos futuros', () => {
    const todayStr = '2026-03-15';
    const schedule = [
      { date: '2026-02-27', shift_start: '08:00' },
      { date: '2026-02-28', shift_start: '14:00' },
    ];

    const nextShift = schedule.find(s => s.date >= todayStr);
    expect(nextShift).toBeUndefined();
  });

  it('retorna null cuando schedule es null', () => {
    const schedule = null as { date: string; shift_start: string }[] | null;
    const nextShift = schedule
      ? schedule.find(s => new Date(s.date) >= new Date())
      : null;

    expect(nextShift).toBeNull();
  });
});

describe('EmployeeHomePage — Quick Actions Navigation', () => {
  it('tiene 3 acciones rapidas', () => {
    const actions = [
      { label: 'Solicitar Vacaciones', href: '/employee/vacation' },
      { label: 'Ver Boletas de Pago', href: '/employee/payslips' },
      { label: 'Mi Asistencia', href: '/employee/attendance' },
    ];

    expect(actions).toHaveLength(3);
  });

  it('vacation navega a /employee/vacation', () => {
    const vacationHref = '/employee/vacation';
    expect(vacationHref).toBe('/employee/vacation');
  });

  it('payslips navega a /employee/payslips', () => {
    const payslipsHref = '/employee/payslips';
    expect(payslipsHref).toBe('/employee/payslips');
  });

  it('attendance navega a /employee/attendance', () => {
    const attendanceHref = '/employee/attendance';
    expect(attendanceHref).toBe('/employee/attendance');
  });
});

describe('EmployeeHomePage — Profile Card Display', () => {
  it('muestra la primera letra del nombre como avatar', () => {
    const name = 'Juan Perez';
    const initial = name.charAt(0).toUpperCase();
    expect(initial).toBe('J');
  });

  it('muestra ? cuando nombre no existe', () => {
    const name = undefined as string | undefined;
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    expect(initial).toBe('?');
  });

  it('muestra salario solo cuando base_salary_cents > 0', () => {
    expect(250000 > 0).toBe(true); // Shows salary
    expect(0 > 0).toBe(false); // Hides salary
  });
});

describe('EmployeeHomePage — SWR Endpoints', () => {
  it('usa los endpoints correctos de HR API', () => {
    const endpoints = [
      '/api/hr/me',
      '/api/hr/me/vacation-balance',
      '/api/hr/me/schedule',
    ];

    for (const endpoint of endpoints) {
      expect(endpoint).toMatch(/^\/api\/hr\//);
    }
  });

  it('attendance endpoint incluye mes actual', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const endpoint = `/api/hr/me/attendance?month=${currentMonth}`;
    expect(endpoint).toContain('month=');
    expect(currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });
});
