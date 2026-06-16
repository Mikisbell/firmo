import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/structured-logger";
import { ProjectionHandler } from "./types";

export const handleInvoiceIssued: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as any;
    await tx.invoices.upsert({
        where: {
            tenant_id_order_id_check_id: {
                tenant_id,
                order_id: p.order_id,
                check_id: p.check_id,
            },
        },
        create: {
            id: p.invoice_id,
            tenant_id,
            order_id: p.order_id,
            check_id: p.check_id,
            invoice_type: p.invoice_type,
            series: p.series || null,
            invoice_number: p.invoice_number || null,
            total_cents: p.total_cents,
            status: "ISSUED",
            created_at: new Date(occurred_at),
        },
        update: {},
    });
    return true;
};

export const handleInvoiceVoided: ProjectionHandler = async (tx, event) => {
    const { payload, occurred_at } = event;
    const p = payload as any;
    await tx.invoices.update({
        where: { id: p.invoice_id },
        data: {
            status: "VOIDED",
            void_reason: p.reason,
            voided_by: p.approved_by,
            voided_at: new Date(occurred_at),
        },
    }).catch((err: unknown) => {
        logger.warn('INVOICE_VOIDED: invoice not found (out-of-order events)', {
            invoiceId: p.invoice_id,
            error: err instanceof Error ? err.message : String(err),
        });
    });
    return true;
};

export const handleCreditNoteIssued: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, actor_id } = event;
    const p = payload as any;
    await tx.credit_notes.upsert({
        where: { id: p.credit_note_id },
        create: {
            id: p.credit_note_id,
            tenant_id,
            invoice_id: p.invoice_id,
            series: p.series,
            number: p.number,
            total_cents: p.total_cents,
            reason: p.reason,
            status: "ISSUED",
            sunat_status: "PENDING",
            created_by: actor_id!,
        },
        update: {},
    });
    return true;
};

export const handleCreditNoteVoided: ProjectionHandler = async (tx, event) => {
    const { payload } = event;
    const p = payload as any;
    await tx.credit_notes.update({
        where: { id: p.credit_note_id },
        data: {
            status: "VOIDED",
        },
    }).catch((err: unknown) => {
        logger.warn('CREDIT_NOTE_VOIDED: credit note not found (out-of-order events)', {
            creditNoteId: p.credit_note_id,
            error: err instanceof Error ? err.message : String(err),
        });
    });
    return true;
};
