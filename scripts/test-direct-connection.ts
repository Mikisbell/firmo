#!/usr/bin/env npx tsx

/**
 * Test Direct Connection (Port 5432)
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing direct connection to port 5432...\n');

  const password = 'ParkPOS2026Secure5821!';

  console.log(`Password: ${password}\n`);

  const client = new Client({
    user: 'app_user',
    password: password,
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
  });

  try {
    console.log('Connecting...\n');
    await client.connect();
    console.log('✅ Connected!\n');

    // Test query
    const result = await client.query('SELECT current_user, current_database()');
    console.log('✅ Query successful:\n');
    console.log(`   Current user: ${result.rows[0].current_user}`);
    console.log(`   Current database: ${result.rows[0].current_database}\n`);

    await client.end();
    return true;

  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
    return false;
  }
}

test().catch(console.error);
