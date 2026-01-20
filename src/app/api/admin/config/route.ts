/**
 * Business Configuration API
 * Requirements: 8.1, 8.2, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

const configSchema = z.object({
  legal_name: z.string().min(1).max(200),
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos').nullable().optional(),
  address_text: z.string().max(500).nullable().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
});

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    
    if (!settings) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
    }
    
    const data = parsed.data;
    
    // Get old values for audit trail
    const oldSettings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!oldSettings) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 });
    }
    
    // Update settings in transaction with audit trail
    const settings = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant_settings.update({
        where: { tenant_id: tenantId },
        data: {
          legal_name: data.legal_name,
          ruc: data.ruc || null,
          address_text: data.address_text || null,
          updated_at: new Date(),
        },
      });

      // Log audit trail with old and new values
      await tx.admin_access_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'config',
          metadata: {
            old_values: {
              legal_name: oldSettings.legal_name,
              ruc: oldSettings.ruc,
              address_text: oldSettings.address_text,
            },
            new_values: {
              legal_name: data.legal_name,
              ruc: data.ruc || null,
              address_text: data.address_text || null,
            },
          },
          created_at: new Date(),
        },
      });

      return updated;
    });
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Config PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
