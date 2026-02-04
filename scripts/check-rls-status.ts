/**
 * Verificar estado de RLS en Supabase
 */

import prisma from '@/src/core/db/prisma';

async function checkRLS() {
  try {
    console.log('🔍 Verificando estado de RLS...\n');

    // 1. Verificar si RLS está habilitado en las tablas
    const rlsStatus = await prisma.$queryRaw`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('orders', 'tenant_settings', 'employees', 'stations')
      ORDER BY tablename;
    `;

    console.log('📊 RLS Status por tabla:');
    console.log(rlsStatus);

    // 2. Verificar políticas RLS
    const policies = await prisma.$queryRaw`
      SELECT tablename, policyname, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('orders', 'tenant_settings', 'employees', 'stations')
      ORDER BY tablename, policyname;
    `;

    console.log('\n📋 Políticas RLS:');
    console.log(policies);

    // 3. Verificar si el contexto de tenant se propaga
    console.log('\n🧪 Probando set_config...');
    const testConfig = await prisma.$queryRaw`
      SELECT set_config('app.current_tenant_id', 'test-tenant-123'::text, false) as result;
    `;
    console.log('set_config result:', testConfig);

    // 4. Verificar si el contexto se mantiene
    const getConfig = await prisma.$queryRaw`
      SELECT current_setting('app.current_tenant_id') as tenant_id;
    `;
    console.log('current_setting result:', getConfig);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRLS();
