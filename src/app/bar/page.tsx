"use client";

/**
 * Bar KDS Page - Kitchen Display System for Bar
 * Refactored for mobile responsiveness
 * 
 * Task 12 - Mobile Responsive Spec
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { useKitchenTicketsByGroup } from "../cocina/hooks/useKitchenTickets";
import { useState, useEffect, useMemo } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Beer, GlassWater } from "lucide-react";
import { useSyncClient } from "@/src/hooks/useSyncClient";
import { type ItemStatus } from "@/src/core/domain/events";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";
import { KDSLayout, KDSTicket } from "@/src/components/kds";

const config = getTerminalConfig("SPC_BAR");

export default function BarKDSPage() {
    // CRÍTICO: Iniciar SyncClient para recibir eventos en tiempo real vía SSE
    useSyncClient();
    
    const tickets = useKitchenTicketsByGroup("BAR");
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
            "BAR"
        );
    };

    // Optimización: Combinar dos reduce+filter en una sola iteración con useMemo
    // Reduce complejidad de O(2n*m) a O(n*m) y evita re-cálculo en renders sin cambios
    const { pendingCount, preparingCount } = useMemo(() => {
        let pending = 0;
        let preparing = 0;
        
        for (const ticket of tickets) {
            for (const line of Object.values(ticket.lines)) {
                if (line.status === "PENDING") pending++;
                else if (line.status === "COOKING") preparing++;
            }
        }
        
        return { pendingCount: pending, preparingCount: preparing };
    }, [tickets]);

    const currentTime = mounted && now 
        ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '--:--';

    return (
        <KDSLayout
            title="BAR"
            subtitle="Bebidas • Jugos • Chicha"
            icon={Beer}
            accentColor="sky"
            pendingCount={pendingCount}
            cookingCount={preparingCount}
            pendingLabel="Pendiente"
            cookingLabel="Preparando"
            currentTime={currentTime}
            emptyIcon={GlassWater}
            emptyTitle="Bar Listo"
            emptySubtitle="Esperando bebidas..."
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
                    accentColor="sky"
                    cookingIcon={Beer}
                    onItemClick={handleStatusClick}
                />
            ))}
        </KDSLayout>
    );
}
