import { deadLetterQueueService } from '@/src/core/events/dlq.service';

async function main() {
  console.log('Iniciando drenaje manual de DLQ...');
  try {
    const count = await deadLetterQueueService.drainDLQ(100);
    console.log(`Drenaje completado con éxito. Se reencolaron ${count} eventos.`);
  } catch (err) {
    console.error('Error drenando DLQ:', err);
  }
}

main().catch(console.error);
