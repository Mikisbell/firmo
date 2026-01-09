import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';
const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

async function main() {
  console.log('🔍 Testing Auth Configuration\n');
  
  // Test 1: Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return;
  }

  // Test 2: Check employees table
  try {
    const employeeCount = await prisma.employees.count();
    console.log(`✅ Employees table exists (${employeeCount} employees)`);
  } catch (error) {
    console.error('❌ Employees table error:', error);
    return;
  }

  // Test 3: List active employees
  try {
    const employees = await prisma.employees.findMany({
      where: { 
        tenant_id: DEFAULT_TENANT_ID,
        is_active: true 
      },
      select: {
        id: true,
        name: true,
        role: true,
        pin_hash: true,
      },
      take: 10,
    });

    console.log(`\n📋 Active Employees (${employees.length}):`);
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.role})`);
      console.log(`    ID: ${emp.id}`);
      console.log(`    PIN Hash: ${emp.pin_hash?.substring(0, 16)}...`);
    });
  } catch (error) {
    console.error('❌ Error listing employees:', error);
    return;
  }

  // Test 4: Test PIN hashing
  console.log('\n🔐 PIN Hash Tests:');
  const testPins = ['1234', '0000', '9999'];
  testPins.forEach(pin => {
    const hash = hashPin(pin);
    console.log(`  PIN ${pin}: ${hash.substring(0, 16)}...`);
  });

  // Test 5: Try to find employee with PIN 1234
  const pin1234Hash = hashPin('1234');
  try {
    const emp = await prisma.employees.findFirst({
      where: {
        tenant_id: DEFAULT_TENANT_ID,
        pin_hash: pin1234Hash,
        is_active: true,
      },
    });

    if (emp) {
      console.log(`\n✅ Found employee with PIN 1234: ${emp.name} (${emp.role})`);
    } else {
      console.log('\n⚠️  No employee found with PIN 1234');
    }
  } catch (error) {
    console.error('❌ Error finding employee:', error);
  }

  // Test 6: Check login_attempts table
  try {
    const attemptsCount = await prisma.login_attempts.count();
    console.log(`\n✅ login_attempts table exists (${attemptsCount} attempts)`);
  } catch (error) {
    console.error('❌ login_attempts table error:', error);
  }

  // Test 7: Check sessions table
  try {
    const sessionsCount = await prisma.sessions.count();
    console.log(`✅ sessions table exists (${sessionsCount} sessions)`);
  } catch (error) {
    console.error('❌ sessions table error:', error);
  }

  // Test 8: Check admin_access_logs table
  try {
    const logsCount = await prisma.admin_access_logs.count();
    console.log(`✅ admin_access_logs table exists (${logsCount} logs)`);
  } catch (error) {
    console.error('❌ admin_access_logs table error:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
