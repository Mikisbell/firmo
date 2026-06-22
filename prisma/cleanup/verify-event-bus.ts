/**
 * Verifica el fix del SupabaseEventBus (driver pg en vez de @neondatabase/serverless).
 * Hace un round-trip real de LISTEN/NOTIFY: subscribe -> publish -> recibe.
 * Fuerza el puerto 5432 (session pooler) porque LISTEN/NOTIFY NO funciona en el
 * pooler de transacciones (6543, pgbouncer transaction mode).
 * Uso: bun --env-file=.env prisma/cleanup/verify-event-bus.ts
 */
import { SupabaseEventBus } from '@/src/core/infra/supabase-event-bus';

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const sessionUrl = raw.replace(':6543', ':5432');
console.log('Probando contra puerto:', (() => { try { return new URL(sessionUrl).port; } catch { return '?'; } })());

async function main() {
  const bus = new SupabaseEventBus(sessionUrl);
  await bus.connect();

  const tenantId = '00000000-0000-0000-0000-000000000000';
  let received: { event_id?: string } | null = null;
  const unsub = await bus.subscribe(tenantId, (e) => { received = e as { event_id?: string }; });

  const testEvent = { event_id: 'ping-1', tenant_id: tenantId, event_type: 'TEST_PING' } as never;
  await bus.publish(tenantId, testEvent);

  // LISTEN/NOTIFY es asíncrono: damos margen para que llegue la notificación
  await new Promise((r) => setTimeout(r, 1500));

  if (received && (received as { event_id?: string }).event_id === 'ping-1') {
    console.log('OK round-trip LISTEN/NOTIFY: notificación recibida sin EAUTHPROTOCOL ni crash');
  } else {
    console.log('SIN notificación (conecta sin crash, pero el realtime no llegó)');
  }

  await unsub();
  await bus.disconnect();
  process.exit(received ? 0 : 2);
}

main().catch((e) => {
  console.error('FALLO:', String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s"]+/g, '[REDACTED]'));
  process.exit(1);
});
