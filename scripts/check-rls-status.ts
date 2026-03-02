/**
 * P3.5 — Verificar estado de RLS en las 7 tablas de ADR-009
 *
 * Uso: npx tsx scripts/check-rls-status.ts
 *
 * Exit codes:
 *   0 = RLS habilitado en las 7 tablas
 *   1 = RLS faltante en una o mas tablas
 */

import prisma from '@/src/core/db/prisma';

// Las 7 tablas protegidas por RLS segun ADR-009
const RLS_TABLES = [
  'events',
  'orders',
  'employees',
  'payments',
  'active_sessions',
  'archived_events',
  'pending_events',
] as const;

interface RlsTableStatus {
  tablename: string;
  rowsecurity: boolean;
}

interface RlsPolicy {
  tablename: string;
  policyname: string;
}

async function checkRLS(): Promise<void> {
  try {
    console.log('Verificando estado de RLS (ADR-009, 7 tablas)...\n');

    // 1. Verificar si RLS esta habilitado en cada tabla
    const rlsStatus = await prisma.$queryRaw<RlsTableStatus[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN (${RLS_TABLES[0]}, ${RLS_TABLES[1]}, ${RLS_TABLES[2]}, ${RLS_TABLES[3]}, ${RLS_TABLES[4]}, ${RLS_TABLES[5]}, ${RLS_TABLES[6]})
      ORDER BY tablename;
    `;

    // 2. Verificar politicas RLS activas
    const policies = await prisma.$queryRaw<RlsPolicy[]>`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN (${RLS_TABLES[0]}, ${RLS_TABLES[1]}, ${RLS_TABLES[2]}, ${RLS_TABLES[3]}, ${RLS_TABLES[4]}, ${RLS_TABLES[5]}, ${RLS_TABLES[6]})
      ORDER BY tablename, policyname;
    `;

    // Build policy count map
    const policyCountMap = new Map<string, number>();
    for (const p of policies) {
      policyCountMap.set(p.tablename, (policyCountMap.get(p.tablename) || 0) + 1);
    }

    // Build RLS status map
    const rlsMap = new Map<string, boolean>();
    for (const row of rlsStatus) {
      rlsMap.set(row.tablename, row.rowsecurity);
    }

    // 3. Print status table
    console.log('+-----------------------+-------------+------------+');
    console.log('| Tabla                 | RLS Enabled | # Policies |');
    console.log('+-----------------------+-------------+------------+');

    let allEnabled = true;
    for (const table of RLS_TABLES) {
      const enabled = rlsMap.get(table);
      const policyCount = policyCountMap.get(table) || 0;

      let statusStr: string;
      if (enabled === undefined) {
        statusStr = 'NOT FOUND';
        allEnabled = false;
      } else if (enabled) {
        statusStr = 'YES';
      } else {
        statusStr = 'NO';
        allEnabled = false;
      }

      const tablePadded = table.padEnd(21);
      const statusPadded = statusStr.padEnd(11);
      const countPadded = String(policyCount).padEnd(10);
      console.log(`| ${tablePadded} | ${statusPadded} | ${countPadded} |`);
    }

    console.log('+-----------------------+-------------+------------+');

    // 4. Summary
    console.log('');
    if (allEnabled) {
      console.log('RESULTADO: RLS habilitado en las 7 tablas de ADR-009.');
      console.log('Nota: Prisma como superuser (postgres) bypasea RLS.');
      process.exit(0);
    } else {
      console.log('RESULTADO: RLS NO esta habilitado en todas las tablas.');
      console.log('Ejecutar prisma/rls/enable-selective-rls.sql en Supabase Dashboard.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error verificando RLS:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkRLS();
