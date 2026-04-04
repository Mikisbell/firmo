'use client';

/**
 * Gestión de Motorizados
 */

import { useState, useEffect } from 'react';
import { Plus, Truck } from 'lucide-react';
import { DriverForm } from './components/DriverForm';
import { toast } from 'sonner';
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  status: 'available' | 'on_delivery' | 'inactive';
  currentDelivery: { id: string; address_text: string } | null;
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'neutral'; label: string }> = {
  available: { variant: 'success', label: 'Disponible' },
  on_delivery: { variant: 'warning', label: 'En entrega' },
  inactive: { variant: 'neutral', label: 'Inactivo' },
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/drivers?pageSize=100');
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
        toast.success(
          driver.is_active ? 'Motorizado desactivado' : 'Motorizado activado',
          {
            description: `${driver.name} ha sido ${driver.is_active ? 'desactivado' : 'activado'}`,
          }
        );
        await fetchDrivers();
      } else {
        throw new Error('Error al actualizar estado');
      }
    } catch (err) {
      toast.error('Error al actualizar motorizado', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };

  const handleSave = async (data: { name: string; phone?: string }) => {
    try {
      let res;
      if (editingDriver) {
        res = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar');
      }

      toast.success(
        editingDriver ? 'Motorizado actualizado' : 'Motorizado creado',
        {
          description: `${data.name} ha sido ${editingDriver ? 'actualizado' : 'agregado'} exitosamente`,
        }
      );
      setShowForm(false);
      setEditingDriver(null);
      await fetchDrivers();
    } catch (err) {
      toast.error('Error al guardar motorizado', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageHeader
        title="Motorizados"
        description="Gestión de repartidores"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => { setEditingDriver(null); setShowForm(true); }}
          >
            Nuevo Motorizado
          </Button>
        }
      />

      <Card padding="none">
        {drivers.length === 0 ? (
          <EmptyState
            icon={<Truck />}
            title="Sin motorizados"
            description="Agrega tu primer repartidor para gestionar entregas"
            action={{ label: 'Nuevo Motorizado', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Entrega Actual</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => {
                  const badge = STATUS_BADGE[driver.status] || { variant: 'neutral' as const, label: driver.status };
                  return (
                    <tr
                      key={driver.id}
                      className={`border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors ${!driver.is_active ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{driver.name}</td>
                      <td className="px-4 py-3 text-park-gray-400">{driver.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-park-gray-400">
                        {driver.currentDelivery
                          ? driver.currentDelivery.address_text.slice(0, 30) + '...'
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingDriver(driver); setShowForm(true); }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant={driver.is_active ? 'destructive' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleActive(driver)}
                          >
                            {driver.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
