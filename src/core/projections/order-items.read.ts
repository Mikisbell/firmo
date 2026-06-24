// src/core/projections/order-items.read.ts
//
// READ-MODEL SERVER-SIDE ÚNICO para el status VIVO de los items de una orden.
//
// CONTRATO (change remove-item-status-from-write-model, council #2179):
//   - El `status` de cada línea se resuelve LEYENDO EXCLUSIVAMENTE de
//     `order_item_projections` (la proyección viva del KDS, alimentada por
//     ORDER_ITEM_STATUS_CHANGED / ORDER_SUBMITTED / ...).
//   - PROHIBIDO fusionar con el JSON `orders.items[]` o usar fallback
//     `?? item.status`. El JSON del snapshot queda CONGELADO en la creación
//     (PENDING) y nunca refleja transiciones de cocina — leer de ahí ES el
//     "trap". Una línea SIN fila en la proyección queda AUSENTE del Map
//     (ausencia explícita); el read-model NUNCA inventa un status desde el JSON.
//   - `tenant_id` SIEMPRE en el filtro (aislamiento multi-tenant server-side).
//
// PROPÓSITO: consolidar en UN solo módulo las queries que hoy cada lector
// (course-fire, stations route, etc.) duplicaba contra `order_item_projections`
// (la duplicación que motivó el veredicto del council). Los consumers que
// necesiten un fallback de presentación (p.ej. course-fire muestra 'PENDING'
// para líneas no proyectadas) lo aplican EN SU CAPA, no aquí: este read-model
// reporta SOLO lo que la proyección sabe.

import type { Prisma } from "@prisma/client";
import type { ItemStatus } from "@/src/core/domain/events";

/**
 * Status VIVO de una línea, proveniente SOLO de `order_item_projections`.
 */
export interface ProjectedItemStatus {
    line_id: string;
    status: ItemStatus;
    station: string;
    updated_at: Date;
}

/**
 * Devuelve el status VIVO de los items de UNA orden como `Map<line_id, ...>`.
 *
 * Lee SOLO de `order_item_projections`, filtrando por `tenant_id` + `order_id`.
 * Las líneas sin fila proyectada NO aparecen en el Map (ausencia explícita).
 *
 * @param tx       cliente Prisma o de transacción (comparte la conexión del caller).
 * @param tenantId tenant del que se leen las proyecciones (server-side, nunca del cliente).
 * @param orderId  orden cuyos items se resuelven.
 */
export async function getItemStatuses(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
): Promise<Map<string, ProjectedItemStatus>> {
    const rows = await tx.order_item_projections.findMany({
        where: { tenant_id: tenantId, order_id: orderId },
        select: { line_id: true, status: true, station: true, updated_at: true },
    });

    const result = new Map<string, ProjectedItemStatus>();
    for (const row of rows) {
        result.set(row.line_id, {
            line_id: row.line_id,
            status: row.status as ItemStatus,
            station: row.station,
            updated_at: row.updated_at,
        });
    }
    return result;
}

/**
 * Versión BATCH: resuelve el status VIVO de los items de VARIAS órdenes en una
 * sola query (evita el N+1 de llamar `getItemStatuses` por orden).
 *
 * Devuelve `Map<order_id, Map<line_id, ProjectedItemStatus>>`. Una orden sin
 * filas proyectadas NO aparece en el Map externo (ausencia explícita). Si la
 * lista de `orderIds` está vacía, no se ejecuta query y se devuelve un Map vacío.
 *
 * @param tx       cliente Prisma o de transacción.
 * @param tenantId tenant del que se leen las proyecciones (server-side).
 * @param orderIds órdenes cuyos items se resuelven.
 */
export async function getItemStatusesForOrders(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderIds: string[],
): Promise<Map<string, Map<string, ProjectedItemStatus>>> {
    const result = new Map<string, Map<string, ProjectedItemStatus>>();
    if (orderIds.length === 0) return result;

    const rows = await tx.order_item_projections.findMany({
        where: { tenant_id: tenantId, order_id: { in: orderIds } },
        select: {
            order_id: true,
            line_id: true,
            status: true,
            station: true,
            updated_at: true,
        },
    });

    for (const row of rows) {
        let inner = result.get(row.order_id);
        if (!inner) {
            inner = new Map<string, ProjectedItemStatus>();
            result.set(row.order_id, inner);
        }
        inner.set(row.line_id, {
            line_id: row.line_id,
            status: row.status as ItemStatus,
            station: row.station,
            updated_at: row.updated_at,
        });
    }
    return result;
}
