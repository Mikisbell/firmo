#!/usr/bin/env npx tsx

/**
 * Verify and Reset app_user Password
 * 
 * Este script verifica que app_user existe y resetea su contraseña
 */

import { Client } from 'pg';

async function verifyAndReset() {
  console.log('\n🔐 Verifying and resetting app_user password...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Credenciales de postgres
  const postgresPassword = 'M1k1sB3ll.$';
  const postgresUser = 'postgres.ncwdmdjnelopikpgrhty';
  const host = 'aws-1-sa-east-1.pooler.supabase.com';
  const port = 5432;
  const database = 'postgres';

  const client = new Client({
    user: postgresUser,
    password: postgresPassword,
    host: host,
    port: port,
    database: database,
  });

  try {
    console.log('1️⃣  Connecting to Supabase with postgres credentials...\n');
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Verificar que app_user existe
    console.log('2️⃣  Checking app_user status...\n');

    const userCheck = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (userCheck.rows.length === 0) {
      console.log('❌ app_user does not exist!\n');
      return false;
    }

    const user = userCheck.rows[0];
    console.log(`✅ app_user exists`);
    console.log(`   Username: ${user.usename}`);
    console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

    // Resetear contraseña
    console.log('3️⃣  Resetting app_user password...\n');

    const newPassword = 'ParkPOS2026Secure5821!';

    try {
      await client.query(
        `ALTER USER app_user WITH PASSWORD '${newPassword}'`
      );
      console.log(`✅ Password reset to: ${newPassword}\n`);
    } catch (error: any) {
      console.log(`❌ Failed to reset password: ${error.message}\n`);
      return false;
    }

    // Verificar permisos
    console.log('4️⃣  Verifying permissions...\n');

    const permissionsCheck = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'orders' AND grantee = 'app_user'
      LIMIT 5
    `);

    if (permissionsCheck.rows.length > 0) {
      console.log(`✅ app_user has ${permissionsCheck.rows.length} permissions on orders table\n`);
    } else {
      console.log('⚠️  No permissions found on orders table\n');
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ app_user password reset successfully!\n');
    console.log('📋 Credentials:\n');
    console.log(`   Username: app_user`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${database}\n`);

    console.log('🎯 Next steps:\n');
    console.log('1. Update .env.local and .env with new password');
    console.log('2. Run integration tests:');
    console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error:\n');
    console.log(`   ${error.message}\n`);
    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
verifyAndReset()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
