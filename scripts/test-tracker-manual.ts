import { PrismaClient } from "@prisma/client";

async function test() {
  const prisma = new PrismaClient();

  console.log("Corriendo lógica del FastTracker manualmente con Prisma nativo...");
  
  const checkpoint = await prisma.projection_checkpoints.findUnique({
      where: { projection_name: 'main' }
  });
  const cursor = checkpoint?.last_processed_sequence || 0n;

  console.log("Cursor actual:", cursor);

  const newEvents = await prisma.events.findMany({
      where: { global_sequence: { gt: cursor } },
      orderBy: { global_sequence: 'asc' },
      select: { global_sequence: true }
  });

  const sequences = newEvents.map(e => e.global_sequence);
  console.log(`Encontrados ${sequences.length} eventos nuevos.`);

  if (sequences.length > 0) {
      let holes: bigint[] = [];
      let last = cursor;
      for (const seq of sequences) {
          let expected = last + 1n;
          while (expected < seq) {
              holes.push(expected);
              expected++;
          }
          last = seq;
      }

      console.log(`Fantasmas detectados (huecos): ${holes.length}`);
      if (holes.length > 0) {
          console.log("Primeros fantasmas:", holes.slice(0, 5));
      }
  }

  await prisma.$disconnect();
}

test().catch(console.error);
