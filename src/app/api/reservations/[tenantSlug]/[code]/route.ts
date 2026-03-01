/**
 * Public Reservation API — Query by Confirmation Code
 *
 * GET /api/reservations/[tenantSlug]/[code] — Get reservation status by confirmation code
 *
 * No authentication required. Returns only public-safe fields
 * (no tenant_id, no table_id, no internal_notes).
 *
 * @module api/reservations/[tenantSlug]/[code]
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/core/observability/structured-logger";
import {
    resolveTenantBySlug,
    getReservationByCode,
} from "@/src/core/reservations/reservation.service";
import { NotFoundError } from "@/src/core/result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Simple IP-based rate limiter (shared pattern with parent route)
// ============================================================================

const ipRateLimitStore = new Map<
    string,
    { count: number; resetTime: number }
>();

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded
        ? forwarded.split(",")[0].trim()
        : request.headers.get("x-real-ip") || "unknown";
}

function checkIpRateLimit(
    ip: string,
    maxRequests: number,
    windowMs: number = 60_000,
): boolean {
    const now = Date.now();
    const key = `reservation-code:${ip}`;
    const record = ipRateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        ipRateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

// ============================================================================
// GET — Query Reservation by Confirmation Code (public, no auth)
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantSlug: string; code: string }> },
) {
    const clientIp = getClientIp(request);

    // Rate limit: max 10 GET requests per minute per IP
    if (!checkIpRateLimit(clientIp, 10)) {
        return NextResponse.json(
            {
                success: false,
                error: "Demasiadas peticiones. Intente de nuevo en un momento",
            },
            {
                status: 429,
                headers: { "Retry-After": "60" },
            },
        );
    }

    try {
        const { tenantSlug, code } = await params;

        // 1. Resolve tenant by slug
        const tenantResult = await resolveTenantBySlug(tenantSlug);
        if (!tenantResult.success) {
            if (tenantResult.error instanceof NotFoundError) {
                return NextResponse.json(
                    { success: false, error: "Restaurante no encontrado" },
                    { status: 404 },
                );
            }
            return NextResponse.json(
                { success: false, error: tenantResult.error.message },
                { status: 400 },
            );
        }

        const tenant = tenantResult.data;

        // 2. Get reservation by code (returns public-safe fields only)
        const result = await getReservationByCode(
            tenant.id,
            code.toUpperCase(),
            tenant.name,
        );

        if (!result.success) {
            if (result.error instanceof NotFoundError) {
                return NextResponse.json(
                    { success: false, error: "Reserva no encontrada" },
                    { status: 404 },
                );
            }
            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 400 },
            );
        }

        // 3. Return public-safe reservation data
        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        logger.error(
            "Error al consultar reserva por codigo",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            {
                success: false,
                error: "Error interno al consultar la reserva",
            },
            { status: 500 },
        );
    }
}
