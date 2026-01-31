/**
 * API: Terminal Number Range
 * 
 * GET - Obtiene el rango actual del terminal
 * POST - Solicita un nuevo rango o extensión
 */

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { allocateRange, extendRange, needsNewRange } from "@/src/core/order-numbers";

const prisma = new PrismaClient();

// GET /api/terminals/range?terminal_id=xxx&tenant_id=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const terminalId = searchParams.get("terminal_id");
    const tenantId = searchParams.get("tenant_id");

    if (!terminalId || !tenantId) {
        return NextResponse.json(
            { error: "Se requieren terminal_id y tenant_id" },
            { status: 400 }
        );
    }

    try {
        const range = await prisma.terminal_number_ranges.findUnique({
            where: { terminal_id: terminalId }
        });

        if (!range) {
            return NextResponse.json(
                { error: "No hay rango asignado", needs_allocation: true },
                { status: 404 }
            );
        }

        const needsExtension = await needsNewRange(prisma, terminalId);

        return NextResponse.json({
            terminal_id: range.terminal_id,
            range_start: range.range_start,
            range_end: range.range_end,
            current_number: range.current_number,
            remaining: range.range_end - range.current_number,
            needs_extension: needsExtension,
        });
    } catch (error) {
        console.error("[Range API] GET error:", error);
        return NextResponse.json(
            { error: "Error al obtener rango" },
            { status: 500 }
        );
    }
}

// POST /api/terminals/range
// Body: { terminal_id, tenant_id, action: "allocate" | "extend" }
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { terminal_id, tenant_id, action = "allocate" } = body;

        if (!terminal_id || !tenant_id) {
            return NextResponse.json(
                { error: "Se requieren terminal_id y tenant_id" },
                { status: 400 }
            );
        }

        let range;

        if (action === "extend") {
            range = await extendRange(prisma, tenant_id, terminal_id);
        } else {
            range = await allocateRange(prisma, tenant_id, terminal_id);
        }

        return NextResponse.json({
            success: true,
            ...range,
            remaining: range.range_end - range.current_number,
        });
    } catch (error) {
        console.error("[Range API] POST error:", error);
        return NextResponse.json(
            { error: "Error al asignar rango" },
            { status: 500 }
        );
    }
}
