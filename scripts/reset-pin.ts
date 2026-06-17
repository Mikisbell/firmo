import { Client } from 'pg';
import { createHash } from 'crypto';

const SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
    return createHash("sha256").update(SALT + pin).digest("hex");
}

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20' });
  await client.connect();
  const hash = hashPin('1111');
  const res = await client.query(`UPDATE "employees" SET pin_hash = $1 WHERE role = 'CASHIER'`, [hash]);
  console.log(`Updated PIN for ${res.rowCount} CASHIER(s) to 1111`);
  await client.end();
}
main().catch(console.error);
