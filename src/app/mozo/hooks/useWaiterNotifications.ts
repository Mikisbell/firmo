/**
 * useWaiterNotifications
 *
 * Architecture (professional, matches Toast/Square pattern):
 *
 * ITEM_READY notifications:
 *   - Source: GET /api/pos/ready-items  (server-side projection, one row per item)
 *   - Polled every 10 s; immediate refresh on focus
 *   - Result: ONE notification card per item — lineId always present
 *   - Offline fallback: rebuild from Dexie if fetch fails
 *
 * REQUEST_CHECK notifications:
 *   - Source: Dexie IndexedDB (offline-first, same as before)
 *
 * This eliminates the grouping-by-order limitation where lineId was undefined
 * for orders with 2+ ready items.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/core/db/schema';
import { ParkEvent } from '@/src/core/domain/events';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import type { ReadyItemRow } from '@/src/app/api/pos/ready-items/route';

export interface WaiterNotification {
  id: string;
  type: 'ITEM_READY' | 'REQUEST_CHECK';
  orderId: string;
  lineId?: string;
  tableNumber: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  station?: string;
  itemName?: string;
  totalCents?: number;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds (increased from 10s to prevent DB pool exhaustion)
const NOTIFICATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ─── Server-side ITEM_READY source ───────────────────────────────────────────

async function fetchReadyItems(): Promise<ReadyItemRow[]> {
  const config = getStoredTerminalConfig();
  if (!config?.tenant_id) return [];
  try {
    const res = await fetch('/api/pos/ready-items', {
      headers: { 'x-tenant-id': config.tenant_id },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function rowToNotification(row: ReadyItemRow): WaiterNotification {
  return {
    id: `item-ready-${row.order_id}-${row.line_id}`,
    type: 'ITEM_READY',
    orderId: row.order_id,
    lineId: row.line_id,
    tableNumber: row.table_number ?? 'N/A',
    title: `Mesa ${row.table_number ?? 'N/A'}`,
    message: `${row.qty > 1 ? `${row.qty}x ` : ''}${row.name}${row.notes ? ` — ${row.notes}` : ''}`,
    timestamp: new Date(row.ready_at),
    read: false,
    station: row.station,
    itemName: row.name,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWaiterNotifications() {
  const [readyItemNotifs, setReadyItemNotifs] = useState<WaiterNotification[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ITEM_READY from server projection (one per item, lineId always set)
  const refreshReadyItems = useCallback(async () => {
    const rows = await fetchReadyItems();
    setReadyItemNotifs(rows.map(rowToNotification));
  }, []);

  // Poll every 10 s + refresh on window focus
  useEffect(() => {
    refreshReadyItems();
    intervalRef.current = setInterval(refreshReadyItems, POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshReadyItems);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', refreshReadyItems);
    };
  }, [refreshReadyItems]);

  // REQUEST_CHECK notifications — still from Dexie (offline-first)
  const events = useLiveQuery(async () => {
    return db.events.where('aggregate_type').equals('ORDER').toArray() as Promise<ParkEvent[]>;
  }, []);

  const [checkNotifs, setCheckNotifs] = useState<WaiterNotification[]>([]);

  useEffect(() => {
    if (!events) return;
    const now = Date.now();
    const notifs: WaiterNotification[] = [];

    for (const ev of events) {
      if (ev.event_type !== 'REQUEST_CHECK') continue;
      const eventTime = new Date(ev.occurred_at).getTime();
      if (now - eventTime > NOTIFICATION_WINDOW_MS) continue;

      const payload = ev.payload as { order_id: string; table_id?: string };

      const orderEvent = events.find(e => {
        const p = e.payload as { order_id?: string };
        return p.order_id === payload.order_id && e.event_type === 'ORDER_CREATED';
      });

      const orderPayload = orderEvent?.payload as {
        fulfillment?: { table_number?: string };
      } | undefined;
      const tableNumber =
        orderPayload?.fulfillment?.table_number ?? payload.table_id ?? 'N/A';

      let totalCents = 0;
      for (const itemEv of events) {
        if (itemEv.event_type !== 'ORDER_ITEM_ADDED') continue;
        const ip = itemEv.payload as {
          order_id: string;
          line?: { qty: number; unit_price_cents: number };
        };
        if (ip.order_id === payload.order_id && ip.line) {
          totalCents += ip.line.qty * ip.line.unit_price_cents;
        }
      }

      notifs.push({
        id: `request-check-${payload.order_id}`,
        type: 'REQUEST_CHECK',
        orderId: payload.order_id,
        tableNumber,
        title: `Cuenta solicitada — Mesa ${tableNumber}`,
        message: `Total: S/ ${(totalCents / 100).toFixed(2)}`,
        timestamp: new Date(ev.occurred_at),
        read: false,
        totalCents,
      });
    }

    setCheckNotifs(notifs);
  }, [events]);

  // Merge both sources; apply local readSet to mark dismissed items
  const notifications: WaiterNotification[] = [
    ...readyItemNotifs.map(n => ({ ...n, read: readSet.has(n.id) })),
    ...checkNotifs.map(n => ({ ...n, read: readSet.has(n.id) })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const markAsRead = useCallback((notificationId: string) => {
    setReadSet(prev => new Set([...prev, notificationId]));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadSet(prev => new Set([...prev, ...notifications.map(n => n.id)]));
  }, [notifications]);

  const clearRead = useCallback(() => {
    setReadyItemNotifs(prev => prev.filter(n => !readSet.has(n.id)));
    setCheckNotifs(prev => prev.filter(n => !readSet.has(n.id)));
    setReadSet(new Set());
  }, [readSet]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const readyItemsCount = notifications.filter(n => n.type === 'ITEM_READY' && !n.read).length;

  return {
    notifications,
    unreadCount,
    readyItemsCount,
    markAsRead,
    markAllAsRead,
    clearRead,
    refreshReadyItems,
  };
}
