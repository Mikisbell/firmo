/**
 * Verifica que SUPABASE_JWT_SECRET es correcto y que podemos mintear tokens validos.
 * Prueba determinística OFFLINE (sin red):
 *  1) La anon key esta firmada HS256 con el legacy secret -> si jwtVerify(anon, secret) pasa,
 *     el secret es CORRECTO.
 *  2) Minteamos un token de tenant (role:authenticated + tenant_id) y lo re-verificamos.
 * Uso: bun --env-file=.env --env-file=.env.local prisma/cleanup/verify-jwt-mint.ts
 */
import { SignJWT, jwtVerify } from 'jose';

const rawSecret = process.env.SUPABASE_JWT_SECRET || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
if (!rawSecret || !anon) { console.log('Faltan SUPABASE_JWT_SECRET / anon key'); process.exit(1); }

async function tryVerify(secretStr: string, label: string) {
  const secret = new TextEncoder().encode(secretStr);
  try {
    const { payload } = await jwtVerify(anon, secret);
    console.log(`OK [${label}] el secret VALIDA la anon key. Secret correcto. claims:`, JSON.stringify(payload));
    return secretStr;
  } catch (e: unknown) {
    const msg = (e as { code?: string; message?: string });
    console.log(`FALLO [${label}] no valida la anon key:`, msg.code || msg.message);
    return null;
  }
}

async function main() {
  // 1) Probar el secret tal cual y, si falla, recortado (por si quedo un \n o espacio)
  let good = await tryVerify(rawSecret, 'raw len ' + rawSecret.length);
  if (!good && rawSecret.trim() !== rawSecret) {
    good = await tryVerify(rawSecret.trim(), 'trim len ' + rawSecret.trim().length);
  }
  if (!good) {
    console.log('=> El SUPABASE_JWT_SECRET parece incorrecto/truncado. Re-copia el "Legacy JWT secret" completo.');
    process.exit(2);
  }

  // 2) Mintear token de tenant y re-verificar
  const secret = new TextEncoder().encode(good);
  const anonPayload = (await jwtVerify(anon, secret)).payload;
  const TENANT = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const token = await new SignJWT({ role: 'authenticated', tenant_id: TENANT })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer((anonPayload.iss as string) || 'supabase')
    .setSubject('poc-terminal-1')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  const { payload: mine } = await jwtVerify(token, secret);
  console.log('OK token de tenant minteado y VALIDADO. claims:', JSON.stringify({ role: mine.role, tenant_id: mine.tenant_id, aud: mine.aud, iss: mine.iss }));
  console.log('=> El minteo de tokens funciona. Listo para la POC segura por tenant.');
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
