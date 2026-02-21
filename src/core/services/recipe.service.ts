/**
 * Recipe Service - Gestión de Recetas / Fichas Técnicas
 *
 * CRUD de recetas con integración al COGSCalculator existente.
 * Cada receta vincula un producto con sus ingredientes del inventario.
 *
 * Reglas:
 * - Multi-tenant: todas las operaciones filtran por tenant_id
 * - Todo dinero en centavos (integer)
 * - Integración con COGSCalculator para cálculo de costos
 *
 * @module core/services/recipe.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError, ConflictError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import prisma from '@/src/core/db/prisma';
import type { CreateRecipeDTO, UpdateRecipeDTO, RecipeQueryParams, RecipeIngredient } from '@/src/core/admin/schemas/recipe.schema';

// ============================================================================
// Types
// ============================================================================

export interface RecipeResult {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string | null;
  ingredients: RecipeIngredient[];
  yield_qty: number;
  yield_unit: string;
  conversion_factor: number;
  category: string | null;
  preparation_time_minutes: number | null;
  notes: string | null;
  cost_cents: number | null;
  last_cost_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  product_name?: string | null;
  product_station?: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// RecipeService
// ============================================================================

export class RecipeService {
  constructor(private prisma: PrismaClient) {}

  /** Converts a Prisma recipe row (with Decimal fields) to RecipeResult */
  private toRecipeResult(
    recipe: any,
    productName: string | null = null,
    productStation: string | null = null,
  ): RecipeResult {
    return {
      id: recipe.id,
      tenant_id: recipe.tenant_id,
      product_id: recipe.product_id,
      name: recipe.name ?? null,
      ingredients: recipe.ingredients as RecipeIngredient[],
      yield_qty: Number(recipe.yield_qty),
      yield_unit: recipe.yield_unit,
      conversion_factor: Number(recipe.conversion_factor),
      category: recipe.category ?? null,
      preparation_time_minutes: recipe.preparation_time_minutes ?? null,
      notes: recipe.notes ?? null,
      cost_cents: recipe.cost_cents ?? null,
      last_cost_at: recipe.last_cost_at ?? null,
      is_active: recipe.is_active,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at,
      product_name: productName,
      product_station: productStation,
    };
  }

  // ==========================================================================
  // List Recipes
  // ==========================================================================

  async list(
    tenantId: string,
    params?: RecipeQueryParams,
  ): Promise<Result<PaginatedResult<RecipeResult>, DomainError>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (params?.category) {
      where.category = params.category;
    }
    if (params?.is_active !== undefined) {
      where.is_active = params.is_active;
    }

    try {
      const [recipes, total] = await Promise.all([
        this.prisma.recipes.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updated_at: 'desc' },
        }),
        this.prisma.recipes.count({ where }),
      ]);

      // Enriquecer con nombre de producto
      const productIds = recipes.map((r: any) => r.product_id);
      const products = productIds.length > 0
        ? await this.prisma.products.findMany({
            where: { id: { in: productIds }, tenant_id: tenantId },
            select: { id: true, name: true, station: true },
          })
        : [];
      const productMap = new Map(products.map((p: any) => [p.id, p]));

      // Filtrar por estación si se pidió
      let enriched = recipes.map((r: any) => {
        const product = productMap.get(r.product_id);
        return this.toRecipeResult(r, product?.name ?? null, product?.station ?? null);
      });

      if (params?.station) {
        enriched = enriched.filter((r) => r.product_station === params.station);
      }

      return ok({
        data: enriched,
        total: params?.station ? enriched.length : total,
        page,
        pageSize: limit,
        totalPages: Math.ceil((params?.station ? enriched.length : total) / limit),
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId }, 'Error listing recipes');
      return err(new DomainError('Error al listar recetas', 'LIST_RECIPES_FAILED'));
    }
  }

  // ==========================================================================
  // Get By ID
  // ==========================================================================

  async getById(
    tenantId: string,
    recipeId: string,
  ): Promise<Result<RecipeResult, DomainError>> {
    try {
      const recipe = await this.prisma.recipes.findFirst({
        where: { id: recipeId, tenant_id: tenantId },
      });

      if (!recipe) {
        return err(new NotFoundError('Receta', recipeId));
      }

      const product = await this.prisma.products.findFirst({
        where: { id: recipe.product_id, tenant_id: tenantId },
        select: { id: true, name: true, station: true },
      });

      return ok(this.toRecipeResult(recipe, product?.name ?? null, product?.station ?? null));
    } catch (error) {
      pinoLogger.error({ error, tenantId, recipeId }, 'Error getting recipe');
      return err(new DomainError('Error al obtener receta', 'GET_RECIPE_FAILED'));
    }
  }

  // ==========================================================================
  // Create Recipe
  // ==========================================================================

  async create(
    tenantId: string,
    data: CreateRecipeDTO,
    userId?: string,
  ): Promise<Result<RecipeResult, DomainError>> {
    // Validar que el producto existe
    const product = await this.prisma.products.findFirst({
      where: { id: data.product_id, tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, station: true },
    });

    if (!product) {
      return err(new NotFoundError('Producto', data.product_id));
    }

    // Validar que no haya receta duplicada para este producto
    const existing = await this.prisma.recipes.findFirst({
      where: { tenant_id: tenantId, product_id: data.product_id },
    });

    if (existing) {
      return err(
        new ConflictError(
          `Ya existe una receta para el producto ${product.name}`,
          'product_id',
        ),
      );
    }

    // Validar que los ingredientes existen en inventario
    const ingredientCodes = data.ingredients.map((i) => i.inventory_code);
    const inventoryItems = await this.prisma.inventory.findMany({
      where: { tenant_id: tenantId, code: { in: ingredientCodes } },
      select: { code: true },
    });
    const existingCodes = new Set(inventoryItems.map((i: any) => i.code));
    const missingCodes = ingredientCodes.filter((c) => !existingCodes.has(c));

    if (missingCodes.length > 0) {
      return err(
        new ValidationError(
          `Ingredientes no encontrados en inventario: ${missingCodes.join(', ')}`,
          'ingredients',
          { missing_codes: missingCodes },
        ),
      );
    }

    const recipeId = uuidv4();

    const txResult = await withTransaction(this.prisma, async (tx) => {
      const recipe = await tx.recipes.create({
        data: {
          id: recipeId,
          tenant_id: tenantId,
          product_id: data.product_id,
          name: data.name ?? null,
          ingredients: data.ingredients as any,
          yield_qty: data.yield_qty,
          yield_unit: data.yield_unit ?? 'UNIDADES',
          conversion_factor: data.conversion_factor ?? 1.0,
          category: data.category ?? null,
          preparation_time_minutes: data.preparation_time_minutes ?? null,
          notes: data.notes ?? null,
          created_by: userId ?? null,
          updated_by: userId ?? null,
        },
      });

      return recipe;
    });

    if (!txResult.success) {
      pinoLogger.error({ error: txResult.error, tenantId }, 'Error creating recipe');
      return err(new DomainError('Error al crear receta', 'CREATE_RECIPE_FAILED'));
    }

    pinoLogger.info({ recipeId, tenantId, productId: data.product_id }, 'Recipe created');

    const recipe = txResult.data;
    return ok(this.toRecipeResult(recipe, product.name, product.station));
  }

  // ==========================================================================
  // Update Recipe
  // ==========================================================================

  async update(
    tenantId: string,
    recipeId: string,
    data: UpdateRecipeDTO,
    userId?: string,
  ): Promise<Result<RecipeResult, DomainError>> {
    const existing = await this.prisma.recipes.findFirst({
      where: { id: recipeId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Receta', recipeId));
    }

    // Validar ingredientes si se están actualizando
    if (data.ingredients) {
      const ingredientCodes = data.ingredients.map((i) => i.inventory_code);
      const inventoryItems = await this.prisma.inventory.findMany({
        where: { tenant_id: tenantId, code: { in: ingredientCodes } },
        select: { code: true },
      });
      const existingCodes = new Set(inventoryItems.map((i: any) => i.code));
      const missingCodes = ingredientCodes.filter((c) => !existingCodes.has(c));

      if (missingCodes.length > 0) {
        return err(
          new ValidationError(
            `Ingredientes no encontrados en inventario: ${missingCodes.join(', ')}`,
            'ingredients',
            { missing_codes: missingCodes },
          ),
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_by: userId ?? null };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.ingredients !== undefined) updateData.ingredients = data.ingredients as any;
    if (data.yield_qty !== undefined) updateData.yield_qty = data.yield_qty;
    if (data.yield_unit !== undefined) updateData.yield_unit = data.yield_unit;
    if (data.conversion_factor !== undefined) updateData.conversion_factor = data.conversion_factor;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.preparation_time_minutes !== undefined) updateData.preparation_time_minutes = data.preparation_time_minutes;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const txResult = await withTransaction(this.prisma, async (tx) => {
      const recipe = await tx.recipes.update({
        where: { id: recipeId },
        data: updateData,
      });
      return recipe;
    });

    if (!txResult.success) {
      pinoLogger.error({ error: txResult.error, tenantId, recipeId }, 'Error updating recipe');
      return err(new DomainError('Error al actualizar receta', 'UPDATE_RECIPE_FAILED'));
    }

    pinoLogger.info({ recipeId, tenantId }, 'Recipe updated');

    const product = await this.prisma.products.findFirst({
      where: { id: existing.product_id, tenant_id: tenantId },
      select: { id: true, name: true, station: true },
    });

    const recipe = txResult.data;
    return ok(this.toRecipeResult(recipe, product?.name ?? null, product?.station ?? null));
  }

  // ==========================================================================
  // Deactivate Recipe
  // ==========================================================================

  async deactivate(
    tenantId: string,
    recipeId: string,
    userId?: string,
  ): Promise<Result<{ id: string; is_active: boolean }, DomainError>> {
    const existing = await this.prisma.recipes.findFirst({
      where: { id: recipeId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Receta', recipeId));
    }

    const txResult = await withTransaction(this.prisma, async (tx) => {
      const recipe = await tx.recipes.update({
        where: { id: recipeId },
        data: { is_active: false, updated_by: userId ?? null },
      });
      return recipe;
    });

    if (!txResult.success) {
      pinoLogger.error({ error: txResult.error, tenantId, recipeId }, 'Error deactivating recipe');
      return err(new DomainError('Error al desactivar receta', 'DEACTIVATE_RECIPE_FAILED'));
    }

    pinoLogger.info({ recipeId, tenantId }, 'Recipe deactivated');

    return ok({ id: recipeId, is_active: false });
  }

  // ==========================================================================
  // Calculate Cost (usando COGSCalculator existente)
  // ==========================================================================

  async calculateCost(
    tenantId: string,
    recipeId: string,
  ): Promise<Result<{ cost_cents: number }, DomainError>> {
    const recipe = await this.prisma.recipes.findFirst({
      where: { id: recipeId, tenant_id: tenantId },
    });

    if (!recipe) {
      return err(new NotFoundError('Receta', recipeId));
    }

    const ingredients = recipe.ingredients as RecipeIngredient[];
    let totalCostCents = 0;

    try {
      for (const ingredient of ingredients) {
        const inv = await this.prisma.inventory.findFirst({
          where: { tenant_id: tenantId, code: ingredient.inventory_code },
          select: { cost_cents: true },
        });

        if (inv && inv.cost_cents != null) {
          totalCostCents += Math.round(inv.cost_cents * ingredient.quantity);
        }
      }

      // Actualizar costo cacheado en la receta
      await this.prisma.recipes.update({
        where: { id: recipeId },
        data: { cost_cents: totalCostCents, last_cost_at: new Date() },
      });

      pinoLogger.info({ recipeId, tenantId, totalCostCents }, 'Recipe cost calculated');

      return ok({ cost_cents: totalCostCents });
    } catch (error) {
      pinoLogger.error({ error, tenantId, recipeId }, 'Error calculating recipe cost');
      return err(new DomainError('Error al calcular costo de receta', 'CALCULATE_COST_FAILED'));
    }
  }
}

// Singleton
export const recipeService = new RecipeService(prisma);
