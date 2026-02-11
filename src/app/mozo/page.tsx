"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTableStatus, useZones, TableStatus } from "./hooks/useTableStatus";
import { useWaiterNotifications } from "./hooks/useWaiterNotifications";
import { NotificationPanel } from "./components/NotificationPanel";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { Users, Utensils, Clock, ClipboardList, Wifi, WifiOff, LogOut, Home, Bell, AlertTriangle, Receipt, Settings } from "lucide-react";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { useResponsive } from "@/src/hooks/useResponsive";
import { MobileHeader, HeaderSpacer } from "@/src/components/ui/MobileHeader";
import { BottomNavigation, BottomNavItem } from "@/src/components/ui/BottomNavigation";

// Fallback zones when API is not available
const DEFAULT_ZONES = [
    { id: "salon", code: "SAL", name: "Salón", color: "#8b5cf6" },
    { id: "terraza", code: "TER", name: "Terraza", color: "#10b981" },
    { id: "vip", code: "VIP", name: "VIP", color: "#f59e0b" },
];

// Time thresholds for color coding (in minutes)
const TIME_THRESHOLDS = {
    WARNING: 20,  // Yellow after 20 min
    ALERT: 40,    // Red after 40 min
};

// Get table color based on status and elapsed time
function getTableColors(status: TableStatus, elapsedMinutes?: number) {
    if (status === "FREE") {
        return {
            bg: "bg-emerald-950/40",
            border: "border-emerald-500/50",
            shadow: "shadow-emerald-900/20",
            gradient: "from-emerald-500/10 via-transparent to-green-500/5",
            icon: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
            light: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]",
            text: "text-emerald-400",
            label: "Disponible",
        };
    }
    
    if (status === "BILL_REQUESTED") {
        return {
            bg: "bg-amber-950/40",
            border: "border-amber-500/50",
            shadow: "shadow-amber-900/20",
            gradient: "from-amber-500/10 via-transparent to-orange-500/5",
            icon: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
            light: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse",
            text: "text-amber-400",
            label: "PIDE CUENTA",
        };
    }
    
    // OCCUPIED - color depends on elapsed time
    const minutes = elapsedMinutes ?? 0;
    
    if (minutes >= TIME_THRESHOLDS.ALERT) {
        // Red - urgent attention needed
        return {
            bg: "bg-red-950/40",
            border: "border-red-500/50",
            shadow: "shadow-red-900/20",
            gradient: "from-red-500/10 via-transparent to-rose-500/5",
            icon: "bg-red-500/20 text-red-300 ring-red-500/30",
            light: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse",
            text: "text-red-400",
            label: `${minutes}m ⚠️`,
        };
    }
    
    if (minutes >= TIME_THRESHOLDS.WARNING) {
        // Yellow/Orange - attention needed soon
        return {
            bg: "bg-orange-950/40",
            border: "border-orange-500/50",
            shadow: "shadow-orange-900/20",
            gradient: "from-orange-500/10 via-transparent to-amber-500/5",
            icon: "bg-orange-500/20 text-orange-300 ring-orange-500/30",
            light: "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]",
            text: "text-orange-400",
            label: `${minutes}m`,
        };
    }
    
    // Blue/Violet - normal occupied
    return {
        bg: "bg-violet-950/40",
        border: "border-violet-500/50",
        shadow: "shadow-violet-900/20",
        gradient: "from-violet-500/10 via-transparent to-purple-500/5",
        icon: "bg-violet-500/20 text-violet-300 ring-violet-500/30",
        light: "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]",
        text: "text-violet-400",
        label: `${minutes}m`,
    };
}

export default function WaiterPage() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const { zones: apiZones, loading: zonesLoading } = useZones();
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>("all"); // "all" = todas las zonas
    const { isMobile, isTablet } = useResponsive();
    const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
    
    // Hook de notificaciones
    const { unreadCount, readyItemsCount } = useWaiterNotifications();
    
    // Use API zones or fallback
    const zones = apiZones.length > 0 ? apiZones : DEFAULT_ZONES;
    
    // Get tables filtered by zone (null = all zones)
    const tables = useTableStatus(selectedZoneId === "all" ? undefined : selectedZoneId || undefined);

    // Mostrar loading mientras verifica autenticación
    if (isLoading || !isAuthenticated || zonesLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center" data-testid="tables-loading">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    // Tables are already filtered by zone in the hook
    const filteredTables = tables;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const occupiedCount = tables.filter(t => t.status === "OCCUPIED" || t.status === "BILL_REQUESTED").length;
    const _billRequestedCount = tables.filter(t => t.status === "BILL_REQUESTED").length;
    const alertCount = tables.filter(t => 
        (t.status === "OCCUPIED" && (t.elapsedMinutes ?? 0) >= TIME_THRESHOLDS.ALERT) ||
        t.status === "BILL_REQUESTED"
    ).length;
    const readyItemsTotal = tables.reduce((sum, t) => sum + (t.readyItemsCount ?? 0), 0);

    const handleExit = () => {
        clearTerminalConfig();
        router.push("/");
    };

    const handleHome = () => {
        router.push("/");
    };

    const toggleNotificationPanel = () => {
        setNotificationPanelOpen(!notificationPanelOpen);
    };

    // Bottom navigation items for mobile
    const navItems: BottomNavItem[] = [
        { id: 'mesas', icon: <Utensils className="w-6 h-6" />, label: 'Mesas', href: '/mozo', badge: alertCount > 0 ? alertCount : undefined },
        { id: 'listos', icon: <Bell className="w-6 h-6" />, label: 'Listos', href: '/mozo/listos', badge: readyItemsTotal > 0 ? readyItemsTotal : undefined },
        { id: 'config', icon: <Settings className="w-6 h-6" />, label: 'Config', href: '/mozo/config' },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/30 via-zinc-950 to-zinc-950">
            {/* Mobile Header */}
            {isMobile ? (
                <>
                    <MobileHeader
                        title="MESERO"
                        subtitle={`${occupiedCount} ocupadas`}
                        variant="colored"
                        colorClass="bg-gradient-to-r from-violet-950/90 to-purple-950/90 border-b-2 border-violet-500"
                        leftAction={
                            <div className="p-2 bg-violet-500/20 rounded-lg">
                                <ClipboardList className="text-violet-400 w-5 h-5" />
                            </div>
                        }
                        rightActions={[
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
                                <span className="text-violet-400">MESERO</span>
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

                        {/* Home Button */}
                        <button
                            onClick={handleHome}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700"
                            title="Ir al inicio"
                        >
                            <Home size={18} />
                        </button>

                        {/* Exit Button */}
                        <button
                            onClick={handleExit}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30"
                            title="Cerrar sesión"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-medium">Cerrar sesión</span>
                        </button>
                    </div>
                </header>
            )}

            <div className="p-3 md:p-4 space-y-4 md:space-y-6 pb-20 md:pb-6">
                {/* Zone Selector - Horizontal scroll on mobile */}
                <div className="flex bg-zinc-900/50 p-1 md:p-1.5 rounded-xl md:rounded-2xl overflow-x-auto gap-1 md:gap-2 border border-violet-500/20 scrollbar-hide">
                    {/* "Todas" option */}
                    <button
                        onClick={() => setSelectedZoneId("all")}
                        className="relative flex-shrink-0 md:flex-1 py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all outline-none min-w-[60px] md:min-w-[80px]"
                    >
                        {selectedZoneId === "all" && (
                            <motion.div
                                layoutId="zone-bg"
                                className="absolute inset-0 bg-gradient-to-r from-zinc-600 to-zinc-700 rounded-lg md:rounded-xl shadow-lg shadow-zinc-900/40"
                                initial={false}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className={`relative z-10 ${selectedZoneId === "all" ? "text-white" : "text-zinc-400"}`}>
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
                            <span className={`relative z-10 ${selectedZoneId === zone.id ? "text-white" : "text-zinc-400"}`}>
                                {zone.name}
                            </span>
                        </button>
                    ))}
                </div>

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
                        {filteredTables.map((t) => {
                            const colors = getTableColors(t.status, t.elapsedMinutes);
                            return (
                            <motion.button
                                key={t.id}
                                data-testid={`table-${t.number}`}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => router.push(`/mozo/mesa/${t.number}`)}
                                whileTap={{ scale: 0.97 }}
                                className={`
                                    relative rounded-xl md:rounded-2xl flex flex-col items-center justify-center 
                                    border-2 transition-all overflow-hidden group 
                                    min-h-[100px] md:min-h-[140px] aspect-[4/3]
                                    ${colors.bg} ${colors.border} shadow-xl ${colors.shadow}
                                `}
                            >
                                {/* Active State Background Gradient */}
                                {t.status !== "FREE" && (
                                    <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} pointer-events-none`} />
                                )}

                                {/* Ready Items Badge */}
                                {t.readyItemsCount && t.readyItemsCount > 0 && (
                                    <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-emerald-500 text-white text-[10px] md:text-xs font-bold rounded-full animate-pulse shadow-lg shadow-emerald-500/50">
                                        <Bell size={isMobile ? 10 : 12} />
                                        {t.readyItemsCount}
                                    </div>
                                )}

                                {/* Bill Requested Badge */}
                                {t.status === "BILL_REQUESTED" && (
                                    <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-amber-500 text-white text-[10px] md:text-xs font-bold rounded-full animate-pulse shadow-lg shadow-amber-500/50">
                                        <Receipt size={isMobile ? 10 : 12} />
                                        {!isMobile && 'CUENTA'}
                                    </div>
                                )}

                                {/* Zone indicator when showing all */}
                                {selectedZoneId === "all" && t.zone && (
                                    <div 
                                        className="absolute bottom-1.5 left-1.5 md:bottom-2 md:left-2 px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase tracking-wider"
                                        style={{ backgroundColor: `${t.zone.color}30`, color: t.zone.color }}
                                    >
                                        {t.zone.code}
                                    </div>
                                )}

                                <div className="space-y-1 md:space-y-2 z-10 flex flex-col items-center">
                                    <div className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-colors ring-2 ${colors.icon}`}>
                                        {t.status === "FREE" 
                                            ? <Utensils className="w-4 h-4 md:w-6 md:h-6" />
                                            : t.status === "BILL_REQUESTED"
                                            ? <Receipt className="w-4 h-4 md:w-6 md:h-6" />
                                            : <Users className="w-4 h-4 md:w-6 md:h-6" />
                                        }
                                    </div>

                                    <div className="text-center">
                                        <div className="text-sm md:text-lg font-bold text-white tracking-tight">{t.name}</div>
                                        {t.status !== "FREE" ? (
                                            <div className="mt-0.5 md:mt-1 flex flex-col animate-in fade-in slide-in-from-bottom-2">
                                                <span className={`text-xs md:text-sm font-mono font-medium ${colors.text}`}>
                                                    {formatCents(t.totalCents || 0)}
                                                </span>
                                                <span className={`text-[9px] md:text-[10px] mt-0.5 flex items-center justify-center gap-0.5 md:gap-1 ${colors.text}`}>
                                                    <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> {colors.label}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] md:text-xs font-medium text-emerald-400 mt-0.5 md:mt-1 block">
                                                {colors.label}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Status Light */}
                                <div className={`absolute top-2 right-2 md:top-3 md:right-3 w-2 h-2 md:w-3 md:h-3 rounded-full ${colors.light}`} />
                            </motion.button>
                            );
                        })}
                    </AnimatePresence>

                    {/* Add Table Button - Only show in specific zone */}
                    {selectedZoneId !== "all" && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="min-h-[100px] md:min-h-[140px] aspect-[4/3] rounded-xl md:rounded-2xl border-2 border-dashed border-violet-500/30 text-violet-500/50 flex flex-col items-center justify-center hover:bg-violet-950/20 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
                        >
                            <span className="text-2xl md:text-3xl font-light mb-0.5 md:mb-1">+</span>
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Barra</span>
                        </motion.button>
                    )}
                </motion.div>

                {/* Legend - Hidden on mobile, shown on tablet+ */}
                <div className="hidden md:flex flex-wrap gap-4 justify-center text-xs text-zinc-500 pt-4 border-t border-zinc-800">
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
                        <span>20-40m</span>
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

            {/* Bottom Navigation - Mobile only */}
            <BottomNavigation items={navItems} activeId="mesas" />

            {/* Notification Panel */}
            <NotificationPanel 
                isOpen={notificationPanelOpen} 
                onClose={() => setNotificationPanelOpen(false)} 
            />
        </div>
    );
}
