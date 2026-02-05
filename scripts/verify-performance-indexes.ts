/**
 * Verification Script: Performance Indexes
 * 
 * This script verifies that all required performance indexes from
 * system-consolidation-phase1 spec (Requirements 9.4, 9.5) are present.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIndexes() {
  console.log('🔍 Verifying Performance Indexes...\n');

  try {
    // Query to get all indexes on relevant tables
    const indexQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('orders', 'events', 'products', 'employees')
      ORDER BY tablename, indexname;
    `;

    const indexes = await prisma.$queryRawUnsafe<Array<{
      schemaname: string;
      tablename: string;
      indexname: string;
      indexdef: string;
    }>>( indexQuery);

    console.log(`Found ${indexes.length} indexes on target tables\n`);

    // Group by table
    const indexesByTable = indexes.reduce((acc, idx) => {
      if (!acc[idx.tablename]) {
        acc[idx.tablename] = [];
      }
      acc[idx.tablename].push(idx);
      return acc;
    }, {} as Record<string, typeof indexes>);

    // Check required indexes
    const requiredIndexes = [
      {
        table: 'orders',
        name: 'idx_orders_terminal',
        description: 'orders(tenant_id, created_at DESC)',
        pattern: /tenant_id.*created_at/i,
      },
      {
        table: 'orders',
        name: 'order_status',
        description: 'orders(tenant_id, order_status)',
        pattern: /tenant_id.*order_status/i,
      },
      {
        table: 'events',
        name: 'idx_events_by_type',
        description: 'events(tenant_id, type, occurred_at DESC)',
        pattern: /tenant_id.*type.*occurred_at/i,
      },
      {
        table: 'events',
        name: 'idx_events_aggregate_replay',
        description: 'events(entity_id, occurred_at) - NEW',
        pattern: /entity_id.*occurred_at/i,
      },
      {
        table: 'products',
        name: 'idx_products_tenant_active',
        description: 'products(tenant_id, is_active) - NEW',
        pattern: /tenant_id.*is_active/i,
      },
      {
        table: 'employees',
        name: 'is_active',
        description: 'employees(tenant_id, is_active)',
        pattern: /tenant_id.*is_active/i,
      },
    ];

    let allPresent = true;

    for (const required of requiredIndexes) {
      const tableIndexes = indexesByTable[required.table] || [];
      const found = tableIndexes.find(idx => 
        required.pattern.test(idx.indexdef)
      );

      if (found) {
        console.log(`✅ ${required.description}`);
        console.log(`   Index: ${found.indexname}`);
        console.log(`   Definition: ${found.indexdef}\n`);
      } else {
        console.log(`❌ MISSING: ${required.description}\n`);
        allPresent = false;
      }
    }

    // Additional info
    console.log('\n📊 Index Summary by Table:\n');
    for (const [table, idxs] of Object.entries(indexesByTable)) {
      console.log(`${table}: ${idxs.length} indexes`);
      idxs.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
      console.log('');
    }

    if (allPresent) {
      console.log('✅ All required performance indexes are present!');
      process.exit(0);
    } else {
      console.log('❌ Some required indexes are missing!');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error verifying indexes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyIndexes();
