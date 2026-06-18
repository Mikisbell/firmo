/**
 * Verifica el SupabaseRealtimeEventBus REAL (broadcast por HTTP) + el helper REAL de
 * minteo. Flujo: el "servidor" emite via bus.publish() (HTTP, service_role) y un cliente
 * suscrito a su canal privado (token de tenant) lo recibe. Sin 5432, sin websocket server.
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-realtime-broadcast-bus.ts
 */
import { createClient } from '@supabase/supabase-js';
import { SupabaseRealtimeEventBus } from '@/src/core/realtime/supabase-realtime-event-bus';
import { mintRealtimeToken } from '@/src/core/realtime/supabase-token';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !anon || !serviceRole) { console.log('Faltan credenciales (url/anon/service_role)'); process.exit(1); }

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';

async function main() {
  // Suscriptor: cliente con token de tenant en su canal privado
  const token = await mintRealtimeToken(TENANT, 'poc-sub');
  const sub = createClient(url, anon);
  sub.realtime.setAuth(token);
  let received: { event_id?: string } | null = null;
  const ch = sub.channel(`tenant:${TENANT}`, { config: { private: true } });
  ch.on('broadcast', { event: 'park_event' }, (m) => { received = m.payload as { event_id?: string }; });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout suscribiendo')), 8000);
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
      if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(t); reject(new Error(s)); }
    });
  });

  // El "servidor" emite con el bus de produccion (HTTP broadcast, service_role)
  const bus = new SupabaseRealtimeEventBus(url, serviceRole);
  await bus.publish(TENANT, { event_id: 'evt-1', tenant_id: TENANT, event_type: 'ORDER_CREATED' } as never);

  await new Promise((r) => setTimeout(r, 2500));
  const ok = received !== null && (received as { event_id?: string }).event_id === 'evt-1';
  console.log(ok
    ? 'OK: servidor emitio por HTTP broadcast y el cliente RECIBIO (sin 5432, sin websocket server-side)'
    : 'NO se recibio. received: ' + JSON.stringify(received));

  await sub.removeAllChannels();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
