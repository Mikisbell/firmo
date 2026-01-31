/**
 * Module Import Test
 * 
 * Tests if the module is being cached with old code
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔍 MODULE IMPORT TEST\n');
  console.log('='.repeat(60));

  // Step 1: Verify the source file has the debug log
  console.log('\n📝 Step 1: Verify source file...\n');
  
  const sourcePath = join(process.cwd(), 'src/core/delivery/assignment.service.ts');
  const sourceContent = readFileSync(sourcePath, 'utf-8');
  
  const hasDebugLog = sourceContent.includes('[DEBUG] assignDriver query result');
  const hasNullCheck = sourceContent.includes('if (!order.orders)');
  
  console.log('Source file checks:');
  console.log('  Has DEBUG log:', hasDebugLog ? '✅' : '❌');
  console.log('  Has null check:', hasNullCheck ? '✅' : '❌');

  if (!hasDebugLog || !hasNullCheck) {
    console.log('\n❌ Source file is missing expected code!');
    process.exit(1);
  }

  // Step 2: Import the module
  console.log('\n📦 Step 2: Importing module...\n');
  
  // Clear require cache
  const modulePath = join(process.cwd(), 'src/core/delivery/assignment.service.ts');
  delete require.cache[modulePath];
  
  const { assignDriver } = await import('@/src/core/delivery/assignment.service');
  
  console.log('✅ Module imported');
  console.log('  assignDriver function:', typeof assignDriver);

  // Step 3: Check if the function has the debug code
  console.log('\n🔍 Step 3: Checking function code...\n');
  
  const functionCode = assignDriver.toString();
  const functionHasDebug = functionCode.includes('DEBUG');
  const functionHasNullCheck = functionCode.includes('order.orders');
  
  console.log('Function code checks:');
  console.log('  Has DEBUG in code:', functionHasDebug ? '✅' : '❌');
  console.log('  Has null check:', functionHasNullCheck ? '✅' : '❌');
  
  if (!functionHasDebug) {
    console.log('\n⚠️ WARNING: Function code does not include DEBUG log!');
    console.log('This suggests the module is using cached/compiled code.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ TEST COMPLETE\n');
}

main().catch(console.error);
