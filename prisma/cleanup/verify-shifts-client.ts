/**
 * READ-ONLY: verifica que el cliente Prisma regenerado ya NO referencia
 * la columna fantasma last_processed_sequence en el modelo shifts.
 * Un findMany arma el SELECT con TODAS las columnas del modelo -> si el cliente
 * siguiera stale, fallaria con "column does not exist", igual que el upsert.
 * Uso: bun --env-file=.env prisma/cleanup/verify-shifts-client.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // shifts: la tabla que reventaba en el upsert del ingest
  const shifts = await prisma.shifts.findMany({ take: 1 });
  console.log(`OK shifts.findMany -> ${shifts.length} fila(s), SIN error de columna`);

  // Tablas que SI tienen last_processed_sequence fisica (drift inerte): deben leer bien igual
  const orders = await prisma.orders.findMany({ take: 1 });
  console.log(`OK orders.findMany -> ${orders.length} fila(s)`);

  const payments = await prisma.payments.findMany({ take: 1 });
  console.log(`OK payments.findMany -> ${payments.length} fila(s)`);

  console.log('RESULTADO: cliente Prisma limpio, la columna fantasma ya no se referencia.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FALLO:', e?.message ?? e);
  process.exit(1);
});
