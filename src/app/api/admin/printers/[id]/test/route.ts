/**
 * Printer Test API - POST
 *
 * Sends a test print to verify printer connectivity.
 *
 * @module app/api/admin/printers/[id]/test/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';
import { ESCPOSBuilder } from '@/src/core/printing/escpos-builder';
import { TcpPrinterTransport } from '@/src/core/printing/printer-driver';

const log = createLogger('printers-test-api');

function buildTestReceipt(printerName: string, paperWidth: number): Uint8Array {
  const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  const separator = '-'.repeat(paperWidth === 58 ? 32 : 48);

  return new ESCPOSBuilder()
    .initialize()
    .align('center')
    .bold(true)
    .text('PRUEBA DE IMPRESION')
    .bold(false)
    .lineFeed(1)
    .text(separator)
    .align('left')
    .text(`Impresora: ${printerName}`)
    .text(`Ancho papel: ${paperWidth}mm`)
    .text(`Fecha: ${now}`)
    .text(separator)
    .align('center')
    .text('Si puedes leer esto,')
    .text('la impresora funciona correctamente.')
    .lineFeed(1)
    .text(separator)
    .lineFeed(3)
    .cut()
    .build();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const tenantId = authResult.user.tenantId;

    const printer = await prisma.printers.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!printer) {
      return NextResponse.json({ error: 'Impresora no encontrada' }, { status: 404 });
    }

    if (!printer.is_active) {
      return NextResponse.json({ error: 'La impresora está desactivada' }, { status: 400 });
    }

    const connection = printer.connection as Record<string, unknown>;
    const testData = buildTestReceipt(printer.name, printer.paper_width);

    // TCP: direct send via socket
    if (printer.connection_type === 'TCP') {
      const address = connection.address as string;
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'La impresora TCP no tiene dirección configurada' },
          { status: 400 },
        );
      }

      const transport = new TcpPrinterTransport(address);
      const result = await transport.send(testData);

      if (!result.success) {
        log.warn('Prueba de impresión TCP fallida', { printerId: id, error: result.error });
        return NextResponse.json(
          { success: false, error: result.error ?? 'Error de conexión TCP' },
          { status: 200 },
        );
      }

      log.info('Prueba de impresión TCP exitosa', { printerId: id, bytesSent: result.bytesSent });
      return NextResponse.json({ success: true, message: 'Impresión de prueba enviada' });
    }

    // HTTP/USB: create a print job in DB for the client to pick up
    await prisma.print_jobs.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        printer_id: printer.id,
        job_type: 'TEST',
        payload: { testData: Buffer.from(testData).toString('base64') },
        actor_id: authResult.user.id,
        status: 'QUEUED',
      },
    });

    log.info('Print job de prueba creado', { printerId: id, connectionType: printer.connection_type });
    return NextResponse.json({
      success: true,
      message: `Print job de prueba creado para impresora ${printer.connection_type}`,
    });
  } catch (err) {
    log.error('Error en prueba de impresión', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
