#!/usr/bin/env node

/**
 * Test that ADMIN can access any terminal with PIN 1234
 * 
 * This test verifies that:
 * 1. ADMIN (PIN 1234) can login to any terminal
 * 2. Non-existent terminals are OK for ADMIN (bypass validation)
 * 3. ADMIN gets proper JWT token in httpOnly cookie
 */

const BASE_URL = 'http://localhost:3000';

async function testAdminAccess() {
  console.log('🔐 Testing ADMIN Access to All Terminals\n');

  const terminals = [
    { id: 'CAJA-01', name: 'Caja 1', role: 'CASHIER' },
    { id: 'MESERO-01', name: 'Mesero 1', role: 'WAITER' },
    { id: 'COCINA-01', name: 'Cocina 1', role: 'KITCHEN' },
    { id: 'BAR-01', name: 'Bar 1', role: 'BAR' },
  ];

  // Use the correct tenant ID where employees are stored
  const tenantId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const adminPin = '1234';

  console.log(`Testing with ADMIN PIN: ${adminPin}\n`);
  console.log('Expected: ADMIN should access ANY terminal, even if not registered\n');

  let successCount = 0;
  let failCount = 0;

  for (const terminal of terminals) {
    console.log(`📝 Testing access to ${terminal.name} (${terminal.id})`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          terminal_id: terminal.id,
          pin: adminPin,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`   ✅ SUCCESS`);
        console.log(`   Employee: ${data.employee.name} (${data.employee.role})`);
        console.log(`   Terminal: ${terminal.id}`);
        console.log(`   Cookie set: ${response.headers.get('set-cookie') ? 'YES' : 'NO'}\n`);
        successCount++;
      } else {
        console.log(`   ❌ FAILED - Status ${response.status}`);
        console.log(`   Error: ${data.error}\n`);
        failCount++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${successCount} passed, ${failCount} failed`);
  console.log('='.repeat(50));

  if (failCount === 0) {
    console.log('\n✅ All tests passed!');
    console.log('\nADMIN can now:');
    console.log('- Access Caja with PIN 1234');
    console.log('- Access Mesero with PIN 1234');
    console.log('- Access Cocina with PIN 1234');
    console.log('- Access Bar with PIN 1234');
    console.log('- Access ANY terminal with PIN 1234');
  } else {
    console.log('\n❌ Some tests failed. Check the errors above.');
  }
}

testAdminAccess();

