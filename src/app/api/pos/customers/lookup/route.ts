/**
 * POS Customer Lookup API
 * Searches local DB, then RENIEC/SUNAT for DNI/RUC data
 *
 * GET /api/pos/customers/lookup?doc_number=12345678&doc_type=DNI
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { LookupQuerySchema } from '@/src/core/integrations/peru-identity/schemas';
import { IdentityLookupService } from '@/src/core/integrations/peru-identity/lookup.service';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = LookupQuerySchema.parse(queryParams);

    const service = new IdentityLookupService(prisma);
    const result = await service.lookup(
      authResult.user.tenantId,
      validated.doc_type,
      validated.doc_number,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { found: false, error: 'Formato de documento inválido' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { found: false, error: 'Error al consultar documento' },
      { status: 500 },
    );
  }
}
