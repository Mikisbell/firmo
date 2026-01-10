'use client';

/**
 * Gestión de Motorizados
 */

import { useState, useEffect } from 'react';
import { DriverForm } from './components/DriverForm';

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  status: 'available' | 'on_delivery' | 'inactive';
  currentDelivery: { id: string; address_text: string } | null;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/drivers');
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleToggleActive = async (driver: Driver) => {
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !driver.is_active }),
      });
      if (res.ok) {
        await fetchDrivers();
      }
    } catch (err) {
      console.error('Error toggling driver:', err);
    }
  };

  const handleSave = async (data: { name: string; phone?: string }) => {
    try {
      if (editingDriver) {
        await fetch(`/api/drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setShowForm(false);
      setEditingDriver(null);
      await fetchDrivers();
    } catch (err) {
      console.error('Error saving driver:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🛵 Motorizados</h1>
        <button
          onClick={() => { setEditingDriver(null); setShowForm(true); }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          + Nuevo Motorizado
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Teléfono</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Entrega Actual</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {drivers.map(driver => (
              <tr key={driver.id} className={!driver.is_active ? 'bg-gray-50' : ''}>
                <td className="px-4 py-3 font-medium">{driver.name}</td>
                <td className="px-4 py-3 text-gray-600">{driver.phone || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={driver.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {driver.currentDelivery 
                    ? `📍 ${driver.currentDelivery.address_text.slice(0, 30)}...`
                    : '-'
                  }
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => { setEditingDriver(driver); setShowForm(true); }}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(driver)}
                    className={`text-sm ${driver.is_active ? 'text-red-600' : 'text-green-600'} hover:underline`}
                  >
                    {driver.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && (
          <p className="p-8 text-center text-gray-500">
            No hay motorizados registrados
          </p>
        )}
      </div>

      {showForm && (
        <DriverForm
          driver={editingDriver}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingDriver(null); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    on_delivery: 'bg-purple-100 text-purple-700',
    inactive: 'bg-gray-100 text-gray-600',
  };

  const labels: Record<string, string> = {
    available: 'Disponible',
    on_delivery: 'En entrega',
    inactive: 'Inactivo',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded ${styles[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
}
