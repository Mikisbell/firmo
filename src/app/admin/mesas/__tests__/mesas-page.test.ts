/**
 * Admin Mesas Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Table shapes completeness (SQUARE/ROUND/RECTANGLE)
 * - Table status color logic (AVAILABLE/OCCUPIED)
 * - Status label mapping
 * - Table display name fallback (display_name || "Mesa {number}")
 * - Capacity label formatting
 * - Filter options for shape
 *
 * @module app/admin/mesas/__tests__/mesas-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const TABLE_SHAPES: Record<string, string> = {
  SQUARE:    'Cuadrada',
  ROUND:     'Redonda',
  RECTANGLE: 'Rectangular',
};

const TABLE_SHAPE_VALUES = Object.keys(TABLE_SHAPES);

const TABLE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/20 text-green-400',
  OCCUPIED:  'bg-amber-500/20 text-amber-400',
};

const TABLE_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Libre',
  OCCUPIED:  'Ocupada',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

function getTableStatusColor(status: string): string {
  return TABLE_STATUS_COLORS[status] ?? 'bg-zinc-500/20 text-zinc-400';
}

function getTableStatusLabel(status: string): string {
  return TABLE_STATUS_LABELS[status] ?? status;
}

function getShapeLabel(shape: string): string {
  return TABLE_SHAPES[shape] ?? shape;
}

function getTableDisplayName(displayName: string | null, number: string): string {
  return displayName || `Mesa ${number}`;
}

function formatCapacity(capacity: number): string {
  return `${capacity} pers.`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminMesasPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — TABLE_SHAPES
// ============================================================================

describe('AdminMesasPage — TABLE_SHAPES', () => {
  it('cubre los 3 tipos de forma', () => {
    expect(TABLE_SHAPE_VALUES).toHaveLength(3);
  });

  it('incluye SQUARE, ROUND, RECTANGLE', () => {
    expect(TABLE_SHAPES.SQUARE).toBeDefined();
    expect(TABLE_SHAPES.ROUND).toBeDefined();
    expect(TABLE_SHAPES.RECTANGLE).toBeDefined();
  });

  it('labels en español', () => {
    expect(TABLE_SHAPES.SQUARE).toBe('Cuadrada');
    expect(TABLE_SHAPES.ROUND).toBe('Redonda');
    expect(TABLE_SHAPES.RECTANGLE).toBe('Rectangular');
  });

  it('forma desconocida devuelve el valor original', () => {
    expect(getShapeLabel('HEXAGONAL')).toBe('HEXAGONAL');
  });
});

// ============================================================================
// Tests — TABLE_STATUS
// ============================================================================

describe('AdminMesasPage — Estado de mesa', () => {
  it('AVAILABLE es verde', () => {
    expect(getTableStatusColor('AVAILABLE')).toContain('green');
  });

  it('OCCUPIED es ámbar', () => {
    expect(getTableStatusColor('OCCUPIED')).toContain('amber');
  });

  it('estado desconocido devuelve color zinc (fallback)', () => {
    expect(getTableStatusColor('RESERVED')).toContain('zinc');
  });

  it('AVAILABLE label es "Libre"', () => {
    expect(getTableStatusLabel('AVAILABLE')).toBe('Libre');
  });

  it('OCCUPIED label es "Ocupada"', () => {
    expect(getTableStatusLabel('OCCUPIED')).toBe('Ocupada');
  });

  it('estado desconocido devuelve el propio valor', () => {
    expect(getTableStatusLabel('RESERVED')).toBe('RESERVED');
  });

  it('property: estados conocidos siempre tienen color con bg- y text-', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('AVAILABLE', 'OCCUPIED'),
        (status) => {
          const color = getTableStatusColor(status);
          expect(color).toMatch(/bg-\w+/);
          expect(color).toMatch(/text-\w+/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Display name fallback
// ============================================================================

describe('AdminMesasPage — Display name', () => {
  it('usa display_name si existe', () => {
    expect(getTableDisplayName('VIP 1', '5')).toBe('VIP 1');
  });

  it('fallback a "Mesa {number}" si display_name es null', () => {
    expect(getTableDisplayName(null, '3')).toBe('Mesa 3');
  });

  it('fallback a "Mesa {number}" si display_name es string vacío', () => {
    expect(getTableDisplayName('', '7')).toBe('Mesa 7');
  });

  it('property: siempre devuelve string no vacío', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        fc.integer({ min: 1, max: 50 }).map(n => String(n)),
        (displayName, number) => {
          const result = getTableDisplayName(displayName, number);
          expect(result.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — formatCapacity
// ============================================================================

describe('AdminMesasPage — formatCapacity', () => {
  it('4 personas = "4 pers."', () => {
    expect(formatCapacity(4)).toBe('4 pers.');
  });

  it('1 persona = "1 pers."', () => {
    expect(formatCapacity(1)).toBe('1 pers.');
  });

  it('property: siempre incluye "pers."', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (cap) => {
          expect(formatCapacity(cap)).toContain('pers.');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Filter options
// ============================================================================

describe('AdminMesasPage — Opciones de filtro', () => {
  it('shape filter tiene los 3 valores', () => {
    expect(TABLE_SHAPE_VALUES).toHaveLength(3);
  });

  it('status filter tiene Activa e Inactiva', () => {
    const values = STATUS_FILTER_OPTIONS.map(o => o.value);
    expect(values).toContain('true');
    expect(values).toContain('false');
  });

  it('status filter labels en español', () => {
    const labels = STATUS_FILTER_OPTIONS.map(o => o.label);
    expect(labels).toContain('Activa');
    expect(labels).toContain('Inactiva');
  });
});
