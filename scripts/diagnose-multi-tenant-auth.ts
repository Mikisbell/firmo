/**
 * Diagnóstico de Autenticación Multi-Tenant
 * Verifica que los empleados de los tenants de prueba existan y tengan PINs correctos
 */

import prisma from '../src/core/db/prisma';
import { createHash } from 'crypto';

const TENANT_1_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_2_ID = '22222222-2222-2222-2222-222222222222';
const PIN_SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
  return createHash('sha256').update(PIN_SALT + pin).digest('hex');
}

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO DE AUTENTICACIÓN MULTI-TENANT');
  console.log('============================================================\n');

  // Verificar Tenant 1
  console.log('📋 TENANT 1:', TENANT_1_ID);
  console.log('   PIN esperado: 1111');
  console.log('   PIN hash:', hashPin('1111'));
  
  const tenant1Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_1_ID },
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
    },
  });
  
  console.log(`   Empleados encontrados: ${tenant1Employees.length}`);
  tenant1Employees.forEach((emp, idx) => {
    const pinMatches = emp.pin_hash === hashPin('1111');
    console.log(`   ${idx + 1}. ${emp.name} (${emp.role})`);
    console.log(`      ID: ${emp.id}`);
    console.log(`      Active: ${emp.is_active}`);
    console.log(`      PIN hash: ${emp.pin_hash}`);
    console.log(`      PIN matches 1111: ${pinMatches ? '✅' : '❌'}`);
  });
  
  console.log('\n📋 TENANT 2:', TENANT_2_ID);
  console.log('   PIN esperado: 2222');
  console.log('   PIN hash:', hashPin('2222'));
  
  const tenant2Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_2_ID },
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
    },
  });
  
  console.log(`   Empleados encontrados: ${tenant2Employees.length}`);
  tenant2Employees.forEach((emp, idx) => {
    const pinMatches = emp.pin_hash === hashPin('2222');
    console.log(`   ${idx + 1}. ${emp.name} (${emp.role})`);
    console.log(`      ID: ${emp.id}`);
    console.log(`      Active: ${emp.is_active}`);
    console.log(`      PIN hash: ${emp.pin_hash}`);
    console.log(`      PIN matches 2222: ${pinMatches ? '✅' : '❌'}`);
  });
  
  // Verificar si hay empleados con roles permitidos
  console.log('\n🔐 VERIFICACIÓN DE ROLES PERMITIDOS');
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN'];
  
  const tenant1AdminEmployees = tenant1Employees.filter(emp => 
    allowedRoles.includes(emp.role) && emp.is_active
  );
  console.log(`   Tenant 1 - Empleados con roles permitidos: ${tenant1AdminEmployees.length}`);
  tenant1AdminEmployees.forEach(emp => {
    console.log(`      - ${emp.name} (${emp.role})`);
  });
  
  const tenant2AdminEmployees = tenant2Employees.filter(emp => 
    allowedRoles.includes(emp.role) && emp.is_active
  );
  console.log(`   Tenant 2 - Empleados con roles permitidos: ${tenant2AdminEmployees.length}`);
  tenant2AdminEmployees.forEach(emp => {
    console.log(`      - ${emp.name} (${emp.role})`);
  });
  
  // Simular autenticación
  console.log('\n🧪 SIMULACIÓN DE AUTENTICACIÓN');
  
  console.log('\n   Intento 1: Tenant 1, PIN 1111');
  const auth1 = await prisma.employees.findFirst({
    where: {
      tenant_id: TENANT_1_ID,
      pin_hash: hashPin('1111'),
      is_active: true,
      role: { in: allowedRoles },
    },
  });
  console.log(`   Resultado: ${auth1 ? '✅ ÉXITO' : '❌ FALLO'}`);
  if (auth1) {
    console.log(`   Empleado: ${auth1.name} (${auth1.role})`);
  }
  
  console.log('\n   Intento 2: Tenant 2, PIN 2222');
  const auth2 = await prisma.employees.findFirst({
    where: {
      tenant_id: TENANT_2_ID,
      pin_hash: hashPin('2222'),
      is_active: true,
      role: { in: allowedRoles },
    },
  });
  console.log(`   Resultado: ${auth2 ? '✅ ÉXITO' : '❌ FALLO'}`);
  if (auth2) {
    console.log(`   Empleado: ${auth2.name} (${auth2.role})`);
  }
  
  // Verificar variable de entorno
  console.log('\n🔧 VERIFICACIÓN DE CONFIGURACIÓN');
  console.log(`   PIN_SALT en .env: ${process.env.PIN_SALT}`);
  console.log(`   PIN_SALT esperado: ${PIN_SALT}`);
  console.log(`   Match: ${process.env.PIN_SALT === PIN_SALT ? '✅' : '❌'}`);
  
  console.log('\n============================================================');
  console.log('✅ Diagnóstico completado');
}

diagnose()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
