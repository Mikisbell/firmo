/**
 * EventBus basado en Supabase Realtime (Broadcast por HTTP).
 *
 * El servidor EMITE a un canal privado 'tenant:<id>' usando el endpoint HTTP de
 * broadcast de Supabase: una sola llamada fetch, SIN websocket ni TCP server-side.
 * Por eso corre igual en Vercel y en Cloudflare Workers (que no hablan TCP).
 *
 * Los clientes se SUSCRIBEN directo a Supabase Realtime por websocket (con un token
 * minteado por /api/realtime/token), no a traves del servidor. De ahi que subscribe()
 * no tenga sentido del lado servidor en este bus.
 *
 * @module core/realtime/supabase-realtime-event-bus
 */
import type { ParkEvent } from '@/src/core/domain/events';
import type { EventBus } from '@/src/core/infra/event-bus';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('supabase-realtime-bus');

/** Nombre del evento de broadcast que transporta cada ParkEvent. */
const BROADCAST_EVENT = 'park_event';

export class SupabaseRealtimeEventBus implements EventBus {
  private readonly broadcastUrl: string;
  private readonly serviceRoleKey: string;

  constructor(url: string, serviceRoleKey: string) {
    this.broadcastUrl = `${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`;
    this.serviceRoleKey = serviceRoleKey;
  }

  /**
   * Emite un evento al canal privado del tenant via HTTP (service_role).
   * El service_role ignora el RLS para emitir; los clientes solo RECIBEN si su
   * token los autoriza en 'tenant:<id>' (politica RLS de realtime.messages).
   */
  async publish(tenantId: string, event: ParkEvent): Promise<void> {
    const res = await fetch(this.broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: `tenant:${tenantId}`, event: BROADCAST_EVENT, payload: event, private: true },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.error(
        'Fallo al emitir broadcast a Supabase Realtime',
        new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`),
        { tenantId, eventId: event.event_id },
      );
      throw new Error(`Supabase broadcast HTTP ${res.status}`);
    }
  }

  /**
   * No aplica server-side: en este modelo los clientes se suscriben directo a
   * Supabase Realtime. Se deja explicito para evitar usos incorrectos.
   */
  subscribe(_tenantId: string, _listener: (event: ParkEvent) => void): () => void {
    throw new Error(
      'SupabaseRealtimeEventBus es solo de emision: los clientes se suscriben directo a Supabase Realtime',
    );
  }
}
