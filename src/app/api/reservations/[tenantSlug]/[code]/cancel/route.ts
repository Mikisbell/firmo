/**
 * Public Reservation API — Cancel Reservation by Customer
 *
 * PATCH /api/reservations/[tenantSlug]/[code]/cancel — Cancel reservation
 *
 * No authentication required, rate-limited.
 * Only PENDING or CONFIRMED reservations can be cancelled by the customer.
 * SEATED, ARRIVED, NO_SHOW, CANCELLED, REJECTED, COMPLETED cannot be cancelled.
 *
 * @module api/reservations/[tenantSlug]/[code]/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/core/observability/structured-logger";
import {
    resolveTenantBySlug,
    cancelByCustomer,
} from "@/src/core/reservations/reservation.service";
import { ConflictError, NotFoundError } from "@/src/core/result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Simple IP-based rate limiter
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
    const key = `reservation-cancel:${ip}`;
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
// PATCH — Cancel Reservation by Customer (public, no auth, rate-limited)
// ============================================================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ tenantSlug: string; code: string }> },
) {
    const clientIp = getClientIp(request);

    // Rate limit: max 10 PATCH requests per minute per IP
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

        // 2. Cancel reservation by customer
        const result = await cancelByCustomer(tenant.id, code.toUpperCase());

        if (!result.success) {
            if (result.error instanceof NotFoundError) {
                return NextResponse.json(
                    { success: false, error: "Reserva no encontrada" },
                    { status: 404 },
                );
            }

            if (result.error instanceof ConflictError) {
                return NextResponse.json(
                    { success: false, error: result.error.message },
                    { status: 409 },
                );
            }

            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 400 },
            );
        }

        // 3. Return cancellation confirmation
        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        logger.error(
            "Error al cancelar reserva por cliente",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            {
                success: false,
                error: "Error interno al cancelar la reserva",
            },
            { status: 500 },
        );
    }
}
