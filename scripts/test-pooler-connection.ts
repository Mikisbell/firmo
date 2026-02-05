#!/usr/bin/env npx tsx

/**
 * Test Pooler Connection (Port 6543)
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing pooler connection (port 6543)...\n');

  // Intentar con diferentes usuarios
  const users = [
    { user: 'postgres', password: 'M1k1sB3ll.$' },
    { user: 'app_user', password: 'ParkPOS2026Secure5821!' },
  ];

  for (const creds of users) {
    console.log(`Testing ${creds.user}...`);
    
    const client = new Client({
      user: creds.user,
      password: creds.password,
      host: 'aws-1-sa-east-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
    });

    try {
      await client.connect();
      console.log(`✅ ${creds.user} connected!\n`);
      
      // Test query
      const result = await client.query('SELECT current_user, current_database()');
      console.log(`   Current user: ${result.rows[0].current_user}`);
      console.log(`   Current database: ${result.rows[0].current_database}\n`);
      
      await client.end();
    } catch (error: any) {
      console.log(`❌ ${creds.user} failed: ${error.message}\n`);
    }
  }
}

test().catch(console.error);
