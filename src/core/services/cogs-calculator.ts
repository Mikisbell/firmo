/**
 * COGS Calculator - Calculadora de Costo de Bienes Vendidos
 * 
 * Calcula el COGS (Cost of Goods Sold) de productos desde sus recetas,
 * usando el costo promedio ponderado de los ingredientes del inventario.
 * 
 * Características:
 * - Cálculo automático desde recetas
 * - Costo promedio ponderado de ingredientes
 * - Caché con Redis (TTL 5 minutos)
 * - Invalidación inteligente de caché
 * - Branded types para seguridad financiera
 * 
 * Algoritmo:
 * 1. Obtener receta del producto
 * 2. Para cada ingrediente:
 *    - Obtener costo promedio ponderado del inventario
 *    - Calcular costo = cantidad × costo_unitario
 * 3. Sumar todos los costos de ingredientes
 * 4. Cachear resultado con TTL 5 minutos
 * 
 * @module core/services/cogs-calculator
 */

import prisma from '@/src/core/db/prisma';
import { cache, generateCacheKey } from '@/src/core/cache/cache-service';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { COGS, toCOGS, unsafeCOGS } from '@/src/core/types/profitability';
import { Centavos } from '@/src/core/types/shared';
import { eventBus } from '@/src/core/infra/event-bus';
import { v4 as uuidv4 } from 'uuid';
import type { COGSCalculatedEvent, IngredientCostChangedEvent } from '@/src/core/domain/events';

/**
 * TTL del caché de COGS (5 minutos en segundos)
 */
const COGS_CACHE_TTL = 5 * 60;

/**
 * Estructura de un ingrediente en la receta
 */
interface RecipeIngredient {
  inventory_code: string;
  quantity: number;
  unit: string;
}

/**
 * Calculadora de COGS
 * 
 * Calcula el costo de producción de productos desde sus recetas,
 * usando el costo promedio ponderado de los ingredientes.
 */
export class COGSCalculator {
  /**
   * Calcula el COGS de un producto desde su receta
   * 
   * Algoritmo:
   * 1. Verificar caché primero
   * 2. Si no está en caché, obtener receta
   * 3. Calcular costo de cada ingrediente
   * 4. Sumar todos los costos
   * 5. Cachear resultado
   * 
   * @param productId - ID del producto
   * @param tenantId - ID del tenant
   * @returns COGS en centavos (0 si no hay receta)
   * 
   * @example
   * const calculator = new COGSCalculator();
   * const cogs = await calculator.calculateFromRecipe('prod_123', 'tenant_456');
   * console.log(formatCOGS(cogs));  // "S/ 20.50"
   */
  async calculateFromRecipe(productId: string, tenantId: string): Promise<COGS> {
    const startTime = Date.now();
    
    try {
      // 1. Verificar caché primero
      const cachedCOGS = await this.getCachedCOGS(productId, tenantId);
      if (cachedCOGS !== null) {
        logger.debug('COGS cache hit', { productId, tenantId });
        metrics.increment('cogs.cache.hit');
        metrics.timing('cogs.calculate', Date.now() - startTime, { cached: 'true' });
        return cachedCOGS;
      }
      
      logger.debug('COGS cache miss', { productId, tenantId });
      metrics.increment('cogs.cache.miss');
      
      // 2. Obtener receta del producto
      const recipe = await prisma.recipes.findUnique({
        where: {
          tenant_id_product_id: {
            tenant_id: tenantId,
            product_id: productId,
          },
        },
      });
      
      // Si no hay receta, retornar COGS = 0
      if (!recipe || !recipe.is_active) {
        logger.debug('No recipe found for product', { productId, tenantId });
        metrics.increment('cogs.no_recipe');
        
        // Cachear el resultado (COGS = 0)
        await this.setCachedCOGS(productId, tenantId, toCOGS(0));
        
        metrics.timing('cogs.calculate', Date.now() - startTime, { cached: 'false', hasRecipe: 'false' });
        return toCOGS(0);
      }
      
      // 3. Parsear ingredientes desde JSON
      const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
      
      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        logger.warn('Recipe has no ingredients', { productId, tenantId, recipeId: recipe.id });
        metrics.increment('cogs.empty_recipe');
        
        // Cachear el resultado (COGS = 0)
        await this.setCachedCOGS(productId, tenantId, toCOGS(0));
        
        metrics.timing('cogs.calculate', Date.now() - startTime, { cached: 'false', hasRecipe: 'true', hasIngredients: 'false' });
        return toCOGS(0);
      }
      
      // 4. Calcular costo de cada ingrediente
      let totalCogsCents = 0;
      
      for (const ingredient of ingredients) {
        // Obtener costo promedio ponderado del ingrediente
        const avgCostCents = await this.getWeightedAverageCost(
          ingredient.inventory_code,
          tenantId
        );
        
        // Costo del ingrediente = cantidad × costo_unitario
        const ingredientCostCents = ingredient.quantity * avgCostCents;
        totalCogsCents += ingredientCostCents;
        
        logger.debug('Ingredient cost calculated', {
          productId,
          inventoryCode: ingredient.inventory_code,
          quantity: ingredient.quantity,
          avgCostCents,
          ingredientCostCents,
        });
      }
      
      // 5. Redondear a integer (centavos)
      const cogsCents = Math.round(totalCogsCents);
      const cogs = toCOGS(cogsCents);
      
      // 6. Cachear resultado
      await this.setCachedCOGS(productId, tenantId, cogs);
      
      // 7. Emitir evento COGS_CALCULATED para auditoría
      await this.emitCOGSCalculatedEvent(
        productId,
        tenantId,
        cogs,
        recipe.id,
        ingredients.length
      );
      
      logger.info('COGS calculated successfully', {
        productId,
        tenantId,
        cogsCents,
        ingredientCount: ingredients.length,
      });
      
      metrics.increment('cogs.calculated');
      metrics.timing('cogs.calculate', Date.now() - startTime, { cached: 'false', hasRecipe: 'true', hasIngredients: 'true' });
      
      return cogs;
      
    } catch (error) {
      logger.error('Failed to calculate COGS', error as Error, {
        productId,
        tenantId,
      });
      
      metrics.increment('cogs.error');
      
      // En caso de error, retornar COGS = 0 (graceful degradation)
      return toCOGS(0);
    }
  }
  
  /**
   * Obtiene el costo promedio ponderado de un ingrediente
   * 
   * Algoritmo:
   * 1. Obtener el item del inventario
   * 2. Retornar su cost_cents (ya es el costo actual)
   * 
   * Nota: En el schema actual, inventory.cost_cents ya representa
   * el costo actual del item. En una implementación más avanzada,
   * se podría calcular el promedio ponderado desde inventory_log
   * con movimientos de tipo PURCHASE.
   * 
   * @param inventoryCode - Código del item de inventario
   * @param tenantId - ID del tenant
   * @returns Costo promedio en centavos (0 si no existe)
   * 
   * @example
   * const avgCost = await calculator.getWeightedAverageCost('ING-001', 'tenant_456');
   * console.log(avgCost);  // 1200 (S/ 12.00 por kg)
   */
  async getWeightedAverageCost(inventoryCode: string, tenantId: string): Promise<number> {
    try {
      // Obtener item del inventario
      const item = await prisma.inventory.findUnique({
        where: {
          tenant_id_code: {
            tenant_id: tenantId,
            code: inventoryCode,
          },
        },
      });
      
      if (!item) {
        logger.warn('Inventory item not found', { inventoryCode, tenantId });
        metrics.increment('cogs.ingredient_not_found');
        return 0;
      }
      
      // Retornar cost_cents (ya es el costo actual)
      const costCents = item.cost_cents || 0;
      
      logger.debug('Weighted average cost retrieved', {
        inventoryCode,
        tenantId,
        costCents,
      });
      
      return costCents;
      
    } catch (error) {
      logger.error('Failed to get weighted average cost', error as Error, {
        inventoryCode,
        tenantId,
      });
      
      metrics.increment('cogs.ingredient_error');
      
      // En caso de error, retornar 0 (graceful degradation)
      return 0;
    }
  }
  
  /**
   * Invalida el caché de COGS de un producto
   * 
   * Usar cuando:
   * - Cambia el costo de un ingrediente
   * - Se modifica la receta del producto
   * - Se actualiza el inventario
   * 
   * @param productId - ID del producto
   * @param tenantId - ID del tenant
   * 
   * @example
   * await calculator.invalidateCacheForProduct('prod_123', 'tenant_456');
   */
  async invalidateCacheForProduct(productId: string, tenantId: string): Promise<void> {
    try {
      const cacheKey = this.buildCacheKey(productId, tenantId);
      await cache.delete(cacheKey);
      
      logger.info('COGS cache invalidated for product', { productId, tenantId });
      metrics.increment('cogs.cache.invalidated', { scope: 'product' });
      
    } catch (error) {
      logger.error('Failed to invalidate COGS cache', error as Error, {
        productId,
        tenantId,
      });
      
      metrics.increment('cogs.cache.invalidation_error');
    }
  }
  
  /**
   * Invalida el caché de COGS de todos los productos que usan un ingrediente
   * 
   * Usar cuando cambia el costo de un ingrediente en el inventario.
   * 
   * Algoritmo:
   * 1. Buscar todas las recetas que usan el ingrediente
   * 2. Invalidar caché de cada producto
   * 
   * @param inventoryCode - Código del ingrediente
   * @param tenantId - ID del tenant
   * 
   * @example
   * // Cuando cambia el costo del pollo
   * await calculator.invalidateCacheForIngredient('ING-POLLO', 'tenant_456');
   */
  async invalidateCacheForIngredient(inventoryCode: string, tenantId: string): Promise<void> {
    try {
      // 1. Buscar todas las recetas que usan este ingrediente
      // Nota: Prisma no soporta búsqueda en campos JSON directamente,
      // así que obtenemos todas las recetas y filtramos en memoria
      const allRecipes = await prisma.recipes.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      });
      
      // 2. Filtrar recetas que contienen el ingrediente
      const affectedRecipes = allRecipes.filter((recipe) => {
        const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
        return Array.isArray(ingredients) && 
               ingredients.some((ing) => ing.inventory_code === inventoryCode);
      });
      
      // 3. Invalidar caché de cada producto afectado
      for (const recipe of affectedRecipes) {
        await this.invalidateCacheForProduct(recipe.product_id, tenantId);
      }
      
      logger.info('COGS cache invalidated for ingredient', {
        inventoryCode,
        tenantId,
        affectedProducts: affectedRecipes.length,
      });
      
      metrics.increment('cogs.cache.invalidated', { 
        scope: 'ingredient',
        affectedProducts: affectedRecipes.length.toString(),
      });
      
    } catch (error) {
      logger.error('Failed to invalidate COGS cache for ingredient', error as Error, {
        inventoryCode,
        tenantId,
      });
      
      metrics.increment('cogs.cache.invalidation_error');
    }
  }
  
  /**
   * Handler para cambio de costo de ingrediente
   * 
   * Se debe llamar cuando cambia el costo de un ingrediente en el inventario.
   * Invalida el caché de todos los productos que usan ese ingrediente y
   * emite un evento para auditoría.
   * 
   * Algoritmo:
   * 1. Invalidar caché de productos afectados
   * 2. Emitir evento INGREDIENT_COST_CHANGED para auditoría
   * 3. Loggear operación
   * 
   * @param inventoryCode - Código del ingrediente
   * @param tenantId - ID del tenant
   * @param newCostCents - Nuevo costo en centavos
   * @param changedBy - ID del usuario que hizo el cambio (opcional)
   * 
   * @example
   * // Cuando se actualiza el costo del pollo en el inventario
   * await cogsCalculator.onIngredientCostChanged(
   *   'ING-POLLO',
   *   'tenant_456',
   *   1500, // S/ 15.00 por kg
   *   'user_789'
   * );
   */
  async onIngredientCostChanged(
    inventoryCode: string,
    tenantId: string,
    newCostCents: number,
    oldCostCents?: number,
    changedBy?: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Ingredient cost changed, invalidating COGS cache', {
        inventoryCode,
        tenantId,
        newCostCents,
        oldCostCents,
        changedBy,
      });
      
      // 1. Buscar productos afectados antes de invalidar caché
      const allRecipes = await prisma.recipes.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      });
      
      const affectedRecipes = allRecipes.filter((recipe) => {
        const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
        return Array.isArray(ingredients) && 
               ingredients.some((ing) => ing.inventory_code === inventoryCode);
      });
      
      const affectedProductIds = affectedRecipes.map(r => r.product_id);
      
      // 2. Invalidar caché de productos afectados
      await this.invalidateCacheForIngredient(inventoryCode, tenantId);
      
      // 3. Emitir evento INGREDIENT_COST_CHANGED para auditoría
      await this.emitIngredientCostChangedEvent(
        inventoryCode,
        tenantId,
        oldCostCents || 0,
        newCostCents,
        affectedProductIds,
        changedBy
      );
      
      metrics.increment('cogs.ingredient_cost_changed');
      metrics.timing('cogs.on_ingredient_cost_changed', Date.now() - startTime);
      
    } catch (error) {
      logger.error('Failed to handle ingredient cost change', error as Error, {
        inventoryCode,
        tenantId,
        newCostCents,
        changedBy,
      });
      
      metrics.increment('cogs.ingredient_cost_changed_error');
      throw error;
    }
  }
  
  /**
   * Handler para cambio de receta
   * 
   * Se debe llamar cuando se modifica la receta de un producto
   * (agregar/quitar ingredientes, cambiar cantidades).
   * Invalida el caché del producto y emite un evento para auditoría.
   * 
   * Algoritmo:
   * 1. Invalidar caché del producto
   * 2. Emitir evento RECIPE_CHANGED para auditoría
   * 3. Loggear operación
   * 
   * @param productId - ID del producto
   * @param tenantId - ID del tenant
   * @param changedBy - ID del usuario que hizo el cambio (opcional)
   * 
   * @example
   * // Cuando se actualiza la receta del Pollo a la Brasa
   * await cogsCalculator.onRecipeChanged(
   *   'prod_123',
   *   'tenant_456',
   *   'user_789'
   * );
   */
  async onRecipeChanged(
    productId: string,
    tenantId: string,
    changedBy?: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Recipe changed, invalidating COGS cache', {
        productId,
        tenantId,
        changedBy,
      });
      
      // 1. Invalidar caché del producto
      await this.invalidateCacheForProduct(productId, tenantId);
      
      // 2. Emitir evento para auditoría (integración con Event Sourcing)
      // Nota: Este evento se puede usar para auditoría y trazabilidad
      // En una implementación futura, se puede integrar con el event bus
      logger.info('RECIPE_CHANGED event', {
        eventType: 'RECIPE_CHANGED',
        productId,
        tenantId,
        changedBy,
        timestamp: new Date().toISOString(),
      });
      
      metrics.increment('cogs.recipe_changed');
      metrics.timing('cogs.on_recipe_changed', Date.now() - startTime);
      
    } catch (error) {
      logger.error('Failed to handle recipe change', error as Error, {
        productId,
        tenantId,
        changedBy,
      });
      
      metrics.increment('cogs.recipe_changed_error');
      throw error;
    }
  }
  
  // ============================================================================
  // Métodos Privados - Emisión de Eventos
  // ============================================================================
  
  /**
   * Emite evento COGS_CALCULATED para auditoría
   * 
   * @param productId - ID del producto
   * @param tenantId - ID del tenant
   * @param cogs - COGS calculado
   * @param recipeId - ID de la receta (opcional)
   * @param ingredientCount - Cantidad de ingredientes (opcional)
   */
  private async emitCOGSCalculatedEvent(
    productId: string,
    tenantId: string,
    cogs: COGS,
    recipeId?: string,
    ingredientCount?: number
  ): Promise<void> {
    try {
      const event: COGSCalculatedEvent = {
        // Identity
        event_id: uuidv4(),
        tenant_id: tenantId,
        
        // Terminal info
        terminal_id: 'cogs-calculator-service',
        terminal_sequence: 0,
        
        // Time
        occurred_at: new Date().toISOString(),
        
        // Aggregate
        aggregate_type: 'INVENTORY',
        aggregate_id: productId,
        
        // Event type and payload
        event_type: 'COGS_CALCULATED',
        payload: {
          product_id: productId,
          cogs_cents: cogs as number,
          calculation_date: new Date().toISOString(),
          ...(recipeId && { recipe_version: 1 }), // Usar recipe_version en lugar de recipe_id
        },
        
        // Tracing
        correlation_id: uuidv4(),
        causation_id: null,
        
        // Actor (sistema)
        actor_id: null,
        actor_role_snapshot: null,
        
        // Version
        schema_version: 1,
        payload_version: 1,
        
        // Context
        shift_id: null,
        business_date: null,
      };
      
      // Publicar evento al event bus
      await eventBus.publish(tenantId, event);
      
      logger.debug('COGS_CALCULATED event emitted', {
        productId,
        tenantId,
        cogsCents: cogs,
        eventId: event.event_id,
      });
      
      metrics.increment('cogs.event.emitted', { eventType: 'COGS_CALCULATED' });
      
    } catch (error) {
      logger.error('Failed to emit COGS_CALCULATED event', error as Error, {
        productId,
        tenantId,
        cogs,
      });
      
      metrics.increment('cogs.event.error', { eventType: 'COGS_CALCULATED' });
      
      // No lanzar error - la emisión de eventos no debe bloquear el flujo principal
    }
  }
  
  /**
   * Emite evento INGREDIENT_COST_CHANGED para auditoría
   * 
   * @param inventoryCode - Código del ingrediente
   * @param tenantId - ID del tenant
   * @param oldCostCents - Costo anterior en centavos
   * @param newCostCents - Nuevo costo en centavos
   * @param affectedProductIds - IDs de productos afectados
   * @param changedBy - ID del usuario que hizo el cambio (opcional)
   */
  private async emitIngredientCostChangedEvent(
    inventoryCode: string,
    tenantId: string,
    oldCostCents: number,
    newCostCents: number,
    affectedProductIds: string[],
    changedBy?: string
  ): Promise<void> {
    try {
      const event: IngredientCostChangedEvent = {
        // Identity
        event_id: uuidv4(),
        tenant_id: tenantId,
        
        // Terminal info
        terminal_id: 'cogs-calculator-service',
        terminal_sequence: 0,
        
        // Time
        occurred_at: new Date().toISOString(),
        
        // Aggregate
        aggregate_type: 'INVENTORY',
        aggregate_id: uuidv4(), // Usar UUID temporal para inventario
        
        // Event type and payload
        event_type: 'INGREDIENT_COST_CHANGED',
        payload: {
          inventory_item_id: null,
          ingredient_id: uuidv4(), // Generar ID temporal para el ingrediente
          old_cost_cents: oldCostCents,
          new_cost_cents: newCostCents,
          changed_by: changedBy || uuidv4(), // Requerido en el schema
          ...(inventoryCode && { reason: `Cost changed for ${inventoryCode}` }),
        },
        
        // Tracing
        correlation_id: uuidv4(),
        causation_id: null,
        
        // Actor
        actor_id: changedBy || null,
        actor_role_snapshot: null,
        
        // Version
        schema_version: 1,
        payload_version: 1,
        
        // Context
        shift_id: null,
        business_date: null,
      };
      
      // Publicar evento al event bus
      await eventBus.publish(tenantId, event);
      
      logger.debug('INGREDIENT_COST_CHANGED event emitted', {
        inventoryCode,
        tenantId,
        oldCostCents,
        newCostCents,
        affectedProducts: affectedProductIds.length,
        eventId: event.event_id,
      });
      
      metrics.increment('cogs.event.emitted', { eventType: 'INGREDIENT_COST_CHANGED' });
      
    } catch (error) {
      logger.error('Failed to emit INGREDIENT_COST_CHANGED event', error as Error, {
        inventoryCode,
        tenantId,
        oldCostCents,
        newCostCents,
      });
      
      metrics.increment('cogs.event.error', { eventType: 'INGREDIENT_COST_CHANGED' });
      
      // No lanzar error - la emisión de eventos no debe bloquear el flujo principal
    }
  }
  
  // ============================================================================
  // Métodos Privados - Gestión de Caché
  // ============================================================================
  
  /**
   * Construye la clave de caché para un producto
   */
  private buildCacheKey(productId: string, tenantId: string): string {
    return generateCacheKey('cogs', tenantId, productId);
  }
  
  /**
   * Obtiene el COGS de un producto desde el caché
   */
  private async getCachedCOGS(productId: string, tenantId: string): Promise<COGS | null> {
    try {
      const cacheKey = this.buildCacheKey(productId, tenantId);
      const cached = await cache.get<number>(cacheKey);
      
      if (cached !== null) {
        return unsafeCOGS(cached);
      }
      
      return null;
      
    } catch (error) {
      logger.error('Failed to get cached COGS', error as Error, {
        productId,
        tenantId,
      });
      
      return null;
    }
  }
  
  /**
   * Almacena el COGS de un producto en el caché
   */
  private async setCachedCOGS(productId: string, tenantId: string, cogs: COGS): Promise<void> {
    try {
      const cacheKey = this.buildCacheKey(productId, tenantId);
      
      await cache.set(cacheKey, cogs as number, {
        ttl: COGS_CACHE_TTL,
        tags: [`cogs:${tenantId}`, `product:${productId}`],
      });
      
    } catch (error) {
      logger.error('Failed to cache COGS', error as Error, {
        productId,
        tenantId,
        cogs,
      });
    }
  }
}

/**
 * Instancia singleton del calculador de COGS
 */
export const cogsCalculator = new COGSCalculator();
