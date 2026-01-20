/**
 * Check Employees in Database
 * Lista los employees disponibles para testing
 */

import prisma from '../src/core/db/prisma';

async function checkEmployees() {
  console.log('🔍 Verificando employees en la base de datos...\n');

  try {
    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        pin_hash: true,
      },
      take: 10,
    });

    if (employees.length === 0) {
      console.log('❌ No hay employees en la base de datos');
      console.log('');
      console.log('💡 Ejecuta el seed para crear datos de prueba:');
      console.log('   npx tsx prisma/seed.ts');
      return;
    }

    console.log(`✅ Encontrados ${employees.length} employees:\n`);
    
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.name}`);
      console.log(`   - ID: ${emp.id}`);
      console.log(`   - Role: ${emp.role}`);
      console.log(`   - PIN Hash: ${emp.pin_hash ? 'Configurado' : 'No configurado'}`);
      console.log('');
    });

    console.log('📝 Nota: Los PINs están hasheados en la BD.');
    console.log('   Para testing, usa el PIN que configuraste en el seed.');
    console.log('   Por defecto, el seed usa PIN "1234" para el owner.');

  } catch (error) {
    console.error('❌ Error al verificar employees:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmployees();
