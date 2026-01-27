'use client';

/**
 * Notification Bell Component
 * Campanita de notificaciones con dropdown
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Info,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAdminNotifications } from '@/src/hooks/useAdminNotifications';
import type { AdminNotification } from '@/src/core/notifications/types';

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, stats, loading, markAsRead, markAllAsRead } = useAdminNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: AdminNotification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate if actionable
    if (notification.actionable && notification.action?.type === 'NAVIGATE') {
      setIsOpen(false);
      router.push(notification.action.target);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push('/admin/notificaciones');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
          stats.hasCritical
            ? 'text-red-400 hover:bg-red-500/10 animate-pulse'
            : stats.unread > 0
            ? 'text-blue-400 hover:bg-blue-500/10'
            : 'text-zinc-400 hover:bg-zinc-800'
        }`}
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        
        {/* Badge */}
        {stats.unread > 0 && (
          <span
            className={`absolute top-1 right-1 px-1.5 py-0.5 text-xs font-bold rounded-full ${
              stats.hasCritical ? 'bg-red-500' : 'bg-blue-500'
            } text-white min-w-[18px] text-center`}
          >
            {stats.unread > 99 ? '99+' : stats.unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold">Notificaciones</h3>
              {stats.unread > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas leídas
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Cargando...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay notificaciones</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {notifications.slice(0, 10).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-zinc-800">
                <button
                  onClick={handleViewAll}
                  className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
                >
                  Ver todas las notificaciones
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ NOTIFICATION ITEM ============

function NotificationItem({
  notification,
  onClick,
}: {
  notification: AdminNotification;
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (notification.priority) {
      case 'HIGH':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'MEDIUM':
        return <Info className="w-4 h-4 text-amber-400" />;
      default:
        return <Check className="w-4 h-4 text-green-400" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 text-left transition-colors ${
        notification.read
          ? 'bg-zinc-900 hover:bg-zinc-800/50'
          : 'bg-zinc-800/50 hover:bg-zinc-800'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${notification.read ? 'text-zinc-400' : 'text-white'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3 h-3 text-zinc-600" />
            <span className="text-xs text-zinc-600">
              {getTimeAgo(notification.created_at)}
            </span>
          </div>
        </div>

        {/* Action indicator */}
        {notification.actionable && !notification.read && (
          <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-1" />
        )}
      </div>
    </button>
  );
}
