"use client";

/**
 * Cocina KDS Page - Kitchen Display System
 * Refactored for mobile responsiveness
 * 
 * Task 12 - Mobile Responsive Spec
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { useKitchenTicketsByGroup } from "./hooks/useKitchenTickets";
import { useState, useEffect } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { UtensilsCrossed, ChefHat } from "lucide-react";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { type ItemStatus } from "@/src/core/domain/events";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";
import { KDSLayout, KDSTicket } from "@/src/components/kds";

const config = getTerminalConfig("SPC_COCINA");

export default function CocinaKDSPage() {
    // Cocina muestra: COCINA, FRIOS, POSTRES, FREIDORA (usando grupo centralizado)
    const tickets = useKitchenTicketsByGroup("COCINA");
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
            "COCINA"
        );
    };

    const pendingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "PENDING").length, 0);
    const cookingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "COOKING").length, 0);

    const currentTime = mounted && now 
        ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '--:--';

    // Mostrar loading mientras verifica autenticación
    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <KDSLayout
            title="COCINA"
            subtitle="Papas • Arroz • Guarniciones"
            icon={ChefHat}
            accentColor="amber"
            pendingCount={pendingCount}
            cookingCount={cookingCount}
            pendingLabel="Pendiente"
            cookingLabel="Cocinando"
            currentTime={currentTime}
            emptyIcon={UtensilsCrossed}
            emptyTitle="Cocina Lista"
            emptySubtitle="Esperando pedidos..."
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
                    accentColor="amber"
                    cookingIcon={UtensilsCrossed}
                    onItemClick={handleStatusClick}
                />
            ))}
        </KDSLayout>
    );
}
