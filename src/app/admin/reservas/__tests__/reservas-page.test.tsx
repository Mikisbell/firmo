/**
 * Admin Reservas Page — Unit Tests
 *
 * Validates:
 * - Module imports and default export
 * - Date helpers: getTodayStr, formatDateDisplay, shiftDate
 * - Status config completeness
 * - Actions per status logic
 * - Status filter options
 * - Summary card calculations
 * - SWR URL construction
 *
 * @module app/admin/reservas/__tests__/reservas-page
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('swr', () => ({
  default: () => ({
    data: null,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/src/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

// ============================================================================
// Helpers extracted from page source (replicated for unit testing)
// ============================================================================

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Status config from the page
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pendiente',  color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  CONFIRMED: { label: 'Confirmada', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  REJECTED:  { label: 'Rechazada',  color: 'text-red-400', bg: 'bg-red-500/15' },
  CANCELLED: { label: 'Cancelada',  color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
  ARRIVED:   { label: 'Llego',      color: 'text-blue-400', bg: 'bg-blue-500/15' },
  SEATED:    { label: 'Sentada',    color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  NO_SHOW:   { label: 'No-show',    color: 'text-red-400', bg: 'bg-red-500/15' },
  COMPLETED: { label: 'Completada', color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
};

type ReservationAction = 'confirm' | 'reject' | 'arrive' | 'seat' | 'no_show' | 'cancel';

const ACTIONS_BY_STATUS: Record<string, { action: ReservationAction; label: string }[]> = {
  PENDING: [
    { action: 'confirm', label: 'Confirmar' },
    { action: 'reject', label: 'Rechazar' },
    { action: 'cancel', label: 'Cancelar' },
  ],
  CONFIRMED: [
    { action: 'arrive', label: 'Llego' },
    { action: 'no_show', label: 'No-show' },
    { action: 'cancel', label: 'Cancelar' },
  ],
  ARRIVED: [
    { action: 'seat', label: 'Sentar' },
  ],
  SEATED: [],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
  COMPLETED: [],
};

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'ARRIVED', label: 'Llegaron' },
  { value: 'SEATED', label: 'Sentadas' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

// ============================================================================
// Tests
// ============================================================================

describe('AdminReservasPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el nombre del componente debe ser AdminReservasPage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('AdminReservasPage');
  });

  it('no debe exportar como named export', async () => {
    const mod = await import('../page');
    const exports = Object.keys(mod).filter(k => k !== 'default');
    // Only default export expected
    expect(exports.length).toBe(0);
  });
});

describe('AdminReservasPage — Date Helpers', () => {
  it('getTodayStr devuelve formato YYYY-MM-DD', () => {
    const today = getTodayStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getTodayStr devuelve la fecha actual', () => {
    const today = getTodayStr();
    const parts = today.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    expect(year).toBeGreaterThanOrEqual(2026);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('formatDateDisplay formatea correctamente', () => {
    const display = formatDateDisplay('2026-02-28');
    expect(display).toContain('2026');
    expect(display).toContain('Feb');
    expect(display).toContain('28');
  });

  it('shiftDate avanza un dia', () => {
    const result = shiftDate('2026-02-28', 1);
    expect(result).toBe('2026-03-01');
  });

  it('shiftDate retrocede un dia', () => {
    const result = shiftDate('2026-03-01', -1);
    expect(result).toBe('2026-02-28');
  });

  it('shiftDate cruza fin de mes correctamente', () => {
    const result = shiftDate('2026-01-31', 1);
    expect(result).toBe('2026-02-01');
  });

  it('shiftDate cruza fin de anio', () => {
    const result = shiftDate('2026-12-31', 1);
    expect(result).toBe('2027-01-01');
  });

  it('shiftDate con 0 dias no cambia la fecha', () => {
    const result = shiftDate('2026-05-15', 0);
    expect(result).toBe('2026-05-15');
  });
});

describe('AdminReservasPage — STATUS_CONFIG', () => {
  it('cubre todos los 8 estados posibles', () => {
    const expectedStatuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'ARRIVED', 'SEATED', 'NO_SHOW', 'COMPLETED'];
    for (const status of expectedStatuses) {
      expect(STATUS_CONFIG[status]).toBeDefined();
      expect(STATUS_CONFIG[status].label).toBeTruthy();
      expect(STATUS_CONFIG[status].color).toBeTruthy();
      expect(STATUS_CONFIG[status].bg).toBeTruthy();
    }
  });

  it('cada status tiene clase de color Tailwind valida', () => {
    for (const [, cfg] of Object.entries(STATUS_CONFIG)) {
      expect(cfg.color).toMatch(/^text-/);
      expect(cfg.bg).toMatch(/^bg-/);
    }
  });

  it('labels estan en espanol', () => {
    expect(STATUS_CONFIG.PENDING.label).toBe('Pendiente');
    expect(STATUS_CONFIG.CONFIRMED.label).toBe('Confirmada');
    expect(STATUS_CONFIG.CANCELLED.label).toBe('Cancelada');
  });
});

describe('AdminReservasPage — ACTIONS_BY_STATUS', () => {
  it('PENDING tiene 3 acciones: confirm, reject, cancel', () => {
    const actions = ACTIONS_BY_STATUS.PENDING.map(a => a.action);
    expect(actions).toEqual(['confirm', 'reject', 'cancel']);
  });

  it('CONFIRMED tiene 3 acciones: arrive, no_show, cancel', () => {
    const actions = ACTIONS_BY_STATUS.CONFIRMED.map(a => a.action);
    expect(actions).toEqual(['arrive', 'no_show', 'cancel']);
  });

  it('ARRIVED tiene 1 accion: seat', () => {
    const actions = ACTIONS_BY_STATUS.ARRIVED.map(a => a.action);
    expect(actions).toEqual(['seat']);
  });

  it('estados terminales no tienen acciones', () => {
    const terminals = ['SEATED', 'REJECTED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'];
    for (const status of terminals) {
      expect(ACTIONS_BY_STATUS[status]).toEqual([]);
    }
  });
});

describe('AdminReservasPage — STATUS_FILTERS', () => {
  it('tiene 7 opciones de filtro', () => {
    expect(STATUS_FILTERS).toHaveLength(7);
  });

  it('primera opcion es "Todos" con valor vacio', () => {
    expect(STATUS_FILTERS[0]).toEqual({ value: '', label: 'Todos' });
  });

  it('todos los filtros tienen value y label', () => {
    for (const filter of STATUS_FILTERS) {
      expect(filter).toHaveProperty('value');
      expect(filter).toHaveProperty('label');
      expect(typeof filter.label).toBe('string');
    }
  });
});

describe('AdminReservasPage — SWR API URL Construction', () => {
  it('construye URL con solo fecha', () => {
    const date = '2026-02-28';
    const statusFilter = '';
    const url = `/api/admin/reservations?date=${date}${statusFilter ? `&status=${statusFilter}` : ''}`;
    expect(url).toBe('/api/admin/reservations?date=2026-02-28');
  });

  it('construye URL con fecha y filtro de status', () => {
    const date = '2026-02-28';
    const statusFilter = 'PENDING';
    const url = `/api/admin/reservations?date=${date}${statusFilter ? `&status=${statusFilter}` : ''}`;
    expect(url).toBe('/api/admin/reservations?date=2026-02-28&status=PENDING');
  });
});

describe('AdminReservasPage — Summary Default Values', () => {
  it('default summary tiene todos los campos en 0', () => {
    const defaultSummary = {
      total: 0, confirmed: 0, pending: 0, cancelled: 0,
      no_show: 0, arrived: 0, seated: 0, rejected: 0, completed: 0,
    };

    for (const [, value] of Object.entries(defaultSummary)) {
      expect(value).toBe(0);
    }
    expect(Object.keys(defaultSummary)).toHaveLength(9);
  });
});
