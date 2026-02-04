/**
 * Debug: Verificar si el contexto de tenant se propaga correctamente
 */

import prisma from '@/src/core/db/prisma';

async function debugRLS() {
  try {
    console.log('🔍 Debuggeando propagación de contexto RLS\n');

    // 1. Verificar que set_config funciona
    console.log('1️⃣  Probando set_config en transacción...');
    const result1 = await prisma.$transaction(async (tx) => {
      const setResult = await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', 'test-tenant-123'::text, false) as result
      `;
      console.log('   set_config result:', setResult);

      const getResult = await tx.$queryRaw`
        SELECT current_setting('app.current_tenant_id') as tenant_id
      `;
      console.log('   current_setting result:', getResult);

      return getResult;
    });

    // 2. Verificar que el contexto se mantiene en la misma transacción
    console.log('\n2️⃣  Verificando que el contexto se mantiene...');
    const result2 = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', 'test-tenant-456'::text, false)
      `;

      // Hacer una query que debería usar RLS
      const orders = await tx.orders.findMany();
      console.log(`   Órdenes encontradas: ${orders.length}`);

      // Verificar el contexto
      const context = await tx.$queryRaw`
        SELECT current_setting('app.current_tenant_id') as tenant_id
      `;
      console.log('   Contexto actual:', context);

      return { orders, context };
    });

    // 3. Verificar que el contexto NO se mantiene entre transacciones
    console.log('\n3️⃣  Verificando que el contexto NO se mantiene entre transacciones...');
    
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', 'test-tenant-789'::text, false)
      `;
      console.log('   Contexto establecido en transacción 1');
    });

    const result3 = await prisma.$transaction(async (tx) => {
      const context = await tx.$queryRaw`
        SELECT current_setting('app.current_tenant_id') as tenant_id
      `;
      console.log('   Contexto en transacción 2:', context);
      return context;
    });

    // 4. Verificar si RLS está realmente funcionando
    console.log('\n4️⃣  Verificando si RLS está funcionando...');
    
    // Obtener un tenant_id real
    const tenants = await prisma.tenant_settings.findMany({ take: 1 });
    if (tenants.length === 0) {
      console.log('   ❌ No hay tenants en la base de datos');
      return;
    }

    const testTenantId = tenants[0].tenant_id;
    console.log(`   Usando tenant_id: ${testTenantId}`);

    // Contar órdenes sin contexto
    const ordersWithoutContext = await prisma.orders.findMany();
    console.log(`   Órdenes sin contexto: ${ordersWithoutContext.length}`);

    // Contar órdenes con contexto
    const ordersWithContext = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${testTenantId}::text, false)
      `;
      return tx.orders.findMany();
    });
    console.log(`   Órdenes con contexto: ${ordersWithContext.length}`);

    if (ordersWithoutContext.length === ordersWithContext.length) {
      console.log('   ⚠️  RLS NO está funcionando (mismo número de órdenes)');
    } else {
      console.log('   ✅ RLS está funcionando (diferente número de órdenes)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRLS();
