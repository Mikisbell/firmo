/**
 * VERIFICA EL HUECO SERVER-SIDE: ¿pg LISTEN/NOTIFY entrega en la conexion actual?
 * Los consumidores server-side (notificaciones push, delivery broadcaster) se suscriben
 * por el SupabaseEventBus (pg LISTEN). Si el pooler de transacciones (6543) NO entrega
 * el NOTIFY a la conexion que hace LISTEN, esos flujos estan rotos en silencio.
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-pg-listen-6543.ts
 */
import { SupabaseEventBus } from '@/src/core/infra/supabase-event-bus';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const port = (() => { try { return new URL(url).port || '5432'; } catch { return '?'; } })();
const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';

async function main() {
  console.log('Probando LISTEN/NOTIFY contra puerto:', port);
  const bus = new SupabaseEventBus(url);
  await bus.connect();

  let received = false;
  await bus.subscribe(TENANT, () => { received = true; });

  // Pequena espera para asegurar que el LISTEN quedo activo, luego publicamos
  await new Promise((r) => setTimeout(r, 800));
  await bus.publish(TENANT, { event_id: 'listen-test-1', tenant_id: TENANT, event_type: 'ORDER_CREATED' } as never);

  // Dar tiempo a que el NOTIFY llegue al listener
  await new Promise((r) => setTimeout(r, 2500));

  if (received) {
    console.log('OK: LISTEN/NOTIFY ENTREGA en puerto ' + port + ' -> notifs push y delivery broadcaster RECIBEN eventos');
  } else {
    console.log('PROBLEMA: el NOTIFY NO llego al listener en puerto ' + port);
    console.log('=> Los consumidores server-side (notificaciones push, delivery broadcaster) NO reciben eventos. Roto en silencio.');
  }

  await bus.disconnect();
  process.exit(received ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
