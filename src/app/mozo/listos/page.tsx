"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChefHat, Utensils, Settings, ArrowRight, Clock, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useWaiterNotifications } from "../hooks/useWaiterNotifications";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { useResponsive } from "@/src/hooks/useResponsive";
import { MobileHeader, HeaderSpacer } from "@/src/components/ui/MobileHeader";
import { BottomNavigation, BottomNavItem } from "@/src/components/ui/BottomNavigation";
import { POSActions } from "@/src/core/actions/pos.actions";
import { getStoredTerminalConfig } from "@/src/core/auth/fingerprint";

export default function ListosPage() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const { isMobile } = useResponsive();
    const { notifications, readyItemsCount, markAsRead } = useWaiterNotifications();

    const readyNotifications = notifications.filter(n => n.type === 'ITEM_READY');

    const handleItemClick = useCallback((notificationId: string, tableNumber: string) => {
        markAsRead(notificationId);
        router.push(`/mozo/mesa/${tableNumber}`);
    }, [markAsRead, router]);

    // Feature 4: Mark item as served directly from listos page
    const handleMarkServed = useCallback(async (
        notificationId: string,
        orderId: string,
        lineId: string | undefined
    ) => {
        if (!lineId) {
            toast.error("No se puede identificar el item específico");
            return;
        }

        const config = getStoredTerminalConfig();
        if (!config) {
            toast.error("Terminal no configurado");
            return;
        }

        try {
            await POSActions.updateItemStatus(
                config.tenant_id,
                config.terminal_id,
                config.actor_id,
                orderId,
                lineId,
                "READY",
                "DONE",
                "waiter"
            );
            markAsRead(notificationId);
            toast.success("Item marcado como servido");
        } catch (_e) {
            toast.error("Error al marcar como servido");
        }
    }, [markAsRead]);

    const navItems: BottomNavItem[] = [
        { id: 'mesas', icon: <Utensils className="w-6 h-6" />, label: 'Mesas', href: '/mozo' },
        { id: 'listos', icon: <Bell className="w-6 h-6" />, label: 'Listos', href: '/mozo/listos', badge: readyItemsCount > 0 ? readyItemsCount : undefined },
        { id: 'config', icon: <Settings className="w-6 h-6" />, label: 'Config', href: '/mozo/configuracion' },
    ];

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950">
            {isMobile ? (
                <>
                    <MobileHeader
                        title="LISTOS"
                        subtitle={readyItemsCount > 0 ? `${readyItemsCount} para servir` : 'Sin pendientes'}
                        variant="colored"
                        colorClass="bg-gradient-to-r from-emerald-950/90 to-green-950/90 border-b-2 border-emerald-500"
                        leftAction={
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <ChefHat className="text-emerald-400 w-5 h-5" />
                            </div>
                        }
                    />
                    <HeaderSpacer />
                </>
            ) : (
                <header className="sticky top-0 z-30 h-20 bg-gradient-to-r from-emerald-950/90 to-green-950/70 backdrop-blur-md border-b-4 border-emerald-500 p-4 flex items-center justify-between shadow-[0_4px_20px_rgba(16,185,129,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 rounded-xl border-2 border-emerald-500/50">
                            <ChefHat className="text-emerald-400" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-wider">
                                <span className="text-emerald-400">LISTOS</span>
                            </h1>
                            <p className="text-emerald-300/50 text-xs uppercase tracking-widest">Items listos para servir</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-center px-4 py-2 bg-emerald-950/50 rounded-lg border border-emerald-500/30">
                            <div className="text-xl font-black text-emerald-400">{readyNotifications.length}</div>
                            <div className="text-[10px] uppercase tracking-wider text-emerald-300/60">Pendientes</div>
                        </div>
                        <button
                            onClick={() => router.push('/mozo')}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700"
                        >
                            <Utensils size={18} />
                            <span className="text-sm">Mesas</span>
                        </button>
                    </div>
                </header>
            )}

            <div className="p-3 md:p-6 space-y-3 pb-24 md:pb-8">
                {readyNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                        <div className="p-6 bg-zinc-800/50 rounded-full mb-4">
                            <ChefHat className="w-12 h-12 text-zinc-600" />
                        </div>
                        <p className="text-zinc-400 font-medium text-lg mb-1">Todo servido</p>
                        <p className="text-zinc-600 text-sm">Cuando cocina termine items, aparecerán aquí</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {readyNotifications.map((notif) => {
                            const timeAgo = formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: es });
                            return (
                                <motion.div
                                    key={notif.id}
                                    layout
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    className={`
                                        w-full text-left p-4 rounded-xl border-2 transition-all
                                        ${notif.read
                                            ? 'bg-zinc-900/50 border-zinc-700/50'
                                            : 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-900/20'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-xl flex-shrink-0 ${notif.read ? 'bg-zinc-700/30 text-zinc-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            <ChefHat className="w-6 h-6" />
                                        </div>

                                        {/* Clickable area — go to table */}
                                        <button
                                            onClick={() => handleItemClick(notif.id, notif.tableNumber)}
                                            className="flex-1 min-w-0 text-left"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className={`font-bold text-base ${notif.read ? 'text-zinc-400' : 'text-emerald-300'}`}>
                                                    {notif.title}
                                                </h3>
                                                {!notif.read && (
                                                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-300 mb-2">{notif.message}</p>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {timeAgo}
                                                </span>
                                                {notif.station && (
                                                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400 font-medium">
                                                        {notif.station}
                                                    </span>
                                                )}
                                            </div>
                                        </button>

                                        {/* Right actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Feature 4: Serve button (only when lineId is available) */}
                                            {notif.lineId && !notif.read && (
                                                <button
                                                    onClick={() => handleMarkServed(notif.id, notif.orderId, notif.lineId)}
                                                    title="Marcar como servido"
                                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 rounded-xl transition-colors text-white"
                                                    aria-label="Servir item"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                            )}
                                            <ArrowRight className="w-5 h-5 text-zinc-600" />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            <BottomNavigation items={navItems} activeId="listos" />
        </div>
    );
}
