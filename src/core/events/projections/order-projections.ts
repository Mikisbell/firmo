import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/structured-logger";
import { ProjectionHandler } from "./types";
import {
    deductInventoryForOrder,
    type DeductionAlert,
} from "@/src/core/inventory/deduction.service";

/**
 * Ejecuta los efectos secundarios de una deducción de inventario (push
 * notifications de stock + Auto-86) FUERA de la transacción, usando el prisma
 * global. Best-effort: nunca propaga errores. Se invoca fire-and-forget para
 * no retener la transacción de la proyección.
 */
async function runDeductionSideEffects(
    tenantId: string,
    alerts: DeductionAlert[],
    productIdToReevaluate: string | null,
): Promise<void> {
    if (alerts.length > 0) {
        const { notifyLowStock } = await import("@/src/core/inventory/stock-alert-notifier");
        for (const alert of alerts) {
            await notifyLowStock({
                tenantId,
                inventoryCode: alert.inventory_code,
                inventoryName: alert.inventory_name,
                currentStock: alert.current_stock,
                minStock: alert.min_stock ?? 0,
                unit: alert.unit,
                alertType: alert.type === "NEGATIVE_STOCK" ? "OUT_OF_STOCK" : "LOW_STOCK",
            }).catch(() => { /* best-effort */ });
        }
    }

    if (productIdToReevaluate) {
        try {
            const prisma = (await import("@/src/core/db/prisma")).default;
            const { ProductAvailabilityService } = await import("@/src/core/services/product-availability.service");
            const { eventBus } = await import("@/src/core/infra/event-bus");
            const availService = new ProductAvailabilityService(prisma, eventBus);
            await availService.autoCheckAvailability(tenantId, productIdToReevaluate);
        } catch (e) {
            logger.warn("Auto-86 check falló post-deducción", {
                productId: productIdToReevaluate,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
}

export const handleOrderCreated: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, terminal_id } = event;
    const p = payload as any;
    
    await tx.orders.upsert({
        where: { id: p.order_id },
        create: {
            id: p.order_id,
            tenant_id,
            order_number: p.order_number,
            order_type: p.order_type,
            order_status: "OPEN",
            fulfillment_status: "COOKING",
            handoff_status: "WAITING",
            stations_active: [],
            unpaid_checks_count: 1,
            subtotal_cents: 0,
            discount_cents: 0,
            total_cents: 0,
            items: p.items || [],
            checks: p.checks || [],
            terminal_id,
            created_at: new Date(occurred_at),
            updated_at: new Date(occurred_at),
        },
        update: { updated_at: new Date(occurred_at) },
    });

    if (p.order_type === 'DINE_IN' && p.fulfillment?.table_number) {
        await tx.$executeRaw`
            UPDATE tables 
            SET status = 'OCCUPIED', 
                current_order_id = ${p.order_id}::uuid,
                occupied_since = ${new Date(occurred_at)}
            WHERE tenant_id = ${tenant_id}::uuid 
              AND number = ${p.fulfillment.table_number}
        `;

        const tbl = await tx.tables.findFirst({
            where: { tenant_id, number: p.fulfillment.table_number },
            select: { id: true }
        });
        if (tbl) {
            await tx.order_tables.create({
                data: {
                    order_id: p.order_id,
                    table_id: tbl.id,
                    is_primary: true
                }
            }).catch((err) => {
                console.error("ERROR IN order_tables.create:", err);
            });
        }
    }
    return true;
};

export const handleOrderItemAdded: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, actor_id } = event;
    const p = payload as any;

    const order = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (order) {
        const items = order.items as any[] || [];
        const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
        await tx.orders.update({
            where: { id: p.order_id },
            data: {
                items: [...items, p.line],
                subtotal_cents: order.subtotal_cents + lineCents,
                total_cents: order.total_cents + lineCents,
                updated_at: new Date(occurred_at),
            },
        });

        const fulfillment = (order as any).fulfillment as any;
        const tableNumber: string | null = fulfillment?.table_number ?? null;
        await tx.$executeRaw`
            INSERT INTO order_item_projections
                (tenant_id, order_id, line_id, table_number, waiter_id, name, qty, station, status, created_at, updated_at)
            VALUES (
                ${tenant_id}::uuid,
                ${p.order_id}::uuid,
                ${p.line.line_id},
                ${tableNumber},
                ${actor_id ?? null}::uuid,
                ${p.line.name},
                ${p.line.qty ?? 1},
                ${p.line.station ?? 'COCINA'},
                'PENDING',
                ${new Date(occurred_at)},
                ${new Date(occurred_at)}
            )
            ON CONFLICT (order_id, line_id) DO NOTHING
        `;
    }
    return true;
};

export const handleOrderItemQtyChanged: ProjectionHandler = async (tx, event) => {
    const { payload, occurred_at } = event;
    const p = payload as any;

    const order = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (order) {
        const items = (order.items as any[]) || [];
        const itemIndex = items.findIndex((i: any) => i.line_id === p.line_id);
        if (itemIndex >= 0) {
            const oldItem = items[itemIndex];
            const oldLineCents = (oldItem.qty || 1) * (oldItem.unit_price_cents || 0);
            const newLineCents = (p.to_qty) * (oldItem.unit_price_cents || 0);
            const diff = newLineCents - oldLineCents;
            const updatedItems = [...items];
            updatedItems[itemIndex] = { ...oldItem, qty: p.to_qty };
            
            await tx.orders.update({
                where: { id: p.order_id },
                data: {
                    items: updatedItems,
                    subtotal_cents: order.subtotal_cents + diff,
                    total_cents: order.total_cents + diff,
                    updated_at: new Date(occurred_at),
                },
            });
        }
    }
    return true;
};

export const handleOrderItemStatusChanged: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as any;

    if (p.to === "DONE") {
        const order = await tx.orders.findUnique({ where: { id: event.aggregate_id } });
        if (order) {
            const items = order.items as any[] || [];
            const item = items.find((i: any) => i.line_id === p.line_id);
            if (item) {
                const locationId = (order as any).location_id || tenant_id;
                // Pasamos `tx` directamente: la deducción corre dentro de la misma
                // transacción de la proyección (sin transacción anidada).
                const deductionResult = await deductInventoryForOrder(
                    tx,
                    tenant_id,
                    locationId,
                    event.aggregate_id,
                    p.line_id,
                    item.product_id,
                    item.qty || 1
                ).catch((err) => ({
                    success: false as const,
                    deductions: [],
                    alerts: [],
                    productIdToReevaluate: null,
                    error: err instanceof Error ? err.message : String(err),
                }));

                if (!deductionResult.success) {
                    logger.warn('Deducción de inventario falló', {
                        orderId: event.aggregate_id,
                        lineId: p.line_id,
                        deductionError: deductionResult.error,
                    });
                } else {
                    // Efectos secundarios (push + Auto-86) fire-and-forget con el
                    // prisma global: NO se await dentro de la tx para no retenerla.
                    // El error se traga (best-effort), igual que las notificaciones.
                    runDeductionSideEffects(
                        tenant_id,
                        deductionResult.alerts,
                        deductionResult.productIdToReevaluate,
                    ).catch(() => { /* best-effort */ });
                }
            }
        }
    }

    const now = new Date(occurred_at);
    const readyAt = p.to === 'READY' ? now : null;
    const servedAt = p.to === 'DONE' ? now : null;
    await tx.$executeRaw`
        UPDATE order_item_projections
        SET
            status     = ${p.to},
            ready_at   = COALESCE(ready_at,   ${readyAt}),
            served_at  = COALESCE(served_at,  ${servedAt}),
            updated_at = ${now}
        WHERE order_id = ${p.order_id}::uuid
          AND line_id  = ${p.line_id}
    `;
    return true;
};

export const handleOrderSubmitted: ProjectionHandler = async (tx, event) => {
    const { payload, occurred_at } = event;
    const p = payload as any;
    const now = new Date(occurred_at);
    const itemsByStation = p.items_by_station as Record<string, Array<{ line_id: string }>>;
    
    for (const lineItems of Object.values(itemsByStation ?? {})) {
        for (const item of lineItems) {
            await tx.$executeRaw`
                UPDATE order_item_projections
                SET
                    status       = 'IN_KITCHEN',
                    submitted_at = COALESCE(submitted_at, ${now}),
                    updated_at   = ${now}
                WHERE order_id = ${p.order_id}::uuid
                  AND line_id  = ${item.line_id}
                  AND status   = 'PENDING'
            `;
        }
    }
    return true;
};

export const handleOrderItemVoided: ProjectionHandler = async (tx, event) => {
    const { payload } = event;
    const p = payload as any;
    await tx.$executeRaw`
        DELETE FROM order_item_projections
        WHERE order_id = ${p.order_id}::uuid
          AND line_id  = ${p.line_id}
    `;
    return true;
};

export const handleOrderItemNote: ProjectionHandler = async (tx, event) => {
    const { payload, occurred_at } = event;
    const p = payload as any;
    await tx.$executeRaw`
        UPDATE order_item_projections
        SET notes = ${p.note}, updated_at = ${new Date(occurred_at)}
        WHERE order_id = ${p.order_id}::uuid
          AND line_id  = ${p.line_id}
    `;
    return true;
};

export const handleOrderCancelled: ProjectionHandler = async (tx, event) => {
    const { payload } = event;
    const p = payload as any;
    await tx.$executeRaw`
        DELETE FROM order_item_projections
        WHERE order_id = ${p.order_id}::uuid
    `;
    await tx.$executeRaw`
        UPDATE tables 
        SET status = 'AVAILABLE', 
            current_order_id = NULL,
            occupied_since = NULL
        WHERE current_order_id = ${p.order_id}::uuid
    `;
    return true;
};
