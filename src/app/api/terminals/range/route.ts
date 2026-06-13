/**
 * API: Terminal Number Range
 *
 * GET  - Obtiene el rango actual del terminal
 * POST - Solicita un nuevo rango o extensión
 *
 * SEGURIDAD (single-tenant-por-deploy):
 * - El tenant_id se deriva SIEMPRE del servidor via getTenantId() (env).
 *   Cualquier tenant_id en el body/query se IGNORA para evitar inyección de
 *   tenant arbitrario (DoS de rangos de numeración / lectura cruzada).
 * - El terminal_id debe corresponder a un terminal REAL registrado para el
 *   tenant del deploy (tabla `terminals`) antes de asignar/extender un rango.
 * - Rate limiting conservador: estas son operaciones de escritura poco frecuentes.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/core/db/prisma";
import { allocateRange, extendRange, needsNewRange, getNextOrderNumber } from "@/src/core/order-numbers";
import { getTenantId } from "@/src/core/config/tenant";
import { rateLimit, getRetryAfterSeconds } from "@/src/core/middleware/rate-limit";
import { logger } from '@/src/core/observability/structured-logger';

// Conservador: operaciones de escritura/lectura poco frecuentes por terminal.
const RANGE_RATE_LIMIT = { maxRequests: 30, windowMs: 60000 };

/**
 * Verifica que el terminal_id pertenezca a un terminal real del tenant del deploy.
 * Devuelve true solo si existe en la tabla `terminals` para el tenant del env.
 */
async function terminalBelongsToTenant(tenantId: string, terminalId: string): Promise<boolean> {
    const terminal = await prisma.terminals.findUnique({
        where: {
            tenant_id_terminal_id: {
                tenant_id: tenantId,
                terminal_id: terminalId,
            },
        },
        select: { id: true },
    });
    return terminal !== null;
}

// GET /api/terminals/range?terminal_id=xxx
// El tenant_id se deriva del servidor; cualquier tenant_id en el query se ignora.
export async function GET(req: NextRequest) {
    const rl = await rateLimit(req, RANGE_RATE_LIMIT);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
            { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(rl.resetAt)) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const terminalId = searchParams.get("terminal_id");

    if (!terminalId) {
        return NextResponse.json(
            { error: "Se requiere terminal_id" },
            { status: 400 }
        );
    }

    // SEGURIDAD: tenant del servidor, NUNCA del cliente.
    const tenantId = getTenantId();

    try {
        // El terminal debe existir para el tenant del deploy.
        if (!(await terminalBelongsToTenant(tenantId, terminalId))) {
            return NextResponse.json(
                { error: "Terminal no registrado" },
                { status: 403 }
            );
        }

        const range = await prisma.terminal_number_ranges.findUnique({
            where: {
                tenant_id_terminal_id: {
                    tenant_id: tenantId,
                    terminal_id: terminalId
                }
            }
        });

        if (!range) {
            return NextResponse.json(
                { error: "No hay rango asignado", needs_allocation: true },
                { status: 404 }
            );
        }

        const needsExtension = await needsNewRange(prisma, tenantId, terminalId);

        return NextResponse.json({
            terminal_id: range.terminal_id,
            range_start: range.range_start,
            range_end: range.range_end,
            current_number: range.current_number,
            remaining: range.range_end - range.current_number,
            needs_extension: needsExtension,
        });
    } catch (error) {
        logger.error('Error al obtener rango de terminal', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: "Error al obtener rango" },
            { status: 500 }
        );
    }
}

// POST /api/terminals/range
// Body: { terminal_id, action: "allocate" | "extend" | "next" }
// El tenant_id se deriva del servidor; cualquier tenant_id en el body se ignora.
export async function POST(req: NextRequest) {
    const rl = await rateLimit(req, RANGE_RATE_LIMIT);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
            { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(rl.resetAt)) } }
        );
    }

    try {
        const body = await req.json();
        const { terminal_id, action = "allocate" } = body;

        if (!terminal_id) {
            return NextResponse.json(
                { error: "Se requiere terminal_id" },
                { status: 400 }
            );
        }

        // SEGURIDAD: tenant del servidor, NUNCA del cliente.
        const tenantId = getTenantId();

        // El terminal debe existir para el tenant del deploy antes de allocate/extend/next.
        if (!(await terminalBelongsToTenant(tenantId, terminal_id))) {
            return NextResponse.json(
                { error: "Terminal no registrado" },
                { status: 403 }
            );
        }

        let range;

        if (action === "next") {
            const nextNum = await getNextOrderNumber(prisma, tenantId, terminal_id);
            return NextResponse.json({ success: true, current_number: nextNum });
        } else if (action === "extend") {
            range = await extendRange(prisma, tenantId, terminal_id);
        } else {
            range = await allocateRange(prisma, tenantId, terminal_id);
        }

        return NextResponse.json({
            success: true,
            ...range,
            remaining: range.range_end - range.current_number,
        });
    } catch (error) {
        logger.error('Error al asignar rango de terminal', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: "Error al asignar rango" },
            { status: 500 }
        );
    }
}
