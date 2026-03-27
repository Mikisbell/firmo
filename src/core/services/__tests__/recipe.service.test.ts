/**
 * Recipe Service Unit Tests
 *
 * Tests para RecipeService con Prisma mockeado.
 * Verifica CRUD, validaciones, aislamiento por tenant, y cálculo de costos.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeService } from '../recipe.service';
import type { CreateRecipeDTO, UpdateRecipeDTO } from '@/src/core/admin/schemas/recipe.schema';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockTx: any = {
  recipes: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  products: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  inventory: {
    findMany: vi.fn(),
  },
};

vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (_prisma: any, operation: any) => {
    try {
      const result = await operation(mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const RECIPE_ID = '11111111-2222-3333-4444-555555555555';
const PRODUCT_ID = '22222222-3333-4444-5555-666666666666';
const USER_ID = '99999999-8888-7777-6666-555555555555';

function makeValidInput(overrides?: Partial<CreateRecipeDTO>): CreateRecipeDTO {
  return {
    product_id: PRODUCT_ID,
    name: 'Pollo a la Brasa',
    ingredients: [
      { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD', is_optional: false },
      { inventory_code: 'ADEREZO-BRASA', quantity: 0.067, unit: 'LITROS', is_optional: false },
    ],
    yield_qty: 4,
    yield_unit: 'PORCIONES',
    conversion_factor: 0.72,
    category: 'POLLO',
    preparation_time_minutes: 90,
    notes: 'Receta estándar de pollo a la brasa',
    ...overrides,
  };
}

function makeRecipeRow(overrides?: Record<string, unknown>) {
  return {
    id: RECIPE_ID,
    tenant_id: TENANT_ID,
    product_id: PRODUCT_ID,
    name: 'Pollo a la Brasa',
    ingredients: [
      { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD', is_optional: false },
      { inventory_code: 'ADEREZO-BRASA', quantity: 0.067, unit: 'LITROS', is_optional: false },
    ],
    yield_qty: 4,
    yield_unit: 'PORCIONES',
    conversion_factor: 0.72,
    category: 'POLLO',
    preparation_time_minutes: 90,
    notes: 'Receta estándar',
    cost_cents: null,
    last_cost_at: null,
    is_active: true,
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

const PRODUCT_ROW = {
  id: PRODUCT_ID,
  name: 'Pollo a la Brasa',
  station: 'PARRILLA',
};

// ============================================================================
// Tests
// ============================================================================

describe('RecipeService', () => {
  let service: RecipeService;
  const mockPrisma: any = {
    recipes: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    products: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    inventory: {
      findMany: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecipeService(mockPrisma);
  });

  // ==========================================================================
  // Create
  // ==========================================================================

  describe('create', () => {
    it('debe crear una receta exitosamente', async () => {
      const input = makeValidInput();

      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.recipes.findFirst.mockResolvedValue(null); // no duplicada
      mockPrisma.inventory.findMany.mockResolvedValue([
        { code: 'POLLO-ENTERO' },
        { code: 'ADEREZO-BRASA' },
      ]);
      mockTx.recipes.create.mockResolvedValue(makeRecipeRow());

      const result = await service.create(TENANT_ID, input, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.product_id).toBe(PRODUCT_ID);
        expect(result.data.name).toBe('Pollo a la Brasa');
        expect(result.data.yield_qty).toBe(4);
        expect(result.data.conversion_factor).toBe(0.72);
        expect(result.data.category).toBe('POLLO');
        expect(result.data.product_name).toBe('Pollo a la Brasa');
        expect(result.data.product_station).toBe('PARRILLA');
      }
    });

    it('debe fallar si el producto no existe', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(null);

      const result = await service.create(TENANT_ID, makeValidInput(), USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('debe fallar si ya existe una receta para el producto', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.recipes.findFirst.mockResolvedValue(makeRecipeRow()); // ya existe

      const result = await service.create(TENANT_ID, makeValidInput(), USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
      }
    });

    it('debe fallar si ingrediente no existe en inventario', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.recipes.findFirst.mockResolvedValue(null);
      mockPrisma.inventory.findMany.mockResolvedValue([
        { code: 'POLLO-ENTERO' },
        // Falta ADEREZO-BRASA
      ]);

      const result = await service.create(TENANT_ID, makeValidInput(), USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('ADEREZO-BRASA');
      }
    });
  });

  // ==========================================================================
  // Get By ID
  // ==========================================================================

  describe('getById', () => {
    it('debe retornar una receta existente', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(makeRecipeRow());
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);

      const result = await service.getById(TENANT_ID, RECIPE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(RECIPE_ID);
        expect(result.data.product_name).toBe('Pollo a la Brasa');
      }
    });

    it('debe retornar NOT_FOUND si no existe', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(null);

      const result = await service.getById(TENANT_ID, 'no-existe');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // List
  // ==========================================================================

  describe('list', () => {
    it('debe listar recetas paginadas', async () => {
      mockPrisma.recipes.findMany.mockResolvedValue([makeRecipeRow()]);
      mockPrisma.recipes.count.mockResolvedValue(1);
      mockPrisma.products.findMany.mockResolvedValue([PRODUCT_ROW]);

      const result = await service.list(TENANT_ID, { page: 1, limit: 20 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.total).toBe(1);
        expect(result.data.page).toBe(1);
      }
    });

    it('debe filtrar por categoría', async () => {
      mockPrisma.recipes.findMany.mockResolvedValue([]);
      mockPrisma.recipes.count.mockResolvedValue(0);
      mockPrisma.products.findMany.mockResolvedValue([]);

      const result = await service.list(TENANT_ID, { category: 'POLLO', limit: 20, page: 1 });

      expect(result.success).toBe(true);
      expect(mockPrisma.recipes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'POLLO' }),
        }),
      );
    });

    it('debe filtrar por estación del producto', async () => {
      mockPrisma.recipes.findMany.mockResolvedValue([
        makeRecipeRow(),
        makeRecipeRow({ id: 'other-id', product_id: 'other-product' }),
      ]);
      mockPrisma.recipes.count.mockResolvedValue(2);
      mockPrisma.products.findMany.mockResolvedValue([
        PRODUCT_ROW,
        { id: 'other-product', name: 'Chaufa', station: 'COCINA' },
      ]);

      const result = await service.list(TENANT_ID, { station: 'PARRILLA', limit: 20, page: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0].product_station).toBe('PARRILLA');
      }
    });
  });

  // ==========================================================================
  // Update
  // ==========================================================================

  describe('update', () => {
    it('debe actualizar una receta exitosamente', async () => {
      const updateData: UpdateRecipeDTO = { name: 'Pollo Especial', yield_qty: 8 };

      mockPrisma.recipes.findFirst.mockResolvedValue(makeRecipeRow());
      mockTx.recipes.update.mockResolvedValue(makeRecipeRow({ name: 'Pollo Especial', yield_qty: 8 }));
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);

      const result = await service.update(TENANT_ID, RECIPE_ID, updateData, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Pollo Especial');
      }
    });

    it('debe fallar si la receta no existe', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(null);

      const result = await service.update(TENANT_ID, 'no-existe', { name: 'Test' }, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('debe validar ingredientes al actualizar', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(makeRecipeRow());
      mockPrisma.inventory.findMany.mockResolvedValue([]); // Ningún ingrediente encontrado

      const result = await service.update(
        TENANT_ID,
        RECIPE_ID,
        { ingredients: [{ inventory_code: 'NO-EXISTE', quantity: 1, unit: 'KG', is_optional: false }] },
        USER_ID,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ==========================================================================
  // Deactivate
  // ==========================================================================

  describe('deactivate', () => {
    it('debe desactivar una receta', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(makeRecipeRow());
      mockTx.recipes.update.mockResolvedValue(makeRecipeRow({ is_active: false }));

      const result = await service.deactivate(TENANT_ID, RECIPE_ID, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(false);
      }
    });

    it('debe fallar si la receta no existe', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(null);

      const result = await service.deactivate(TENANT_ID, 'no-existe', USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // Calculate Cost
  // ==========================================================================

  describe('calculateCost', () => {
    it('debe calcular el costo total de la receta', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(
        makeRecipeRow({
          ingredients: [
            { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD' },
            { inventory_code: 'ADEREZO-BRASA', quantity: 0.5, unit: 'LITROS' },
          ],
        }),
      );
      mockPrisma.inventory.findFirst = vi.fn()
        .mockResolvedValueOnce({ cost_cents: 2500 }) // POLLO-ENTERO: S/25.00
        .mockResolvedValueOnce({ cost_cents: 800 });  // ADEREZO-BRASA: S/8.00 por litro

      mockPrisma.recipes.update.mockResolvedValue({});

      const result = await service.calculateCost(TENANT_ID, RECIPE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        // 1 * 2500 + 0.5 * 800 = 2500 + 400 = 2900
        expect(result.data.cost_cents).toBe(2900);
      }
    });

    it('debe fallar si la receta no existe', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(null);

      const result = await service.calculateCost(TENANT_ID, 'no-existe');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('debe manejar ingredientes sin costo', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(
        makeRecipeRow({
          ingredients: [
            { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD' },
          ],
        }),
      );
      mockPrisma.inventory.findFirst = vi.fn().mockResolvedValue(null);
      mockPrisma.recipes.update.mockResolvedValue({});

      const result = await service.calculateCost(TENANT_ID, RECIPE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cost_cents).toBe(0);
      }
    });
  });
});
