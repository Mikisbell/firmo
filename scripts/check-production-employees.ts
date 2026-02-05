/**
 * Script para verificar empleados en producción
 * Uso: npx tsx scripts/check-production-employees.ts
 */

import { PrismaClient } from '@prisma/client';
import { hashPin } from '../src/core/auth/pin';

const prisma = new PrismaClient();

async function checkEmployees() {
  console.log('👥 Verificando empleados en producción...\n');

  try {
    // Contar empleados
    const totalEmployees = await prisma.employees.count();
    console.log(`📊 Total de empleados: ${totalEmployees}\n`);

    if (totalEmployees === 0) {
      console.log('❌ No hay empleados en la base de datos');
      console.log('💡 Necesitas ejecutar el seed script\n');
      return;
    }

    // Listar empleados activos
    const employees = await prisma.employees.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        role: true,
        pin_hash: true,
        tenant_id: true
      },
      take: 10
    });

    console.log('👤 Empleados activos:');
    console.log('─'.repeat(80));
    
    for (const emp of employees) {
      console.log(`\nNombre: ${emp.name}`);
      console.log(`Rol: ${emp.role}`);
      console.log(`ID: ${emp.id}`);
      console.log(`Tenant: ${emp.tenant_id}`);
      console.log(`PIN Hash: ${emp.pin_hash.substring(0, 20)}...`);
    }

    console.log('\n' + '─'.repeat(80));

    // Verificar si PIN 1234 existe
    const pin1234Hash = hashPin('1234');
    const employeeWith1234 = await prisma.employees.findFirst({
      where: {
        pin_hash: pin1234Hash,
        is_active: true
      }
    });

    if (employeeWith1234) {
      console.log('\n✅ Encontrado empleado con PIN 1234:');
      console.log(`   Nombre: ${employeeWith1234.name}`);
      console.log(`   Rol: ${employeeWith1234.role}`);
    } else {
      console.log('\n❌ NO hay ningún empleado con PIN 1234');
      console.log('💡 Necesitas crear un empleado o ejecutar el seed');
    }

  } catch (error) {
    console.error('❌ Error verificando empleados:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkEmployees()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verificación falló:', error);
    process.exit(1);
  });
