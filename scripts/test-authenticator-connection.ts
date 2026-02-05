#!/usr/bin/env npx tsx

/**
 * Test Authenticator Connection
 * 
 * Supabase uses 'authenticator' user for authentication
 */

import { Client } from 'pg';

async function test() {
  console.log('\n🔐 Testing authenticator connection...\n');

  // Intentar con diferentes usuarios
  const users = [
    { user: 'authenticator', password: 'ParkPOS2026Secure5821!' },
    { user: 'app_user', password: 'ParkPOS2026Secure5821!' },
    { user: 'postgres', password: 'M1k1sB3ll.$' },
  ];

  for (const creds of users) {
    console.log(`Testing ${creds.user}...`);
    
    const client = new Client({
      user: creds.user,
      password: creds.password,
      host: 'aws-1-sa-east-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
    });

    try {
      await client.connect();
      console.log(`✅ ${creds.user} connected!\n`);
      await client.end();
    } catch (error: any) {
      console.log(`❌ ${creds.user} failed: ${error.message}\n`);
    }
  }
}

test().catch(console.error);
