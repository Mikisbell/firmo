/**
 * Tests para invalidación inteligente de caché de COGS
 * 
 * Valida que los handlers de cambio de costo y receta
 * invaliden correctamente el caché de productos afectados.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { COGSCalculator } from '../cogs-calculator';
import prisma from '@/src/core/db/prisma';
import { cache } from '@/src/core/cache/cache-service';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { eventBus } from '@/src/core/infra/event-bus';

// Mock de dependencias
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    recipes: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/src/core/cache/cache-service', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  generateCacheKey: vi.fn((prefix: string, tenantId: string, productId: string) => `${prefix}:${tenantId}:${productId}`),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn(),
  },
}));

vi.mock('@/src/core/infra/event-bus', () => ({
  eventBus: {
    publish: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => '00000000-0000-4000-a000-000000000000'),
}));

describe('COGSCalculator - Invalidación Inteligente', () => {
  let calculator: COGSCalculator;
  
  beforeEach(() => {
    calculator = new COGSCalculator();
    vi.clearAllMocks();
  });
  
  describe('onIngredientCostChanged', () => {
    it('debe invalidar caché de productos que usan el ingrediente', async () => {
      // Arrange
      const inventoryCode = 'ING-POLLO';
      const tenantId = 'tenant_123';
      const newCostCents = 1500;
      const changedBy = '550e8400-e29b-41d4-a716-446655440000'; // UUID válido
      
      // Mock: 2 recetas usan el ingrediente
      const mockRecipes = [
        {
          id: 'recipe_1',
          product_id: 'prod_1',
          tenant_id: tenantId,
          is_active: true,
          ingredients: [
            { inventory_code: 'ING-POLLO', quantity: 1.5, unit: 'kg' },
            { inventory_code: 'ING-PAPA', quantity: 0.5, unit: 'kg' },
          ],
        },
        {
          id: 'recipe_2',
          product_id: 'prod_2',
          tenant_id: tenantId,
          is_active: true,
          ingredients: [
            { inventory_code: 'ING-POLLO', quantity: 1.0, unit: 'kg' },
          ],
        },
        {
          id: 'recipe_3',
          product_id: 'prod_3',
          tenant_id: tenantId,
          is_active: true,
          ingredients: [
            { inventory_code: 'ING-ARROZ', quantity: 0.3, unit: 'kg' },
          ],
        },
      ];
      
      vi.mocked(prisma.recipes.findMany).mockResolvedValue(mockRecipes as any);
      
      // Act
      await calculator.onIngredientCostChanged(
        inventoryCode,
        tenantId,
        newCostCents,
        undefined, // oldCostCents
        changedBy
      );
      
      // Assert
      // Debe buscar todas las recetas del tenant
      expect(prisma.recipes.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      });
      
      // Debe invalidar caché de los 2 productos que usan el ingrediente
      expect(cache.delete).toHaveBeenCalledTimes(2);
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant_123:prod_1');
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant_123:prod_2');
      
      // NO debe invalidar el producto que no usa el ingrediente
      expect(cache.delete).not.toHaveBeenCalledWith('cogs:tenant_123:prod_3');
      
      // Debe loggear el evento
      expect(logger.info).toHaveBeenCalledWith(
        'Ingredient cost changed, invalidating COGS cache',
        expect.objectContaining({
          inventoryCode,
          tenantId,
          newCostCents,
          changedBy,
        })
      );

      // Debe emitir evento de auditoría via eventBus
      expect(eventBus.publish).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          event_type: 'INGREDIENT_COST_CHANGED',
          tenant_id: tenantId,
        })
      );

      // Debe registrar métricas
      expect(metrics.increment).toHaveBeenCalledWith('cogs.ingredient_cost_changed');
      expect(metrics.timing).toHaveBeenCalledWith(
        'cogs.on_ingredient_cost_changed',
        expect.any(Number)
      );
    });
    
    it('debe propagar error cuando falla la búsqueda de recetas', async () => {
      // Arrange
      const inventoryCode = 'ING-POLLO';
      const tenantId = 'tenant_123';
      const newCostCents = 1500;

      vi.mocked(prisma.recipes.findMany).mockRejectedValue(new Error('DB error'));

      // Act - Debe lanzar excepción (onIngredientCostChanged re-throws errors)
      await expect(
        calculator.onIngredientCostChanged(inventoryCode, tenantId, newCostCents)
      ).rejects.toThrow('DB error');

      // Assert
      // Debe loggear el error
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to handle ingredient cost change',
        expect.any(Error),
        expect.objectContaining({
          inventoryCode,
          tenantId,
          newCostCents,
        })
      );

      // Debe registrar métrica de error
      expect(metrics.increment).toHaveBeenCalledWith('cogs.ingredient_cost_changed_error');
    });
  });
  
  describe('onRecipeChanged', () => {
    it('debe invalidar caché del producto', async () => {
      // Arrange
      const productId = 'prod_123';
      const tenantId = 'tenant_456';
      const changedBy = 'user_789';
      
      // Act
      await calculator.onRecipeChanged(productId, tenantId, changedBy);
      
      // Assert
      // Debe invalidar caché del producto
      expect(cache.delete).toHaveBeenCalledTimes(1);
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant_456:prod_123');
      
      // Debe loggear el evento
      expect(logger.info).toHaveBeenCalledWith(
        'Recipe changed, invalidating COGS cache',
        expect.objectContaining({
          productId,
          tenantId,
          changedBy,
        })
      );
      
      // Debe emitir evento de auditoría
      expect(logger.info).toHaveBeenCalledWith(
        'RECIPE_CHANGED event',
        expect.objectContaining({
          eventType: 'RECIPE_CHANGED',
          productId,
          tenantId,
          changedBy,
        })
      );
      
      // Debe registrar métricas
      expect(metrics.increment).toHaveBeenCalledWith('cogs.recipe_changed');
      expect(metrics.timing).toHaveBeenCalledWith(
        'cogs.on_recipe_changed',
        expect.any(Number)
      );
    });
    
    it('debe manejar error de invalidación de caché gracefully', async () => {
      // Arrange
      const productId = 'prod_123';
      const tenantId = 'tenant_456';

      vi.mocked(cache.delete).mockRejectedValue(new Error('Cache error'));

      // Act - No debe lanzar excepción (invalidateCacheForProduct catches errors internally)
      await calculator.onRecipeChanged(productId, tenantId);

      // Assert
      // Debe loggear el error de invalidación dentro de invalidateCacheForProduct
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to invalidate COGS cache',
        expect.any(Error),
        expect.objectContaining({
          productId,
          tenantId,
        })
      );

      // Debe registrar métrica de error de invalidación
      expect(metrics.increment).toHaveBeenCalledWith('cogs.cache.invalidation_error');
    });
    
    it('debe funcionar sin changedBy (opcional)', async () => {
      // Arrange
      const productId = 'prod_123';
      const tenantId = 'tenant_456';
      
      // Act
      await calculator.onRecipeChanged(productId, tenantId);
      
      // Assert
      // Debe invalidar caché del producto
      expect(cache.delete).toHaveBeenCalledTimes(1);
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant_456:prod_123');
      
      // Debe loggear sin changedBy
      expect(logger.info).toHaveBeenCalledWith(
        'Recipe changed, invalidating COGS cache',
        expect.objectContaining({
          productId,
          tenantId,
          changedBy: undefined,
        })
      );
    });
  });
});
