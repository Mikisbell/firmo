#!/usr/bin/env npx tsx

/**
 * Test Postgres Connection
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing postgres connection...\n');

  const postgresPassword = 'M1k1sB3ll.$';
  const postgresUser = 'postgres.ncwdmdjnelopikpgrhty';

  console.log(`User: ${postgresUser}`);
  console.log(`Password: ${postgresPassword}\n`);

  const client = new Client({
    user: postgresUser,
    password: postgresPassword,
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected with postgres!\n');

    // Verificar app_user
    const result = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (result.rows.length > 0) {
      console.log('✅ app_user exists:\n');
      console.log(`   Username: ${result.rows[0].usename}`);
      console.log(`   RLS Bypass: ${result.rows[0].usebypassrls}\n`);
    } else {
      console.log('❌ app_user does not exist\n');
    }

    await client.end();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

test().catch(console.error);
