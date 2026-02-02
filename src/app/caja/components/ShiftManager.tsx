/**
 * Shift Manager Component
 * 
 * Manages cashier shifts: open, close, and view shift history.
 */

'use client';

import { useState } from 'react';
import { Clock, DollarSign, LogOut, TrendingUp, AlertCircle } from 'lucide-react';

interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  totalSales: number;
  status: 'open' | 'closed';
}

interface ShiftManagerProps {
  currentShift: Shift | null;
  onShiftChange: () => void;
}

export default function ShiftManager({ currentShift, onShiftChange }: ShiftManagerProps) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');

  const handleOpenShift = async () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Ingrese un monto válido');
      return;
    }

    try {
      const res = await fetch('/api/caja/shift/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingAmount: amount }),
      });

      if (!res.ok) throw new Error('Failed to open shift');
      
      setShowOpenModal(false);
      onShiftChange();
      alert('Turno abierto exitosamente');
    } catch (err) {
      alert('Error al abrir turno');
    }
  };

  const handleCloseShift = async () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Ingrese un monto válido');
      return;
    }

    try {
      const res = await fetch('/api/caja/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingAmount: amount }),
      });

      if (!res.ok) throw new Error('Failed to close shift');
      
      setShowCloseModal(false);
      onShiftChange();
      alert('Turno cerrado exitosamente');
    } catch (err) {
      alert('Error al cerrar turno');
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Shift Status */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Estado del Turno</h2>
        
        {currentShift ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">Turno Activo</span>
              </div>
              <span className="text-sm text-zinc-400">
                Abierto: {new Date(currentShift.openedAt).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">Fondo Inicial</p>
                <p className="text-lg font-bold">S/{currentShift.openingAmount.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">Ventas del Turno</p>
                <p className="text-lg font-bold">S/{currentShift.totalSales.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">Balance Esperado</p>
                <p className="text-lg font-bold">
                  S/{(currentShift.openingAmount + currentShift.totalSales).toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCloseModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Turno
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-zinc-400 mb-4">No hay turno abierto</p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
            >
              Abrir Turno
            </button>
          </div>
        )}
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 p-6">
            <h3 className="text-xl font-bold mb-4">Abrir Turno</h3>
            <p className="text-zinc-400 mb-4">Ingrese el monto inicial en caja</p>
            
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">S/</span>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-xl font-bold"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenShift}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
              >
                Abrir Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 p-6">
            <h3 className="text-xl font-bold mb-4">Cerrar Turno</h3>
            <p className="text-zinc-400 mb-4">Ingrese el monto final en caja</p>
            
            <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-zinc-400">Balance esperado</p>
              <p className="text-xl font-bold">
                S/{currentShift ? (currentShift.openingAmount + currentShift.totalSales).toFixed(2) : '0.00'}
              </p>
            </div>
            
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">S/</span>
              <input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-xl font-bold"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseShift}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
              >
                Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
