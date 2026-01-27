'use client';

/**
 * Notification Bell Component (Placeholder)
 * 
 * NOTA: Este es un placeholder temporal.
 * La arquitectura completa está documentada en:
 * - ARQUITECTURA_NOTIFICACIONES_ADMIN.md
 * - IMPLEMENTACION_NOTIFICACIONES_ADMIN.md
 * 
 * TODO: Implementar sistema completo de notificaciones según arquitectura
 */

import { Bell } from 'lucide-react';

export default function NotificationBell() {
  return (
    <button
      className="relative p-2 hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      title="Notificaciones (próximamente)"
      disabled
    >
      <Bell className="w-5 h-5 text-zinc-500" />
      {/* Badge de contador (oculto por ahora) */}
      <span className="hidden absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
    </button>
  );
}
