/**
 * Admin Petty Cash Approve API - POST
 *
 * Approves a pending petty cash transaction.
 *
 * @module app/api/admin/petty-cash/[id]/approve/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PettyCashService } from '@/src/core/services/petty-cash.service';
import prisma from '@/src/core/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  const service = new PettyCashService(prisma);
  const result = await service.approveTransaction(
    authResult.user.tenantId,
    id,
    authResult.user.id,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
