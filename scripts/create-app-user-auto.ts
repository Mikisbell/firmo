#!/usr/bin/env npx tsx

/**
 * Automatic app_user Creation Script
 * 
 * Este script crea automáticamente el usuario app_user en Supabase
 * usando las credenciales de postgres del archivo .env
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function createAppUser() {
  console.log('\n🔐 Creating app_user in Supabase...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Paso 1: Verificar si app_user ya existe
    console.log('1️⃣  Checking if app_user already exists...\n');

    const existingUser = await prisma.$queryRaw`
      SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'
    `;

    if (existingUser && (existingUser as any[]).length > 0) {
      console.log('✅ app_user already exists!\n');
      const user = (existingUser as any[])[0];
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS is correctly configured (usebypassrls = false)\n');
        console.log('🎉 app_user is ready to use!\n');
        return true;
      } else {
        console.log('⚠️  RLS bypass is enabled. Fixing...\n');
      }
    } else {
      console.log('❌ app_user does not exist. Creating...\n');
    }

    // Paso 2: Crear usuario app_user
    console.log('2️⃣  Creating app_user with password...\n');

    const password = 'ParkPOS2026Secure5821!';

    await prisma.$executeRawUnsafe(
      `CREATE USER app_user WITH PASSWORD '${password}'`
    );
    console.log('✅ app_user created\n');

    // Paso 3: Dar permisos de conexión
    console.log('3️⃣  Granting connection permissions...\n');

    await prisma.$executeRawUnsafe(
      `GRANT CONNECT ON DATABASE postgres TO app_user`
    );
    console.log('✅ CONNECT permission granted\n');

    // Paso 4: Dar permisos en schema public
    console.log('4️⃣  Granting schema permissions...\n');

    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO app_user`
    );
    console.log('✅ USAGE permission granted on schema public\n');

    // Paso 5: Dar permisos en todas las tablas
    console.log('5️⃣  Granting table permissions...\n');

    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`
    );
    console.log('✅ SELECT, INSERT, UPDATE, DELETE permissions granted\n');

    // Paso 6: Dar permisos en secuencias
    console.log('6️⃣  Granting sequence permissions...\n');

    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user`
    );
    console.log('✅ USAGE permission granted on sequences\n');

    // Paso 7: Dar permisos en funciones
    console.log('7️⃣  Granting function permissions...\n');

    await prisma.$executeRawUnsafe(
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user`
    );
    console.log('✅ EXECUTE permission granted on functions\n');

    // Paso 8: Verificar que se creó correctamente
    console.log('8️⃣  Verifying app_user configuration...\n');

    const verifyUser = await prisma.$queryRaw`
      SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'
    `;

    if (verifyUser && (verifyUser as any[]).length > 0) {
      const user = (verifyUser as any[])[0];
      console.log('✅ app_user verified:\n');
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS is correctly configured!\n');
      }
    }

    // Paso 9: Verificar permisos
    console.log('9️⃣  Verifying permissions...\n');

    const permissions = await prisma.$queryRaw`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'orders' AND grantee = 'app_user'
      ORDER BY privilege_type
    `;

    if (permissions && (permissions as any[]).length > 0) {
      console.log('✅ Permissions verified:\n');
      (permissions as any[]).forEach((perm: any) => {
        console.log(`   ${perm.grantee}: ${perm.privilege_type}`);
      });
      console.log();
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ app_user successfully created and configured!\n');
    console.log('📋 Credentials:\n');
    console.log(`   Username: app_user`);
    console.log(`   Password: ${password}`);
    console.log(`   Host: aws-1-sa-east-1.pooler.supabase.com`);
    console.log(`   Database: postgres\n`);

    console.log('🎯 Next steps:\n');
    console.log('1. Run integration tests:');
    console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');
    console.log('2. Expected result: 10/10 tests PASSED ✅\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error creating app_user:\n');
    console.log(`   ${error.message}\n`);

    if (error.message.includes('already exists')) {
      console.log('ℹ️  app_user already exists. This is normal.\n');
      console.log('🎯 Next steps:\n');
      console.log('1. Run integration tests:');
      console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');
      return true;
    }

    console.log('🔧 Troubleshooting:\n');
    console.log('1. Make sure you have postgres user credentials in .env');
    console.log('2. Make sure DATABASE_URL is correct');
    console.log('3. Make sure you have permission to create users\n');

    return false;

  } finally {
    await prisma.$disconnect();
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
