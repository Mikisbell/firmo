import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// ============================================================================
// Simple Sales API - Saves completed sales to database
// ============================================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// POST - Save a completed sale
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderNumber, items, payments, subtotal, total, completedAt } = body;

        // Insert sale record
        const result = await pool.query(`
            INSERT INTO sales (order_number, items, payments, subtotal_cents, total_cents, completed_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
        `, [
            orderNumber,
            JSON.stringify(items),
            JSON.stringify(payments),
            subtotal,
            total,
            completedAt
        ]);

        return NextResponse.json({
            success: true,
            saleId: result.rows[0]?.id
        });
    } catch (error: any) {
        console.error("[Sales API] Error:", error.message);

        // If table doesn't exist, create it
        if (error.code === "42P01") {
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sales (
                        id SERIAL PRIMARY KEY,
                        order_number INTEGER NOT NULL,
                        items JSONB NOT NULL DEFAULT '[]',
                        payments JSONB NOT NULL DEFAULT '[]',
                        subtotal_cents INTEGER NOT NULL DEFAULT 0,
                        total_cents INTEGER NOT NULL DEFAULT 0,
                        completed_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                `);
                console.log("[Sales API] Created sales table");

                // Retry the insert
                return POST(request);
            } catch (createError) {
                console.error("[Sales API] Failed to create table:", createError);
            }
        }

        return NextResponse.json(
            { success: false, error: "Failed to save sale" },
            { status: 500 }
        );
    }
}

// GET - List today's sales (for reports)
export async function GET(request: NextRequest) {
    try {
        const result = await pool.query(`
            SELECT * FROM sales 
            WHERE created_at >= CURRENT_DATE 
            ORDER BY created_at DESC
            LIMIT 100
        `);

        return NextResponse.json({
            success: true,
            sales: result.rows,
            count: result.rows.length
        });
    } catch (error: any) {
        console.error("[Sales API] GET Error:", error.message);
        return NextResponse.json(
            { success: true, sales: [], count: 0 },
            { status: 200 }
        );
    }
}
