/**
 * Admin Notifications Hook
 * Hook para gestionar notificaciones del panel de administración
 */

import { useState, useEffect, useCallback } from 'react';
import type { AdminNotification, AdminNotificationStats } from '@/src/core/notifications/types';

interface UseAdminNotificationsReturn {
  notifications: AdminNotification[];
  stats: AdminNotificationStats;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAdminNotifications(): UseAdminNotificationsReturn {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [stats, setStats] = useState<AdminNotificationStats>({
    total: 0,
    unread: 0,
    hasCritical: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al cargar notificaciones');
      }

      const data = await res.json();
      setNotifications(data.notifications || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching notifications:', err);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/stats', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al cargar estadísticas');
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchNotifications(), fetchStats()]);
      setLoading(false);
    };

    load();
  }, [fetchNotifications, fetchStats]);

  // Poll stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Mark as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al marcar como leída');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch (err) {
      console.error('Error marking as read:', err);
      throw err;
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al marcar todas como leídas');
      }

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setStats(prev => ({ ...prev, unread: 0, hasCritical: false }));
    } catch (err) {
      console.error('Error marking all as read:', err);
      throw err;
    }
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchStats()]);
  }, [fetchNotifications, fetchStats]);

  return {
    notifications,
    stats,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
