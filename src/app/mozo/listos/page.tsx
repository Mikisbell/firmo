"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChefHat, Utensils, Settings, Clock, Check, RefreshCw, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useWaiterNotifications } from "../hooks/useWaiterNotifications";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";
import { useResponsive } from "@/src/hooks/useResponsive";
import { MobileHeader, HeaderSpacer } from "@/src/components/ui/MobileHeader";
import { useWaiterContext } from "../context/WaiterContext";
import { POSActions } from "@/src/core/actions/pos.actions";
import { getStoredTerminalConfig } from "@/src/core/auth/fingerprint";

export default function ListosPage() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const { isMobile } = useResponsive();
    const { readyItemNotifs, markAsRead } = useWaiterContext();

    const readyNotifications = readyItemNotifs.filter(n => n.type === 'ITEM_READY' && !n.read);
    const readyItemsCount = readyNotifications.length;

    // Mark individual item as served — lineId always present (server projection)
    const handleMarkServed = useCallback(async (
        notificationId: string,
        orderId: string,
        lineId: string,
    ) => {
        const config = getStoredTerminalConfig();
        if (!config) { toast.error("Terminal no configurado"); return; }

        try {
            await POSActions.updateItemStatus(
                config.tenant_id,
                config.terminal_id,
                config.actor_id,
                orderId,
                lineId,
                "READY",
                "DONE",
                "waiter",
            );
            markAsRead(notificationId);
            toast.success("Item marcado como servido");
        } catch {
            toast.error("Error al marcar como servido");
        }
    }, [markAsRead]);



    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-park-gray-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-park-gray-700 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-park-gray-950 text-park-gray-100 font-sans">
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
                        rightActions={[]}
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
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refreshReadyItems}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-400 transition-colors border border-emerald-700/50"
                        >
                            <RefreshCw size={16} />
                            <span className="text-sm">Actualizar</span>
                        </button>
                        <div className="text-center px-4 py-2 bg-emerald-950/50 rounded-lg border border-emerald-500/30">
                            <div className="text-xl font-black text-emerald-400">{readyNotifications.length}</div>
                            <div className="text-[10px] uppercase tracking-wider text-emerald-300/60">Pendientes</div>
                        </div>
                        <button
                            onClick={() => router.push('/mozo')}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-park-gray-800/50 hover:bg-park-gray-700 text-park-gray-400 hover:text-white transition-colors border border-park-gray-700"
                        >
                            <Utensils size={18} />
                            <span className="text-sm">Mesas</span>
                        </button>
                    </div>
                </header>
            )}

            <div className="p-3 md:p-6 space-y-4 pb-24 md:pb-8">

                {/* ── ITEM_READY: one card per item ── */}
                {readyNotifications.length === 0 && checkNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                        <div className="p-6 bg-park-gray-800/50 rounded-full mb-4">
                            <ChefHat className="w-12 h-12 text-park-gray-600" />
                        </div>
                        <p className="text-park-gray-400 font-medium text-lg mb-1">Todo servido</p>
                        <p className="text-park-gray-600 text-sm">Cuando cocina marque items listos, aparecerán aquí</p>
                    </div>
                ) : (
                    <>
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
                                            p-4 rounded-xl border-2 transition-all
                                            ${notif.read
                                                ? 'bg-park-gray-900/50 border-park-gray-700/50 opacity-60'
                                                : 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-900/20'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-3 rounded-xl flex-shrink-0 ${notif.read ? 'bg-park-gray-700/30 text-park-gray-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                <ChefHat className="w-6 h-6" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`font-bold text-base truncate ${notif.read ? 'text-park-gray-400' : 'text-white'}`}>
                                                        {notif.itemName}
                                                    </span>
                                                    {!notif.read && (
                                                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap text-xs text-park-gray-500">
                                                    <span className="font-semibold text-park-gray-300">Mesa {notif.tableNumber}</span>
                                                    {notif.station && (
                                                        <span className="px-2 py-0.5 bg-park-gray-800 rounded font-medium uppercase tracking-wide">
                                                            {notif.station}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {timeAgo}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Serve button — always present (lineId guaranteed by server projection) */}
                                            {!notif.read ? (
                                                <button
                                                    onClick={() => handleMarkServed(notif.id, notif.orderId, notif.lineId!)}
                                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center"
                                                    aria-label={`Servir ${notif.itemName}`}
                                                >
                                                    <Check className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Servir</span>
                                                </button>
                                            ) : (
                                                <span className="flex-shrink-0 text-xs text-park-gray-600 font-medium">Servido</span>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* ── REQUEST_CHECK section ── */}
                        {checkNotifications.length > 0 && (
                            <div className="pt-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-park-gray-500 mb-3 flex items-center gap-2">
                                    <CreditCard className="w-3.5 h-3.5" />
                                    Solicitudes de cuenta
                                </p>
                                <AnimatePresence mode="popLayout">
                                    {checkNotifications.map((notif) => {
                                        const timeAgo = formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: es });
                                        return (
                                            <motion.button
                                                key={notif.id}
                                                layout
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -100 }}
                                                onClick={() => {
                                                    markAsRead(notif.id);
                                                    router.push(`/mozo/mesa/${notif.tableNumber}`);
                                                }}
                                                className={`
                                                    w-full text-left p-4 rounded-xl border-2 transition-all mb-3
                                                    hover:scale-[1.01] active:scale-[0.99]
                                                    ${notif.read
                                                        ? 'bg-park-gray-900/50 border-park-gray-700/50'
                                                        : 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-900/20'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-3 rounded-xl flex-shrink-0 ${notif.read ? 'bg-park-gray-700/30 text-park-gray-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        <CreditCard className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <p className={`font-bold text-base ${notif.read ? 'text-park-gray-400' : 'text-amber-300'}`}>
                                                            Mesa {notif.tableNumber}
                                                        </p>
                                                        <p className="text-sm text-park-gray-300">{notif.message}</p>
                                                        <span className="flex items-center gap-1 text-xs text-park-gray-500 mt-1">
                                                            <Clock className="w-3 h-3" />
                                                            {timeAgo}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
