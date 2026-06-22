/**
 * Verifica la FASE 2.3a: el eventBus REAL (CompositeEventBus del factory) emite por
 * Supabase broadcast al hacer publish() — el mismo camino que usa el ingest.
 * Un suscriptor con token de tenant en su canal privado debe recibir el evento.
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-composite-bus.ts
 */
import { createClient } from '@supabase/supabase-js';
import { eventBus } from '@/src/core/infra/event-bus';
import { mintRealtimeToken } from '@/src/core/realtime/supabase-token';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';

async function main() {
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

  // publish por el eventBus REAL del factory (CompositeEventBus): pg + broadcast
  const result = eventBus.publish(TENANT, { event_id: 'evt-composite-1', tenant_id: TENANT, event_type: 'ORDER_CREATED' } as never);
  if (result instanceof Promise) await result;

  await new Promise((r) => setTimeout(r, 2500));
  const ok = received !== null && (received as { event_id?: string }).event_id === 'evt-composite-1';
  console.log(ok
    ? 'OK FASE 2.3a: el eventBus REAL (composite) emitio por broadcast y el cliente lo recibio'
    : 'NO se recibio. received: ' + JSON.stringify(received));

  await sub.removeAllChannels();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
