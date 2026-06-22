/**
 * Reducer de NOTA DE VENTA — documento interno NO fiscal (pre-cuenta) que el mozo entrega
 * y que luego se convierte en boleta/factura. Maquina de estados a prueba de fallos:
 *
 *   OPEN ──convert──▶ CONVERTED   (un solo comprobante por nota; no doble emision)
 *     │
 *     └────void─────▶ VOIDED
 *
 * Reglas duras (el reducer NUNCA lanza — acumula warnings):
 *   - No se puede convertir una nota ANULADA.
 *   - No se puede anular una nota ya CONVERTIDA.
 *   - Conversion idempotente: re-convertir al mismo comprobante es no-op; a otro distinto conserva el primero.
 *   - SALES_NOTE_ISSUED sobre una nota existente se ignora (idempotencia de creacion).
 */
import type { ParkEvent } from "../domain/events";
import type { ApplyResult } from "./types";

export type SalesNoteStatus = "OPEN" | "CONVERTED" | "VOIDED";

export interface SalesNoteProjection {
    sales_note_id: string;
    order_id: string;
    check_id: string;
    serie: string;
    numero: string;
    total_cents: number;
    status: SalesNoteStatus;
    /** Comprobante fiscal al que se convirtio (si status === CONVERTED). */
    invoice_id?: string;
    invoice_type?: string;
    /** Motivo de anulacion (si status === VOIDED). */
    void_reason?: string;
}

export function applySalesNoteEvent(
    state: SalesNoteProjection | null,
    e: ParkEvent,
): ApplyResult<SalesNoteProjection | null> {
    const warnings: string[] = [];

    if (e.event_type === "SALES_NOTE_ISSUED") {
        if (state) {
            warnings.push(
                `SALES_NOTE_ISSUED sobre nota ya existente (${state.sales_note_id}); ignorado`,
            );
            return { state, warnings };
        }
        const p = e.payload;
        return {
            state: {
                sales_note_id: p.sales_note_id,
                order_id: p.order_id,
                check_id: p.check_id,
                serie: p.serie,
                numero: p.numero,
                total_cents: p.total_cents,
                status: "OPEN",
            },
            warnings,
        };
    }

    // El resto de eventos requieren una nota previa.
    if (!state) {
        warnings.push(`${e.event_type} sin nota de venta previa; ignorado`);
        return { state: null, warnings };
    }

    if (e.event_type === "SALES_NOTE_CONVERTED") {
        if (state.status === "VOIDED") {
            warnings.push("No se puede convertir una nota de venta ANULADA");
            return { state, warnings };
        }
        if (state.status === "CONVERTED") {
            // Idempotente: mismo comprobante -> no-op; distinto -> se conserva el primero.
            if (state.invoice_id !== e.payload.invoice_id) {
                warnings.push(
                    "Nota de venta ya convertida a otro comprobante; se conserva el primero (no doble emision)",
                );
            }
            return { state, warnings };
        }
        return {
            state: {
                ...state,
                status: "CONVERTED",
                invoice_id: e.payload.invoice_id,
                invoice_type: e.payload.invoice_type,
            },
            warnings,
        };
    }

    if (e.event_type === "SALES_NOTE_VOIDED") {
        if (state.status === "CONVERTED") {
            warnings.push("No se puede anular una nota de venta ya convertida a comprobante");
            return { state, warnings };
        }
        if (state.status === "VOIDED") {
            // Anulacion idempotente.
            return { state, warnings };
        }
        return {
            state: { ...state, status: "VOIDED", void_reason: e.payload.reason },
            warnings,
        };
    }

    // Evento no relacionado con la nota de venta: estado inalterado.
    return { state, warnings };
}
