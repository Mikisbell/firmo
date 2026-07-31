import { deadLetterQueueService } from '@/src/core/events/dlq.service';
import prisma from '@/src/core/db/prisma';

async function main() {
  console.log('Iniciando drenaje manual de DLQ...');
  try {
    const count = await deadLetterQueueService.drainDLQ(100);
    console.log(`Drenaje completado con éxito. Se reencolaron ${count} eventos.`);
  } catch (err) {
    console.error('Error drenando DLQ:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fallo fatal en script DLQ:', err);
  process.exit(1);
});
