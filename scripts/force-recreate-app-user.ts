#!/usr/bin/env npx tsx

/**
 * Force Recreate app_user - Remove dependencies first
 */

import { Client } from 'pg';

async function forceRecreate() {
  console.log('\n🔐 Force recreating app_user...\n');
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

    // Paso 1: Reasignar objetos a postgres
    console.log('2️⃣  Reassigning objects to postgres...\n');
    try {
      await client.query(`REASSIGN OWNED BY app_user TO postgres`);
      console.log('✅ Objects reassigned\n');
    } catch (error: any) {
      console.log(`⚠️  ${error.message}\n`);
    }

    // Paso 2: Eliminar permisos
    console.log('3️⃣  Dropping owned objects...\n');
    try {
      await client.query(`DROP OWNED BY app_user`);
      console.log('✅ Objects dropped\n');
    } catch (error: any) {
      console.log(`⚠️  ${error.message}\n`);
    }

    // Paso 3: Eliminar usuario
    console.log('4️⃣  Dropping app_user...\n');
    try {
      await client.query(`DROP USER app_user`);
      console.log('✅ User dropped\n');
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}\n`);
      return false;
    }

    // Paso 4: Crear app_user nuevamente
    console.log('5️⃣  Creating app_user...\n');
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

    // Paso 5: Dar permisos
    console.log('6️⃣  Granting permissions...\n');

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
        console.log(`✅ ${permission.substring(0, 50)}...`);
      } catch (error: any) {
        console.log(`⚠️  ${permission.substring(0, 50)}...`);
      }
    }

    console.log();

    // Paso 6: Verificar
    console.log('7️⃣  Verifying app_user...\n');

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

forceRecreate()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
