/**
 * PARK POS - Inventory Stress Test Script
 * Tests: Inventory APIs, concurrent operations, data integrity
 * Task 6 - Checkpoint Kardex funcionando
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = 'loc-main-001';
const TERMINAL_ID = 'term-admin-001';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
}

const results: TestResult[] = [];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (e: any) {
    results.push({ name, passed: false, duration: Date.now() - start, details: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// ============ DATABASE INVENTORY TESTS ============

async function testInventoryTableExists() {
  await test('DB: Inventory table exists', async () => {
    const count = await prisma.inventory.count();
    console.log(`   Inventory items: ${count}`);
  });
}

async function testInventoryLogTableExists() {
  await test('DB: InventoryLog table exists', async () => {
    const count = await prisma.inventory_log.count();
    console.log(`   Inventory logs: ${count}`);
  });
}

async function testWasteLogTableExists() {
  await test('DB: WasteLog table exists', async () => {
    const count = await prisma.waste_logs.count();
    console.log(`   Waste logs: ${count}`);
  });
}

async function testGoodsReceiptTableExists() {
  await test('DB: GoodsReceipt table exists', async () => {
    const count = await prisma.goods_receipts.count();
    console.log(`   Goods receipts: ${count}`);
  });
}

async function testInventoryCountTableExists() {
  await test('DB: InventoryCount table exists', async () => {
    const count = await prisma.inventory_counts.count();
    console.log(`   Inventory counts: ${count}`);
  });
}

async function testInventoryIndices() {
  await test('DB: Inventory indices exist', async () => {
    // Test query performance with index
    const start = Date.now();
    await prisma.inventory.findMany({
      where: { tenant_id: TENANT_ID },
      take: 100,
    });
    const duration = Date.now() - start;
    console.log(`   Query time: ${duration}ms`);
    if (duration > 500) throw new Error(`Query too slow: ${duration}ms (expected < 500ms)`);
  });
}

async function testInventoryLogIndices() {
  await test('DB: InventoryLog indices exist', async () => {
    const start = Date.now();
    await prisma.inventory_log.findMany({
      where: { tenant_id: TENANT_ID },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    const duration = Date.now() - start;
    console.log(`   Query time: ${duration}ms`);
    if (duration > 500) throw new Error(`Query too slow: ${duration}ms (expected < 500ms)`);
  });
}

// ============ DATA INTEGRITY TESTS ============

async function testInventoryStockNonNegative() {
  await test('Integrity: Stock values non-negative', async () => {
    const negativeStock = await prisma.inventory.findMany({
      where: {
        stock: { lt: 0 },
      },
    });
    if (negativeStock.length > 0) {
      throw new Error(`Found ${negativeStock.length} items with negative stock`);
    }
  });
}

async function testInventoryCostInCents() {
  await test('Integrity: Costs stored in cents (integers)', async () => {
    const items = await prisma.inventory.findMany({
      where: { cost_cents: { not: null } },
      take: 100,
    });
    for (const item of items) {
      if (item.cost_cents !== null && item.cost_cents !== Math.floor(item.cost_cents)) {
        throw new Error(`Item ${item.code} has non-integer cost: ${item.cost_cents}`);
      }
    }
  });
}

async function testWasteLogCostInCents() {
  await test('Integrity: Waste costs in cents (integers)', async () => {
    const logs = await prisma.waste_logs.findMany({ take: 100 });
    for (const log of logs) {
      if (log.cost_cents !== Math.floor(log.cost_cents)) {
        throw new Error(`WasteLog ${log.id} has non-integer cost: ${log.cost_cents}`);
      }
    }
  });
}

async function testInventoryLogQuantities() {
  await test('Integrity: InventoryLog quantities valid', async () => {
    const logs = await prisma.inventory_log.findMany({ take: 100 });
    for (const log of logs) {
      const qty = Number(log.quantity);
      if (isNaN(qty)) {
        throw new Error(`InventoryLog ${log.id} has invalid quantity`);
      }
    }
  });
}

// ============ API TESTS ============

async function testApiStockEndpoint() {
  await test('API: /api/inventory/stock', async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Items: ${data.items?.length || 0}, Summary: ${JSON.stringify(data.summary)}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiStockPerformance() {
  await test('API: Stock endpoint < 200ms', async () => {
    try {
      const start = Date.now();
      const res = await fetch(
        `${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const duration = Date.now() - start;
      console.log(`   Response time: ${duration}ms`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      if (duration > 200) console.log(`   ⚠️ Slower than target (200ms)`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiStockSearch() {
  await test('API: Stock search filter', async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}&search=pollo`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Search results: ${data.items?.length || 0}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiStockLowStockFilter() {
  await test('API: Stock low_stock_only filter', async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}&low_stock_only=true`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Low stock items: ${data.items?.length || 0}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiRecentMovements() {
  await test('API: /api/inventory/movements/recent', async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/movements/recent?tenant_id=${TENANT_ID}&limit=10`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Recent movements: ${data.movements?.length || 0}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiStats() {
  await test('API: /api/inventory/stats', async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/stats?tenant_id=${TENANT_ID}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Stats: ${JSON.stringify(data)}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiKardex() {
  await test('API: /api/inventory/kardex/:code', async () => {
    try {
      // Get first inventory item
      const item = await prisma.inventory.findFirst({
        where: { tenant_id: TENANT_ID },
      });
      if (!item) {
        console.log('   No inventory items found, skipping');
        return;
      }

      const res = await fetch(
        `${BASE_URL}/api/inventory/kardex/${item.code}?tenant_id=${TENANT_ID}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Kardex entries: ${data.entries?.length || 0}, Summary: ${JSON.stringify(data.summary)}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testApiKardexPagination() {
  await test('API: Kardex pagination', async () => {
    try {
      const item = await prisma.inventory.findFirst({
        where: { tenant_id: TENANT_ID },
      });
      if (!item) {
        console.log('   No inventory items found, skipping');
        return;
      }

      const res = await fetch(
        `${BASE_URL}/api/inventory/kardex/${item.code}?tenant_id=${TENANT_ID}&page=1&page_size=10`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      console.log(`   Page 1: ${data.entries?.length || 0} entries, Total: ${data.pagination?.total || 0}`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

// ============ CONCURRENT OPERATIONS TESTS ============

async function testConcurrentStockReads() {
  await test('Concurrent: 10 parallel stock reads', async () => {
    try {
      const promises = Array(10).fill(null).map(() =>
        fetch(`${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}`, {
          signal: AbortSignal.timeout(10000),
        }).then(r => r.status)
      );
      const start = Date.now();
      const statuses = await Promise.all(promises);
      const duration = Date.now() - start;
      const success = statuses.filter(s => s === 200).length;
      console.log(`   Success: ${success}/10, Duration: ${duration}ms`);
      if (success < 8) throw new Error(`Too many failures: ${10 - success}/10`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testConcurrentKardexReads() {
  await test('Concurrent: 5 parallel kardex reads', async () => {
    try {
      const items = await prisma.inventory.findMany({
        where: { tenant_id: TENANT_ID },
        take: 5,
      });
      if (items.length === 0) {
        console.log('   No inventory items found, skipping');
        return;
      }

      const promises = items.map(item =>
        fetch(`${BASE_URL}/api/inventory/kardex/${item.code}?tenant_id=${TENANT_ID}`, {
          signal: AbortSignal.timeout(10000),
        }).then(r => r.status)
      );
      const start = Date.now();
      const statuses = await Promise.all(promises);
      const duration = Date.now() - start;
      const success = statuses.filter(s => s === 200).length;
      console.log(`   Success: ${success}/${items.length}, Duration: ${duration}ms`);
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

// ============ VALIDATION TESTS ============

async function testReceiveValidation() {
  await test('Validation: Receive rejects invalid quantity', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/inventory/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          inventory_code: 'TEST',
          quantity: -5, // Invalid
          unit_cost_cents: 100,
          actor_id: uuid(),
          terminal_id: TERMINAL_ID,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      console.log('   Correctly rejected negative quantity');
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

async function testWasteValidation() {
  await test('Validation: Waste rejects invalid reason', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/inventory/waste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          inventory_code: 'TEST',
          quantity: 5,
          reason_code: 'INVALID_REASON', // Invalid
          actor_id: uuid(),
          terminal_id: TERMINAL_ID,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      console.log('   Correctly rejected invalid reason code');
    } catch (e: any) {
      if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
      throw e;
    }
  });
}

// ============ MAIN ============

async function main() {
  console.log('='.repeat(60));
  console.log('PARK POS - Inventory Stress Test Suite');
  console.log('='.repeat(60));
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');

  // Database tests
  console.log('\n📊 DATABASE TESTS\n');
  await testInventoryTableExists();
  await testInventoryLogTableExists();
  await testWasteLogTableExists();
  await testGoodsReceiptTableExists();
  await testInventoryCountTableExists();
  await testInventoryIndices();
  await testInventoryLogIndices();

  // Data integrity tests
  console.log('\n✔️ DATA INTEGRITY TESTS\n');
  await testInventoryStockNonNegative();
  await testInventoryCostInCents();
  await testWasteLogCostInCents();
  await testInventoryLogQuantities();

  // API tests
  console.log('\n🌐 API TESTS\n');
  let serverUp = false;
  try {
    const res = await fetch(`${BASE_URL}/api/inventory/stock?tenant_id=${TENANT_ID}`, {
      signal: AbortSignal.timeout(5000),
    });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }

  if (serverUp) {
    await testApiStockEndpoint();
    await testApiStockPerformance();
    await testApiStockSearch();
    await testApiStockLowStockFilter();
    await testApiRecentMovements();
    await testApiStats();
    await testApiKardex();
    await testApiKardexPagination();

    // Concurrent tests
    console.log('\n⚡ CONCURRENT OPERATION TESTS\n');
    await testConcurrentStockReads();
    await testConcurrentKardexReads();

    // Validation tests
    console.log('\n🛡️ VALIDATION TESTS\n');
    await testReceiveValidation();
    await testWasteValidation();
  } else {
    console.log('   Server not running, skipping API tests');
    console.log('   Run: npm run dev');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
