/**
 * Recipe Detail API - GET, PUT, DELETE by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { recipeService } from '@/src/core/services/recipe.service';
import { UpdateRecipeSchema, RecipeIdSchema } from '@/src/core/admin/schemas/recipe.schema';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    RecipeIdSchema.parse(id);

    const result = await recipeService.getById(authResult.user.tenantId, id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al obtener receta' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    RecipeIdSchema.parse(id);

    const body = await request.json();
    const validated = UpdateRecipeSchema.parse(body);

    const result = await recipeService.update(
      authResult.user.tenantId,
      id,
      validated,
      authResult.user.id,
    );

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: (error as ZodError).errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al actualizar receta' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    RecipeIdSchema.parse(id);

    const result = await recipeService.calculateCost(authResult.user.tenantId, id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al calcular costo de receta' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    RecipeIdSchema.parse(id);

    const result = await recipeService.deactivate(
      authResult.user.tenantId,
      id,
      authResult.user.id,
    );

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al desactivar receta' }, { status: 500 });
  }
}
