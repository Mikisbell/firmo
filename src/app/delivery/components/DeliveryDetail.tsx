'use client';

import React from 'react';

/**
 * Detalle de entrega para la app del motorizado
 */

interface DeliveryOrder {
  id: string;
  order_id: string;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: number;
  status: 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';
  dispatched_at: string | null;
}

interface Props {
  delivery: DeliveryOrder;
  onDispatch: () => void;
  onDeliver: () => void;
  onFail: () => void;
}

export const DeliveryDetail = React.memo(function DeliveryDetail({ delivery, onDispatch, onDeliver, onFail }: Props) {
  const isDispatched = delivery.status === 'DISPATCHED';

  // Generar link de Google Maps
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address_text)}`;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-start mb-2">
          <span className="font-bold text-lg">
            Pedido #{delivery.order_id.slice(0, 8)}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            isDispatched
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {isDispatched ? 'En camino' : 'Asignado'}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-gray-700">
            📍 {delivery.address_text}
          </p>
          {delivery.address_reference && (
            <p className="text-gray-500">
              Ref: {delivery.address_reference}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 border-b flex gap-2">
        <a
          href={`tel:${delivery.customer_phone}`}
          className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg text-center font-medium"
        >
          📞 Llamar
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg text-center font-medium"
        >
          🗺️ Navegar
        </a>
      </div>

      <div className="p-4 space-y-2">
        {!isDispatched ? (
          <button
            onClick={onDispatch}
            className="w-full py-3 bg-purple-500 text-white rounded-lg font-bold text-lg"
          >
            🚀 EN CAMINO
          </button>
        ) : (
          <>
            <button
              onClick={onDeliver}
              className="w-full py-3 bg-green-500 text-white rounded-lg font-bold text-lg"
            >
              ✅ ENTREGADO
            </button>
            <button
              onClick={onFail}
              className="w-full py-3 bg-red-500 text-white rounded-lg font-bold text-lg"
            >
              ❌ NO ENTREGADO
            </button>
          </>
        )}
      </div>
    </div>
  );
});

