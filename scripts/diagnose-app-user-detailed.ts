#!/usr/bin/env npx tsx

/**
 * Detailed app_user Diagnosis
 */

import { Client } from 'pg';

async function diagnose() {
  console.log('\n🔍 Detailed app_user Diagnosis...\n');
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
    console.log('1️⃣  Connecting with postgres credentials...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Listar todos los usuarios
    console.log('2️⃣  Listing all users:\n');
    const users = await client.query(`
      SELECT usename, usesuper, usecreatedb, usebypassrls 
      FROM pg_user 
      ORDER BY usename
    `);

    users.rows.forEach((user: any) => {
      const flags = [
        user.usesuper ? 'SUPER' : '',
        user.usecreatedb ? 'CREATEDB' : '',
        user.usebypassrls ? 'BYPASSRLS' : '',
      ].filter(Boolean).join(', ');

      console.log(`   ${user.usename.padEnd(30)} [${flags}]`);
    });

    console.log();

    // Verificar app_user específicamente
    console.log('3️⃣  Checking app_user details:\n');
    const appUser = await client.query(`
      SELECT 
        usename,
        usesuper,
        usecreatedb,
        usebypassrls
      FROM pg_user 
      WHERE usename = 'app_user'
    `);

    if (appUser.rows.length > 0) {
      const user = appUser.rows[0];
      console.log(`   Username: ${user.usename}`);
      console.log(`   Super User: ${user.usesuper}`);
      console.log(`   Create DB: ${user.usecreatedb}`);
      console.log(`   Bypass RLS: ${user.usebypassrls}\n`);
    } else {
      console.log('   ❌ app_user not found!\n');
    }

    // Verificar permisos en tablas
    console.log('4️⃣  Checking app_user permissions:\n');
    const perms = await client.query(`
      SELECT 
        table_name,
        privilege_type
      FROM information_schema.role_table_grants 
      WHERE grantee = 'app_user'
      ORDER BY table_name, privilege_type
    `);

    if (perms.rows.length > 0) {
      const tablePerms: { [key: string]: string[] } = {};
      perms.rows.forEach((perm: any) => {
        if (!tablePerms[perm.table_name]) {
          tablePerms[perm.table_name] = [];
        }
        tablePerms[perm.table_name].push(perm.privilege_type);
      });

      Object.entries(tablePerms).forEach(([table, privs]) => {
        console.log(`   ${table}: ${privs.join(', ')}`);
      });
      console.log();
    } else {
      console.log('   ⚠️  No table permissions found\n');
    }

    // Verificar permisos en schemas
    console.log('5️⃣  Checking app_user schema permissions:\n');
    const schemaPerms = await client.query(`
      SELECT 
        schema_name,
        privilege_type
      FROM information_schema.role_schema_grants 
      WHERE grantee = 'app_user'
      ORDER BY schema_name, privilege_type
    `);

    if (schemaPerms.rows.length > 0) {
      schemaPerms.rows.forEach((perm: any) => {
        console.log(`   ${perm.schema_name}: ${perm.privilege_type}`);
      });
      console.log();
    } else {
      console.log('   ⚠️  No schema permissions found\n');
    }

    // Verificar permisos en database
    console.log('6️⃣  Checking app_user database permissions:\n');
    const dbPerms = await client.query(`
      SELECT 
        datname,
        datacl
      FROM pg_database 
      WHERE datname = 'postgres'
    `);

    if (dbPerms.rows.length > 0) {
      const acl = dbPerms.rows[0].datacl;
      console.log(`   Database ACL: ${acl}\n`);
    }

    // Intentar conectar como app_user (desde postgres)
    console.log('7️⃣  Testing app_user login capability:\n');
    try {
      const appUserClient = new Client({
        user: 'app_user',
        password: 'ParkPOS2026Secure5821!',
        host: host,
        port: port,
        database: database,
      });

      await appUserClient.connect();
      console.log('✅ app_user can connect!\n');
      await appUserClient.end();
    } catch (error: any) {
      console.log(`❌ app_user cannot connect: ${error.message}\n`);
    }

    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  } finally {
    await client.end();
  }
}

diagnose().catch(console.error);
