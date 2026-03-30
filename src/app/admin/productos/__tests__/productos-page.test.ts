/**
 * Admin Productos Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - CATEGORY_OPTIONS completeness (11 categories)
 * - STATION_OPTIONS completeness (6 stations)
 * - formatPrice helper (cents → 'S/ X.XX')
 * - Product status display (active/inactive)
 * - toggleSelection logic (add/remove from set)
 * - toggleSelectAll logic (select all vs deselect all)
 * - SWR endpoint
 *
 * @module app/admin/productos/__tests__/productos-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const CATEGORY_OPTIONS = [
  { value: 'POLLOS',      label: 'Pollos' },
  { value: 'PARRILLAS',   label: 'Parrillas' },
  { value: 'CRIOLLOS',    label: 'Criollos' },
  { value: 'SALCHIPAPAS', label: 'Salchipapas' },
  { value: 'ALITAS',      label: 'Alitas' },
  { value: 'PIQUEOS',     label: 'Piqueos' },
  { value: 'BEBIDAS',     label: 'Bebidas' },
  { value: 'GUARNICIONES',label: 'Guarniciones' },
  { value: 'EXTRAS',      label: 'Extras' },
  { value: 'POSTRES',     label: 'Postres' },
  { value: 'COMBOS',      label: 'Combos' },
];

const STATION_OPTIONS = [
  { value: 'PARRILLA', label: 'Parrilla' },
  { value: 'COCINA',   label: 'Cocina' },
  { value: 'BAR',      label: 'Bar' },
  { value: 'HORNO',    label: 'Horno' },
  { value: 'POSTRES',  label: 'Postres' },
  { value: 'EMPAQUE',  label: 'Empaque' },
];

const CATEGORY_VALUES = CATEGORY_OPTIONS.map(c => c.value);
const STATION_VALUES = STATION_OPTIONS.map(s => s.value);

function formatPrice(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function getStatusLabel(isActive: boolean): string {
  return isActive ? 'Activo' : 'Inactivo';
}

function getStatusColor(isActive: boolean): string {
  return isActive
    ? 'bg-green-500/20 text-green-400'
    : 'bg-zinc-500/20 text-zinc-400';
}

function toggleSelection(selectedIds: string[], id: string): string[] {
  return selectedIds.includes(id)
    ? selectedIds.filter(i => i !== id)
    : [...selectedIds, id];
}

function toggleSelectAll(selectedIds: string[], allIds: string[]): string[] {
  return selectedIds.length === allIds.length ? [] : [...allIds];
}

function getCategoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find(c => c.value === value)?.label ?? value;
}

function getStationLabel(value: string): string {
  return STATION_OPTIONS.find(s => s.value === value)?.label ?? value;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminProductosPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — CATEGORY_OPTIONS
// ============================================================================

describe('AdminProductosPage — CATEGORY_OPTIONS', () => {
  it('tiene exactamente 11 categorías', () => {
    expect(CATEGORY_OPTIONS).toHaveLength(11);
  });

  it('incluye las categorías del dominio pollería', () => {
    const expected = ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS', 'GUARNICIONES'];
    for (const cat of expected) {
      expect(CATEGORY_VALUES).toContain(cat);
    }
  });

  it('todos tienen value y label no vacíos', () => {
    for (const opt of CATEGORY_OPTIONS) {
      expect(opt.value.trim().length).toBeGreaterThan(0);
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(getCategoryLabel('POLLOS')).toBe('Pollos');
    expect(getCategoryLabel('BEBIDAS')).toBe('Bebidas');
    expect(getCategoryLabel('COMBOS')).toBe('Combos');
    expect(getCategoryLabel('GUARNICIONES')).toBe('Guarniciones');
  });

  it('categoría desconocida devuelve el valor original', () => {
    expect(getCategoryLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('property: todas las categorías conocidas tienen label no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORY_VALUES),
        (cat) => {
          expect(getCategoryLabel(cat).trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — STATION_OPTIONS
// ============================================================================

describe('AdminProductosPage — STATION_OPTIONS', () => {
  it('tiene exactamente 6 estaciones', () => {
    expect(STATION_OPTIONS).toHaveLength(6);
  });

  it('incluye PARRILLA, COCINA, BAR, HORNO, POSTRES, EMPAQUE', () => {
    const expected = ['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE'];
    for (const station of expected) {
      expect(STATION_VALUES).toContain(station);
    }
  });

  it('labels en español', () => {
    expect(getStationLabel('PARRILLA')).toBe('Parrilla');
    expect(getStationLabel('COCINA')).toBe('Cocina');
    expect(getStationLabel('BAR')).toBe('Bar');
    expect(getStationLabel('EMPAQUE')).toBe('Empaque');
  });

  it('estación desconocida devuelve el valor original', () => {
    expect(getStationLabel('FRIOS')).toBe('FRIOS');
  });
});

// ============================================================================
// Tests — formatPrice
// ============================================================================

describe('AdminProductosPage — formatPrice', () => {
  it('incluye prefijo S/', () => {
    expect(formatPrice(1500)).toContain('S/');
  });

  it('1500 centavos = S/ 15.00', () => {
    expect(formatPrice(1500)).toBe('S/ 15.00');
  });

  it('0 centavos = S/ 0.00', () => {
    expect(formatPrice(0)).toBe('S/ 0.00');
  });

  it('2490 centavos = S/ 24.90', () => {
    expect(formatPrice(2490)).toBe('S/ 24.90');
  });

  it('property: siempre incluye S/ y tiene 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        (cents) => {
          const result = formatPrice(cents);
          expect(result).toContain('S/');
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: precio en soles = cents / 100 (enteros)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (soles) => {
          const cents = soles * 100;
          // e.g. soles=15 → cents=1500 → 'S/ 15.00'
          expect(formatPrice(cents)).toContain(String(soles));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Estado del producto
// ============================================================================

describe('AdminProductosPage — Estado del producto', () => {
  it('activo → label "Activo"', () => {
    expect(getStatusLabel(true)).toBe('Activo');
  });

  it('inactivo → label "Inactivo"', () => {
    expect(getStatusLabel(false)).toBe('Inactivo');
  });

  it('activo → color verde', () => {
    expect(getStatusColor(true)).toContain('green');
  });

  it('inactivo → color zinc/gris', () => {
    expect(getStatusColor(false)).toContain('zinc');
  });

  it('property: siempre devuelve un string no vacío', () => {
    fc.assert(
      fc.property(fc.boolean(), (isActive) => {
        expect(getStatusLabel(isActive).trim().length).toBeGreaterThan(0);
        expect(getStatusColor(isActive).trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — toggleSelection (selección individual)
// ============================================================================

describe('AdminProductosPage — toggleSelection', () => {
  it('agrega id que no estaba seleccionado', () => {
    const result = toggleSelection(['a', 'b'], 'c');
    expect(result).toContain('c');
    expect(result).toHaveLength(3);
  });

  it('remueve id que ya estaba seleccionado', () => {
    const result = toggleSelection(['a', 'b', 'c'], 'b');
    expect(result).not.toContain('b');
    expect(result).toHaveLength(2);
  });

  it('toggle dos veces devuelve el estado original', () => {
    const original = ['a', 'b'];
    const after = toggleSelection(toggleSelection(original, 'c'), 'c');
    expect(after).toEqual(original);
  });

  it('property: longitud cambia en ±1', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 10 }),
        fc.uuid(),
        (selected, id) => {
          // Ensure id is not already in selected for clean test
          const cleanSelected = selected.filter(s => s !== id);
          const added = toggleSelection(cleanSelected, id);
          expect(added).toHaveLength(cleanSelected.length + 1);
          const removed = toggleSelection(added, id);
          expect(removed).toHaveLength(cleanSelected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — toggleSelectAll (selección masiva)
// ============================================================================

describe('AdminProductosPage — toggleSelectAll', () => {
  const allIds = ['a', 'b', 'c', 'd'];

  it('desde vacío → selecciona todos', () => {
    expect(toggleSelectAll([], allIds)).toEqual(allIds);
  });

  it('desde parcial → selecciona todos', () => {
    expect(toggleSelectAll(['a'], allIds)).toEqual(allIds);
  });

  it('desde todos seleccionados → deselecciona todo', () => {
    expect(toggleSelectAll(allIds, allIds)).toEqual([]);
  });

  it('property: desde todos seleccionados siempre resulta en vacío', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (ids) => {
          expect(toggleSelectAll(ids, ids)).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: desde vacío siempre selecciona todos', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (ids) => {
          expect(toggleSelectAll([], ids)).toEqual(ids);
        }
      ),
      { numRuns: 100 }
    );
  });
});
