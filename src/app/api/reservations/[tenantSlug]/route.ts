/**
 * Public Reservation API — Create Reservation + Query Available Slots
 *
 * POST /api/reservations/[tenantSlug] — Create a new reservation (no auth, rate-limited 3/min/IP)
 * GET  /api/reservations/[tenantSlug]?date=YYYY-MM-DD&party_size=N — Query available time slots
 *
 * Tenant is resolved from slug — tenant_id is NEVER accepted from the client.
 * All business logic lives in ReservationService; this route is a thin wrapper.
 *
 * @module api/reservations/[tenantSlug]
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/core/observability/structured-logger";
import {
    CreateReservationSchema,
    AvailabilitySlotsQuerySchema,
} from "@/src/core/reservations/reservation.schema";
import {
    resolveTenantBySlug,
    createReservation,
    getAvailableSlots,
} from "@/src/core/reservations/reservation.service";
import {
    ConflictError,
    NotFoundError,
    ValidationError,
} from "@/src/core/result";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Simple IP-based rate limiter for public reservation endpoints
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
    const key = `reservation:${ip}`;
    const record = ipRateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        ipRateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return true; // allowed
    }

    if (record.count >= maxRequests) {
        return false; // blocked
    }

    record.count++;
    return true; // allowed
}

// ============================================================================
// POST — Create Reservation (public, no auth, rate-limited)
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ tenantSlug: string }> },
) {
    const clientIp = getClientIp(request);

    // Rate limit: max 3 POST requests per minute per IP
    if (!checkIpRateLimit(clientIp, 3)) {
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
        const { tenantSlug } = await params;

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

        // 2. Parse and validate request body
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: "JSON invalido" },
                { status: 400 },
            );
        }

        const parsed = CreateReservationSchema.parse(body);

        // 3. Create reservation via service (all logic is in the service)
        const result = await createReservation(
            tenant.id,
            tenant.locationId,
            parsed,
            tenant.name,
        );

        if (!result.success) {
            const error = result.error;

            if (error instanceof ConflictError) {
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 409 },
                );
            }

            if (error instanceof NotFoundError) {
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 404 },
                );
            }

            // ValidationError or generic
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 },
            );
        }

        // 4. Return success — public-safe response (no tenant_id, no internal data)
        return NextResponse.json(
            {
                success: true,
                data: {
                    confirmation_code: result.data.confirmation_code,
                    status: result.data.status,
                    date: result.data.date,
                    time: result.data.time,
                    party_size: result.data.party_size,
                    restaurant_name: tenant.name,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validacion fallida",
                    details: error.errors.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        logger.error(
            "Error al crear reserva",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            { success: false, error: "Error interno al crear la reserva" },
            { status: 500 },
        );
    }
}

// ============================================================================
// GET — Query Available Time Slots (public, no auth)
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantSlug: string }> },
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
        const { tenantSlug } = await params;

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

        // 2. Parse query params
        const searchParams = request.nextUrl.searchParams;
        const queryInput = {
            date: searchParams.get("date") ?? "",
            party_size: searchParams.get("party_size") ?? "",
        };

        const parsed = AvailabilitySlotsQuerySchema.parse(queryInput);

        // 3. Get available slots via service
        const result = await getAvailableSlots(
            tenant.id,
            parsed.date,
            parsed.party_size,
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 400 },
            );
        }

        // 4. Return slots — public-safe response
        return NextResponse.json({
            success: true,
            data: {
                restaurant_name: tenant.name,
                date: parsed.date,
                slots: result.data,
            },
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Parametros invalidos",
                    details: error.errors.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        logger.error(
            "Error al consultar disponibilidad",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            {
                success: false,
                error: "Error interno al consultar disponibilidad",
            },
            { status: 500 },
        );
    }
}
