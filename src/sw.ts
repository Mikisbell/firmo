/**
 * FIRMO POS - Service Worker (Serwist)
 * 
 * Estrategias de cache profesionales:
 * - Precaching automático de assets con hash
 * - Network-first para páginas (evita cache stale)
 * - Cache-first para assets estáticos
 * - Fallback offline dedicado
 */

/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            matcher: ({ url }) => url.pathname === "/pos-shell",
            handler: new NetworkFirst({
                cacheName: 'pos-shell-cache',
            }),
        },
        ...defaultCache,
    ],
    fallbacks: {
        entries: [
            {
                url: "/pos-shell",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();

// ============ PUSH NOTIFICATIONS ============

interface NotificationPayload {
    type: 'ITEM_READY' | 'REQUEST_CHECK' | 'TEST';
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data: {
        order_id: string;
        table_number?: string;
        station?: string;
        url?: string;
    };
    tag?: string;
}

/**
 * Get notification actions based on type
 */
function getActionsForType(type: string): Array<{ action: string; title: string }> {
    switch (type) {
        case 'ITEM_READY':
            return [
                { action: 'view', title: '👀 Ver Mesa' },
                { action: 'dismiss', title: '✕ Cerrar' }
            ];
        case 'REQUEST_CHECK':
            return [
                { action: 'view', title: '💰 Abrir Cuenta' },
                { action: 'dismiss', title: '✕ Cerrar' }
            ];
        default:
            return [];
    }
}

// Push event handler
self.addEventListener("push", (event: PushEvent) => {
    if (!event.data) return;

    let payload: NotificationPayload;
    try {
        payload = event.data.json();
    } catch {
        console.error('[SW] Invalid push payload');
        return;
    }

    const options: NotificationOptions & { vibrate?: number[]; actions?: Array<{ action: string; title: string }>; requireInteraction?: boolean } = {
        body: payload.body || 'Nueva notificación',
        icon: payload.icon || '/images/android-chrome-192x192.png',
        badge: payload.badge || '/images/favicon-32x32.png',
        tag: payload.tag || payload.type,
        data: payload.data || {},
        vibrate: [200, 100, 200],
        actions: getActionsForType(payload.type),
        // REQUEST_CHECK requires interaction (don't auto-dismiss)
        requireInteraction: payload.type === 'REQUEST_CHECK',
    };

    event.waitUntil(
        self.registration.showNotification(payload.title || 'FIRMO POS', options)
    );

    console.log(`[SW] Push notification shown: ${payload.type}`);
});

// Notification click handler
self.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close();

    const notifData = event.notification.data as { url?: string; order_id?: string } | undefined;
    const action = event.action;

    // Handle dismiss action
    if (action === 'dismiss') {
        return;
    }

    // Determine URL to open
    const urlToOpen = notifData?.url || '/mozo';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to find an existing window with /mozo or /caja
            for (const client of clientList) {
                const clientUrl = new URL(client.url);
                if ((clientUrl.pathname.startsWith('/mozo') || clientUrl.pathname.startsWith('/caja')) && 'focus' in client) {
                    // Navigate existing window to the target URL
                    return (client as WindowClient).navigate(urlToOpen).then(c => c?.focus());
                }
            }
            // No existing window found, open new one
            return self.clients.openWindow(urlToOpen);
        })
    );

    console.log(`[SW] Notification clicked: action=${action}, url=${urlToOpen}`);
});

// Background sync
interface SyncEvent extends ExtendableEvent {
    tag: string;
}

self.addEventListener("sync", (event: SyncEvent) => {
    if (event.tag === "sync-events") {
        event.waitUntil(notifyClientsToSync());
    }
});

async function notifyClientsToSync(): Promise<void> {
    const clientList = await self.clients.matchAll();
    clientList.forEach((client) => {
        client.postMessage({ type: "SYNC_REQUESTED" });
    });
}

console.log("[SW] Serwist Service Worker v2 loaded");
