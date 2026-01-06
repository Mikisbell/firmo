// Script to check Supabase database contents
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    console.log("=== PARK POS - Database Check ===\n");

    try {
        // Check all tables for row counts
        const tables = [
            { name: 'tenant_settings', query: () => prisma.tenantSettings.count() },
            { name: 'employees', query: () => prisma.employee.count() },
            { name: 'terminals', query: () => prisma.terminal.count() },
            { name: 'stations', query: () => prisma.station.count() },
            { name: 'products', query: () => prisma.product.count() },
            { name: 'orders', query: () => prisma.order.count() },
            { name: 'shifts', query: () => prisma.shift.count() },
            { name: 'invoices', query: () => prisma.invoice.count() },
            { name: 'events', query: () => prisma.event.count() },
            { name: 'customers', query: () => prisma.customer.count() },
            { name: 'promotions', query: () => prisma.promotion.count() },
        ];

        console.log("Table Counts:");
        console.log("-".repeat(40));

        for (const t of tables) {
            try {
                const count = await t.query();
                console.log(`${t.name.padEnd(20)} : ${count} rows`);
            } catch (e: any) {
                console.log(`${t.name.padEnd(20)} : ERROR - ${e.message?.slice(0, 50)}`);
            }
        }

        // Show sample data if exists
        console.log("\n=== Sample Data ===\n");

        const tenants = await prisma.tenantSettings.findMany({ take: 5 });
        if (tenants.length > 0) {
            console.log("Tenants:", JSON.stringify(tenants, null, 2));
        }

        const products = await prisma.product.findMany({ take: 5 });
        if (products.length > 0) {
            console.log("\nProducts (first 5):", JSON.stringify(products, null, 2));
        }

        const orders = await prisma.order.findMany({ take: 5, orderBy: { created_at: 'desc' } });
        if (orders.length > 0) {
            console.log("\nRecent Orders (first 5):", JSON.stringify(orders, null, 2));
        }

        const events = await prisma.event.findMany({ take: 5, orderBy: { occurred_at: 'desc' } });
        if (events.length > 0) {
            console.log("\nRecent Events (first 5):", JSON.stringify(events, null, 2));
        }

    } catch (error) {
        console.error("Database connection error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
