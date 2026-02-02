/**
 * Script para verificar todas las tablas en Supabase Cloud
 * y crear las que falten
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Conectando a Supabase Cloud...\n');

  try {
    // Obtener todas las tablas del schema public
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('📊 TABLAS ENCONTRADAS EN SUPABASE:\n');
    console.log('='.repeat(60));

    const tableNames = tables.map(t => t.tablename).sort();
    tableNames.forEach((name, index) => {
      console.log(`${String(index + 1).padStart(3, ' ')}. ${name}`);
    });

    console.log('='.repeat(60));
    console.log(`\n✅ Total de tablas: ${tableNames.length}\n`);

    // Verificar tablas críticas
    const criticalTables = [
      'inventory',
      'inventory_log',
      'goods_receipts',
      'goods_receipt_items',
      'waste_logs',
      'stock_alerts',
      'invoices',
      'invoice_queue',
      'invoice_cdr',
      'orders',
      'payments',
      'refunds',
      'employees',
      'products',
      'recipes',
      'events',
      'event_outbox',
      'processed_events',
    ];

    console.log('🔎 VERIFICACIÓN DE TABLAS CRÍTICAS:\n');
    console.log('='.repeat(60));

    const missing: string[] = [];
    const existing: string[] = [];

    for (const table of criticalTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table.padEnd(30, ' ')} EXISTE`);
        existing.push(table);
      } else {
        console.log(`❌ ${table.padEnd(30, ' ')} FALTA`);
        missing.push(table);
      }
    }

    console.log('='.repeat(60));
    console.log(`\n✅ Tablas existentes: ${existing.length}`);
    console.log(`❌ Tablas faltantes: ${missing.length}\n`);

    if (missing.length > 0) {
      console.log('📋 TABLAS A CREAR:\n');
      missing.forEach(table => {
        console.log(`  - ${table}`);
      });
      console.log('\n⚠️  Ejecuta: npx prisma migrate deploy\n');
    }

    // Verificar estructura de tabla inventory
    console.log('\n📐 ESTRUCTURA DE TABLA "inventory":\n');
    console.log('='.repeat(60));

    const inventoryColumns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string }>
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'inventory'
      ORDER BY ordinal_position;
    `;

    if (inventoryColumns.length > 0) {
      inventoryColumns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
        console.log(`  ${col.column_name.padEnd(25, ' ')} ${col.data_type.padEnd(20, ' ')} ${nullable}`);
      });
    } else {
      console.log('  ❌ Tabla "inventory" no existe');
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error al conectar a Supabase:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
