/**
 * Panel de Notificaciones para Mozo
 * Diseño moderno 2026 con animaciones y UX intuitiva
 */

"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, Clock, ChefHat, Receipt, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWaiterNotifications, WaiterNotification } from "../hooks/useWaiterNotifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearRead } = useWaiterNotifications();

  const handleNotificationClick = useCallback((notification: WaiterNotification) => {
    markAsRead(notification.id);
    onClose();
    
    // Navegar a la mesa correspondiente
    router.push(`/mozo/mesa/${notification.tableNumber}`);
  }, [markAsRead, onClose, router]);

  const getNotificationIcon = (type: WaiterNotification['type']) => {
    switch (type) {
      case 'ITEM_READY':
        return <ChefHat className="w-5 h-5" />;
      case 'REQUEST_CHECK':
        return <Receipt className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColors = (type: WaiterNotification['type'], read: boolean) => {
    if (read) {
      return {
        bg: 'bg-zinc-900/50',
        border: 'border-zinc-700/50',
        icon: 'bg-zinc-700/30 text-zinc-400',
        text: 'text-zinc-400',
      };
    }

    switch (type) {
      case 'ITEM_READY':
        return {
          bg: 'bg-emerald-950/40',
          border: 'border-emerald-500/50',
          icon: 'bg-emerald-500/20 text-emerald-400',
          text: 'text-emerald-300',
        };
      case 'REQUEST_CHECK':
        return {
          bg: 'bg-amber-950/40',
          border: 'border-amber-500/50',
          icon: 'bg-amber-500/20 text-amber-400',
          text: 'text-amber-300',
        };
      default:
        return {
          bg: 'bg-violet-950/40',
          border: 'border-violet-500/50',
          icon: 'bg-violet-500/20 text-violet-400',
          text: 'text-violet-300',
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[400px] bg-zinc-950 border-l-2 border-violet-500/30 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-violet-500/30 bg-gradient-to-r from-violet-950/50 to-purple-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Bell className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Notificaciones</h2>
                  {unreadCount > 0 && (
                    <p className="text-xs text-violet-300/60">
                      {unreadCount} sin leer
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="flex gap-2 p-3 border-b border-zinc-800">
                <button
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-violet-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Marcar todas
                </button>
                <button
                  onClick={clearRead}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar leídas
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="p-4 bg-zinc-800/50 rounded-full mb-4">
                    <Bell className="w-8 h-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 font-medium mb-1">
                    No hay notificaciones
                  </p>
                  <p className="text-zinc-600 text-sm">
                    Te avisaremos cuando haya items listos
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notification) => {
                      const colors = getNotificationColors(notification.type, notification.read);
                      const timeAgo = formatDistanceToNow(notification.timestamp, {
                        addSuffix: true,
                        locale: es,
                      });

                      return (
                        <motion.button
                          key={notification.id}
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          onClick={() => handleNotificationClick(notification)}
                          className={`
                            w-full text-left p-4 rounded-xl border-2 transition-all
                            ${colors.bg} ${colors.border}
                            ${!notification.read ? 'shadow-lg' : ''}
                            hover:scale-[1.02] active:scale-[0.98]
                          `}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`p-2 rounded-lg ${colors.icon} flex-shrink-0`}>
                              {getNotificationIcon(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className={`font-bold text-sm ${colors.text}`}>
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-1 animate-pulse" />
                                )}
                              </div>

                              <p className="text-sm text-zinc-300 mb-2">
                                {notification.message}
                              </p>

                              {/* Metadata */}
                              <div className="flex items-center gap-3 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {timeAgo}
                                </span>
                                {notification.station && (
                                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                                    {notification.station}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
