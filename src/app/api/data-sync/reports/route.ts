import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/core/db/schema";
import { requirePosAuth } from "@/src/core/auth/middleware";

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

        // Fetch today's paid orders
        const orders = await db.orders.findMany({
            where: {
                tenant_id,
                status: "PAID",
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
                updated_at: true,
                table_number: true,
            },
            orderBy: {
                created_at: "desc"
            }
        });

        // Calculate summaries
        const totalSales = orders.reduce((sum, order) => sum + order.total_cents, 0);
        const totalOrders = orders.length;

        // Group by order_type
        const byType = orders.reduce((acc, order) => {
            acc[order.order_type] = (acc[order.order_type] || 0) + order.total_cents;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            success: true,
            summary: {
                total_sales_cents: totalSales,
                total_orders: totalOrders,
                by_type: byType
            },
            recent_orders: orders.slice(0, 50) // Last 50 orders
        });
    } catch (error) {
        console.error("Error fetching reports:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
