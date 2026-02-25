"use client";

/**
 * Cocina KDS Page - Kitchen Display System
 * Refactored for mobile responsiveness
 * 
 * Task 12 - Mobile Responsive Spec
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { useKitchenTicketsByGroup } from "./hooks/useKitchenTickets";
import { useState, useEffect, useMemo, useCallback } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { UtensilsCrossed, ChefHat } from "lucide-react";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { useAuth } from "@/src/components/auth";
import { useSyncClient } from "@/src/hooks/useSyncClient";
import { type ItemStatus } from "@/src/core/domain/events";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { useRouter } from "next/navigation";
import { EmployeeProfileButton } from "@/src/components/shared/EmployeeProfileButton";
import { EmployeeProfileDrawer } from "@/src/components/shared/EmployeeProfileDrawer";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";
import { KDSLayout, KDSTicket, CourseFireBar } from "@/src/components/kds";
import { CourseFireService, type CourseStatusReport } from "@/src/core/services/course-fire.service";

const config = getTerminalConfig("SPC_COCINA");

export default function CocinaKDSPage() {
    // CRÍTICO: Iniciar SyncClient para recibir eventos en tiempo real vía SSE
    useSyncClient();

    // Cocina muestra: COCINA, FRIOS, POSTRES, FREIDORA (usando grupo centralizado)
    const tickets = useKitchenTicketsByGroup("COCINA");
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const { session, terminal, logout: authLogout } = useAuth();
    const router = useRouter();
    const [profileOpen, setProfileOpen] = useState(false);

    const handleLogout = useCallback(() => {
        clearTerminalConfig();
        authLogout();
        router.push("/");
    }, [authLogout, router]);

    const [now, setNow] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [courseReport, setCourseReport] = useState<CourseStatusReport | null>(null);

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

    // Build course report for selected order (client-side, pure function)
    const selectedTicket = useMemo(() => {
        if (!selectedOrderId) return null;
        return tickets.find(t => t.order_id === selectedOrderId) || null;
    }, [selectedOrderId, tickets]);

    useMemo(() => {
        if (!selectedTicket) {
            setCourseReport(null);
            return;
        }
        const items = Object.values(selectedTicket.lines).map((line: any) => ({
            line_id: line.line_id,
            name: line.name,
            qty: line.qty,
            station: line.station || 'COCINA',
            status: line.status,
            course: line.course,
            held: line.held,
        }));
        // Only show CourseFireBar if there are items with courses
        const hasCourses = items.some(i => i.course);
        if (!hasCourses) {
            setCourseReport(null);
            return;
        }
        const svc = new CourseFireService(null as any);
        setCourseReport(svc.buildCourseReport(selectedTicket.order_id, items));
    }, [selectedTicket]);

    const handleFireCourse = useCallback(async (orderId: string, course: number) => {
        const res = await fetch(`/api/admin/orders/${orderId}/courses/fire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ course }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al disparar tiempo');
        }
    }, []);

    // Optimización: Combinar dos reduce+filter en una sola iteración con useMemo
    // Reduce complejidad de O(2n*m) a O(n*m) y evita re-cálculo en renders sin cambios
    const { pendingCount, cookingCount } = useMemo(() => {
        let pending = 0;
        let cooking = 0;
        
        for (const ticket of tickets) {
            for (const line of Object.values(ticket.lines)) {
                if (line.status === "PENDING") pending++;
                else if (line.status === "COOKING") cooking++;
            }
        }
        
        return { pendingCount: pending, cookingCount: cooking };
    }, [tickets]);

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
        <>
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
                employeeSlot={session && (
                    <>
                        <EmployeeProfileButton
                            employeeName={session.employee_name}
                            accentColor="amber"
                            onClick={() => setProfileOpen(true)}
                            compact
                        />
                        <EmployeeProfileDrawer
                            isOpen={profileOpen}
                            onClose={() => setProfileOpen(false)}
                            employeeName={session.employee_name}
                            employeeRole={session.employee_role}
                            terminalId={terminal?.terminal_id ?? config.terminal_id}
                            terminalRole={session.terminal_role}
                            sessionCreatedAt={session.created_at}
                            accentColor="amber"
                            onLogout={handleLogout}
                        />
                    </>
                )}
            >
                {tickets.map(ticket => (
                    <div
                        key={ticket.order_id}
                        onClick={() => setSelectedOrderId(
                            selectedOrderId === ticket.order_id ? null : ticket.order_id
                        )}
                        className={`cursor-pointer rounded-2xl ${
                            selectedOrderId === ticket.order_id
                                ? 'ring-2 ring-cyan-400/60'
                                : ''
                        }`}
                    >
                        <KDSTicket
                            orderId={ticket.order_id}
                            orderNumber={ticket.order_number}
                            orderType={ticket.order_type as "DINE_IN" | "DELIVERY" | "TAKEOUT"}
                            items={Object.values(ticket.lines).map((line: any) => ({
                                line_id: line.line_id,
                                name: line.name,
                                qty: line.qty,
                                status: line.status,
                                course: line.course,
                                held: line.held,
                            }))}
                            accentColor="amber"
                            cookingIcon={UtensilsCrossed}
                            onItemClick={handleStatusClick}
                        />
                    </div>
                ))}
            </KDSLayout>
            {courseReport && (
                <CourseFireBar report={courseReport} onFire={handleFireCourse} />
            )}
        </>
    );
}
