import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";
import { ProjectionHandler } from "./types";
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

export const handleCheckCreated: ProjectionHandler = async (tx, event) => {
    const { payload, occurred_at } = event;
    const p = payload as any;
    const order = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (order) {
        const checks = (order.checks as any[]) || [];
        const exists = checks.some((c: any) => c.check_id === p.check?.check_id);
        if (!exists && p.check) {
            await tx.orders.update({
                where: { id: p.order_id },
                data: {
                    checks: [...checks, p.check],
                    unpaid_checks_count: (order.unpaid_checks_count ?? 0) + 1,
                    updated_at: new Date(occurred_at),
                },
            });
        }
    }
    return true;
};

export const handleCheckPaymentAdded: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, terminal_id, actor_id } = event;
    const p = payload as any;
    const paymentId = p.payment?.id || p.paymentId || uuidv4();
    const amountCents = p.payment?.amount_cents ?? p.amountCents ?? 0;
    const method = p.payment?.method ?? p.method ?? 'CASH';

    await tx.payments.upsert({
        where: { id: paymentId },
        create: {
            id: paymentId,
            tenant_id,
            order_id: p.order_id,
            check_id: p.check_id,
            amount_cents: amountCents,
            payment_method: method,
            reference: p.payment?.ref ?? p.reference ?? null,
            status: 'COMPLETED',
            processed_at: new Date(occurred_at),
            processed_by: actor_id ?? null,
            shift_id: event.shift_id ?? null,
            terminal_id: terminal_id ?? '',
        },
        update: {},
    });

    const payOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (payOrder) {
        const checks = (payOrder.checks as any[]) || [];
        const updated = checks.map((c: any) => {
            if (c.check_id !== p.check_id) return c;
            const existing = c.payment?.payments || [];
            return {
                ...c,
                payment: {
                    status: 'PARTIAL',
                    payments: [...existing, { amount_cents: amountCents, method }],
                },
            };
        });
        await tx.orders.update({
            where: { id: p.order_id },
            data: { checks: updated, updated_at: new Date(occurred_at) },
        });
    }
    return true;
};

export const handleCheckMarkedPaid: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as any;

    const paidOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (paidOrder) {
        const paidChecks = (paidOrder.checks as any[]) || [];
        const updatedChecks = paidChecks.map((c: any) => {
            if (c.check_id !== p.check_id) return c;
            return {
                ...c,
                status: 'PAID',
                change_cents: p.change_cents ?? 0,
                payment: { ...c.payment, status: 'PAID' },
            };
        });
        
        const newUnpaidCount = Math.max(0, (paidOrder.unpaid_checks_count ?? 1) - 1);

        await tx.orders.update({
            where: { id: p.order_id },
            data: {
                checks: updatedChecks,
                unpaid_checks_count: newUnpaidCount,
                updated_at: new Date(occurred_at),
            },
        });

        if (newUnpaidCount === 0 && paidOrder.table_id) {
            await tx.$executeRaw`
                UPDATE tables 
                SET status = 'AVAILABLE', current_order_id = NULL, occupied_since = NULL
                WHERE current_order_id = ${p.order_id}::uuid OR id = ${paidOrder.table_id}::uuid
            `;
        } else if (newUnpaidCount === 0) {
            const fulfillment = (paidOrder as any).fulfillment as any;
            if (fulfillment?.table_number) {
                await tx.$executeRaw`
                    UPDATE tables 
                    SET status = 'AVAILABLE', current_order_id = NULL, occupied_since = NULL
                    WHERE tenant_id = ${tenant_id}::uuid AND number = ${fulfillment.table_number}
                `;
            }
        }
    } else {
        await tx.orders.update({
            where: { id: p.order_id },
            data: {
                unpaid_checks_count: { decrement: 1 },
                updated_at: new Date(occurred_at),
            },
        });
    }
    return true;
};

export const handleCheckTipSet: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, terminal_id, actor_id } = event;
    const p = payload as any;

    const activeShift = await tx.shifts.findFirst({
        where: { tenant_id, terminal_id, status: "OPEN" },
        select: { id: true },
    });
    if (!activeShift) return true;

    const tipOrder = await tx.orders.findUnique({
        where: { id: p.order_id },
        select: { location_id: true, waiter_id: true },
    });

    const tipId = uuidv5(`${p.order_id}-${p.check_id}-tip`, uuidv5.URL);
    await tx.tips.upsert({
        where: { id: tipId },
        create: {
            id: tipId,
            tenant_id,
            location_id: (tipOrder as any)?.location_id ?? tenant_id,
            order_id: p.order_id,
            shift_id: activeShift.id,
            amount: p.tip_cents,
            payment_method: 'CASH',
            waiter_id: (tipOrder as any)?.waiter_id ?? actor_id!,
        },
        update: { amount: p.tip_cents },
    });
    return true;
};

export const handleCheckDiscountSet: ProjectionHandler = async (tx, event) => {
    const { payload } = event;
    const p = payload as any;
    const discountOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (discountOrder) {
        await tx.orders.update({
            where: { id: p.order_id },
            data: {
                discount_cents: p.discount_cents,
                total_cents: Math.max(0, discountOrder.subtotal_cents - p.discount_cents),
            },
        });
    }
    return true;
};

export const handleRefundIssued: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at, actor_id } = event;
    const p = payload as any;
    await tx.refunds.upsert({
        where: { id: p.refund_id },
        create: {
            id: p.refund_id,
            tenant_id,
            order_id: p.order_id,
            check_id: p.check_id,
            invoice_id: p.invoice_id ?? null,
            type: p.type,
            status: "ISSUED",
            reason_code: p.reason_code,
            reason_detail: p.reason_detail ?? null,
            requested_by: actor_id!,
            authorized_by: actor_id!,
            original_amount: p.original_amount,
            refund_amount: p.refund_amount,
            refund_method: p.refund_method,
            items: p.items ?? null,
            issued_at: new Date(occurred_at),
            authorized_at: new Date(occurred_at),
        },
        update: {},
    });
    return true;
};
