/**
 * Verificar que el evento de activación de terminal se registró correctamente
 */

import prisma from '@/src/core/db/prisma';

async function main() {
  console.log('🔍 Verificando eventos de activación de terminal...\n');

  try {
    // Obtener los últimos eventos de activación
    const events = await prisma.events.findMany({
      where: {
        type: 'TERMINAL_ACTIVATED_SIMPLE',
      },
      orderBy: {
        occurred_at: 'desc',
      },
      take: 5,
    });

    if (events.length === 0) {
      console.log('❌ No se encontraron eventos de activación');
      process.exit(1);
    }

    console.log(`✅ Se encontraron ${events.length} eventos de activación:\n`);

    events.forEach((event, index) => {
      console.log(`${index + 1}. Evento:`);
      console.log(`   Tipo: ${event.type}`);
      console.log(`   Entity ID: ${event.entity_id}`);
      console.log(`   Actor ID: ${event.actor_id}`);
      console.log(`   Actor Role: ${event.actor_role_snapshot}`);
      console.log(`   Terminal ID: ${event.terminal_id}`);
      console.log(`   Payload: ${JSON.stringify(event.payload, null, 2)}`);
      console.log(`   Ocurrió: ${event.occurred_at.toISOString()}`);
      console.log();
    });

    // Verificar que el actor_id es un UUID válido
    const lastEvent = events[0];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(lastEvent.actor_id)) {
      console.log('✅ El actor_id es un UUID válido');
    } else {
      console.log(`❌ El actor_id NO es un UUID válido: ${lastEvent.actor_id}`);
      process.exit(1);
    }

    console.log('\n✅ ¡Verificación completada exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
