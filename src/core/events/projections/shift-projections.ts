import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/structured-logger";
import { ProjectionHandler } from "./types";

export const handleShiftOpened: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, terminal_id, actor_id } = event;
    const p = payload as any;

    const tenantSettings = await (tx as any).tenant_settings.findFirst({
        where: { tenant_id },
        select: { max_cash_opening_cents: true },
    });
    const maxOpening = tenantSettings?.max_cash_opening_cents ?? 50_000;
    if (p.cash_opening_cents > maxOpening) {
        logger.warn('Monto de apertura excede máximo configurado', {
            tenantId: tenant_id,
            cashOpeningCents: p.cash_opening_cents,
            maxCents: maxOpening,
        });
        return false;
    }

    await tx.shifts.updateMany({
        where: { tenant_id, terminal_id, status: "OPEN" },
        data: { status: "CLOSED", closed_at: new Date(occurred_at), closed_by: actor_id },
    });

    await tx.shifts.upsert({
        where: { id: p.shift_id },
        create: {
            id: p.shift_id,
            tenant_id,
            terminal_id,
            status: "OPEN",
            opened_at: new Date(occurred_at),
            opened_by: actor_id!,
            cash_opening_cents: p.cash_opening_cents,
            cash_expected_cents: p.cash_opening_cents,
        },
        update: {},
    });
    return true;
};

export const handleCashAdjusted: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload } = event;
    const p = payload as any;
    const delta = p.delta_cents ?? 0;
    await tx.shifts.updateMany({
        where: { id: p.shift_id, tenant_id, status: "OPEN" },
        data: { cash_expected_cents: { increment: delta } },
    });
    return true;
};

export const handleShiftClosed: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, actor_id } = event;
    const p = payload as any;
    
    const currentShift = await tx.shifts.findFirst({
        where: { id: p.shift_id, tenant_id },
        select: { cash_opening_cents: true, cash_expected_cents: true },
    });

    const cashPayments = await tx.payments.aggregate({
        where: { tenant_id, shift_id: p.shift_id, payment_method: "CASH", status: "COMPLETED" },
        _sum: { amount_cents: true },
    });
    const cashSalesIn = cashPayments._sum.amount_cents ?? 0;

    const openingCents = currentShift?.cash_opening_cents ?? 0;
    const adjustmentsDelta = (currentShift?.cash_expected_cents ?? openingCents) - openingCents;
    const cashExpected = openingCents + cashSalesIn + adjustmentsDelta;

    const cashCounted = p.cash_counted_cents ?? 0;
    const diffCents = cashCounted - cashExpected;

    await tx.shifts.update({
        where: { id: p.shift_id },
        data: {
            status: "CLOSED",
            closed_at: new Date(occurred_at),
            closed_by: actor_id,
            cash_expected_cents: cashExpected,
            cash_counted_cents: cashCounted,
            diff_cents: diffCents,
        },
    });
    return true;
};
