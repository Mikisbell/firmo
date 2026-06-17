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

  // REQUEST_CHECK notifications & Phantom item filter — still from Dexie (offline-first)
  const events = useLiveQuery(async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return db.events
        .where('aggregate_type').equals('ORDER')
        .filter(ev => ev.occurred_at >= yesterday)
        .toArray() as Promise<ParkEvent[]>;
  }, []);

  const [checkNotifs, setCheckNotifs] = useState<WaiterNotification[]>([]);
  const [localDoneItems, setLocalDoneItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!events) return;
    const now = Date.now();
    const notifs: WaiterNotification[] = [];
    const doneItems = new Set<string>();

    const orderData = new Map<string, {
      tableNumber?: string;
      totalCents: number;
      lastRequestCheck?: ParkEvent;
      acknowledged: boolean;
    }>();

    // Single pass (O(N)) to build order data and find requests
    for (const ev of events) {
      if (!orderData.has(ev.aggregate_id)) {
        orderData.set(ev.aggregate_id, { totalCents: 0, acknowledged: false });
      }
      const data = orderData.get(ev.aggregate_id)!;

      if (ev.event_type === 'ORDER_CREATED') {
        const p = ev.payload as any;
        if (p.fulfillment?.table_number) {
          data.tableNumber = p.fulfillment.table_number;
        }
      } else if (ev.event_type === 'ORDER_ITEM_ADDED') {
        const p = ev.payload as any;
        if (p.line) {
          data.totalCents += p.line.qty * p.line.unit_price_cents;
        }
      } else if (ev.event_type === 'ORDER_ITEM_STATUS_CHANGED') {
         const p = ev.payload as any;
         if (p.to === 'DONE') {
             doneItems.add(`${p.order_id}-${p.line_id}`);
         }
      } else if (ev.event_type === 'REQUEST_CHECK') {
        const p = ev.payload as any;
        if (p.table_number && !data.tableNumber) {
          data.tableNumber = p.table_number;
        }
        data.lastRequestCheck = ev;
        data.acknowledged = false;
      } else if (ev.event_type === 'CHECK_REQUEST_ACKNOWLEDGED' || ev.event_type === 'CHECK_MARKED_PAID') {
        data.acknowledged = true;
      }
    }

    setLocalDoneItems(doneItems);

    // Build notifications for unacknowledged requests within window
    for (const [orderId, data] of orderData.entries()) {
      if (data.lastRequestCheck && !data.acknowledged) {
        const evTime = new Date(data.lastRequestCheck.occurred_at).getTime();
        if (now - evTime <= NOTIFICATION_WINDOW_MS) {
          const tableNumber = data.tableNumber ?? 'N/A';
          notifs.push({
            id: `request-check-${orderId}`,
            type: 'REQUEST_CHECK',
            orderId,
            tableNumber,
            title: `Cuenta solicitada — Mesa ${tableNumber}`,
            message: `Total: S/ ${(data.totalCents / 100).toFixed(2)}`,
            timestamp: new Date(data.lastRequestCheck.occurred_at),
            read: false,
            totalCents: data.totalCents,
          });
        }
      }
    }

    setCheckNotifs(notifs);
  }, [events]);

  // Filter out phantom items that were marked as DONE locally but API still returns
  const filteredReadyItems = readyItemNotifs.filter(n => !localDoneItems.has(`${n.orderId}-${n.lineId}`));

  // Merge both sources; apply local readSet to mark dismissed items
  const notifications: WaiterNotification[] = [
    ...filteredReadyItems.map(n => ({ ...n, read: readSet.has(n.id) })),
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
    readyItemNotifs: filteredReadyItems,
    checkNotifs,
    readSet,
    unreadCount,
    readyItemsCount,
    markAsRead,
    markAllAsRead,
    clearRead,
    refreshReadyItems,
  };
}
