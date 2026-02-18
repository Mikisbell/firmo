/**
 * COGS Calculator - Tests Unitarios
 * 
 * Tests para el calculador de COGS (Cost of Goods Sold).
 * 
 * Cobertura:
 * - Cálculo de COGS desde receta
 * - Costo promedio ponderado de ingredientes
 * - Caché de COGS
 * - Invalidación de caché
 * - Manejo de errores
 * 
 * @module core/services/__tests__/cogs-calculator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { COGSCalculator } from '../cogs-calculator';
import { toCOGS } from '@/src/core/types/profitability';
import prisma from '@/src/core/db/prisma';
import { cache } from '@/src/core/cache/cache-service';
import { Decimal } from '@prisma/client/runtime/library';

// Helper para crear mock de inventory item
const createInventoryMock = (code: string, name: string, costCents: number | null, stock = 100) => ({
  id: `inv-${code}`,
  tenant_id: 'tenant-123',
  code,
  name,
  unit: 'kg',
  stock: new Decimal(stock),
  min_stock: null,
  cost_cents: costCents,
  updated_at: new Date(),
  created_at: new Date(),
  created_by: null,
  expiry_date: null,
  last_count_at: null,
  location_id: null,
  lot_number: null,
  theoretical_stock: new Decimal(stock),
  updated_by: null,
});

// Helper para crear mock de receta
const createRecipeMock = (productId: string, ingredients: any[], isActive = true, yieldQty = 1) => ({
  id: 'recipe-1',
  tenant_id: 'tenant-123',
  product_id: productId,
  ingredients,
  yield_qty: new Decimal(yieldQty),
  is_active: isActive,
  created_at: new Date(),
  updated_at: new Date(),
});

// Mock de Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    recipes: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock del servicio de caché
vi.mock('@/src/core/cache/cache-service', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  generateCacheKey: (...parts: (string | number)[]) => parts.join(':'),
}));

describe('COGSCalculator', () => {
  let calculator: COGSCalculator;
  const tenantId = 'tenant-123';
  const productId = 'product-456';
  
  beforeEach(() => {
    calculator = new COGSCalculator();
    vi.clearAllMocks();
  });
  
  describe('calculateFromRecipe', () => {
    it('debe retornar COGS desde caché si existe', async () => {
      // Arrange
      const cachedCOGS = 2050;
      vi.mocked(cache.get).mockResolvedValue(cachedCOGS);
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(cachedCOGS);
      expect(cache.get).toHaveBeenCalledWith('cogs:tenant-123:product-456');
      expect(prisma.recipes.findUnique).not.toHaveBeenCalled();
    });
    
    it('debe retornar COGS = 0 si no hay receta', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(null);
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
      expect(cache.set).toHaveBeenCalledWith(
        'cogs:tenant-123:product-456',
        0,
        expect.objectContaining({ ttl: 300 })
      );
    });
    
    it('debe retornar COGS = 0 si la receta está inactiva', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [], false)
      );
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe retornar COGS = 0 si la receta no tiene ingredientes', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [])
      );
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe calcular COGS correctamente desde receta con ingredientes', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      
      // Receta: Pollo a la Brasa
      // - 1.5 kg pollo × 1200 cents/kg = 1800 cents
      // - 0.5 kg papa × 200 cents/kg = 100 cents
      // - 0.1 L aceite × 1500 cents/L = 150 cents
      // Total COGS = 2050 centavos
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [
          { inventory_code: 'ING-POLLO', quantity: 1.5, unit: 'kg' },
          { inventory_code: 'ING-PAPA', quantity: 0.5, unit: 'kg' },
          { inventory_code: 'ING-ACEITE', quantity: 0.1, unit: 'L' },
        ])
      );
      
      // Mock de costos de ingredientes
      vi.mocked(prisma.inventory.findUnique)
        .mockResolvedValueOnce(createInventoryMock('ING-POLLO', 'Pollo', 1200))
        .mockResolvedValueOnce(createInventoryMock('ING-PAPA', 'Papa', 200, 50))
        .mockResolvedValueOnce(createInventoryMock('ING-ACEITE', 'Aceite', 1500, 20));
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(2050); // 1800 + 100 + 150 = 2050 cents
      expect(cache.set).toHaveBeenCalledWith(
        'cogs:tenant-123:product-456',
        2050,
        expect.objectContaining({ ttl: 300 })
      );
    });
    
    it('debe redondear COGS a integer', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      
      // Receta con cantidades decimales que resultan en COGS decimal
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [
          { inventory_code: 'ING-TEST', quantity: 0.333, unit: 'kg' },
        ])
      );
      
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(
        createInventoryMock('ING-TEST', 'Test', 1000)
      );
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      // 0.333 × 1000 = 333.0 → redondeado a 333
      expect(result).toBe(333);
      expect(Number.isInteger(result)).toBe(true);
    });
    
    it('debe manejar ingredientes sin costo (retornar 0)', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [
          { inventory_code: 'ING-SIN-COSTO', quantity: 1, unit: 'kg' },
        ])
      );
      
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(
        createInventoryMock('ING-SIN-COSTO', 'Sin Costo', null)
      );
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe manejar ingredientes no encontrados (retornar 0)', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      
      vi.mocked(prisma.recipes.findUnique).mockResolvedValue(
        createRecipeMock(productId, [
          { inventory_code: 'ING-NO-EXISTE', quantity: 1, unit: 'kg' },
        ])
      );
      
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(null);
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe retornar COGS = 0 en caso de error (graceful degradation)', async () => {
      // Arrange
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(prisma.recipes.findUnique).mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await calculator.calculateFromRecipe(productId, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
  });
  
  describe('getWeightedAverageCost', () => {
    it('debe retornar el costo del item de inventario', async () => {
      // Arrange
      const inventoryCode = 'ING-POLLO';
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(
        createInventoryMock('ING-POLLO', 'Pollo', 1200)
      );
      
      // Act
      const result = await calculator.getWeightedAverageCost(inventoryCode, tenantId);
      
      // Assert
      expect(result).toBe(1200);
    });
    
    it('debe retornar 0 si el item no existe', async () => {
      // Arrange
      const inventoryCode = 'ING-NO-EXISTE';
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(null);
      
      // Act
      const result = await calculator.getWeightedAverageCost(inventoryCode, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe retornar 0 si el item no tiene costo', async () => {
      // Arrange
      const inventoryCode = 'ING-SIN-COSTO';
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue(
        createInventoryMock('ING-SIN-COSTO', 'Sin Costo', null)
      );
      
      // Act
      const result = await calculator.getWeightedAverageCost(inventoryCode, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
    
    it('debe retornar 0 en caso de error', async () => {
      // Arrange
      const inventoryCode = 'ING-ERROR';
      vi.mocked(prisma.inventory.findUnique).mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await calculator.getWeightedAverageCost(inventoryCode, tenantId);
      
      // Assert
      expect(result).toBe(0);
    });
  });
  
  describe('invalidateCacheForProduct', () => {
    it('debe invalidar el caché de un producto', async () => {
      // Act
      await calculator.invalidateCacheForProduct(productId, tenantId);
      
      // Assert
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant-123:product-456');
    });
  });
  
  describe('invalidateCacheForIngredient', () => {
    it('debe invalidar el caché de todos los productos que usan el ingrediente', async () => {
      // Arrange
      const inventoryCode = 'ING-POLLO';
      
      vi.mocked(prisma.recipes.findMany).mockResolvedValue([
        createRecipeMock('product-1', [
          { inventory_code: 'ING-POLLO', quantity: 1.5, unit: 'kg' },
          { inventory_code: 'ING-PAPA', quantity: 0.5, unit: 'kg' },
        ]),
        createRecipeMock('product-2', [
          { inventory_code: 'ING-POLLO', quantity: 2, unit: 'kg' },
        ]),
        createRecipeMock('product-3', [
          { inventory_code: 'ING-PAPA', quantity: 1, unit: 'kg' },
        ]),
      ]);
      
      // Act
      await calculator.invalidateCacheForIngredient(inventoryCode, tenantId);
      
      // Assert
      expect(cache.delete).toHaveBeenCalledTimes(2);
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant-123:product-1');
      expect(cache.delete).toHaveBeenCalledWith('cogs:tenant-123:product-2');
      expect(cache.delete).not.toHaveBeenCalledWith('cogs:tenant-123:product-3');
    });
    
    it('debe manejar recetas sin ingredientes', async () => {
      // Arrange
      const inventoryCode = 'ING-POLLO';
      
      vi.mocked(prisma.recipes.findMany).mockResolvedValue([
        createRecipeMock('product-1', []),
      ]);
      
      // Act
      await calculator.invalidateCacheForIngredient(inventoryCode, tenantId);
      
      // Assert
      expect(cache.delete).not.toHaveBeenCalled();
    });
  });
});
