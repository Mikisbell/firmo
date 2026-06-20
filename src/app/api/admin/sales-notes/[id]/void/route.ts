/**
 * Admin Void Sales Note API - POST
 *
 * Anula una Nota de Venta abierta (solo status=OPEN) con motivo. Requiere admin.
 * tenant_id SIEMPRE desde el JWT. Emite SALES_NOTE_VOIDED + actualiza projection.
 *
 * @module app/api/admin/sales-notes/[id]/void/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';

const VoidSchema = z.object({ reason: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres') });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { reason } = VoidSchema.parse(body);
    const tenantId = authResult.user.tenantId;

    const voided = await prisma.$transaction(async (tx) => {
      // Guarda a nivel DB: solo anula si esta OPEN (no pisa CONVERTED/VOIDED).
      const res = await tx.sales_notes.updateMany({
        where: { id, tenant_id: tenantId, status: 'OPEN' },
        data: { status: 'VOIDED', void_reason: reason, voided_at: new Date() },
      });
      if (res.count === 0) return false;

      await tx.events.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          occurred_at: new Date(),
          type: 'SALES_NOTE_VOIDED',
          entity_type: 'SALES_NOTE',
          entity_id: id,
          actor_id: authResult.user.id,
          actor_role_snapshot: 'ADMIN',
          terminal_id: 'admin',
          payload: { sales_note_id: id, reason },
        },
      });
      return true;
    });

    if (!voided) {
      // O no existe, o no estaba OPEN (ya convertida/anulada).
      const exists = await prisma.sales_notes.findFirst({ where: { id, tenant_id: tenantId }, select: { status: true } });
      if (!exists) return NextResponse.json({ error: 'Nota de venta no encontrada' }, { status: 404 });
      return NextResponse.json({ error: `No se puede anular una nota ${exists.status}` }, { status: 409 });
    }

    return NextResponse.json({ id, status: 'VOIDED' });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al anular la nota de venta' }, { status: 500 });
  }
}
