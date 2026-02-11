/**
 * Componente de Ventanas de Mantenimiento
 * 
 * Permite configurar ventanas de tiempo durante las cuales
 * las alertas serán silenciadas (snoozing).
 * 
 * @module app/admin/alerts/components
 */

'use client';

import { useState } from 'react';

export function MaintenanceWindows() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          + Nueva Ventana de Mantenimiento
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <p className="text-gray-600 text-center py-8">
          No hay ventanas de mantenimiento configuradas
        </p>
      </div>
    </div>
  );
}
