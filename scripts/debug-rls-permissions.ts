/**
 * Debug: Verificar permisos de RLS
 */

import prisma from '@/src/core/db/prisma';

async function debugRLSPermissions() {
  try {
    console.log('🔍 Debuggeando permisos de RLS\n');

    // 1. Verificar usuario actual
    console.log('1️⃣  Usuario actual:');
    const currentUser = await prisma.$queryRaw`SELECT current_user;`;
    console.log('   ', currentUser);

    // 2. Verificar si el usuario es superuser
    console.log('\n2️⃣  ¿Es superuser?');
    const isSuperuser = await prisma.$queryRaw`
      SELECT usesuper FROM pg_user WHERE usename = current_user;
    `;
    console.log('   ', isSuperuser);

    // 3. Verificar si RLS está habilitado en la tabla
    console.log('\n3️⃣  RLS habilitado en tabla orders:');
    const rlsEnabled = await prisma.$queryRaw`
      SELECT tablename, rowsecurity FROM pg_tables 
      WHERE tablename = 'orders' AND schemaname = 'public';
    `;
    console.log('   ', rlsEnabled);

    // 4. Verificar políticas RLS
    console.log('\n4️⃣  Políticas RLS en tabla orders:');
    const policies = await prisma.$queryRaw`
      SELECT policyname, qual, with_check FROM pg_policies 
      WHERE tablename = 'orders';
    `;
    console.log('   ', policies);

    // 5. Intentar hacer una query con RLS
    console.log('\n5️⃣  Intentando query con RLS:');
    
    // Establecer contexto
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000000001'::text, false)
    `;

    // Hacer query
    const orders = await prisma.$queryRaw`
      SELECT id, tenant_id FROM orders LIMIT 5;
    `;
    console.log(`   Órdenes encontradas: ${orders.length}`);
    if (orders.length > 0) {
      console.log('   Primeras órdenes:', orders);
    }

    // 6. Verificar si el usuario tiene permisos en la tabla
    console.log('\n6️⃣  Permisos del usuario en tabla orders:');
    const permissions = await prisma.$queryRaw`
      SELECT grantee, privilege_type FROM information_schema.role_table_grants 
      WHERE table_name = 'orders';
    `;
    console.log('   ', permissions);

    // 7. Verificar si hay un bypass de RLS
    console.log('\n7️⃣  Verificar bypass de RLS:');
    const bypassRLS = await prisma.$queryRaw`
      SELECT usebypassrls FROM pg_user WHERE usename = current_user;
    `;
    console.log('   ', bypassRLS);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRLSPermissions();
