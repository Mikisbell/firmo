'use client';

/**
 * App del Motorizado
 * Vista móvil para gestionar entregas asignadas
 */

import { useState, useEffect, useCallback } from 'react';
import { DeliveryDetail } from './components/DeliveryDetail';
import { FailureModal } from './components/FailureModal';
import PhotoCapture from './components/PhotoCapture';

interface DeliveryOrder {
  id: string;
  order_id: string;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: number;
  status: 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';
  created_at: string;
  assigned_at: string | null;
  dispatched_at: string | null;
}

export default function DriverAppPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failingDelivery, setFailingDelivery] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  // En producción, esto vendría de la sesión del usuario
  useEffect(() => {
    const storedDriverId = localStorage.getItem('driverId');
    if (storedDriverId) {
      setDriverId(storedDriverId);
    }
  }, []);

  const fetchDeliveries = useCallback(async () => {
    if (!driverId) return;
    
    try {
      const res = await fetch(`/api/delivery/driver/${driverId}`);
      if (!res.ok) throw new Error('Error fetching deliveries');
      
      const data = await res.json();
      setDeliveries(data.deliveries || []);
      setError(null);
    } catch (err) {
      setError('Error cargando entregas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (driverId) {
      fetchDeliveries();
      const interval = setInterval(fetchDeliveries, 15000);
      return () => clearInterval(interval);
    }
  }, [driverId, fetchDeliveries]);

  const handleDispatch = async (deliveryId: string) => {
    try {
      const res = await fetch(`/api/delivery/${deliveryId}/dispatch`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      await fetchDeliveries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al despachar');
    }
  };

  const handleDeliver = async (deliveryId: string, signatureUrl?: string) => {
    try {
      const res = await fetch(`/api/delivery/${deliveryId}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      await fetchDeliveries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al entregar');
    }
  };

  const handlePhotoCapture = async (photoDataUrl: string) => {
    if (!capturingPhoto) return;
    
    // En producción, aquí subirías la foto a storage y obtendrías la URL
    // Por ahora, usamos el data URL directamente (solo para demo)
    await handleDeliver(capturingPhoto, photoDataUrl);
    setCapturingPhoto(null);
  };

  const handleFail = async (deliveryId: string, reason: string) => {
    try {
      const res = await fetch(`/api/delivery/${deliveryId}/fail`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      setFailingDelivery(null);
      await fetchDeliveries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reportar fallo');
    }
  };

  // Pantalla de configuración si no hay driverId
  if (!driverId) {
    return (
      <DriverSetup onSetDriver={(id) => {
        localStorage.setItem('driverId', id);
        setDriverId(id);
      }} />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const activeDelivery = deliveries.find(d => 
    d.status === 'ASSIGNED' || d.status === 'DISPATCHED'
  );
  const upcomingDeliveries = deliveries.filter(d => 
    d.status === 'ASSIGNED' && d.id !== activeDelivery?.id
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-orange-500 text-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🛵 Mis Entregas</h1>
          <button
            onClick={() => {
              localStorage.removeItem('driverId');
              setDriverId(null);
            }}
            className="text-sm opacity-80 hover:opacity-100"
          >
            Cambiar
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {activeDelivery ? (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">
              ENTREGA ACTIVA
            </h2>
            <DeliveryDetail
              delivery={activeDelivery}
              onDispatch={() => handleDispatch(activeDelivery.id)}
              onDeliver={() => setCapturingPhoto(activeDelivery.id)}
              onFail={() => setFailingDelivery(activeDelivery.id)}
            />
          </section>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg">
              🎉 Sin entregas pendientes
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Las nuevas entregas aparecerán aquí
            </p>
          </div>
        )}

        {upcomingDeliveries.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">
              PRÓXIMAS ENTREGAS ({upcomingDeliveries.length})
            </h2>
            <div className="space-y-2">
              {upcomingDeliveries.map(delivery => (
                <div key={delivery.id} className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="font-medium text-sm">
                    #{delivery.order_id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-600">
                    📍 {delivery.address_text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {failingDelivery && (
        <FailureModal
          onConfirm={(reason: string) => handleFail(failingDelivery, reason)}
          onCancel={() => setFailingDelivery(null)}
        />
      )}

      {capturingPhoto && (
        <PhotoCapture
          onCapture={handlePhotoCapture}
          onCancel={() => {
            // Si cancela la foto, entregar sin foto
            handleDeliver(capturingPhoto);
            setCapturingPhoto(null);
          }}
        />
      )}
    </div>
  );
}

function DriverSetup({ onSetDriver }: { onSetDriver: (id: string) => void }) {
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/drivers')
      .then(res => res.json())
      .then(data => {
        setDrivers(data.drivers?.filter((d: { is_active: boolean; id: string; name: string }) => d.is_active) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-2xl font-bold text-center mb-8">🛵 App Motorizado</h1>
        <div className="bg-white rounded-lg p-6 shadow">
          <p className="text-gray-600 mb-4">Selecciona tu perfil:</p>
          <div className="space-y-2">
            {drivers.map(driver => (
              <button
                key={driver.id}
                onClick={() => onSetDriver(driver.id)}
                className="w-full p-3 text-left border rounded-lg hover:bg-orange-50 hover:border-orange-300"
              >
                {driver.name}
              </button>
            ))}
          </div>
          {drivers.length === 0 && (
            <p className="text-gray-500 text-center">
              No hay motorizados registrados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
