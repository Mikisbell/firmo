import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/tenant/configuration
 * Get current tenant configuration
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export async function GET(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ Validar que el tenant existe antes de procesar
    const configuration = await prisma.tenant_settings.findUnique({
      where: { tenant_id: session.tenantId },
    });

    if (!configuration) {
      return NextResponse.json(
        { error: 'Tenant configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(configuration);
  } catch (error: any) {
    console.error('Error getting tenant configuration:', error);
    
    // ✅ Retornar 404 si el tenant no existe, no 500
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant configuration not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tenant/configuration
 * Update current tenant configuration
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */
export async function PUT(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const tenantId = session.tenantId;

    // ✅ Validar que el tenant existe antes de procesar
    const tenantExists = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    
    if (!tenantExists) {
      return NextResponse.json(
        { error: 'Tenant configuration not found' },
        { status: 404 }
      );
    }

    // Validate updates
    if (body.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      } catch {
        return NextResponse.json(
          { error: `Invalid timezone: ${body.timezone}` },
          { status: 400 }
        );
      }
    }

    if (body.currency) {
      const allowedCurrencies = ['PEN', 'USD', 'EUR'];
      if (!allowedCurrencies.includes(body.currency)) {
        return NextResponse.json(
          { error: `Unsupported currency: ${body.currency}` },
          { status: 400 }
        );
      }
    }

    // Update configuration
    const updated = await prisma.tenant_settings.update({
      where: { tenant_id: tenantId },
      data: {
        ...body,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating tenant configuration:', error);
    
    // ✅ Retornar 404 si el tenant no existe, no 500
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant configuration not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
