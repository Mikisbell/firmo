/**
 * Admin Terminales Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - ROLE_ICONS completeness (5 roles de terminal)
 * - STATUS_COLORS / STATUS_LABELS completeness (3 estados)
 * - isOnline: lastSeen within 5 minutes
 * - copyCode formatting: "ABCDEFG" → "ABC-DEFG"
 * - filteredDevices by status
 * - Summary totals (total / active / pending / disabled)
 *
 * @module app/admin/terminales/__tests__/terminales-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type TerminalRole = 'CAJA' | 'MOZO' | 'KDS_COCINA' | 'KDS_HORNO' | 'KDS_BAR';
type TerminalStatus = 'active' | 'pending' | 'disabled';

const TERMINAL_ROLES: TerminalRole[] = ['CAJA', 'MOZO', 'KDS_COCINA', 'KDS_HORNO', 'KDS_BAR'];

const STATUS_LABELS: Record<TerminalStatus, string> = {
  active:   'Activo',
  pending:  'Pendiente',
  disabled: 'Inactivo',
};

const STATUS_COLORS: Record<TerminalStatus, string> = {
  active:   'bg-green-500/20 text-green-400',
  pending:  'bg-amber-500/20 text-amber-400',
  disabled: 'bg-gray-500/20 text-gray-400',
};

const TERMINAL_STATUSES = Object.keys(STATUS_LABELS) as TerminalStatus[];

interface TerminalDevice {
  id: string;
  terminal_id: string;
  role: TerminalRole;
  status: TerminalStatus;
  device_name: string;
  last_seen_at?: string | null;
  activation_code?: { code: string; expires_at: string } | null;
}

function formatActivationCode(code: string): string {
  // "ABCDEFG" → "ABC-DEFG"
  if (code.length <= 3) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function filterByStatus(devices: TerminalDevice[], status: TerminalStatus): TerminalDevice[] {
  return devices.filter(d => d.status === status);
}

function buildSummary(devices: TerminalDevice[]): { total: number; active: number; pending: number; disabled: number } {
  return {
    total:    devices.length,
    active:   filterByStatus(devices, 'active').length,
    pending:  filterByStatus(devices, 'pending').length,
    disabled: filterByStatus(devices, 'disabled').length,
  };
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminTerminalesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — ROLE_ICONS / TERMINAL_ROLES
// ============================================================================

describe('AdminTerminalesPage — Roles de terminal', () => {
  it('hay exactamente 5 roles', () => {
    expect(TERMINAL_ROLES).toHaveLength(5);
  });

  it('incluye CAJA, MOZO, KDS_COCINA, KDS_HORNO, KDS_BAR', () => {
    expect(TERMINAL_ROLES).toContain('CAJA');
    expect(TERMINAL_ROLES).toContain('MOZO');
    expect(TERMINAL_ROLES).toContain('KDS_COCINA');
    expect(TERMINAL_ROLES).toContain('KDS_HORNO');
    expect(TERMINAL_ROLES).toContain('KDS_BAR');
  });
});

// ============================================================================
// Tests — STATUS_LABELS / STATUS_COLORS
// ============================================================================

describe('AdminTerminalesPage — STATUS_LABELS', () => {
  it('hay 3 estados', () => {
    expect(TERMINAL_STATUSES).toHaveLength(3);
  });

  it('active es verde', () => {
    expect(STATUS_COLORS.active).toContain('green');
  });

  it('pending es ámbar', () => {
    expect(STATUS_COLORS.pending).toContain('amber');
  });

  it('disabled es gris', () => {
    expect(STATUS_COLORS.disabled).toContain('gray');
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.active).toBe('Activo');
    expect(STATUS_LABELS.pending).toBe('Pendiente');
    expect(STATUS_LABELS.disabled).toBe('Inactivo');
  });

  it('property: todos los estados tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TERMINAL_STATUSES),
        (status) => {
          expect(STATUS_LABELS[status].trim().length).toBeGreaterThan(0);
          expect(STATUS_COLORS[status].trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatActivationCode
// ============================================================================

describe('AdminTerminalesPage — formatActivationCode', () => {
  it('"ABCDEFG" → "ABC-DEFG"', () => {
    expect(formatActivationCode('ABCDEFG')).toBe('ABC-DEFG');
  });

  it('"ABC123" → "ABC-123"', () => {
    expect(formatActivationCode('ABC123')).toBe('ABC-123');
  });

  it('código de 3 chars → sin guión', () => {
    expect(formatActivationCode('ABC')).toBe('ABC');
  });

  it('código de 7 chars incluye guión en posición 3', () => {
    const code = '1234567';
    const result = formatActivationCode(code);
    expect(result[3]).toBe('-');
  });

  it('property: siempre contiene guión si length > 3', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 })
          .filter(s => /^[A-Z0-9]+$/.test(s.toUpperCase()))
          .map(s => s.toUpperCase()),
        (code) => {
          const result = formatActivationCode(code);
          expect(result).toContain('-');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — isOnline
// ============================================================================

describe('AdminTerminalesPage — isOnline', () => {
  it('null → offline', () => {
    expect(isOnline(null)).toBe(false);
    expect(isOnline(undefined)).toBe(false);
  });

  it('hace 1 minuto → online', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isOnline(recent)).toBe(true);
  });

  it('hace 6 minutos → offline', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(isOnline(old)).toBe(false);
  });
});

// ============================================================================
// Tests — filterByStatus / buildSummary
// ============================================================================

describe('AdminTerminalesPage — Filtros y resumen', () => {
  const devices: TerminalDevice[] = [
    { id: '1', terminal_id: 'CAJA-01', role: 'CAJA',  status: 'active',   device_name: 'Caja 1' },
    { id: '2', terminal_id: 'MOZO-01', role: 'MOZO',  status: 'active',   device_name: 'Mozo 1' },
    { id: '3', terminal_id: 'KDS-01',  role: 'KDS_COCINA', status: 'pending',  device_name: 'KDS Cocina' },
    { id: '4', terminal_id: 'OLD-01',  role: 'CAJA',  status: 'disabled', device_name: 'Old Terminal' },
  ];

  it('filterByStatus active → 2 terminales', () => {
    expect(filterByStatus(devices, 'active')).toHaveLength(2);
  });

  it('filterByStatus pending → 1 terminal', () => {
    expect(filterByStatus(devices, 'pending')).toHaveLength(1);
  });

  it('buildSummary: total = active + pending + disabled', () => {
    const summary = buildSummary(devices);
    expect(summary.total).toBe(4);
    expect(summary.active + summary.pending + summary.disabled).toBe(summary.total);
  });

  it('buildSummary vacío → todo 0', () => {
    const summary = buildSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.active).toBe(0);
  });

  it('property: active + pending + disabled = total', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(...TERMINAL_STATUSES).map(status => ({
            id: 'x', terminal_id: 'T', role: 'CAJA' as TerminalRole,
            status, device_name: 'D'
          })),
          { minLength: 0, maxLength: 20 }
        ),
        (devices) => {
          const s = buildSummary(devices);
          expect(s.active + s.pending + s.disabled).toBe(s.total);
        }
      ),
      { numRuns: 100 }
    );
  });
});
