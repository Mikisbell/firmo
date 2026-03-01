import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/src/core/observability/structured-logger';
import { deleteTenant, generateDeletionConfirmationToken } from '@/src/core/tenant/deactivation';
import { withCrossTenantAdmin } from '@/src/core/tenant/cross-tenant-admin';
import { validateToken } from '@/src/core/auth/auth.service';
import { z } from 'zod';

// Validation schema for deletion request
const DeletionRequestSchema = z.object({
  confirmation_token: z.string().min(1, 'Confirmation token is required'),
});

/**
 * POST /api/admin/tenants/:id/delete
 * 
 * Delete a tenant permanently with data purge
 * 
 * Requires explicit confirmation token
 * 
 * Requirements: 14.4, 14.5, 14.6, 14.7
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenant_id } = await params;

    // Get authentication token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Validate token
    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload?.sub) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin authorization
    await withCrossTenantAdmin(
      tokenResult.payload.sub,
      tenant_id,
      'can_deactivate_tenant',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Parse and validate request body
    const body = await request.json();
    const validation = DeletionRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { confirmation_token } = validation.data;

    // Delete tenant
    await deleteTenant(tenant_id, confirmation_token);

    return NextResponse.json(
      {
        success: true,
        message: `Local ${tenant_id} ha sido eliminado permanentemente`,
        tenant_id,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error al eliminar tenant', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error) {
      if (error.message.includes('authorization')) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 403 }
        );
      }

      if (error.message.includes('confirmation')) {
        return NextResponse.json(
          { error: 'Token de confirmación inválido o expirado' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al eliminar local' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tenants/:id/delete
 * 
 * Generate deletion confirmation token
 * 
 * Requirements: 14.6
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenant_id } = await params;

    // Get authentication token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Validate token
    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload?.sub) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin authorization
    await withCrossTenantAdmin(
      tokenResult.payload.sub,
      tenant_id,
      'can_deactivate_tenant',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Generate confirmation token
    const confirmation_token = await generateDeletionConfirmationToken(tenant_id);

    return NextResponse.json(
      {
        success: true,
        message: 'Token de confirmación de eliminación generado',
        confirmation_token,
        expires_in_seconds: 3600, // 1 hour
        warning: 'Este token es necesario para eliminar permanentemente el local. Guárdelo de forma segura.',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error al generar token de eliminación', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error && error.message.includes('authorization')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error al generar token de eliminación' },
      { status: 500 }
    );
  }
}
