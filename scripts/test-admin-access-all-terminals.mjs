#!/usr/bin/env node

/**
 * Test that ADMIN can access any terminal with PIN 1234
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

  const tenantId = '00000000-0000-0000-0000-000000000000';
  const adminPin = '1234';

  console.log(`Testing with ADMIN PIN: ${adminPin}\n`);

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
        console.log(`   Terminal: ${terminal.id}\n`);
      } else {
        console.log(`   ❌ FAILED - Status ${response.status}`);
        console.log(`   Error: ${data.error}\n`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }
  }

  console.log('\n✅ Test complete!');
  console.log('\nExpected behavior:');
  console.log('- ADMIN should be able to access ANY terminal with PIN 1234');
  console.log('- Each terminal should return the ADMIN employee data');
  console.log('- No role mismatch errors should occur');
}

testAdminAccess();
