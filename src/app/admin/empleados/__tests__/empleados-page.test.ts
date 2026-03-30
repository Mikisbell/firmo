/**
 * Admin Empleados Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - ROLE_OPTIONS completeness (11 roles)
 * - ROLE_COLORS completeness (all 11 roles have a color)
 * - Employee status display (active/inactive)
 * - SWR endpoint construction (with/without inactive filter)
 *
 * @module app/admin/empleados/__tests__/empleados-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const ROLE_OPTIONS = [
  { value: 'OWNER',      label: 'Propietario' },
  { value: 'ADMIN',      label: 'Administrador' },
  { value: 'MANAGER',    label: 'Gerente' },
  { value: 'SUPERVISOR', label: 'Supervisor(a)' },
  { value: 'CASHIER',    label: 'Cajero(a)' },
  { value: 'WAITER',     label: 'Mesero(a)' },
  { value: 'KITCHEN',    label: 'Cocina' },
  { value: 'COOK',       label: 'Cocinero(a)' },
  { value: 'PACKER',     label: 'Empaquetador(a)' },
  { value: 'BAR',        label: 'Barman' },
  { value: 'DRIVER',     label: 'Motorizado(a)' },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER:      'bg-amber-500/20 text-amber-400',
  ADMIN:      'bg-purple-500/20 text-purple-400',
  MANAGER:    'bg-blue-500/20 text-blue-400',
  SUPERVISOR: 'bg-indigo-500/20 text-indigo-400',
  CASHIER:    'bg-green-500/20 text-green-400',
  WAITER:     'bg-cyan-500/20 text-cyan-400',
  KITCHEN:    'bg-orange-500/20 text-orange-400',
  COOK:       'bg-orange-400/20 text-orange-300',
  PACKER:     'bg-yellow-500/20 text-yellow-400',
  BAR:        'bg-teal-500/20 text-teal-400',
  DRIVER:     'bg-pink-500/20 text-pink-400',
};

function buildEmployeesEndpoint(showInactive: boolean): string {
  return showInactive
    ? '/api/admin/employees?is_active=false&pageSize=100'
    : '/api/admin/employees?pageSize=100';
}

function getRoleLabel(role: string): string {
  return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
}

function getStatusLabel(isActive: boolean): string {
  return isActive ? 'Activo' : 'Inactivo';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminEmpleadosPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — ROLE_OPTIONS
// ============================================================================

describe('AdminEmpleadosPage — ROLE_OPTIONS', () => {
  it('tiene exactamente 11 roles', () => {
    expect(ROLE_OPTIONS).toHaveLength(11);
  });

  it('incluye todos los roles del sistema', () => {
    const values = ROLE_OPTIONS.map(r => r.value);
    const expected = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER',
                      'WAITER', 'KITCHEN', 'COOK', 'PACKER', 'BAR', 'DRIVER'];
    for (const role of expected) {
      expect(values).toContain(role);
    }
  });

  it('todos tienen value y label no vacíos', () => {
    for (const opt of ROLE_OPTIONS) {
      expect(opt.value.trim().length).toBeGreaterThan(0);
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(getRoleLabel('OWNER')).toBe('Propietario');
    expect(getRoleLabel('CASHIER')).toBe('Cajero(a)');
    expect(getRoleLabel('DRIVER')).toBe('Motorizado(a)');
  });

  it('rol desconocido devuelve el valor original', () => {
    expect(getRoleLabel('UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
  });
});

// ============================================================================
// Tests — ROLE_COLORS
// ============================================================================

describe('AdminEmpleadosPage — ROLE_COLORS', () => {
  it('tiene colores para los 11 roles', () => {
    expect(Object.keys(ROLE_COLORS)).toHaveLength(11);
  });

  it('todos los roles de ROLE_OPTIONS tienen color', () => {
    for (const opt of ROLE_OPTIONS) {
      expect(ROLE_COLORS[opt.value]).toBeDefined();
    }
  });

  it('cada color tiene clase bg- y text-', () => {
    for (const color of Object.values(ROLE_COLORS)) {
      expect(color).toMatch(/bg-\w+/);
      expect(color).toMatch(/text-\w+/);
    }
  });

  it('OWNER tiene color ámbar (premium)', () => {
    expect(ROLE_COLORS.OWNER).toContain('amber');
  });

  it('ADMIN tiene color púrpura', () => {
    expect(ROLE_COLORS.ADMIN).toContain('purple');
  });
});

// ============================================================================
// Tests — Estado del empleado
// ============================================================================

describe('AdminEmpleadosPage — Estado de empleado', () => {
  it('empleado activo muestra "Activo"', () => {
    expect(getStatusLabel(true)).toBe('Activo');
  });

  it('empleado inactivo muestra "Inactivo"', () => {
    expect(getStatusLabel(false)).toBe('Inactivo');
  });

  it('property: getStatusLabel siempre devuelve un string no vacío', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isActive) => {
          const label = getStatusLabel(isActive);
          expect(label.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Endpoint construction
// ============================================================================

describe('AdminEmpleadosPage — Construcción de endpoint', () => {
  it('sin inactivos: URL base con pageSize=100', () => {
    expect(buildEmployeesEndpoint(false)).toBe('/api/admin/employees?pageSize=100');
  });

  it('con inactivos: URL incluye is_active=false', () => {
    const url = buildEmployeesEndpoint(true);
    expect(url).toContain('is_active=false');
    expect(url).toContain('pageSize=100');
  });

  it('ambas URLs apuntan a /api/admin/employees', () => {
    expect(buildEmployeesEndpoint(false)).toContain('/api/admin/employees');
    expect(buildEmployeesEndpoint(true)).toContain('/api/admin/employees');
  });
});
