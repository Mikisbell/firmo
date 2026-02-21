/**
 * Recipes API - GET (list) and POST (create)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { recipeService } from '@/src/core/services/recipe.service';
import { CreateRecipeSchema, RecipeQuerySchema } from '@/src/core/admin/schemas/recipe.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = RecipeQuerySchema.parse(queryParams);

    const result = await recipeService.list(tenantId, validated);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al obtener recetas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const validated = CreateRecipeSchema.parse(body);

    const result = await recipeService.create(tenantId, validated, authResult.user.id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'CONFLICT' ? 409
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al crear receta' }, { status: 500 });
  }
}
