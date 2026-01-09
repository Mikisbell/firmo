// src/core/sync/useSyncStatus.ts
// Hook para monitorear el estado de sincronización

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";
import { useState, useEffect } from "react";

export type SyncState = "synced" | "syncing" | "pending" | "error" | "offline";

export function useSyncStatus() {
    const [syncState, setSyncState] = useState<SyncState>("synced");
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

    // Contar eventos pendientes de sincronizar
    const pendingCount = useLiveQuery(async () => {
        const db = getDb();
        if (!db) return 0;
        
        // Eventos con synced = 0 están pendientes
        return await db.events
            .where("synced")
            .equals(0)
            .count();
    }, []) ?? 0;

    // Actualizar estado basado en pendingCount
    useEffect(() => {
        if (pendingCount > 0) {
            setSyncState("pending");
        } else {
            setSyncState("synced");
            setLastSyncAt(new Date());
        }
    }, [pendingCount]);

    // Escuchar eventos de conexión
    useEffect(() => {
        const handleOnline = () => {
            if (pendingCount > 0) {
                setSyncState("pending");
            }
        };
        
        const handleOffline = () => {
            setSyncState("offline");
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Check initial state
        if (!navigator.onLine) {
            setSyncState("offline");
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [pendingCount]);

    return {
        syncState,
        pendingCount,
        lastSyncAt,
        isOnline: navigator.onLine,
        isSynced: syncState === "synced",
        hasPending: pendingCount > 0,
    };
}
