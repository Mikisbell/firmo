/**
 * POC SEGURA: aislamiento por tenant en canales privados de Realtime, SIN puerto 5432.
 * - Cliente A (token tenant A) entra a canal privado 'tenant:A' y emite un broadcast.
 * - Cliente B (token tenant B) INTENTA entrar a 'tenant:A' (canal de A). El RLS debe DENEGARLO.
 * Prueba: A recibe lo suyo (self) y B NO recibe nada del tenant A (aislamiento).
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-realtime-tenant-isolation.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || '');
if (!url || !anon || !process.env.SUPABASE_JWT_SECRET) { console.log('Faltan credenciales Supabase'); process.exit(1); }

const TA = 'aaaaaaaa-0000-0000-0000-000000000001';
const TB = 'bbbbbbbb-0000-0000-0000-000000000002';

async function mint(tenant: string, sub: string) {
  return new SignJWT({ role: 'authenticated', tenant_id: tenant })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase').setSubject(sub).setAudience('authenticated')
    .setIssuedAt().setExpirationTime('1h').sign(secret);
}

function makeClient(token: string): SupabaseClient {
  const c = createClient(url, anon);
  c.realtime.setAuth(token);
  return c;
}

function joinPrivate(client: SupabaseClient, topic: string, self: boolean, onMsg: () => void) {
  const ch = client.channel(topic, { config: { private: true, broadcast: { self } } });
  ch.on('broadcast', { event: 'evt' }, () => onMsg());
  return new Promise<{ ch: ReturnType<typeof client.channel>; status: string }>((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ ch, status: 'TIMEOUT' }); } }, 8000);
    ch.subscribe((status) => {
      if (done) return;
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        done = true; clearTimeout(t); resolve({ ch, status });
      }
    });
  });
}

async function main() {
  const cA = makeClient(await mint(TA, 'term-A'));
  const cB = makeClient(await mint(TB, 'term-B'));

  let aGot = 0, bGot = 0;
  // A entra a SU canal (self:true para confirmar entrega)
  const a = await joinPrivate(cA, 'tenant:' + TA, true, () => { aGot++; });
  // B (tenant distinto) INTENTA entrar al canal de A -> RLS debe denegar
  const b = await joinPrivate(cB, 'tenant:' + TA, false, () => { bGot++; });

  console.log('A subscribe a tenant:A ->', a.status, '| B subscribe a tenant:A ->', b.status, '(CHANNEL_ERROR = RLS lo denego, correcto)');

  // A emite a su propio canal
  if (a.status === 'SUBSCRIBED') {
    await a.ch.send({ type: 'broadcast', event: 'evt', payload: { msg: 'pedido-mesa-3' } });
  }
  await new Promise((r) => setTimeout(r, 2000));

  console.log('A recibio (debe ser >0):', aGot, '| B recibio del tenant A (debe ser 0):', bGot);
  const ok = aGot > 0 && bGot === 0;
  console.log(ok
    ? 'OK AISLAMIENTO POR TENANT: A recibe lo suyo, B NO accede al canal de A. Realtime privado funciona SIN puerto 5432.'
    : 'REVISAR: aGot=' + aGot + ' bGot=' + bGot);

  await cA.removeAllChannels(); await cB.removeAllChannels();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
