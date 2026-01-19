/**
 * Test APIs to verify they work correctly
 */

async function testAPI(url: string, name: string) {
  try {
    const response = await fetch(url);
    const status = response.status;
    const data = await response.json();
    
    console.log(`\n✓ ${name}`);
    console.log(`  Status: ${status}`);
    console.log(`  Data:`, JSON.stringify(data).substring(0, 100) + '...');
    
    return { success: status < 400, status, data };
  } catch (error) {
    console.error(`\n✗ ${name}`);
    console.error(`  Error:`, error instanceof Error ? error.message : error);
    return { success: false, error };
  }
}

async function main() {
  console.log('Testing APIs...\n');
  console.log('='.repeat(50));
  
  // Test zones API
  await testAPI('http://localhost:3000/api/admin/zones', 'GET /api/admin/zones');
  
  // Test tables API
  await testAPI('http://localhost:3000/api/admin/tables?active=true', 'GET /api/admin/tables?active=true');
  
  console.log('\n' + '='.repeat(50));
  console.log('\nNote: /api/notifications/subscribe requires authentication');
  console.log('It will return 401 without a valid Bearer token, which is expected.');
}

main();
