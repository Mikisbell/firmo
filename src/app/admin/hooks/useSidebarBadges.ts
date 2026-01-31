'use client';

/**
 * useSidebarBadges Hook
 * Obtiene contadores de notificaciones para badges del sidebar
 * 
 * Badges implementados:
 * - Auditoría: Eventos de seguridad sin revisar
 * - Delivery: Pedidos pendientes de asignar
 * 
 * Requirements: P0 - Sidebar Improvements
 */

import { useState, useEffect } from 'react';

export interface SidebarBadges {
  auditoria: number;
  delivery: number;
}

export function useSidebarBadges(): SidebarBadges {
  const [badges, setBadges] = useState<SidebarBadges>({
    auditoria: 0,
    delivery: 0,
  });

  useEffect(() => {
    // Fetch badges data
    const fetchBadges = async () => {
      try {
        const response = await fetch('/api/admin/sidebar/badges', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setBadges({
            auditoria: data.auditoria || 0,
            delivery: data.delivery || 0,
          });
        }
      } catch (error) {
        // Silently fail - badges are non-critical
        console.debug('Failed to fetch sidebar badges:', error);
      }
    };

    fetchBadges();

    // Refresh every 30 seconds
    const intervalId = setInterval(fetchBadges, 30000);

    return () => clearInterval(intervalId);
  }, []);

  return badges;
}
