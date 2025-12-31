import { db } from "@/src/core/db/schema";
import { newUUID, type UUID } from "@/src/core/domain/ids";
import type { ParkEvent } from "@/src/core/domain/events";
import { getSyncClient } from "@/src/core/sync/client";

// Helper para obtener secuencia de forma segura (MVP lock optimista por 'singleton')
async function getNextSequence(store_id: string): Promise<number> {
    const st = await db.sync_state.get("singleton");
    const count = await db.events.count();
    // En un sistema real multi-tab, esto requiere cuidado. 
    // Para MVP asumimos 1 tab activa escribiendo.
    return (st?.last_terminal_sequence_acked ?? 0) + count + 1;
}

// Helper genérico para appender
async function appendEvent(
    store_id: string,
    terminal_id: string,
    event_partial: Omit<ParkEvent, "store_id" | "terminal_id" | "terminal_sequence" | "occurred_at" | "schema_version" | "synced">
) {
    const seq = await getNextSequence(store_id);
    const now = new Date().toISOString();

    const fullEvent: ParkEvent = {
        ...event_partial,
        store_id,
        terminal_id,
        terminal_sequence: seq,
        schema_version: 1,
        occurred_at: now,
        synced: 0,
    } as ParkEvent;

    await db.events.add({
        ...fullEvent,
        // Dexie schema espera primitives en índices, pero el objeto completo es válido
        // El cast 'as any' en db.events.add a veces es necesario si el tipo inferido es estricto
    } as any);

    // Trigger sync in background (fire and forget)
    getSyncClient().start(); // asegura que esté corriendo
}

export const POSActions = {
    async startSale(store_id: string, terminal_id: string) {
        const saleId = `sale_${newUUID()}`;
        await appendEvent(store_id, terminal_id, {
            event_id: newUUID(),
            event_type: "sale_created",
            aggregate_type: "SALE",
            aggregate_id: saleId,
            correlation_id: saleId,
            causation_id: null,
            payload: { sale_id: saleId, catalog_version: 1 },
        });
        return saleId;
    },

    async addToCart(store_id: string, terminal_id: string, sale_id: string, product: { id: string; price: number }) {
        await appendEvent(store_id, terminal_id, {
            event_id: newUUID(),
            event_type: "sale_item_added",
            aggregate_type: "SALE",
            aggregate_id: sale_id,
            correlation_id: sale_id,
            causation_id: null,
            payload: {
                line_id: newUUID(),
                product_id: product.id,
                qty: 1,
                unit_price_cents: product.price,
            },
        });
    },

    async confirmSale(store_id: string, terminal_id: string, sale_id: string, total_cents: number) {
        // 1. Payment (Cash)
        await appendEvent(store_id, terminal_id, {
            event_id: newUUID(),
            event_type: "payment_captured_local",
            aggregate_type: "PAYMENT",
            aggregate_id: `pay_${newUUID()}`,
            correlation_id: sale_id,
            causation_id: null,
            payload: {
                method: "CASH",
                amount_cents: total_cents, // Exacto por ahora
                change_given_cents: 0
            }
        });

        // 2. Confirm
        await appendEvent(store_id, terminal_id, {
            event_id: newUUID(),
            event_type: "sale_confirmed",
            aggregate_type: "SALE",
            aggregate_id: sale_id,
            correlation_id: sale_id,
            causation_id: null,
            payload: { total_cents },
        });
    },
};
