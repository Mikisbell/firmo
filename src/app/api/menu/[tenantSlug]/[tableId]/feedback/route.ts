/**
 * Public Feedback API
 * POST /api/menu/[tenantSlug]/[tableId]/feedback
 *
 * No auth required — customer-facing endpoint.
 * Rate limiting handled at edge middleware level.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('public-feedback');

const feedbackSchema = z.object({
  type: z.enum(['QUEJA', 'SUGERENCIA', 'ELOGIO']),
  message: z.string().min(5).max(1000),
  customer_name: z.string().max(100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; tableId: string }> }
) {
  try {
    const { tenantSlug, tableId } = await params;

    // Resolve tenant from slug
    const tenant = await prisma.tenants.findFirst({
      where: { slug: tenantSlug, is_active: true },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    // Resolve table (optional — feedback is valid even without a table)
    const table = await prisma.tables.findFirst({
      where: { id: tableId, tenant_id: tenant.id, is_active: true },
      select: { id: true, number: true },
    });

    // Parse body
    const body = await request.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, message, customer_name, rating } = parsed.data;

    await prisma.customer_feedback.create({
      data: {
        tenant_id: tenant.id,
        table_id: table?.id ?? null,
        table_number: table?.number ?? null,
        type,
        message,
        customer_name: customer_name ?? null,
        rating: rating ?? null,
      },
    });

    logger.info('Customer feedback received', { tenantId: tenant.id, type, tableId: table?.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving feedback', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al enviar opinión' }, { status: 500 });
  }
}
