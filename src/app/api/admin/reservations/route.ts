/**
 * Admin Reservation API — List Reservations
 *
 * GET /api/admin/reservations?date=YYYY-MM-DD&status=PENDING&zone_id=uuid
 *
 * Protected with requireAdminAuth. tenant_id ALWAYS from JWT, NEVER from client.
 * Returns reservations ordered by time ascending + summary totals for the day.
 *
 * @module api/admin/reservations
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/core/observability/structured-logger";
import { requireAdminAuth } from "@/src/core/middleware/admin-auth";
import { ReservationQuerySchema } from "@/src/core/reservations/reservation.schema";
import { getReservationsByDate } from "@/src/core/reservations/reservation.service";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// GET — List Reservations by Date (admin, requireAdminAuth)
// ============================================================================

export async function GET(request: NextRequest) {
    // 1. Auth guard — ALWAYS first
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
        return authResult.response;
    }

    // tenant_id from JWT — NEVER from client
    const tenantId = authResult.user.tenantId;

    try {
        // 2. Parse query params with Zod
        const searchParams = request.nextUrl.searchParams;
        const queryInput: Record<string, string | undefined> = {};

        const dateParam = searchParams.get("date");
        if (dateParam) queryInput.date = dateParam;

        const statusParam = searchParams.get("status");
        if (statusParam) queryInput.status = statusParam;

        const zoneIdParam = searchParams.get("zone_id");
        if (zoneIdParam) queryInput.zone_id = zoneIdParam;

        const parsed = ReservationQuerySchema.parse(queryInput);

        // 3. Get reservations via service (scoped to admin's tenant)
        const result = await getReservationsByDate(tenantId, {
            date: parsed.date,
            status: parsed.status,
            zoneId: parsed.zone_id,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 400 },
            );
        }

        // 4. Return reservations + summary totals
        return NextResponse.json({
            success: true,
            data: {
                reservations: result.data.reservations,
                summary: result.data.summary,
            },
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Parametros de consulta invalidos",
                    details: error.errors.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        logger.error(
            "Error al listar reservas admin",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            { success: false, error: "Error interno al obtener reservas" },
            { status: 500 },
        );
    }
}
