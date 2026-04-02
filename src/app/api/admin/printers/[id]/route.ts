/**
 * Printers API - GET/PATCH/DELETE by ID
 *
 * @module app/api/admin/printers/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('printers-api');

const connectionSchema = z.object({
  address: z.string().min(1, 'La dirección es requerida'),
}).passthrough();

const updatePrinterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
  stationCode: z.string().min(1, 'El código de estación es requerido').optional(),
  connectionType: z.enum(['TCP', 'HTTP', 'USB'], { message: 'connectionType debe ser TCP, HTTP o USB' }).optional(),
  connection: z.record(z.unknown()).optional(),
  paperWidth: z.union([z.literal(58), z.literal(80)]).optional(),
  stationId: z.string().uuid('stationId debe ser un UUID válido').nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    if (
      (data.connectionType === 'TCP' || data.connectionType === 'HTTP') &&
      data.connection !== undefined
    ) {
      return connectionSchema.safeParse(data.connection).success;
    }
    return true;
  },
  { message: 'La conexión TCP/HTTP requiere un campo "address"', path: ['connection'] },
);

async function findPrinter(id: string, tenantId: string) {
  return prisma.printers.findFirst({
    where: { id, tenant_id: tenantId },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;

    const printer = await prisma.printers.findFirst({
      where: { id, tenant_id: authResult.user.tenantId },
      include: {
        stations: { select: { id: true, code: true, name: true } },
        _count: { select: { print_jobs: { where: { status: 'QUEUED' } } } },
      },
    });

    if (!printer) {
      return NextResponse.json({ error: 'Impresora no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      printer: {
        id: printer.id,
        name: printer.name,
        stationId: printer.station_id,
        stationCode: printer.station_code,
        stationName: printer.stations?.name ?? null,
        connectionType: printer.connection_type,
        connection: printer.connection,
        paperWidth: printer.paper_width,
        isActive: printer.is_active,
        pendingJobs: printer._count.print_jobs,
      },
    });
  } catch (err) {
    log.error('Error al obtener impresora', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = updatePrinterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;

    const existing = await findPrinter(id, tenantId);
    if (!existing) {
      return NextResponse.json({ error: 'Impresora no encontrada' }, { status: 404 });
    }

    const { name, stationCode, connectionType, connection, paperWidth, stationId, isActive } = parsed.data;

    if (stationId !== undefined && stationId !== null) {
      const station = await prisma.stations.findFirst({
        where: { id: stationId, tenant_id: tenantId },
      });
      if (!station) {
        return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 });
      }
    }

    // Validate connection.address when switching TO TCP/HTTP
    const effectiveType = connectionType ?? existing.connection_type;
    const effectiveConnection = connection ?? (existing.connection as Record<string, unknown>);
    if (
      (effectiveType === 'TCP' || effectiveType === 'HTTP') &&
      !connectionSchema.safeParse(effectiveConnection).success
    ) {
      return NextResponse.json(
        { error: 'La conexión TCP/HTTP requiere un campo "address"' },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (stationCode !== undefined) data.station_code = stationCode;
    if (connectionType !== undefined) data.connection_type = connectionType;
    if (connection !== undefined) data.connection = connection;
    if (paperWidth !== undefined) data.paper_width = paperWidth;
    if (stationId !== undefined) data.station_id = stationId;
    if (isActive !== undefined) data.is_active = isActive;

    const printer = await prisma.printers.update({
      where: { id, tenant_id: tenantId },
      data: data as any,
    });

    log.info('Impresora actualizada', { printerId: id, tenantId });

    return NextResponse.json({
      printer: {
        id: printer.id,
        name: printer.name,
        stationId: printer.station_id,
        stationCode: printer.station_code,
        connectionType: printer.connection_type,
        connection: printer.connection,
        paperWidth: printer.paper_width,
        isActive: printer.is_active,
      },
    });
  } catch (err) {
    log.error('Error al actualizar impresora', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const tenantId = authResult.user.tenantId;

    const existing = await findPrinter(id, tenantId);
    if (!existing) {
      return NextResponse.json({ error: 'Impresora no encontrada' }, { status: 404 });
    }

    await prisma.printers.update({
      where: { id, tenant_id: tenantId },
      data: { is_active: false },
    });

    log.info('Impresora desactivada', { printerId: id, tenantId });

    return NextResponse.json({ message: 'Impresora desactivada correctamente' });
  } catch (err) {
    log.error('Error al desactivar impresora', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
