import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('tables', 'products')`);
        console.log("Indexes in DB:", res.rows);
    } catch (e) {
        console.error("Error checking indexes:", e);
    } finally {
        client.release();
        await pool.end();
    }
}
check();
