import { NextRequest, NextResponse } from 'next/server';
import { exportTenantData, ExportRequest } from '@/src/core/tenant/export';
import { getTenantContext } from '@/src/core/tenant/tenant-context';
import prisma from '@/src/core/db/prisma';

/**
 * POST /api/tenant/export
 * Create a new export of tenant data
 */
export async function POST(request: NextRequest) {
  try {
    const contextResult = await getTenantContext(request);

    if (!contextResult.valid) {
      return contextResult.response;
    }

    const { context } = contextResult;
    
    // ✅ Validar que el tenant existe antes de procesar
    const tenantExists = await prisma.tenant_settings.findUnique({
      where: { tenant_id: context.tenant_id },
    });
    
    if (!tenantExists) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    const body = await request.json();

    const exportRequest: ExportRequest = {
      tenant_id: context.tenant_id,
      format: body.format || 'json',
      include_events: body.include_events !== false,
      include_orders: body.include_orders !== false,
      include_products: body.include_products !== false,
      include_employees: body.include_employees !== false,
      include_customers: body.include_customers !== false,
      date_from: body.date_from,
      date_to: body.date_to,
    };

    const result = await exportTenantData(exportRequest);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Export failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('Tenant not found')) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('required')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
