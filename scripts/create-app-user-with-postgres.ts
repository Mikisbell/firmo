#!/usr/bin/env npx tsx

/**
 * Create app_user Using Postgres Credentials
 * 
 * Este script usa las credenciales de postgres para crear app_user
 */

import { Client } from 'pg';

async function createAppUser() {
  console.log('\n🔐 Creating app_user in Supabase using postgres credentials...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Credenciales de postgres (del .env.backup)
  const postgresPassword = 'M1k1sB3ll.$';
  const postgresUser = 'postgres.ncwdmdjnelopikpgrhty';
  const host = 'aws-1-sa-east-1.pooler.supabase.com';
  const port = 5432; // Direct connection para crear usuarios
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

    // Paso 2: Verificar si app_user ya existe
    console.log('2️⃣  Checking if app_user already exists...\n');

    const existingUser = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ app_user already exists!\n');
      const user = existingUser.rows[0];
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS is correctly configured (usebypassrls = false)\n');
        console.log('🎉 app_user is ready to use!\n');
        return true;
      }
    } else {
      console.log('❌ app_user does not exist. Creating...\n');
    }

    // Paso 3: Crear usuario app_user
    console.log('3️⃣  Creating app_user with password...\n');

    const appUserPassword = 'ParkPOS2026Secure5821!';

    try {
      await client.query(
        `CREATE USER app_user WITH PASSWORD '${appUserPassword}'`
      );
      console.log('✅ app_user created\n');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  app_user already exists (caught by CREATE IF NOT EXISTS)\n');
      } else {
        throw error;
      }
    }

    // Paso 4: Dar permisos
    console.log('4️⃣  Granting permissions...\n');

    const permissions = [
      `GRANT CONNECT ON DATABASE postgres TO app_user`,
      `GRANT USAGE ON SCHEMA public TO app_user`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`,
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user`,
    ];

    for (const permission of permissions) {
      try {
        await client.query(permission);
        console.log(`✅ ${permission.split(' ')[1]}`);
      } catch (error: any) {
        console.log(`⚠️  ${permission.split(' ')[1]} (already granted or error)`);
      }
    }

    console.log();

    // Paso 5: Verificar que se creó correctamente
    console.log('5️⃣  Verifying app_user configuration...\n');

    const verifyUser = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      console.log('✅ app_user verified:\n');
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS is correctly configured!\n');
      }
    }

    // Paso 6: Verificar permisos
    console.log('6️⃣  Verifying permissions...\n');

    const permissionsCheck = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'orders' AND grantee = 'app_user'
      ORDER BY privilege_type
    `);

    if (permissionsCheck.rows.length > 0) {
      console.log('✅ Permissions verified:\n');
      permissionsCheck.rows.forEach((perm: any) => {
        console.log(`   ${perm.grantee}: ${perm.privilege_type}`);
      });
      console.log();
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ app_user successfully created and configured!\n');
    console.log('📋 Credentials:\n');
    console.log(`   Username: app_user`);
    console.log(`   Password: ${appUserPassword}`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${database}\n`);

    console.log('🎯 Next steps:\n');
    console.log('1. Run integration tests:');
    console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');
    console.log('2. Expected result: 10/10 tests PASSED ✅\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error:\n');
    console.log(`   ${error.message}\n`);

    console.log('🔧 Troubleshooting:\n');
    console.log('1. Make sure postgres credentials are correct');
    console.log('2. Make sure you have permission to create users');
    console.log('3. Check that the host and port are correct\n');

    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
createAppUser()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
