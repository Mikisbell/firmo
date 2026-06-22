'use client';

/**
 * SalesNoteVoidModal — confirma la anulacion de una Nota de Venta pidiendo motivo.
 * Reutilizable por caja (CheckDetail) y mozo (mesa). El motivo es obligatorio.
 *
 * @module components/SalesNoteVoidModal
 */

import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface SalesNoteVoidModalProps {
  label: string; // ej. "NVT001-00000001"
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

const MIN_REASON = 5;

export function SalesNoteVoidModal({ label, onClose, onConfirm }: SalesNoteVoidModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid = reason.trim().length >= MIN_REASON;

  const handleConfirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Anular Nota de Venta
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-400">
            Vas a anular la nota <span className="font-mono font-bold text-white">{label}</span>. Esta accion no se puede deshacer.
          </p>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Motivo *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: cliente cambio de pedido, error en la cuenta..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-red-500 resize-none"
              autoFocus
            />
            {reason.length > 0 && !valid && (
              <p className="text-xs text-red-400 mt-1">El motivo debe tener al menos {MIN_REASON} caracteres</p>
            )}
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!valid || submitting}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
            Anular
          </button>
        </div>
      </div>
    </div>
  );
}
