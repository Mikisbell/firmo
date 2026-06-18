/**
 * POC de TRANSPORTE: prueba que Supabase Realtime funciona por WEBSOCKET (wss:443),
 * SIN puerto 5432 ni TCP. Usa Broadcast (no requiere RLS de tabla) con la anon key.
 * Round-trip send->receive. Esto es lo que sobrevive a Cloudflare: navegador -> wss directo.
 * Uso: bun --env-file=.env.local prisma/cleanup/verify-realtime-transport.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, anon);

async function main() {
  // self:true -> el emisor recibe su propio broadcast (suficiente para probar el round-trip)
  const channel = supabase.channel('poc-realtime', { config: { broadcast: { self: true } } });
  let received: { msg?: string } | null = null;
  channel.on('broadcast', { event: 'ping' }, (msg) => { received = msg.payload as { msg?: string }; });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout suscribiendo al canal')), 10000);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); reject(err || new Error(status)); }
    });
  });

  await channel.send({ type: 'broadcast', event: 'ping', payload: { msg: 'hola-cloudflare' } });
  await new Promise((r) => setTimeout(r, 1500));

  const ok = received && (received as { msg?: string }).msg === 'hola-cloudflare';
  console.log(ok
    ? 'OK round-trip Realtime por WEBSOCKET: mensaje recibido SIN puerto 5432'
    : 'NO se recibio el broadcast (received: ' + JSON.stringify(received) + ')');

  await supabase.removeChannel(channel);
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error('FALLO:', String(e?.message ?? e));
  process.exit(1);
});
