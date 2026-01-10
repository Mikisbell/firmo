/**
 * Notification Event Listener
 * Conecta el Event Bus con los handlers de notificaciones
 * 
 * Este módulo se importa en el servidor para registrar los listeners
 * que disparan notificaciones push cuando ocurren eventos relevantes.
 * 
 * Requirements: 5.1, 6.1
 */

import { eventBus } from '@/src/core/infra/event-bus';
import { logger } from '@/src/core/observability/logger';
import { handleItemReady, handleRequestCheck } from './event-handlers';
import { invalidateCache as invalidateAnalyticsCache } from '@/src/core/analytics/analytics.service';
import type { ParkEvent } from '@/src/core/domain/events';

// Track registered tenants to avoid duplicate listeners
const registeredTenants = new Set<string>();

/**
 * Register notification handlers for a tenant
 * Safe to call multiple times - will only register once per tenant
 */
export function registerNotificationHandlers(tenantId: string): void {
  if (registeredTenants.has(tenantId)) {
    return;
  }

  const unsubscribe = eventBus.subscribe(tenantId, async (event: ParkEvent) => {
    try {
      await handleEvent(event);
    } catch (err) {
      logger.error(
        'NOTIFICATION_HANDLER_ERROR', 
        'Error handling event for notifications', 
        err instanceof Error ? err : new Error(String(err)),
        {
          event_type: event.event_type,
          event_id: event.event_id,
        }
      );
    }
  });

  registeredTenants.add(tenantId);
  
  logger.info('NOTIFICATION_HANDLERS_REGISTERED', 'Notification handlers registered for tenant', {
    tenantId,
  });

  // Store unsubscribe function for cleanup (if needed)
  (globalThis as Record<string, unknown>)[`notif_unsub_${tenantId}`] = unsubscribe;
}

/**
 * Route event to appropriate handler
 */
async function handleEvent(event: ParkEvent): Promise<void> {
  // Invalidate analytics cache on payment events
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
      
      // Only handle transitions to READY
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
}

/**
 * Unregister handlers for a tenant (for testing/cleanup)
 */
export function unregisterNotificationHandlers(tenantId: string): void {
  const unsubscribe = (globalThis as Record<string, unknown>)[`notif_unsub_${tenantId}`];
  if (typeof unsubscribe === 'function') {
    unsubscribe();
    delete (globalThis as Record<string, unknown>)[`notif_unsub_${tenantId}`];
  }
  registeredTenants.delete(tenantId);
}

/**
 * Check if handlers are registered for a tenant
 */
export function isRegistered(tenantId: string): boolean {
  return registeredTenants.has(tenantId);
}
