/**
 * VERIFICA cross-connection: una instancia PUBLICA, OTRA distinta ESCUCHA.
 * Simula el caso real de Vercel multi-instancia: el ingest (instancia A) hace NOTIFY,
 * el listener de notificaciones/delivery (instancia B) hace LISTEN en OTRA conexion.
 * Si el listener de B recibe el evento de A -> LISTEN/NOTIFY funciona cross-instancia.
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-pg-listen-cross.ts
 */
import { SupabaseEventBus } from '@/src/core/infra/supabase-event-bus';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const port = (() => { try { return new URL(url).port || '5432'; } catch { return '?'; } })();
const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';

async function main() {
  console.log('Probando cross-connection en puerto:', port);

  // Dos buses = dos conexiones distintas (simula 2 instancias de Vercel)
  const busSub = new SupabaseEventBus(url); // instancia B: escucha
  const busPub = new SupabaseEventBus(url); // instancia A: publica
  await busSub.connect();
  await busPub.connect();

  let received = false;
  await busSub.subscribe(TENANT, () => { received = true; });
  await new Promise((r) => setTimeout(r, 1000));

  // La OTRA conexion publica
  await busPub.publish(TENANT, { event_id: 'cross-test-1', tenant_id: TENANT, event_type: 'ORDER_CREATED' } as never);
  await new Promise((r) => setTimeout(r, 3000));

  if (received) {
    console.log('OK CROSS-CONNECTION: el NOTIFY de una conexion llego al LISTEN de OTRA -> funciona multi-instancia');
  } else {
    console.log('PROBLEMA CROSS-CONNECTION: el NOTIFY NO cruzo entre conexiones en puerto ' + port);
    console.log('=> En Vercel multi-instancia, notifs push / delivery podrian NO recibir eventos de otras instancias.');
  }

  await busSub.disconnect();
  await busPub.disconnect();
  process.exit(received ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
