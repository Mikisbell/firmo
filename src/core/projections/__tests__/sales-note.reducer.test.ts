/**
 * Tests del reducer de NOTA DE VENTA (sales-note.reducer.ts).
 *
 * Cubre la maquina de estados a prueba de fallos:
 *   - OPEN -> CONVERTED (un solo comprobante por nota)
 *   - OPEN -> VOIDED
 *   - transiciones invalidas no mutan el estado y acumulan warnings (nunca lanzan)
 *
 * Property test: para CUALQUIER secuencia de eventos, el estado final es coherente
 * (status valido, sin doble emision, sin anular ya convertida).
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { applySalesNoteEvent, type SalesNoteProjection } from "../sales-note.reducer";
import type { ParkEvent } from "@/src/core/domain/events";

// ============================================================================
// Helpers — constructores de eventos de nota de venta
// ============================================================================

function baseEnvelope(aggregate_id: string) {
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: 1,
        occurred_at: new Date("2026-06-19T12:00:00.000Z").toISOString(),
        aggregate_type: "SALES_NOTE" as const,
        aggregate_id,
        correlation_id: aggregate_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "WAITER",
        schema_version: 1,
        payload_version: 1,
    };
}

function issued(overrides: Partial<{ sales_note_id: string; total_cents: number }> = {}): Extract<
    ParkEvent,
    { event_type: "SALES_NOTE_ISSUED" }
> {
    const sales_note_id = overrides.sales_note_id || uuidv4();
    return {
        ...baseEnvelope(sales_note_id),
        event_type: "SALES_NOTE_ISSUED",
        payload: {
            sales_note_id,
            order_id: uuidv4(),
            check_id: "c1",
            serie: "NV01",
            numero: "1",
            total_cents: overrides.total_cents ?? 2500,
        },
    };
}

function converted(
    sales_note_id: string,
    overrides: Partial<{ invoice_id: string; invoice_type: "BOLETA" | "FACTURA" }> = {},
): Extract<ParkEvent, { event_type: "SALES_NOTE_CONVERTED" }> {
    return {
        ...baseEnvelope(sales_note_id),
        event_type: "SALES_NOTE_CONVERTED",
        payload: {
            sales_note_id,
            invoice_id: overrides.invoice_id || uuidv4(),
            invoice_type: overrides.invoice_type || "BOLETA",
        },
    };
}

function voided(
    sales_note_id: string,
    reason = "ANULACION POR ERROR",
): Extract<ParkEvent, { event_type: "SALES_NOTE_VOIDED" }> {
    return {
        ...baseEnvelope(sales_note_id),
        event_type: "SALES_NOTE_VOIDED",
        payload: { sales_note_id, reason },
    };
}

// ============================================================================
// Unit — happy paths
// ============================================================================

describe("applySalesNoteEvent — emision", () => {
    it("ISSUED crea la nota en estado OPEN sin warnings", () => {
        const e = issued({ total_cents: 4200 });
        const { state, warnings } = applySalesNoteEvent(null, e);
        expect(warnings).toHaveLength(0);
        expect(state).toMatchObject({
            sales_note_id: e.payload.sales_note_id,
            total_cents: 4200,
            status: "OPEN",
        });
    });

    it("ISSUED sobre una nota existente se ignora (idempotencia de creacion)", () => {
        const e = issued();
        const first = applySalesNoteEvent(null, e).state;
        const { state, warnings } = applySalesNoteEvent(first, issued({ sales_note_id: e.payload.sales_note_id }));
        expect(state).toBe(first);
        expect(warnings[0]).toContain("ya existente");
    });
});

describe("applySalesNoteEvent — conversion", () => {
    it("OPEN -> CONVERTED guarda invoice_id e invoice_type", () => {
        const e = issued();
        const open = applySalesNoteEvent(null, e).state;
        const inv = uuidv4();
        const { state, warnings } = applySalesNoteEvent(
            open,
            converted(e.payload.sales_note_id, { invoice_id: inv, invoice_type: "FACTURA" }),
        );
        expect(warnings).toHaveLength(0);
        expect(state).toMatchObject({ status: "CONVERTED", invoice_id: inv, invoice_type: "FACTURA" });
    });

    it("re-convertir al MISMO comprobante es no-op sin warning (idempotente)", () => {
        const e = issued();
        const inv = uuidv4();
        const open = applySalesNoteEvent(null, e).state;
        const conv = applySalesNoteEvent(open, converted(e.payload.sales_note_id, { invoice_id: inv })).state;
        const { state, warnings } = applySalesNoteEvent(
            conv,
            converted(e.payload.sales_note_id, { invoice_id: inv }),
        );
        expect(warnings).toHaveLength(0);
        expect(state).toBe(conv);
    });

    it("re-convertir a OTRO comprobante conserva el primero + warning (no doble emision)", () => {
        const e = issued();
        const inv1 = uuidv4();
        const open = applySalesNoteEvent(null, e).state;
        const conv = applySalesNoteEvent(open, converted(e.payload.sales_note_id, { invoice_id: inv1 })).state;
        const { state, warnings } = applySalesNoteEvent(conv, converted(e.payload.sales_note_id, { invoice_id: uuidv4() }));
        expect(state).toMatchObject({ invoice_id: inv1 });
        expect(warnings[0]).toContain("no doble emision");
    });
});

describe("applySalesNoteEvent — anulacion", () => {
    it("OPEN -> VOIDED guarda el motivo", () => {
        const e = issued();
        const open = applySalesNoteEvent(null, e).state;
        const { state, warnings } = applySalesNoteEvent(open, voided(e.payload.sales_note_id, "CLIENTE SE RETIRO"));
        expect(warnings).toHaveLength(0);
        expect(state).toMatchObject({ status: "VOIDED", void_reason: "CLIENTE SE RETIRO" });
    });

    it("VOIDED es idempotente", () => {
        const e = issued();
        const open = applySalesNoteEvent(null, e).state;
        const v = applySalesNoteEvent(open, voided(e.payload.sales_note_id)).state;
        const { state } = applySalesNoteEvent(v, voided(e.payload.sales_note_id));
        expect(state).toBe(v);
    });
});

// ============================================================================
// Unit — fail-proofs (transiciones invalidas)
// ============================================================================

describe("applySalesNoteEvent — fail-proofs", () => {
    it("no se puede convertir una nota ANULADA", () => {
        const e = issued();
        const open = applySalesNoteEvent(null, e).state;
        const v = applySalesNoteEvent(open, voided(e.payload.sales_note_id)).state;
        const { state, warnings } = applySalesNoteEvent(v, converted(e.payload.sales_note_id));
        expect(state).toBe(v);
        expect(state?.status).toBe("VOIDED");
        expect(warnings[0]).toContain("ANULADA");
    });

    it("no se puede anular una nota ya CONVERTIDA", () => {
        const e = issued();
        const open = applySalesNoteEvent(null, e).state;
        const conv = applySalesNoteEvent(open, converted(e.payload.sales_note_id)).state;
        const { state, warnings } = applySalesNoteEvent(conv, voided(e.payload.sales_note_id));
        expect(state).toBe(conv);
        expect(state?.status).toBe("CONVERTED");
        expect(warnings[0]).toContain("convertida");
    });

    it("CONVERTED/VOIDED sin nota previa se ignoran (no lanzan)", () => {
        const id = uuidv4();
        expect(applySalesNoteEvent(null, converted(id)).state).toBeNull();
        expect(applySalesNoteEvent(null, voided(id)).warnings[0]).toContain("sin nota de venta previa");
    });
});

// ============================================================================
// Property — invariantes para CUALQUIER secuencia
// ============================================================================

describe("applySalesNoteEvent — property", () => {
    it("para cualquier secuencia: status valido, sin doble emision, nunca lanza", () => {
        const noteId = uuidv4();
        const opArb = fc.constantFrom<"convert" | "void">("convert", "void");

        fc.assert(
            fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
                let state = applySalesNoteEvent(null, issued({ sales_note_id: noteId })).state;
                let firstInvoiceId: string | undefined;

                for (const op of ops) {
                    const before = state;
                    const ev = op === "convert" ? converted(noteId) : voided(noteId);
                    state = applySalesNoteEvent(state, ev).state;

                    // status siempre valido
                    expect(["OPEN", "CONVERTED", "VOIDED"]).toContain(state?.status);

                    // una vez CONVERTED, el invoice_id no cambia jamas (no doble emision)
                    if (before?.status === "CONVERTED") {
                        firstInvoiceId ??= before.invoice_id;
                        expect(state?.invoice_id).toBe(firstInvoiceId);
                    }

                    // una vez VOIDED, jamas pasa a CONVERTED
                    if (before?.status === "VOIDED") {
                        expect(state?.status).toBe("VOIDED");
                    }
                }
                return true;
            }),
            { numRuns: 200 },
        );
    });
});
