#!/usr/bin/env npx tsx

/**
 * Test Supabase Direct Connection
 * 
 * Intenta conectar directamente a Supabase sin pooler
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing Supabase direct connection...\n');

  // Intentar con postgres
  console.log('Testing postgres with direct connection...\n');
  
  const client = new Client({
    user: 'postgres.ncwdmdjnelopikpgrhty',
    password: 'M1k1sB3ll.$',
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
    console.log(`✅ Query successful:`);
    console.log(`   Current user: ${result.rows[0].current_user}`);
    console.log(`   Current database: ${result.rows[0].current_database}\n`);
    
    await client.end();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

test().catch(console.error);
