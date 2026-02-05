#!/usr/bin/env npx tsx

/**
 * Recreate app_user from scratch
 */

import { Client } from 'pg';

async function recreate() {
  console.log('\n🔐 Recreating app_user from scratch...\n');
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
    console.log('1️⃣  Connecting to Supabase...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Paso 1: Eliminar app_user si existe
    console.log('2️⃣  Dropping app_user if exists...\n');
    try {
      await client.query(`DROP USER IF EXISTS app_user`);
      console.log('✅ Dropped (or did not exist)\n');
    } catch (error: any) {
      console.log(`⚠️  ${error.message}\n`);
    }

    // Paso 2: Crear app_user
    console.log('3️⃣  Creating app_user...\n');
    const password = 'ParkPOS2026Secure5821!';
    
    try {
      await client.query(
        `CREATE USER app_user WITH PASSWORD '${password}'`
      );
      console.log(`✅ Created with password: ${password}\n`);
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}\n`);
      return false;
    }

    // Paso 3: Dar permisos
    console.log('4️⃣  Granting permissions...\n');

    const permissions = [
      `GRANT CONNECT ON DATABASE postgres TO app_user`,
      `GRANT USAGE ON SCHEMA public TO app_user`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`,
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user`,
    ];

    for (const permission of permissions) {
      try {
        await client.query(permission);
        console.log(`✅ ${permission.substring(0, 50)}...`);
      } catch (error: any) {
        console.log(`⚠️  ${permission.substring(0, 50)}... (${error.message.substring(0, 30)})`);
      }
    }

    console.log();

    // Paso 4: Verificar
    console.log('5️⃣  Verifying app_user...\n');

    const verify = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (verify.rows.length > 0) {
      const user = verify.rows[0];
      console.log(`✅ app_user verified:`);
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);
    } else {
      console.log('❌ app_user not found after creation!\n');
      return false;
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ app_user recreated successfully!\n');
    console.log('📋 Credentials:\n');
    console.log(`   Username: app_user`);
    console.log(`   Password: ${password}`);
    console.log(`   Host: ${host}\n`);

    return true;

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;

  } finally {
    await client.end();
  }
}

recreate()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
