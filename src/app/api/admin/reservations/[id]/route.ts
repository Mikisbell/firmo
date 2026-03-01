/**
 * Admin Reservation API — Actions on Reservation
 *
 * PATCH /api/admin/reservations/[id] — Perform action (confirm, reject, arrive, seat, no_show, cancel)
 * GET   /api/admin/reservations/[id] — Get single reservation details
 *
 * Protected with requireAdminAuth. tenant_id ALWAYS from JWT, NEVER from client.
 * All state transition logic lives in ReservationService.
 *
 * @module api/admin/reservations/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/core/observability/structured-logger";
import { requireAdminAuth } from "@/src/core/middleware/admin-auth";
import { ReservationActionSchema } from "@/src/core/reservations/reservation.schema";
import {
    performAction,
    getReservationById,
} from "@/src/core/reservations/reservation.service";
import { ConflictError, NotFoundError } from "@/src/core/result";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validate UUID format
function isValidUUID(id: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

// ============================================================================
// GET — Get Single Reservation (admin, requireAdminAuth)
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    // 1. Auth guard
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
        return authResult.response;
    }

    const tenantId = authResult.user.tenantId;

    try {
        const { id } = await params;

        // Validate UUID format
        if (!isValidUUID(id)) {
            return NextResponse.json(
                { success: false, error: "Reserva no encontrada" },
                { status: 404 },
            );
        }

        // Get reservation by ID (scoped to admin's tenant)
        const result = await getReservationById(tenantId, id);

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

        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        logger.error(
            "Error al obtener reserva admin",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            { success: false, error: "Error interno al obtener la reserva" },
            { status: 500 },
        );
    }
}

// ============================================================================
// PATCH — Perform Action on Reservation (admin, requireAdminAuth)
// ============================================================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    // 1. Auth guard — ALWAYS first
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
        return authResult.response;
    }

    // tenant_id from JWT — NEVER from client
    const tenantId = authResult.user.tenantId;
    const actorId = authResult.user.id;

    try {
        const { id } = await params;

        // Validate UUID format
        if (!isValidUUID(id)) {
            return NextResponse.json(
                { success: false, error: "Reserva no encontrada" },
                { status: 404 },
            );
        }

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

        const parsed = ReservationActionSchema.parse(body);

        // 3. Perform action via service (all logic is in the service)
        const result = await performAction(
            tenantId,
            id,
            parsed.action,
            actorId,
            {
                table_id: parsed.table_id,
                reason: parsed.reason,
            },
        );

        if (!result.success) {
            const error = result.error;

            if (error instanceof NotFoundError) {
                return NextResponse.json(
                    { success: false, error: "Reserva no encontrada" },
                    { status: 404 },
                );
            }

            if (error instanceof ConflictError) {
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 409 },
                );
            }

            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 },
            );
        }

        // 4. Return updated reservation
        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Datos de accion invalidos",
                    details: error.errors.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        logger.error(
            "Error al realizar accion sobre reserva",
            error instanceof Error ? error : new Error(String(error)),
        );
        return NextResponse.json(
            {
                success: false,
                error: "Error interno al realizar la accion",
            },
            { status: 500 },
        );
    }
}
