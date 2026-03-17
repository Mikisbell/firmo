'use client';

/**
 * Notification Bell Component
 * Dropdown with in-app notifications for authenticated admin employees.
 * Polls every 30s via SWR. No Web Push / VAPID.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  FileText,
  Calendar,
  DollarSign,
  Info,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useInAppNotifications, type InAppNotification } from '@/src/hooks/useSWRHooks';

// ============ HELPERS ============

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

function notifIcon(type: InAppNotification['type']) {
  switch (type) {
    case 'LEAVE_REQUEST':
      return <Calendar className="w-4 h-4 text-blue-400" />;
    case 'ADVANCE_REQUEST':
      return <DollarSign className="w-4 h-4 text-amber-400" />;
    case 'PAYSLIP_READY':
      return <FileText className="w-4 h-4 text-green-400" />;
    case 'SHIFT_REMINDER':
      return <Clock className="w-4 h-4 text-purple-400" />;
    default:
      return <Info className="w-4 h-4 text-zinc-400" />;
  }
}

// ============ MAIN COMPONENT ============

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useInAppNotifications();
  const notifications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAsRead = useCallback(
    async (id: string, notifData: InAppNotification['data']) => {
      try {
        await fetch(`/api/admin/notifications/${id}/read`, {
          method: 'POST',
          credentials: 'include',
        });
        await mutate();

        // Navigate if notification has a URL
        const url = notifData && typeof notifData === 'object' && 'url' in notifData
          ? (notifData as { url?: string }).url
          : undefined;
        if (url) {
          setOpen(false);
          router.push(url);
        }
      } catch {
        // Non-critical — ignore
      }
    },
    [mutate, router],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      await mutate();
    } catch {
      // Non-critical — ignore
    }
  }, [mutate]);

  // Show last 10 in dropdown
  const recent = notifications.slice(0, 10);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        title="Notificaciones"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell className={cn('w-5 h-5', unreadCount > 0 ? 'text-white' : 'text-zinc-400')} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="font-semibold text-sm">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-800">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                <BellOff className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : (
              recent.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif.id, notif.data)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors',
                    !notif.read && 'bg-zinc-800/40',
                  )}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                    {notifIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug truncate', !notif.read && 'font-semibold')}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{notif.body}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{relativeTime(notif.created_at)}</p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-800">
            <Link
              href="/admin/notificaciones"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-blue-400 hover:text-blue-300 transition-colors py-0.5"
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
