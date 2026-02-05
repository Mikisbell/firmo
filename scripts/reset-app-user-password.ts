#!/usr/bin/env npx tsx

/**
 * Reset app_user Password
 */

import { Client } from 'pg';

async function reset() {
  console.log('\n🔐 Resetting app_user password...\n');

  const postgresPassword = 'M1k1sB3ll.$';
  const postgresUser = 'postgres.ncwdmdjnelopikpgrhty';
  const newPassword = 'AppUser2026!';

  const client = new Client({
    user: postgresUser,
    password: postgresPassword,
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Reset password
    console.log(`Resetting password to: ${newPassword}\n`);

    await client.query(
      `ALTER USER app_user WITH PASSWORD '${newPassword}'`
    );

    console.log('✅ Password reset successfully!\n');

    // Verify
    const result = await client.query(
      `SELECT usename FROM pg_user WHERE usename = 'app_user'`
    );

    if (result.rows.length > 0) {
      console.log('✅ app_user verified\n');
      console.log(`📋 New credentials:\n`);
      console.log(`   Username: app_user`);
      console.log(`   Password: ${newPassword}`);
      console.log(`   Host: aws-1-sa-east-1.pooler.supabase.com`);
      console.log(`   Database: postgres\n`);

      // URL-encode the password
      const encoded = newPassword
        .replace(/!/g, '%21')
        .replace(/@/g, '%40')
        .replace(/#/g, '%23')
        .replace(/\$/g, '%24');

      console.log(`📋 URL-encoded password: ${encoded}\n`);

      console.log(`🎯 Update .env.local and .env with:\n`);
      console.log(`DATABASE_URL="postgresql://app_user:${encoded}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"`);
      console.log(`DIRECT_URL="postgresql://app_user:${encoded}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"\n`);
    }

    await client.end();
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

reset().catch(console.error);
