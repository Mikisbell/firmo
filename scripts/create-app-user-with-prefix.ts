#!/usr/bin/env npx tsx

/**
 * Create app_user with project prefix
 * 
 * Supabase requiere que los usuarios tengan el prefijo del proyecto
 */

import { Client } from 'pg';

async function create() {
  console.log('\n🔐 Creating app_user with project prefix...\n');
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

    // Paso 1: Verificar si app_user existe
    console.log('2️⃣  Checking if app_user exists...\n');
    const check = await client.query(
      `SELECT usename FROM pg_user WHERE usename = 'app_user'`
    );

    if (check.rows.length > 0) {
      console.log('✅ app_user already exists\n');
    } else {
      console.log('❌ app_user does not exist\n');
    }

    // Paso 2: Crear app_user si no existe
    if (check.rows.length === 0) {
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
    }

    // Paso 3: Dar permisos
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
        console.log(`✅ ${permission.substring(0, 50)}...`);
      } catch (error: any) {
        console.log(`⚠️  ${permission.substring(0, 50)}...`);
      }
    }

    console.log();

    // Paso 4: Probar conexión como app_user
    console.log('5️⃣  Testing app_user connection...\n');

    const appUserClient = new Client({
      user: 'app_user',
      password: 'ParkPOS2026Secure5821!',
      host: host,
      port: port,
      database: database,
    });

    try {
      await appUserClient.connect();
      console.log('✅ app_user can connect!\n');
      
      const result = await appUserClient.query('SELECT current_user, current_database()');
      console.log(`   Current user: ${result.rows[0].current_user}`);
      console.log(`   Current database: ${result.rows[0].current_database}\n`);
      
      await appUserClient.end();
    } catch (error: any) {
      console.log(`❌ app_user cannot connect: ${error.message}\n`);
      console.log('⚠️  This might be a Supabase authentication issue\n');
    }

    console.log('════════════════════════════════════════════════════════════\n');

    return true;

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;

  } finally {
    await client.end();
  }
}

create()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
