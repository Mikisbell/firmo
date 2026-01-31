/**
 * Order Number Range Allocator
 * 
 * Asigna rangos únicos de números de orden a cada terminal.
 * Evita colisiones cuando múltiples terminales están offline.
 * 
 * Cada terminal recibe un rango de 10,000 números.
 * Formato: Terminal CAJA → 10001-20000, MESA_1 → 20001-30000, etc.
 */

import { PrismaClient } from "@prisma/client";

const RANGE_SIZE = 10000; // 10,000 números por terminal

export interface NumberRange {
    terminal_id: string;
    range_start: number;
    range_end: number;
    current_number: number;
}

/**
 * Asigna un nuevo rango de números a un terminal
 */
export async function allocateRange(
    prisma: PrismaClient,
    tenantId: string,
    terminalId: string
): Promise<NumberRange> {
    // Buscar si ya tiene rango asignado
    const existing = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });

    if (existing) {
        return {
            terminal_id: existing.terminal_id,
            range_start: existing.range_start,
            range_end: existing.range_end,
            current_number: existing.current_number,
        };
    }

    // Buscar el último rango asignado para este tenant
    const lastRange = await prisma.terminal_number_ranges.findFirst({
        where: { tenant_id: tenantId },
        orderBy: { range_end: 'desc' }
    });

    const rangeStart = (lastRange?.range_end ?? 0) + 1;
    const rangeEnd = rangeStart + RANGE_SIZE - 1;

    // Crear nuevo rango
    const newRange = await prisma.terminal_number_ranges.create({
        data: {
            terminal_id: terminalId,
            tenant_id: tenantId,
            range_start: rangeStart,
            range_end: rangeEnd,
            current_number: rangeStart,
        }
    });

    return {
        terminal_id: newRange.terminal_id,
        range_start: newRange.range_start,
        range_end: newRange.range_end,
        current_number: newRange.current_number,
    };
}

/**
 * Obtiene el siguiente número de orden para un terminal
 * (usado en servidor para validación)
 */
export async function getNextOrderNumber(
    prisma: PrismaClient,
    terminalId: string
): Promise<number> {
    const range = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });

    if (!range) {
        throw new Error(`No range allocated for terminal ${terminalId}`);
    }

    if (range.current_number >= range.range_end) {
        throw new Error(`Range exhausted for terminal ${terminalId}. Request new range.`);
    }

    // Incrementar y retornar
    const updated = await prisma.terminal_number_ranges.update({
        where: { terminal_id: terminalId },
        data: { current_number: { increment: 1 } }
    });

    return updated.current_number;
}

/**
 * Verifica si un terminal necesita un nuevo rango
 */
export async function needsNewRange(
    prisma: PrismaClient,
    terminalId: string,
    threshold: number = 100 // Alertar cuando quedan menos de 100
): Promise<boolean> {
    const range = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });

    if (!range) return true;

    const remaining = range.range_end - range.current_number;
    return remaining < threshold;
}

/**
 * Extiende el rango de un terminal (cuando se está agotando)
 */
export async function extendRange(
    prisma: PrismaClient,
    tenantId: string,
    terminalId: string
): Promise<NumberRange> {
    const existing = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });

    if (!existing) {
        return allocateRange(prisma, tenantId, terminalId);
    }

    // Buscar el último rango global
    const lastRange = await prisma.terminal_number_ranges.findFirst({
        where: { tenant_id: tenantId },
        orderBy: { range_end: 'desc' }
    });

    const newRangeEnd = (lastRange?.range_end ?? existing.range_end) + RANGE_SIZE;

    // Extender el rango existente
    const updated = await prisma.terminal_number_ranges.update({
        where: { terminal_id: terminalId },
        data: { range_end: newRangeEnd }
    });

    return {
        terminal_id: updated.terminal_id,
        range_start: updated.range_start,
        range_end: updated.range_end,
        current_number: updated.current_number,
    };
}
