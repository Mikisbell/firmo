"use client";

/**
 * Empaque KDS Page - Packaging and Delivery Station
 * Shows orders ready for packaging and delivery
 * 
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { useKitchenTicketsByGroup } from "../hooks/useKitchenTickets";
import { useState, useEffect, useMemo } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Package, PackageCheck } from "lucide-react";
import { useSyncClient } from "@/src/hooks/useSyncClient";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { type ItemStatus } from "@/src/core/domain/events";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";
import { KDSLayout, KDSTicket } from "@/src/components/kds";

const config = getTerminalConfig("SPC_EMPAQUE");

export default function EmpaqueKDSPage() {
    // CRÍTICO: Iniciar SyncClient para recibir eventos en tiempo real vía SSE
    useSyncClient();
    
    // Empaque muestra solo items de EMPAQUE station
    const tickets = useKitchenTicketsByGroup("EMPAQUE");
    const { isLoading, isAuthenticated } = useRequireTerminal();
    
    const [now, setNow] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setNow(Date.now());
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [mounted]);

    const handleStatusClick = async (orderId: string, lineId: string, currentStatus: ItemStatus) => {
        const nextStatus = getNextNormalState(currentStatus);
        if (!nextStatus || !canTransition(currentStatus, nextStatus)) return;

        await POSActions.updateItemStatus(
            config.tenant_id, 
            config.terminal_id, 
            config.actor_id, 
            orderId, 
            lineId, 
            currentStatus, 
            nextStatus, 
            "EMPAQUE"
        );
    };

    // Optimización: Combinar dos reduce+filter en una sola iteración con useMemo
    // Reduce complejidad de O(2n*m) a O(n*m) y evita re-cálculo en renders sin cambios
    const { pendingCount, packagingCount } = useMemo(() => {
        let pending = 0;
        let packaging = 0;
        
        for (const ticket of tickets) {
            for (const line of Object.values(ticket.lines)) {
                if (line.status === "PENDING") pending++;
                else if (line.status === "COOKING") packaging++;
            }
        }
        
        return { pendingCount: pending, packagingCount: packaging };
    }, [tickets]);

    const currentTime = mounted && now 
        ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '--:--';

    // Mostrar loading mientras verifica autenticación
    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <KDSLayout
            title="EMPAQUE"
            subtitle="Empacar • Verificar • Delivery"
            icon={Package}
            accentColor="emerald"
            pendingCount={pendingCount}
            cookingCount={packagingCount}
            pendingLabel="Por Empacar"
            cookingLabel="Empacando"
            currentTime={currentTime}
            emptyIcon={PackageCheck}
            emptyTitle="Todo Empacado"
            emptySubtitle="Esperando pedidos para empacar..."
            hasTickets={tickets.length > 0}
        >
            {tickets.map(ticket => (
                <KDSTicket
                    key={ticket.order_id}
                    orderId={ticket.order_id}
                    orderNumber={ticket.order_number}
                    orderType={ticket.order_type as "DINE_IN" | "DELIVERY" | "TAKEOUT"}
                    items={Object.values(ticket.lines).map(line => ({
                        line_id: line.line_id,
                        name: line.name,
                        qty: line.qty,
                        status: line.status,
                    }))}
                    accentColor="emerald"
                    cookingIcon={Package}
                    onItemClick={handleStatusClick}
                />
            ))}
        </KDSLayout>
    );
}
