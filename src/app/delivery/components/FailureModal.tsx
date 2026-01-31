'use client';

/**
 * Modal para reportar fallo de entrega
 */

import { useState } from 'react';

interface Props {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const FAILURE_REASONS = [
  'Cliente no disponible',
  'Dirección incorrecta',
  'Cliente rechazó pedido',
  'Zona peligrosa',
  'Problema con el pedido',
  'Otro',
];

export function FailureModal({ onConfirm, onCancel }: Props) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const reason = selectedReason === 'Otro' ? customReason : selectedReason;
    if (!reason.trim()) {
      alert('Selecciona o escribe un motivo');
      return;
    }
    setSubmitting(true);
    await onConfirm(reason);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-slide-up">
        <h2 className="text-lg font-bold mb-4">¿Por qué no se pudo entregar?</h2>
        
        <div className="space-y-2 mb-4">
          {FAILURE_REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full p-3 text-left border rounded-lg ${
                selectedReason === reason 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-200'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {selectedReason === 'Otro' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Describe el motivo..."
            className="w-full p-3 border rounded-lg mb-4"
            rows={3}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || submitting}
            className="flex-1 py-3 bg-red-500 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
