import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function createTables() {
    const client = await pool.connect();
    try {
        console.log("Creating order_tables...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS "public"."order_tables" (
                "order_id" UUID NOT NULL,
                "table_id" UUID NOT NULL,
                "is_primary" BOOLEAN NOT NULL DEFAULT false,
                "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "order_tables_pkey" PRIMARY KEY ("order_id", "table_id")
            );
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS "order_tables_table_id_idx" ON "public"."order_tables"("table_id");
        `);
        // Foreign keys might be complex, let's add them
        await client.query(`
            ALTER TABLE "public"."order_tables" ADD CONSTRAINT "order_tables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        `).catch(e => console.log("Constraint order_id might exist", e.message));
        
        await client.query(`
            ALTER TABLE "public"."order_tables" ADD CONSTRAINT "order_tables_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        `).catch(e => console.log("Constraint table_id might exist", e.message));

        console.log("Created order_tables successfully!");
    } catch (e) {
        console.error("Error creating tables:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

createTables();
