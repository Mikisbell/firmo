"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useTableStatus, TableStatus, TableInfo } from "../hooks/useTableStatus";
import { useWaiterNotifications, WaiterNotification } from "../hooks/useWaiterNotifications";

interface WaiterContextValue {
    // Tables — mapa table_id -> TableInfo (consumido por mozo/mesa via tableState[tableId])
    tableState: Record<string, TableInfo>;
    // Notifications
    readyItemNotifs: WaiterNotification[];
    checkNotifs: WaiterNotification[];
    readSet: Set<string>;
    markAsRead: (id: string) => void;
    // Aggregated state
    activeTablesCount: number;
    totalAlertsCount: number;
}

const WaiterContext = createContext<WaiterContextValue | undefined>(undefined);

export function WaiterContextProvider({ children }: { children: ReactNode }) {
    const tableState = useTableStatus();
    const { readyItemNotifs, checkNotifs, readSet, markAsRead } = useWaiterNotifications();

    const activeTablesCount = Object.values(tableState).filter(
        (t) => t.status !== "FREE"
    ).length;

    const unreadReady = readyItemNotifs.filter((n) => !readSet.has(n.id)).length;
    const unreadCheck = checkNotifs.filter((n) => !readSet.has(n.id)).length;
    const totalAlertsCount = unreadReady + unreadCheck;

    return (
        <WaiterContext.Provider
            value={{
                tableState,
                readyItemNotifs,
                checkNotifs,
                readSet,
                markAsRead,
                activeTablesCount,
                totalAlertsCount,
            }}
        >
            {children}
        </WaiterContext.Provider>
    );
}

export function useWaiterContext() {
    const context = useContext(WaiterContext);
    if (!context) {
        throw new Error("useWaiterContext must be used within a WaiterContextProvider");
    }
    return context;
}
