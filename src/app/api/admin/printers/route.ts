/**
 * Printers API - GET/POST
 *
 * @module app/api/admin/printers/route
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

const createPrinterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  stationCode: z.string().min(1, 'El código de estación es requerido'),
  connectionType: z.enum(['TCP', 'HTTP', 'USB'], { message: 'connectionType debe ser TCP, HTTP o USB' }),
  connection: z.record(z.unknown()).optional().default({}),
  paperWidth: z.union([z.literal(58), z.literal(80)]).optional().default(80),
  stationId: z.string().uuid('stationId debe ser un UUID válido').optional(),
}).refine(
  (data) => {
    if (data.connectionType === 'TCP' || data.connectionType === 'HTTP') {
      return connectionSchema.safeParse(data.connection).success;
    }
    return true;
  },
  { message: 'La conexión TCP/HTTP requiere un campo "address"', path: ['connection'] },
);

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const showAll = request.nextUrl.searchParams.get('all') === 'true';
    const where: Record<string, unknown> = { tenant_id: authResult.user.tenantId };
    if (!showAll) where.is_active = true;

    const printers = await prisma.printers.findMany({
      where: where as any,
      include: {
        stations: { select: { id: true, code: true, name: true } },
        _count: { select: { print_jobs: { where: { status: 'QUEUED' } } } },
      },
      orderBy: { name: 'asc' },
    });

    const result = printers.map((p) => ({
      id: p.id,
      name: p.name,
      stationId: p.station_id,
      stationCode: p.station_code,
      stationName: p.stations?.name ?? null,
      connectionType: p.connection_type,
      connection: p.connection,
      paperWidth: p.paper_width,
      isActive: p.is_active,
      pendingJobs: p._count.print_jobs,
    }));

    return NextResponse.json({ printers: result });
  } catch (err) {
    log.error('Error al listar impresoras', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = createPrinterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, stationCode, connectionType, connection, paperWidth, stationId } = parsed.data;
  const tenantId = authResult.user.tenantId;

  try {
    if (stationId) {
      const station = await prisma.stations.findFirst({
        where: { id: stationId, tenant_id: tenantId },
      });
      if (!station) {
        return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 });
      }
    }

    const printer = await prisma.printers.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name,
        station_code: stationCode,
        station_id: stationId ?? null,
        connection_type: connectionType,
        connection: connection as any,
        paper_width: paperWidth,
      },
    });

    log.info('Impresora creada', { printerId: printer.id, name, tenantId });

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
    }, { status: 201 });
  } catch (err) {
    log.error('Error al crear impresora', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
