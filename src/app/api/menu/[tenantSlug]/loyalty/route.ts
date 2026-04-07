/**
 * Public Loyalty Check API - GET (no auth)
 *
 * Customer checks their loyalty points by phone number.
 * Rate limited: 5 lookups per minute per IP.
 * Returns only safe data (points, tier, progress). No PII.
 *
 * @module app/api/menu/[tenantSlug]/loyalty/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';
import { DEFAULT_TIERS, type LoyaltyTier } from '@/src/core/admin/schemas/loyalty.schema';

const logger = createLogger('public-loyalty');

// ============================================================================
// Rate Limiting (in-memory, per IP — 5 per minute)
// ============================================================================

const ipTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOOKUPS_PER_WINDOW = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const valid = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  ipTimestamps.set(ip, valid);

  if (valid.length >= MAX_LOOKUPS_PER_WINDOW) return true;

  valid.push(now);
  ipTimestamps.set(ip, valid);

  // Clean old entries
  if (ipTimestamps.size > 10000) {
    for (const [k, ts] of ipTimestamps) {
      const v = ts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (v.length === 0) ipTimestamps.delete(k);
      else ipTimestamps.set(k, v);
    }
  }

  return false;
}

// ============================================================================
// Helpers
// ============================================================================

function parseTiers(raw: unknown): LoyaltyTier[] {
  if (!raw) return DEFAULT_TIERS;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length > 0) return arr as LoyaltyTier[];
  } catch {
    // ignore
  }
  return DEFAULT_TIERS;
}

function findNextTier(
  tiers: LoyaltyTier[],
  currentTier: string,
  lifetimePoints: number,
): { name: string; minPoints: number; pointsNeeded: number } | null {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const currentIdx = sorted.findIndex((t) => t.name === currentTier);
  if (currentIdx < 0 || currentIdx >= sorted.length - 1) return null;
  const next = sorted[currentIdx + 1];
  return {
    name: next.name,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - lifetimePoints),
  };
}

// ============================================================================
// Route
// ============================================================================

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiadas consultas. Intenta en un minuto.' },
        { status: 429 },
      );
    }

    // Validate phone param
    const phone = request.nextUrl.searchParams.get('phone')?.trim();
    if (!phone || phone.length < 6 || phone.length > 15 || !/^\d+$/.test(phone)) {
      return NextResponse.json(
        { error: 'Numero de telefono invalido' },
        { status: 400 },
      );
    }

    // Resolve tenant
    const tenant = await prisma.tenants.findFirst({
      where: { slug: tenantSlug, is_active: true },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    // Check if loyalty is enabled
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenant.id },
      select: {
        loyalty_enabled: true,
        loyalty_tiers: true,
      },
    });

    if (!settings?.loyalty_enabled) {
      return NextResponse.json({ found: false, reason: 'loyalty_disabled' });
    }

    // Look up customer by phone + tenant
    const customer = await prisma.customers.findUnique({
      where: { tenant_id_phone: { tenant_id: tenant.id, phone } },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ found: false });
    }

    // Get loyalty profile
    const profile = await prisma.customer_profile.findUnique({
      where: {
        tenant_id_customer_id: { tenant_id: tenant.id, customer_id: customer.id },
      },
      select: {
        loyalty_points_balance: true,
        loyalty_lifetime_points: true,
        loyalty_tier: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ found: false });
    }

    const tiers = parseTiers(settings.loyalty_tiers);
    const nextTier = findNextTier(tiers, profile.loyalty_tier, profile.loyalty_lifetime_points);

    // Calculate progress percentage toward next tier
    let progress = 100;
    if (nextTier) {
      const currentTier = tiers.find((t) => t.name === profile.loyalty_tier);
      const currentMin = currentTier?.minPoints ?? 0;
      const range = nextTier.minPoints - currentMin;
      if (range > 0) {
        progress = Math.min(
          100,
          Math.round(((profile.loyalty_lifetime_points - currentMin) / range) * 100),
        );
      }
    }

    logger.info('Loyalty lookup', { tenantId: tenant.id, found: true });

    return NextResponse.json({
      found: true,
      points: profile.loyalty_points_balance,
      tier: profile.loyalty_tier,
      nextTier: nextTier
        ? { name: nextTier.name, pointsNeeded: nextTier.pointsNeeded }
        : null,
      progress,
    });
  } catch (error) {
    logger.error(
      'Error in loyalty lookup',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al consultar puntos' }, { status: 500 });
  }
}
