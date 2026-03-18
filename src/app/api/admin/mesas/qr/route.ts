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
import { getTenantLocationId } from '@/src/core/locations/location.helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const tenantId = authResult.user.tenantId;

    // Use provided location_id or fall back to the tenant's primary location
    const requestedLocation = request.nextUrl.searchParams.get('location_id');
    const locationId = requestedLocation ?? await getTenantLocationId(tenantId);

    if (!locationId) {
      return NextResponse.json({ error: 'No hay sucursal configurada' }, { status: 404 });
    }

    // Use origin as base URL for QR codes
    const baseUrl = request.nextUrl.origin;

    const result = await tableQrService.generateAllTableQRs(
      tenantId,
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
