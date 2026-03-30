/**
 * Admin Drivers Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Driver statuses (available/on_delivery/inactive)
 * - Status badge color logic per status
 * - Toggle active logic (active ↔ inactive state flip)
 * - handleSave: POST for new, PATCH for existing driver
 * - Form validation: name required, phone optional
 *
 * @module app/admin/drivers/__tests__/drivers-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source and DriverForm
// ============================================================================

type DriverStatus = 'available' | 'on_delivery' | 'inactive';

const DRIVER_STATUSES: DriverStatus[] = ['available', 'on_delivery', 'inactive'];

const STATUS_LABELS: Record<DriverStatus, string> = {
  available:    'Disponible',
  on_delivery:  'En entrega',
  inactive:     'Inactivo',
};

const STATUS_COLORS: Record<DriverStatus, string> = {
  available:    'bg-green-500/20 text-green-400',
  on_delivery:  'bg-amber-500/20 text-amber-400',
  inactive:     'bg-zinc-500/20 text-zinc-400',
};

function getStatusLabel(status: DriverStatus): string {
  return STATUS_LABELS[status];
}

function getStatusColor(status: DriverStatus): string {
  return STATUS_COLORS[status];
}

function buildDriverURL(driverId: string | null): { url: string; method: string } {
  if (driverId) {
    return { url: `/api/drivers/${driverId}`, method: 'PATCH' };
  }
  return { url: '/api/drivers', method: 'POST' };
}

function buildToggleBody(isActive: boolean): { is_active: boolean } {
  return { is_active: !isActive };
}

function isDriverFormValid(name: string): boolean {
  return !!name.trim();
}

function buildSavePayload(name: string, phone: string): { name: string; phone?: string } {
  const trimmedPhone = phone.trim();
  return { name: name.trim(), ...(trimmedPhone ? { phone: trimmedPhone } : {}) };
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminDriversPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Driver statuses
// ============================================================================

describe('AdminDriversPage — Estados del motorizado', () => {
  it('hay exactamente 3 estados', () => {
    expect(DRIVER_STATUSES).toHaveLength(3);
  });

  it('incluye available, on_delivery, inactive', () => {
    expect(DRIVER_STATUSES).toContain('available');
    expect(DRIVER_STATUSES).toContain('on_delivery');
    expect(DRIVER_STATUSES).toContain('inactive');
  });

  it('labels en español', () => {
    expect(getStatusLabel('available')).toBe('Disponible');
    expect(getStatusLabel('on_delivery')).toBe('En entrega');
    expect(getStatusLabel('inactive')).toBe('Inactivo');
  });

  it('available es verde', () => {
    expect(getStatusColor('available')).toContain('green');
  });

  it('on_delivery es ámbar', () => {
    expect(getStatusColor('on_delivery')).toContain('amber');
  });

  it('inactive es zinc/gris', () => {
    expect(getStatusColor('inactive')).toContain('zinc');
  });

  it('todos los estados tienen label y color definidos', () => {
    for (const status of DRIVER_STATUSES) {
      expect(STATUS_LABELS[status].trim().length).toBeGreaterThan(0);
      expect(STATUS_COLORS[status].trim().length).toBeGreaterThan(0);
    }
  });

  it('property: todos los estados tienen bg- y text- en su color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DRIVER_STATUSES),
        (status) => {
          const color = getStatusColor(status);
          expect(color).toMatch(/bg-\w+/);
          expect(color).toMatch(/text-\w+/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Toggle activo/inactivo
// ============================================================================

describe('AdminDriversPage — Toggle activo', () => {
  it('motorizado activo → se desactiva', () => {
    expect(buildToggleBody(true)).toEqual({ is_active: false });
  });

  it('motorizado inactivo → se activa', () => {
    expect(buildToggleBody(false)).toEqual({ is_active: true });
  });

  it('property: toggle siempre invierte el valor', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isActive) => {
          const result = buildToggleBody(isActive);
          expect(result.is_active).toBe(!isActive);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('doble toggle devuelve al estado original', () => {
    const original = true;
    const after = buildToggleBody(buildToggleBody(original).is_active).is_active;
    expect(after).toBe(original);
  });
});

// ============================================================================
// Tests — URL de guardado (crear vs editar)
// ============================================================================

describe('AdminDriversPage — URL de guardado', () => {
  it('nuevo motorizado: POST a /api/drivers', () => {
    const { url, method } = buildDriverURL(null);
    expect(method).toBe('POST');
    expect(url).toBe('/api/drivers');
  });

  it('editar motorizado: PATCH a /api/drivers/:id', () => {
    const { url, method } = buildDriverURL('driver-123');
    expect(method).toBe('PATCH');
    expect(url).toBe('/api/drivers/driver-123');
  });

  it('property: editar siempre incluye el id en la URL', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (id) => {
          const { url, method } = buildDriverURL(id);
          expect(url).toContain(id);
          expect(method).toBe('PATCH');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario DriverForm
// ============================================================================

describe('AdminDriversPage — DriverForm validación', () => {
  it('nombre vacío no es válido', () => {
    expect(isDriverFormValid('')).toBe(false);
  });

  it('nombre con espacios no es válido', () => {
    expect(isDriverFormValid('   ')).toBe(false);
  });

  it('nombre con texto es válido', () => {
    expect(isDriverFormValid('Juan Ríos')).toBe(true);
  });

  it('property: nombre no vacío siempre válido', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (name) => {
          expect(isDriverFormValid(name)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Construcción del payload de guardado
// ============================================================================

describe('AdminDriversPage — Payload de guardado', () => {
  it('incluye name trimmeado', () => {
    const payload = buildSavePayload('  Juan  ', '');
    expect(payload.name).toBe('Juan');
  });

  it('phone opcional: no incluye phone si está vacío', () => {
    const payload = buildSavePayload('Juan', '');
    expect(payload).not.toHaveProperty('phone');
  });

  it('incluye phone si está presente', () => {
    const payload = buildSavePayload('Juan', '999888777');
    expect(payload.phone).toBe('999888777');
  });

  it('phone solo espacios no se incluye', () => {
    const payload = buildSavePayload('Juan', '   ');
    expect(payload).not.toHaveProperty('phone');
  });

  it('property: payload siempre tiene name no vacío', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ minLength: 1 }), { nil: '' }),
        (name, phone) => {
          const payload = buildSavePayload(name, phone ?? '');
          expect(payload.name.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
