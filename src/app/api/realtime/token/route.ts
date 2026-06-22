/**
 * Entrega un token de corta vida para que el terminal se conecte a Supabase Realtime.
 *
 * El tenant_id sale de la sesion (requirePosAuth), NUNCA del cliente, asi el RLS de
 * canales privados solo deja recibir los eventos del propio tenant.
 *
 * @module app/api/realtime/token
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { mintRealtimeToken } from '@/src/core/realtime/supabase-token';
import { logger } from '@/src/core/observability/structured-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePosAuth(req);
  if (!auth.authorized) return auth.response;

  try {
    const token = await mintRealtimeToken(auth.user.tenantId, auth.user.id);
    // El canal va explicito para que el cliente no lo arme mal; igual deriva del tenant de sesion.
    return NextResponse.json({ token, channel: `tenant:${auth.user.tenantId}` });
  } catch (error) {
    logger.error(
      'No se pudo mintear el token de Realtime',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Realtime no disponible' }, { status: 503 });
  }
}
