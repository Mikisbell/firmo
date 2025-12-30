// src/core/domain/events.ts
import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

export const aggregateTypeSchema = z.enum(["SALE", "SHIFT", "INVENTORY", "CATALOG", "PAYMENT"]);

export const paymentMethodSchema = z.enum(["CASH"]); // MVP: solo CASH (tarjeta/wallet P1)

export const baseEnvelopeSchema = z.object({
    store_id: z.string().min(1),
    terminal_id: z.string().min(1),
    terminal_sequence: z.number().int().nonnegative(),

    event_id: uuidSchema,
    schema_version: z.number().int().positive(),
    occurred_at: isoDateSchema,

    aggregate_type: aggregateTypeSchema,
    aggregate_id: z.string().min(1),

    correlation_id: z.string().min(1),
    causation_id: uuidSchema.nullish(),
});

// --------- Payloads (MVP) ----------
const shiftOpenedPayload = z.object({
    opening_cash_cents: z.number().int(),
});

const cashMovementPayload = z.object({
    type: z.enum(["IN", "OUT"]),
    amount_cents: z.number().int().positive(),
    reason: z.string().min(1),
});

const shiftClosedPayload = z.object({
    declared_cash_cents: z.number().int().nonnegative(),
    over_short_cents: z.number().int(), // puede ser negativo
});

const saleCreatedPayload = z.object({
    sale_id: z.string().min(1),
    catalog_version: z.number().int().nonnegative(),
});

const saleItemAddedPayload = z.object({
    line_id: z.string().min(1),
    product_id: z.string().min(1),
    qty: z.number().int().positive(),
    unit_price_cents: z.number().int().nonnegative(),
});

const saleItemRemovedPayload = z.object({
    line_id: z.string().min(1),
    qty: z.number().int().positive(), // remover cantidad
});

const paymentCapturedLocalPayload = z.object({
    method: paymentMethodSchema, // CASH
    amount_cents: z.number().int().nonnegative(),
    change_given_cents: z.number().int().nonnegative().default(0),
});

const saleConfirmedPayload = z.object({
    total_cents: z.number().int().nonnegative(),
});

// --------- Eventos discriminados ----------
export const eventSchema = z.discriminatedUnion("event_type", [
    baseEnvelopeSchema.extend({
        event_type: z.literal("shift_opened"),
        aggregate_type: z.literal("SHIFT"),
        payload: shiftOpenedPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("cash_movement"),
        aggregate_type: z.literal("SHIFT"),
        payload: cashMovementPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("shift_closed"),
        aggregate_type: z.literal("SHIFT"),
        payload: shiftClosedPayload,
    }),

    baseEnvelopeSchema.extend({
        event_type: z.literal("sale_created"),
        aggregate_type: z.literal("SALE"),
        payload: saleCreatedPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("sale_item_added"),
        aggregate_type: z.literal("SALE"),
        payload: saleItemAddedPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("sale_item_removed"),
        aggregate_type: z.literal("SALE"),
        payload: saleItemRemovedPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("payment_captured_local"),
        aggregate_type: z.literal("PAYMENT"),
        payload: paymentCapturedLocalPayload,
    }),
    baseEnvelopeSchema.extend({
        event_type: z.literal("sale_confirmed"),
        aggregate_type: z.literal("SALE"),
        payload: saleConfirmedPayload,
    }),
]).strict();

export type ParkEvent = z.infer<typeof eventSchema>;

// --------- Request schema (ingest) ----------
export const ingestRequestSchema = z.object({
    store_id: z.string().min(1),
    terminal_id: z.string().min(1),
    from_terminal_sequence: z.number().int().nonnegative(),
    to_terminal_sequence: z.number().int().nonnegative(),
    events: z.array(eventSchema).min(1).max(500),
}).strict();

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

// Helper
export function parseEvent(input: unknown): ParkEvent {
    return eventSchema.parse(input);
}
