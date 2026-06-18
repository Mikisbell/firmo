/**
 * READ-ONLY: prueba que el singleton de Prisma (src/core/db/prisma.ts) conecte
 * en modo produccion (rama del adaptador Neon WebSocket) contra la DB real.
 * Uso: NODE_ENV=production bun --env-file=.env prisma/cleanup/test-singleton.ts
 */
import prisma from '../../src/core/db/prisma';

async function main() {
  console.log('NODE_ENV:', process.env.NODE_ENV || '(unset)');
  try {
    const r = await prisma.$queryRawUnsafe('SELECT 1 as ok, current_database()::text as db');
    console.log('SINGLETON CONNECT OK:', JSON.stringify(r));
  } catch (e: any) {
    console.error('SINGLETON CONNECT FAIL:', (e?.message ?? String(e)).slice(0, 300));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main();
