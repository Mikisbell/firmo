/**
 * Minteo de tokens para Supabase Realtime.
 *
 * Firma un JWT HS256 con el legacy JWT secret del proyecto para que Supabase lo
 * acepte y el RLS de canales privados (realtime.messages) aisle por tenant.
 * REGLA DE ORO: el tenant_id viene SIEMPRE de la sesion del servidor, NUNCA del cliente.
 *
 * @module core/realtime/supabase-token
 */
import { SignJWT } from 'jose';

/** Vida del token: corta, el cliente lo renueva pidiendolo de nuevo. */
const REALTIME_TOKEN_TTL = '1h';

/**
 * Mintea un token de acceso para que un terminal se conecte a Supabase Realtime.
 *
 * @param tenantId - tenant de la sesion autenticada (no del cliente)
 * @param userId - id del usuario/empleado (va en el claim sub)
 * @returns JWT HS256 firmado con SUPABASE_JWT_SECRET
 * @throws Error si SUPABASE_JWT_SECRET no esta configurado
 */
export async function mintRealtimeToken(tenantId: string, userId: string): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET no configurado: Realtime no disponible');
  }

  // role:authenticated + tenant_id -> la politica RLS del canal privado autoriza
  // unicamente el topic 'tenant:<tenant_id>'. iss/aud iguales a los tokens de Supabase.
  return new SignJWT({ role: 'authenticated', tenant_id: tenantId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase')
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(REALTIME_TOKEN_TTL)
    .sign(new TextEncoder().encode(secret));
}
