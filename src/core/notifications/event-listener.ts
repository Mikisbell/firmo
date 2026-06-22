/**
 * Notification dispatch — enruta cada ParkEvent a sus handlers de notificación
 * push y a la invalidación de cache de analytics.
 *
 * IMPORTANTE (serverless): se invoca INLINE desde el ingest (post-commit), NO
 * vía `eventBus.subscribe()`. El patrón anterior —suscribirse en memoria a PG
 * LISTEN/NOTIFY dentro de un request— NO sobrevive en Cloudflare Workers: el
 * worker que registra el listener no es el que recibe el NOTIFY, así que las
 * notificaciones se perdían en prod. El ingest es el ÚNICO camino de escritura
 * y tiene cada evento, por lo que dispara las notificaciones directo.
 *
 * Requirements: 5.1, 6.1
 */

import { logger } from '@/src/core/observability/logger';
import { handleItemReady, handleRequestCheck } from './event-handlers';
import { invalidateCache as invalidateAnalyticsCache } from '@/src/core/analytics/analytics.service';
import type { ParkEvent } from '@/src/core/domain/events';

/**
 * Enruta un evento a sus handlers de notificación + invalidación de cache.
 *
 * Best-effort: NO debe lanzar hacia el caller (el ingest la invoca post-commit y
 * un fallo de notificación no debe afectar la respuesta del sync). Aun así, los
 * errores internos se loguean para diagnóstico.
 */
export async function dispatchNotifications(event: ParkEvent): Promise<void> {
  try {
    // Invalida cache de analytics en eventos de pago/cambio de estado
    if (event.event_type === 'CHECK_MARKED_PAID' || event.event_type === 'ORDER_ITEM_STATUS_CHANGED') {
      invalidateAnalyticsCache(event.tenant_id);
    }

    switch (event.event_type) {
      case 'ORDER_ITEM_STATUS_CHANGED': {
        const payload = event.payload as {
          order_id?: string;
          item_id?: string;
          line_id?: string;
          from?: string;
          to?: string;
        };

        // Solo notificamos las transiciones a READY
        if (payload.to === 'READY') {
          await handleItemReady({
            type: 'ORDER_ITEM_STATUS_CHANGED',
            payload: {
              order_id: payload.order_id || event.aggregate_id,
              item_id: payload.item_id || payload.line_id || '',
              from: payload.from || '',
              to: payload.to,
            },
            meta: {
              tenant_id: event.tenant_id,
              terminal_id: event.terminal_id,
              timestamp: event.occurred_at,
            },
          });
        }
        break;
      }

      case 'REQUEST_CHECK': {
        const payload = event.payload as {
          order_id?: string;
          table_id?: string;
        };

        await handleRequestCheck({
          type: 'REQUEST_CHECK',
          payload: {
            order_id: payload.order_id || event.aggregate_id,
            table_id: payload.table_id || '',
          },
          meta: {
            tenant_id: event.tenant_id,
            terminal_id: event.terminal_id,
            actor_id: event.actor_id || '',
            timestamp: event.occurred_at,
          },
        });
        break;
      }
    }
  } catch (err) {
    logger.error(
      'NOTIFICATION_HANDLER_ERROR',
      'Error handling event for notifications',
      err instanceof Error ? err : new Error(String(err)),
      {
        event_type: event.event_type,
        event_id: event.event_id,
      },
    );
  }
}
