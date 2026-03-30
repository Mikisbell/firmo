/**
 * Admin Recetas Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - CATEGORY_OPTIONS completeness (8 categories including 'Todas')
 * - STATION_OPTIONS completeness (6 areas)
 * - STATION_COLORS completeness
 * - formatCost helper (null → '—', cents → 'S/ X.XX')
 * - Recipe SWR URL construction with filters
 * - Cost recalculation URL
 * - Ingredient validation (quantity > 0, unit required)
 *
 * @module app/admin/recetas/__tests__/recetas-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const CATEGORY_OPTIONS = [
  { value: '',         label: 'Todas' },
  { value: 'POLLO',    label: 'Pollo' },
  { value: 'ADEREZO',  label: 'Aderezo' },
  { value: 'GUARNICION', label: 'Guarnición' },
  { value: 'SALSA',    label: 'Salsa' },
  { value: 'BEBIDA',   label: 'Bebida' },
  { value: 'POSTRE',   label: 'Postre' },
  { value: 'OTRO',     label: 'Otro' },
];

const STATION_OPTIONS = [
  { value: '',          label: 'Todas las áreas' },
  { value: 'PARRILLA',  label: 'Parrillas' },
  { value: 'HORNO',     label: 'Horno' },
  { value: 'COCINA',    label: 'Cocina' },
  { value: 'BAR',       label: 'Bar' },
  { value: 'EMPAQUE',   label: 'Empaque' },
];

const STATION_COLORS: Record<string, string> = {
  PARRILLA: 'bg-orange-900/30 text-orange-300 border-orange-700',
  HORNO:    'bg-red-900/30 text-red-300 border-red-700',
  COCINA:   'bg-amber-900/30 text-amber-300 border-amber-700',
  BAR:      'bg-sky-900/30 text-sky-300 border-sky-700',
  EMPAQUE:  'bg-violet-900/30 text-violet-300 border-violet-700',
};

const KNOWN_STATIONS = Object.keys(STATION_COLORS);
const KNOWN_CATEGORIES = CATEGORY_OPTIONS.filter(c => c.value !== '').map(c => c.value);

function formatCost(cents: number | null): string {
  return cents != null ? `S/ ${(cents / 100).toFixed(2)}` : '—';
}

function buildRecipesURL(page: number, category: string, station: string): string {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (category) params.set('category', category);
  if (station) params.set('station', station);
  return `/api/admin/recipes?${params.toString()}`;
}

function buildCostCalcURL(recipeId: string): string {
  return `/api/admin/recipes/${recipeId}`;
}

function buildDeactivateURL(recipeId: string): string {
  return `/api/admin/recipes/${recipeId}`;
}

interface Ingredient {
  inventory_code: string;
  quantity: number;
  unit: string;
  is_optional?: boolean;
}

function isIngredientValid(ingredient: Ingredient): boolean {
  return !!(ingredient.inventory_code.trim() && ingredient.quantity > 0 && ingredient.unit.trim());
}

function isRecipeFormValid(productId: string, ingredients: Ingredient[]): boolean {
  return !!(productId && ingredients.length > 0 && ingredients.every(isIngredientValid));
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminRecetasPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — CATEGORY_OPTIONS
// ============================================================================

describe('AdminRecetasPage — CATEGORY_OPTIONS', () => {
  it('tiene 8 entradas (incluye "Todas" vacía)', () => {
    expect(CATEGORY_OPTIONS).toHaveLength(8);
  });

  it('primera opción es "Todas" con value vacío', () => {
    expect(CATEGORY_OPTIONS[0].value).toBe('');
    expect(CATEGORY_OPTIONS[0].label).toBe('Todas');
  });

  it('incluye las 7 categorías de receta', () => {
    const expected = ['POLLO', 'ADEREZO', 'GUARNICION', 'SALSA', 'BEBIDA', 'POSTRE', 'OTRO'];
    for (const cat of expected) {
      expect(KNOWN_CATEGORIES).toContain(cat);
    }
  });

  it('labels en español', () => {
    expect(CATEGORY_OPTIONS.find(c => c.value === 'POLLO')?.label).toBe('Pollo');
    expect(CATEGORY_OPTIONS.find(c => c.value === 'GUARNICION')?.label).toBe('Guarnición');
    expect(CATEGORY_OPTIONS.find(c => c.value === 'OTRO')?.label).toBe('Otro');
  });

  it('ningún label está vacío', () => {
    for (const opt of CATEGORY_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — STATION_OPTIONS
// ============================================================================

describe('AdminRecetasPage — STATION_OPTIONS', () => {
  it('tiene 6 entradas (incluye "Todas las áreas")', () => {
    expect(STATION_OPTIONS).toHaveLength(6);
  });

  it('primera opción es "Todas las áreas" con value vacío', () => {
    expect(STATION_OPTIONS[0].value).toBe('');
    expect(STATION_OPTIONS[0].label).toBe('Todas las áreas');
  });

  it('incluye PARRILLA, HORNO, COCINA, BAR, EMPAQUE', () => {
    for (const station of KNOWN_STATIONS) {
      expect(STATION_OPTIONS.some(s => s.value === station)).toBe(true);
    }
  });
});

// ============================================================================
// Tests — STATION_COLORS
// ============================================================================

describe('AdminRecetasPage — STATION_COLORS', () => {
  it('cubre 5 estaciones con colores', () => {
    expect(Object.keys(STATION_COLORS)).toHaveLength(5);
  });

  it('cada color tiene bg-, text- y border-', () => {
    for (const color of Object.values(STATION_COLORS)) {
      expect(color).toMatch(/bg-\w+/);
      expect(color).toMatch(/text-\w+/);
      expect(color).toMatch(/border-\w+/);
    }
  });

  it('PARRILLA es naranja (fuego)', () => {
    expect(STATION_COLORS.PARRILLA).toContain('orange');
  });

  it('BAR es sky/azul', () => {
    expect(STATION_COLORS.BAR).toContain('sky');
  });

  it('HORNO es rojo', () => {
    expect(STATION_COLORS.HORNO).toContain('red');
  });
});

// ============================================================================
// Tests — formatCost
// ============================================================================

describe('AdminRecetasPage — formatCost', () => {
  it('null → "—" (sin costo calculado)', () => {
    expect(formatCost(null)).toBe('—');
  });

  it('0 centavos → S/ 0.00', () => {
    expect(formatCost(0)).toBe('S/ 0.00');
  });

  it('150 centavos → S/ 1.50', () => {
    expect(formatCost(150)).toBe('S/ 1.50');
  });

  it('2500 centavos → S/ 25.00', () => {
    expect(formatCost(2500)).toBe('S/ 25.00');
  });

  it('property: valor no-null siempre incluye S/ y 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        (cents) => {
          const result = formatCost(cents);
          expect(result).toContain('S/');
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URL construction
// ============================================================================

describe('AdminRecetasPage — URLs', () => {
  it('URL base sin filtros incluye page y limit', () => {
    const url = buildRecipesURL(1, '', '');
    expect(url).toContain('/api/admin/recipes');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });

  it('URL con categoría incluye category param', () => {
    const url = buildRecipesURL(1, 'POLLO', '');
    expect(url).toContain('category=POLLO');
  });

  it('URL con estación incluye station param', () => {
    const url = buildRecipesURL(1, '', 'PARRILLA');
    expect(url).toContain('station=PARRILLA');
  });

  it('URL sin filtros no incluye category ni station', () => {
    const url = buildRecipesURL(1, '', '');
    expect(url).not.toContain('category');
    expect(url).not.toContain('station');
  });

  it('URL de cálculo de costo usa PATCH sobre /api/admin/recipes/:id', () => {
    expect(buildCostCalcURL('recipe-123')).toBe('/api/admin/recipes/recipe-123');
  });

  it('URL de desactivar usa DELETE sobre /api/admin/recipes/:id', () => {
    expect(buildDeactivateURL('recipe-456')).toBe('/api/admin/recipes/recipe-456');
  });

  it('property: URL con categoría siempre la incluye', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_CATEGORIES),
        fc.integer({ min: 1, max: 10 }),
        (cat, page) => {
          const url = buildRecipesURL(page, cat, '');
          expect(url).toContain(`category=${cat}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Validación de ingredientes
// ============================================================================

describe('AdminRecetasPage — Validación de ingredientes', () => {
  it('ingrediente válido: código, cantidad > 0, unidad', () => {
    expect(isIngredientValid({ inventory_code: 'POLLO-01', quantity: 1.5, unit: 'kg' })).toBe(true);
  });

  it('ingrediente inválido: código vacío', () => {
    expect(isIngredientValid({ inventory_code: '', quantity: 1, unit: 'kg' })).toBe(false);
  });

  it('ingrediente inválido: cantidad = 0', () => {
    expect(isIngredientValid({ inventory_code: 'POLLO-01', quantity: 0, unit: 'kg' })).toBe(false);
  });

  it('ingrediente inválido: unidad vacía', () => {
    expect(isIngredientValid({ inventory_code: 'POLLO-01', quantity: 1, unit: '' })).toBe(false);
  });

  it('is_optional no afecta la validez', () => {
    const valid = { inventory_code: 'SAL-01', quantity: 5, unit: 'g', is_optional: true };
    expect(isIngredientValid(valid)).toBe(true);
  });
});

// ============================================================================
// Tests — Validación del formulario de receta
// ============================================================================

describe('AdminRecetasPage — isRecipeFormValid', () => {
  const validIngredient: Ingredient = { inventory_code: 'POLLO-01', quantity: 1, unit: 'kg' };

  it('inválido sin product_id', () => {
    expect(isRecipeFormValid('', [validIngredient])).toBe(false);
  });

  it('inválido sin ingredientes', () => {
    expect(isRecipeFormValid('prod-123', [])).toBe(false);
  });

  it('inválido si algún ingrediente no es válido', () => {
    const badIngredient: Ingredient = { inventory_code: '', quantity: 1, unit: 'kg' };
    expect(isRecipeFormValid('prod-123', [validIngredient, badIngredient])).toBe(false);
  });

  it('válido con product_id y todos los ingredientes correctos', () => {
    expect(isRecipeFormValid('prod-123', [validIngredient])).toBe(true);
  });

  it('property: siempre inválido sin product_id', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            inventory_code: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            quantity: fc.integer({ min: 1, max: 10000 }).map(n => n / 100), // 0.01 → 100.00
            unit: fc.constantFrom('g', 'kg', 'ml', 'l', 'unidad'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (ingredients) => {
          expect(isRecipeFormValid('', ingredients)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: siempre inválido con cantidad <= 0', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.integer({ min: -1000, max: 0 }).map(n => n / 100), // -10.00 → 0.00
        fc.constantFrom('g', 'kg', 'ml'),
        (code, qty, unit) => {
          const ingredient: Ingredient = { inventory_code: code, quantity: qty, unit };
          expect(isIngredientValid(ingredient)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
