"use client";

import { compareTablesByPriority } from '@/src/core/utils/table-sort.utils';

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/src/core/constants/roles";
import { useZones, TableStatus } from "./hooks/useTableStatus";
import { useWaiterContext } from "./context/WaiterContext";
import { NotificationPanel } from "./components/NotificationPanel";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { Users, Utensils, Clock, ClipboardList, Wifi, WifiOff, Home, Bell, AlertTriangle, Receipt, Settings } from "lucide-react";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { useAuth } from "@/src/components/auth";
import { EmployeeProfileButton } from "@/src/components/shared/EmployeeProfileButton";
import { EmployeeProfileDrawer } from "@/src/components/shared/EmployeeProfileDrawer";
import { useResponsive } from "@/src/hooks/useResponsive";
import { MobileHeader, HeaderSpacer } from "@/src/components/ui/MobileHeader";

import { PremiumTable } from "@/src/components/ui";
import type { TableStatus as ThemeTableStatus } from "@/src/components/ui/table-theme";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";

export default function WaiterPage() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const { session, terminal, logout: authLogout } = useAuth();
    const { zones: apiZones, loading: zonesLoading } = useZones();
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>("all"); // "all" = todas las zonas
    const { isMobile, isTablet } = useResponsive();
    const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    
    // Hook de contexto global — se invoca UNA sola vez (los hooks no pueden llamarse dentro de callbacks)
    const { tableState, readyItemNotifs, checkNotifs, readSet } = useWaiterContext();
    const unreadCount = checkNotifs.filter(n => !readSet.has(n.id)).length;
    const readyItemsCount = readyItemNotifs.filter(n => !readSet.has(n.id)).length;

    // Use API zones only
    const zones = apiZones;
    
    // Get tables filtered by zone
    const tables = Object.values(tableState).filter(t => 
        selectedZoneId === "all" ? true : t.zone?.id === selectedZoneId
    );

    const tenantSettings = useLiveQuery(
        () => terminal ? db.tenant_settings.get(terminal.tenant_id) : undefined,
        [terminal?.tenant_id]
    );
    const inactivityThresholdMin = tenantSettings?.table_inactivity_threshold_min ?? 15;

    // All hooks MUST be called before any early return (React rules of hooks)
    const handleExit = useCallback(() => {
        clearTerminalConfig();
        authLogout();
        router.push("/login");
    }, [router, authLogout]);

    const handleSimpleLogout = useCallback(() => {
        authLogout();
        router.push("/login");
    }, [router, authLogout]);

    const handleHome = useCallback(() => {
        router.push("/");
    }, [router]);

    const toggleNotificationPanel = useCallback(() => {
        setNotificationPanelOpen(prev => !prev);
    }, []);

    // Mostrar loading mientras verifica autenticación
    if (isLoading || !isAuthenticated || zonesLoading) {
        return (
            <div className="min-h-screen bg-park-gray-950 flex items-center justify-center" data-testid="tables-loading">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-park-gray-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-park-gray-400">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    // Sort tables: Occupied first, then numerically
    const filteredTables = [...tables].sort(compareTablesByPriority);

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const occupiedCount = tables.filter(t => t.status === "OCCUPIED" || t.status === "COOKING" || t.status === "BILL_REQUESTED").length;
    const alertCount = tables.filter(t =>
        ((t.status === "OCCUPIED" || t.status === "COOKING") && (t.elapsedMinutes ?? 0) >= inactivityThresholdMin) ||
        t.status === "BILL_REQUESTED" ||
        t.slaStatus === "SLA_WARNING" ||
        t.slaStatus === "SLA_CRITICAL"
    ).length;
    const readyItemsTotal = tables.reduce((sum, t) => sum + (t.readyItemsCount ?? 0), 0);

    return (
        <div className="min-h-screen bg-park-gray-950 text-park-gray-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/30 via-park-gray-950 to-park-gray-950">
            {/* Mobile Header */}
            {isMobile ? (
                <>
                    <MobileHeader
                        title={(session?.employee_role ? ROLE_LABELS[session.employee_role]?.toUpperCase() : "MOZO") || "MOZO"}
                        subtitle={`${occupiedCount} ocupadas`}
                        variant="colored"
                        colorClass="bg-gradient-to-r from-violet-950/90 to-purple-950/90 border-b-2 border-violet-500"
                        leftAction={
                            <div className="p-2 bg-violet-500/20 rounded-lg">
                                <ClipboardList className="text-violet-400 w-5 h-5" />
                            </div>
                        }
                        rightActions={[
                            session && (
                                <EmployeeProfileButton
                                    key="profile"
                                    employeeName={session.employee_name}
                                    employeeRole={session.employee_role}
                                    accentColor="violet"
                                    onOpenDrawer={() => setProfileOpen(true)}
                                    onLogout={handleSimpleLogout}
                                    compact
                                />
                            ),
                            <button
                                key="notifications"
                                onClick={toggleNotificationPanel}
                                className="relative p-2 bg-violet-500/20 rounded-lg"
                            >
                                <Bell className="text-violet-400 w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>,
                            <div key="sync" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            </div>,
                            alertCount > 0 ? (
                                <div key="alert" className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs">
                                    <AlertTriangle size={14} />
                                    {alertCount}
                                </div>
                            ) : null,
                        ].filter(Boolean)}
                    />
                    <HeaderSpacer />
                </>
            ) : (
                /* Desktop Header - Estilo Morado/Violeta */
                <header className="sticky top-0 z-30 h-20 bg-gradient-to-r from-violet-950/90 to-purple-950/70 backdrop-blur-md border-b-4 border-violet-500 p-4 flex items-center justify-between shadow-[0_4px_20px_rgba(139,92,246,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-500/20 rounded-xl border-2 border-violet-500/50">
                            <ClipboardList className="text-violet-400" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-wider">
                                <span className="text-violet-400 uppercase">{(session?.employee_role ? ROLE_LABELS[session.employee_role] : "MOZO") || "MOZO"}</span>
                                <span className="text-violet-600/60 text-lg ml-2">T-01</span>
                            </h1>
                            <p className="text-violet-300/50 text-xs uppercase tracking-widest">Toma de Pedidos • Mesas</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications Button */}
                        <button
                            onClick={toggleNotificationPanel}
                            className="relative text-center px-4 py-2 bg-violet-950/50 rounded-lg border border-violet-500/30 hover:bg-violet-900/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Bell size={20} className="text-violet-400" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/50">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                        </button>

                        {/* Ready Items Counter */}
                        {readyItemsCount > 0 && (
                            <div className="text-center px-4 py-2 bg-emerald-950/50 rounded-lg border border-emerald-500/30 animate-pulse">
                                <div className="text-xl font-black text-emerald-400 flex items-center gap-1">
                                    <Bell size={16} />
                                    {readyItemsCount}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-emerald-300/60">Listos</div>
                            </div>
                        )}

                        {/* Alert Counter */}
                        {alertCount > 0 && (
                            <div className="text-center px-4 py-2 bg-amber-950/50 rounded-lg border border-amber-500/30">
                                <div className="text-xl font-black text-amber-400 flex items-center gap-1">
                                    <AlertTriangle size={16} />
                                    {alertCount}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-amber-300/60">Atención</div>
                            </div>
                        )}

                        {/* Tables Counter */}
                        <div className="text-center px-4 py-2 bg-violet-950/50 rounded-lg border border-violet-500/30">
                            <div className="text-xl font-black text-violet-400">{occupiedCount}</div>
                            <div className="text-[10px] uppercase tracking-wider text-violet-300/60">Ocupadas</div>
                        </div>

                        {/* Sync Indicator */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                            <span className="text-xs font-bold uppercase tracking-wider">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
                        </div>

                        {/* Employee Profile Button */}
                        {session && (
                            <EmployeeProfileButton
                                employeeName={session.employee_name}
                                employeeRole={session.employee_role}
                                accentColor="violet"
                                onOpenDrawer={() => setProfileOpen(true)}
                                onLogout={handleSimpleLogout}
                            />
                        )}

                        {/* Home Button */}
                        <button
                            onClick={handleHome}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-park-gray-800/50 hover:bg-park-gray-700 text-park-gray-400 hover:text-white transition-colors border border-park-gray-700"
                            title="Ir al inicio"
                        >
                            <Home size={18} />
                        </button>
                    </div>
                </header>
            )}

            <div className="p-3 md:p-4 space-y-4 md:space-y-6 pb-20 md:pb-6">
                {/* Zone Selector - Horizontal scroll on mobile */}
                <div className="flex bg-park-gray-900/50 p-1 md:p-1.5 rounded-xl md:rounded-2xl overflow-x-auto gap-1 md:gap-2 border border-violet-500/20 scrollbar-hide">
                    {/* "Todas" option */}
                    <button
                        onClick={() => setSelectedZoneId("all")}
                        className="relative flex-shrink-0 md:flex-1 py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all outline-none min-w-[60px] md:min-w-[80px]"
                    >
                        {selectedZoneId === "all" && (
                            <motion.div
                                layoutId="zone-bg"
                                className="absolute inset-0 bg-gradient-to-r from-park-gray-600 to-park-gray-700 rounded-lg md:rounded-xl shadow-lg shadow-park-gray-900/40"
                                initial={false}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className={`relative z-10 ${selectedZoneId === "all" ? "text-white" : "text-park-gray-400"}`}>
                            Todas
                        </span>
                    </button>
                    {zones.map((zone) => (
                        <button
                            key={zone.id}
                            onClick={() => setSelectedZoneId(zone.id)}
                            className="relative flex-shrink-0 md:flex-1 py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all outline-none min-w-[60px]"
                        >
                            {selectedZoneId === zone.id && (
                                <motion.div
                                    layoutId="zone-bg"
                                    className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg md:rounded-xl shadow-lg shadow-violet-900/40"
                                    initial={false}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className={`relative z-10 ${selectedZoneId === zone.id ? "text-white" : "text-park-gray-400"}`}>
                                {zone.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Empty State */}
                {tables.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-16 h-16 bg-park-gray-800 rounded-full flex items-center justify-center mb-4">
                            <Utensils className="w-8 h-8 text-park-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No hay mesas configuradas</h3>
                        <p className="text-park-gray-400 max-w-sm">
                            El sistema está sincronizando o no se han creado mesas aún. Si eres el administrador, por favor crea tu plano de mesas desde el Panel de Administración.
                        </p>
                    </div>
                )}

                {/* Tables Grid - Responsive columns */}
                <motion.div
                    layout
                    data-testid="tables-loaded"
                    className={`grid gap-2 md:gap-4 ${
                        isMobile 
                            ? 'grid-cols-2' 
                            : isTablet 
                                ? 'grid-cols-3' 
                                : 'grid-cols-4'
                    }`}
                >
                    <AnimatePresence mode="popLayout">
                        {filteredTables.map((t) => (
                            <PremiumTable
                                key={t.id}
                                id={t.id}
                                number={t.number}
                                displayName={t.name}
                                status={t.status as ThemeTableStatus}
                                elapsedMinutes={t.elapsedMinutes}
                                slaStatus={t.slaStatus}
                                totalCents={t.totalCents}
                                readyItemsCount={t.readyItemsCount}
                                isMerged={t.is_merged}
                                zoneColor={t.zone?.color}
                                zoneCode={t.zone?.code}
                                mode="grid"
                                onClick={() => router.push(`/mozo/mesa/${t.number}`)}
                            />
                        ))}
                    </AnimatePresence>

                    {/* Add Table Button - Only show in specific zone */}
                    {selectedZoneId !== "all" && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="min-h-[100px] md:min-h-[140px] aspect-[4/3] rounded-xl md:rounded-2xl border-2 border-dashed border-violet-500/30 text-violet-500/50 flex flex-col items-center justify-center hover:bg-violet-950/20 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
                        >
                            <span className="text-2xl md:text-3xl font-light mb-0.5 md:mb-1">+</span>
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">+ Mesa</span>
                        </motion.button>
                    )}
                </motion.div>

                {/* Legend - Hidden on mobile, shown on tablet+ */}
                <div className="hidden md:flex flex-wrap gap-4 justify-center text-xs text-park-gray-500 pt-4 border-t border-park-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span>Disponible</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-violet-500" />
                        <span>Ocupada &lt;20m</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span>Cocinando</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span>&gt;40m</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                        <span>Pide cuenta</span>
                    </div>
                </div>
            </div>

            {/* Notification Panel */}
            <NotificationPanel
                isOpen={notificationPanelOpen}
                onClose={() => setNotificationPanelOpen(false)}
            />

            {/* Employee Profile Drawer */}
            <EmployeeProfileDrawer
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
                employeeName={session?.employee_name ?? ''}
                employeeRole={session?.employee_role ?? ''}
                terminalId={terminal?.terminal_id ?? ''}
                terminalRole={session?.terminal_role}
                sessionCreatedAt={session?.created_at}
                accentColor="violet"
                stat={{ label: 'Mesas activas', value: occupiedCount }}
                onLogout={handleExit}
            />
        </div>
    );
}
