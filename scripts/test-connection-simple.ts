#!/usr/bin/env npx tsx

/**
 * Simple Connection Test
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing app_user connection...\n');

  // Probar con la contraseña sin URL-encode
  const password = 'ParkPOS2026Secure5821!';
  const encodedPassword = 'ParkPOS2026Secure5821%21';

  console.log(`Plain password: ${password}`);
  console.log(`URL-encoded: ${encodedPassword}\n`);

  // Intento 1: Con URL-encode
  console.log('Attempt 1: With URL-encoded password\n');

  const client1 = new Client({
    user: 'app_user',
    password: encodedPassword,
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
  });

  try {
    await client1.connect();
    console.log('✅ Connected with URL-encoded password!\n');
    await client1.end();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }

  // Intento 2: Sin URL-encode
  console.log('Attempt 2: With plain password\n');

  const client2 = new Client({
    user: 'app_user',
    password: password,
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
  });

  try {
    await client2.connect();
    console.log('✅ Connected with plain password!\n');
    await client2.end();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

test().catch(console.error);
