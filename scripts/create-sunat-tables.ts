import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function createTables() {
    const client = await pool.connect();
    try {
        console.log("Creating sunat_contingency...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS "public"."sunat_contingency" (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "tenant_id" UUID NOT NULL,
                "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "status" TEXT NOT NULL,
                "resolved_at" TIMESTAMPTZ(6),
                "reason" TEXT,
                CONSTRAINT "sunat_contingency_pkey" PRIMARY KEY ("id")
            );
        `);
        
        console.log("Creating sunat_contingency_invoices...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS "public"."sunat_contingency_invoices" (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "contingency_id" UUID NOT NULL,
                "invoice_id" UUID NOT NULL,
                "status" TEXT NOT NULL,
                "synced_at" TIMESTAMPTZ(6),
                CONSTRAINT "sunat_contingency_invoices_pkey" PRIMARY KEY ("id")
            );
        `);

        console.log("Created remaining tables successfully!");
    } catch (e) {
        console.error("Error creating tables:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

createTables();
