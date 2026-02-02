/**
 * Cash Drawer Component
 * 
 * Manages cash drawer operations: in/out, viewing current balance.
 */

'use client';

import { useState } from 'react';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';

interface CashDrawerProps {
  shift: any;
}

export default function CashDrawer({ shift }: CashDrawerProps) {
  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleCashIn = async () => {
    // Implementation would call API
    alert(`Entrada de caja: S/${amount} - ${reason}`);
    setShowInModal(false);
    setAmount('');
    setReason('');
  };

  const handleCashOut = async () => {
    // Implementation would call API
    alert(`Salida de caja: S/${amount} - ${reason}`);
    setShowOutModal(false);
    setAmount('');
    setReason('');
  };

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Balance de Caja</h2>
        <div className="text-center py-8">
          <p className="text-zinc-400 mb-2">Efectivo en caja</p>
          <p className="text-5xl font-bold text-green-400">S/0.00</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowInModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-4 bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
        >
          <ArrowUpCircle className="w-5 h-5" />
          <span className="font-medium">Entrada de Efectivo</span>
        </button>
        <button
          onClick={() => setShowOutModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-4 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          <ArrowDownCircle className="w-5 h-5" />
          <span className="font-medium">Salida de Efectivo</span>
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-4 h-4" />
          Movimientos Recientes
        </h3>
        <p className="text-zinc-400 text-center py-4">No hay movimientos registrados</p>
      </div>

      {/* Cash In Modal */}
      {showInModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 p-6">
            <h3 className="text-xl font-bold mb-4">Entrada de Efectivo</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">S/</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400">Motivo</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                  placeholder="Ej: Fondo adicional"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowInModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCashIn}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg"
              >
                Registrar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Out Modal */}
      {showOutModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 p-6">
            <h3 className="text-xl font-bold mb-4">Salida de Efectivo</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">S/</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400">Motivo</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                  placeholder="Ej: Pago a proveedor"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowOutModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCashOut}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg"
              >
                Registrar Salida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
