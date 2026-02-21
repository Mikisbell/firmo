/**
 * Admin Platform Config API - GET/PATCH
 *
 * Manage external platform configurations.
 *
 * @module app/api/admin/platform-config/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PlatformOrderService } from '@/src/core/services/platform-order.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const UpdateConfigSchema = z.object({
  platform: z.enum(['PEDIDOSYA', 'LLAMAFOOD', 'RAPPI']),
  isActive: z.boolean().optional(),
  apiKey: z.string().optional(),
  storeId: z.string().optional(),
  webhookSecret: z.string().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  markupRate: z.number().min(0).max(1).optional(),
  autoAccept: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const service = new PlatformOrderService(prisma);
  const platform = request.nextUrl.searchParams.get('platform') as any;
  const result = await service.getConfig(authResult.user.tenantId, platform || undefined);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ configs: result.data });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = UpdateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { platform, ...updates } = parsed.data;

  const service = new PlatformOrderService(prisma);
  const result = await service.updateConfig(authResult.user.tenantId, platform, updates);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ config: result.data });
}
