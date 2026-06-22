import { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/structured-logger";
import { ProjectionHandler } from "./types";

/**
 * Proyeccion server-side de la NOTA DE VENTA (documento interno NO fiscal).
 * Espeja la maquina de estados del reducer (sales-note.reducer.ts) con guardas
 * a nivel DB (updateMany WHERE status='OPEN') como defensa en profundidad:
 * aunque llegue un evento fuera de orden, no se puede convertir/anular una nota
 * que ya salio de OPEN. El @@unique([tenant_id, order_id, check_id]) impide dos
 * notas para el mismo check (no doble emision).
 */

export const handleSalesNoteIssued: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as Extract<ParkEvent, { event_type: "SALES_NOTE_ISSUED" }>["payload"];
    await tx.sales_notes.upsert({
        where: {
            tenant_id_order_id_check_id: {
                tenant_id,
                order_id: p.order_id,
                check_id: p.check_id,
            },
        },
        create: {
            id: p.sales_note_id,
            tenant_id,
            order_id: p.order_id,
            check_id: p.check_id,
            serie: p.serie,
            numero: p.numero,
            total_cents: p.total_cents,
            status: "OPEN",
            created_at: new Date(occurred_at),
        },
        update: {}, // idempotente: re-emision sobre el mismo check no muta nada
    });
    return true;
};

export const handleSalesNoteConverted: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as Extract<ParkEvent, { event_type: "SALES_NOTE_CONVERTED" }>["payload"];
    const res = await tx.sales_notes.updateMany({
        where: { tenant_id, id: p.sales_note_id, status: "OPEN" },
        data: {
            status: "CONVERTED",
            invoice_id: p.invoice_id,
            invoice_type: p.invoice_type,
            converted_at: new Date(occurred_at),
        },
    });
    if (res.count === 0) {
        logger.warn("SALES_NOTE_CONVERTED ignorado: nota inexistente o no-OPEN", {
            salesNoteId: p.sales_note_id,
        });
    }
    return true;
};

export const handleSalesNoteVoided: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as Extract<ParkEvent, { event_type: "SALES_NOTE_VOIDED" }>["payload"];
    const res = await tx.sales_notes.updateMany({
        where: { tenant_id, id: p.sales_note_id, status: "OPEN" },
        data: {
            status: "VOIDED",
            void_reason: p.reason,
            voided_at: new Date(occurred_at),
        },
    });
    if (res.count === 0) {
        logger.warn("SALES_NOTE_VOIDED ignorado: nota inexistente o no-OPEN", {
            salesNoteId: p.sales_note_id,
        });
    }
    return true;
};
