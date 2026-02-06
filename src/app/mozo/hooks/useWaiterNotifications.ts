/**
 * Hook para gestionar notificaciones del mesero en tiempo real
 * Escucha eventos de items listos y solicitudes de cuenta
 */

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/core/db/schema';
import { ParkEvent } from '@/src/core/domain/events';

export interface WaiterNotification {
  id: string;
  type: 'ITEM_READY' | 'REQUEST_CHECK';
  orderId: string;
  tableNumber: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  station?: string;
  itemName?: string;
  totalCents?: number;
}

/**
 * Hook para obtener notificaciones del mesero en tiempo real
 * Reconstruye notificaciones desde eventos en IndexedDB
 */
export function useWaiterNotifications() {
  const [notifications, setNotifications] = useState<WaiterNotification[]>([]);

  // Escuchar eventos relevantes desde IndexedDB
  const events = useLiveQuery(async () => {
    const allEvents = await db.events
      .where('aggregate_type')
      .equals('ORDER')
      .toArray() as ParkEvent[];

    // No filtrar aquí - necesitamos todos los eventos para reconstruir el estado
    return allEvents;
  }, []);

  // Reconstruir notificaciones desde eventos
  useEffect(() => {
    if (!events) return;

    const notifs: WaiterNotification[] = [];
    const now = Date.now();
    const NOTIFICATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutos

    // Agrupar items listos por orden
    const readyItemsByOrder = new Map<string, Array<{
      itemId: string;
      itemName: string;
      station: string;
      timestamp: Date;
    }>>();

    for (const ev of events) {
      const eventTime = new Date(ev.occurred_at).getTime();
      
      // Solo mostrar notificaciones de los últimos 30 minutos
      if (now - eventTime > NOTIFICATION_WINDOW_MS) continue;

      if (ev.event_type === 'ORDER_ITEM_STATUS_CHANGED') {
        const payload = ev.payload as {
          order_id: string;
          line_id: string;
          from: string;
          to: string;
          item_name?: string;
          station?: string;
        };

        // Solo items que cambiaron a READY
        if (payload.to !== 'READY') continue;

        const orderId = payload.order_id;
        if (!readyItemsByOrder.has(orderId)) {
          readyItemsByOrder.set(orderId, []);
        }

        readyItemsByOrder.get(orderId)!.push({
          itemId: payload.line_id,
          itemName: payload.item_name || 'Item',
          station: payload.station || 'COCINA',
          timestamp: new Date(ev.occurred_at),
        });
      }
    }

    // Crear notificaciones agrupadas de items listos
    for (const [orderId, items] of readyItemsByOrder.entries()) {
      // Obtener número de mesa desde el primer evento
      const orderEvent = events.find(ev => {
        const p = ev.payload as { order_id?: string };
        return p.order_id === orderId && ev.event_type === 'ORDER_CREATED';
      });

      if (!orderEvent) continue;

      const orderPayload = orderEvent.payload as {
        fulfillment?: { table_number?: string };
      };
      const tableNumber = orderPayload.fulfillment?.table_number || 'N/A';

      // Agrupar por estación
      const stations = [...new Set(items.map(i => i.station))];
      const itemNames = items.map(i => i.itemName);
      const latestTimestamp = items.reduce((latest, item) => 
        item.timestamp > latest ? item.timestamp : latest, 
        items[0].timestamp
      );

      const message = items.length === 1
        ? `${itemNames[0]} está listo`
        : `${items.length} items listos: ${itemNames.slice(0, 2).join(', ')}${items.length > 2 ? '...' : ''}`;

      notifs.push({
        id: `item-ready-${orderId}`,
        type: 'ITEM_READY',
        orderId,
        tableNumber,
        title: `🍽️ Mesa ${tableNumber}`,
        message,
        timestamp: latestTimestamp,
        read: false,
        station: stations.join(', '),
        itemName: itemNames[0],
      });
    }

    // Crear notificaciones de solicitud de cuenta
    for (const ev of events) {
      if (ev.event_type !== 'REQUEST_CHECK') continue;

      const eventTime = new Date(ev.occurred_at).getTime();
      if (now - eventTime > NOTIFICATION_WINDOW_MS) continue;

      const payload = ev.payload as {
        order_id: string;
        table_id?: string;
      };

      // Buscar el evento ORDER_CREATED para obtener detalles
      const orderEvent = events.find(e => {
        const p = e.payload as { order_id?: string };
        return p.order_id === payload.order_id && e.event_type === 'ORDER_CREATED';
      });

      if (!orderEvent) continue;

      const orderPayload = orderEvent.payload as {
        fulfillment?: { table_number?: string };
      };
      const tableNumber = orderPayload.fulfillment?.table_number || payload.table_id || 'N/A';

      // Calcular total desde eventos ORDER_ITEM_ADDED
      let totalCents = 0;
      for (const itemEv of events) {
        if (itemEv.event_type === 'ORDER_ITEM_ADDED') {
          const itemPayload = itemEv.payload as {
            order_id: string;
            line?: { qty: number; unit_price_cents: number };
          };
          if (itemPayload.order_id === payload.order_id && itemPayload.line) {
            totalCents += itemPayload.line.qty * itemPayload.line.unit_price_cents;
          }
        }
      }

      notifs.push({
        id: `request-check-${payload.order_id}`,
        type: 'REQUEST_CHECK',
        orderId: payload.order_id,
        tableNumber,
        title: `💳 Cuenta solicitada - Mesa ${tableNumber}`,
        message: `Total: S/ ${(totalCents / 100).toFixed(2)}`,
        timestamp: new Date(ev.occurred_at),
        read: false,
        totalCents,
      });
    }

    // Ordenar por timestamp descendente (más recientes primero)
    notifs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setNotifications(notifs);
  }, [events]);

  // Marcar notificación como leída
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Limpiar notificaciones leídas
  const clearRead = useCallback(() => {
    setNotifications(prev => prev.filter(n => !n.read));
  }, []);

  // Contar no leídas
  const unreadCount = notifications.filter(n => !n.read).length;

  // Contar items listos no leídos
  const readyItemsCount = notifications.filter(
    n => n.type === 'ITEM_READY' && !n.read
  ).length;

  return {
    notifications,
    unreadCount,
    readyItemsCount,
    markAsRead,
    markAllAsRead,
    clearRead,
  };
}
