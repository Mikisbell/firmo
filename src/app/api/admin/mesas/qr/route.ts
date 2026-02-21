/**
 * Admin Table QR Generation API
 *
 * GET: Generate QR codes for all active tables in a location
 * Requires admin auth.
 *
 * @module app/api/admin/mesas/qr/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { tableQrService } from '@/src/core/tables/table-qr.service';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const locationId = request.nextUrl.searchParams.get('location_id');

    if (!locationId) {
      return NextResponse.json(
        { error: 'location_id es requerido' },
        { status: 400 },
      );
    }

    // Use origin as base URL for QR codes
    const baseUrl = request.nextUrl.origin;

    const result = await tableQrService.generateAllTableQRs(
      authResult.user.tenantId,
      locationId,
      baseUrl,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ items: result.data });
  } catch {
    return NextResponse.json(
      { error: 'Error al generar códigos QR' },
      { status: 500 },
    );
  }
}
