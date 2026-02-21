/**
 * Payment QR API - POST (generate Yape/Plin QR code)
 *
 * POS-facing endpoint. Uses getTenantId() for tenant context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/src/core/config/tenant';
import { PaymentQRRequestSchema } from '@/src/core/admin/schemas/yape-plin.schema';
import { qrGeneratorService } from '@/src/core/payments/qr-generator.service';
import prisma from '@/src/core/db/prisma';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantId();
    const body = await request.json();
    const { method, amountCents, orderNumber } = PaymentQRRequestSchema.parse(body);

    // Obtener config del merchant
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        yape_merchant_phone: true,
        yape_merchant_name: true,
        plin_merchant_phone: true,
        plin_merchant_name: true,
      },
    });

    const phone = method === 'YAPE'
      ? settings?.yape_merchant_phone
      : settings?.plin_merchant_phone;

    const merchantName = method === 'YAPE'
      ? settings?.yape_merchant_name
      : settings?.plin_merchant_name;

    if (!phone) {
      return NextResponse.json(
        { error: `Teléfono de ${method} no configurado. Configúrelo en Administración.` },
        { status: 400 },
      );
    }

    const result = method === 'YAPE'
      ? await qrGeneratorService.generateYapeQR(phone, amountCents, orderNumber)
      : await qrGeneratorService.generatePlinQR(phone, amountCents, orderNumber);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      qrDataUrl: result.data.qrDataUrl,
      paymentUrl: result.data.paymentUrl,
      merchantPhone: phone,
      merchantName: merchantName ?? null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al generar QR de pago' }, { status: 500 });
  }
}
