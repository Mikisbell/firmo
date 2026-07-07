/**
 * GET /api/tenant/public
 * Public endpoint — returns only branding fields, no auth required.
 * Uses server-side getTenantId() so no tenant_id is needed from the client.
 */

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';

export async function GET() {
  try {
    const tenantId = getTenantId();
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { legal_name: true, logo_url: true, address_text: true },
    });
    return NextResponse.json(
      settings ?? { legal_name: 'FIRMO POS', logo_url: null, address_text: null },
    );
  } catch {
    return NextResponse.json({ legal_name: 'FIRMO POS', logo_url: null, address_text: null });
  }
}
