/**
 * Admin CRM Segment Refresh API
 * POST /api/admin/crm/segments/[id]/refresh - Refresh segment members
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { SegmentService } from '@/src/core/services/segment.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new SegmentService();
    const result = await service.refreshMembers(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar miembros' }, { status: 500 });
  }
}
