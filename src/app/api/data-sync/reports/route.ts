import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/core/db/prisma";
import { requirePosAuth } from "@/src/core/middleware";

export async function GET(req: NextRequest) {
    try {
        const authResult = await requirePosAuth(req);
        if (!authResult.authorized) {
            return authResult.response;
        }

        const tenant_id = authResult.user.tenantId;
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');

        let targetDate = new Date();
        if (dateParam) {
            targetDate = new Date(dateParam);
        }

        // Start and end of the day in local time
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch today's fully-paid orders from Prisma (server DB)
        // Note: order_status tracks OPEN/CANCELLED. Paid orders are detected via unpaid_checks_count = 0
        const orders = await prisma.orders.findMany({
            where: {
                tenant_id,
                unpaid_checks_count: 0,
                total_cents: { gt: 0 },
                created_at: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            select: {
                id: true,
                order_number: true,
                order_type: true,
                total_cents: true,
                created_at: true,
                fulfillment: true,
                tables: {
                    select: { number: true }
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });

        // Calculate summaries
        const totalSales = orders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
        const totalOrders = orders.length;

        // Group by order_type
        const byType = orders.reduce((acc, order) => {
            acc[order.order_type] = (acc[order.order_type] || 0) + (order.total_cents ?? 0);
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            success: true,
            summary: {
                total_sales_cents: totalSales,
                total_orders: totalOrders,
                by_type: byType
            },
            recent_orders: orders.slice(0, 50).map(o => {
                const fulfillment = o.fulfillment as Record<string, unknown> | null;
                const tableNumber = (o.tables?.number) ?? (fulfillment?.table_number as string | undefined) ?? null;
                return {
                    id: o.id,
                    order_number: o.order_number,
                    order_type: o.order_type,
                    total_cents: o.total_cents,
                    created_at: o.created_at,
                    table_number: tableNumber,
                };
            })
        });
    } catch (error) {
        console.error("Error fetching reports:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
