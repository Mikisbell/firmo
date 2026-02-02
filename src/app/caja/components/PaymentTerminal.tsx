/**
 * Payment Terminal Component
 * 
 * Modal for processing payments with multiple methods
 * and automatic change calculation.
 */

'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Smartphone, Calculator, Check, Receipt } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: number;
  total: number;
  items: any[];
}

interface PaymentTerminalProps {
  order: Order | null;
  onClose: () => void;
  onComplete: (payment: any) => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: DollarSign, color: 'bg-green-500' },
  { id: 'card', name: 'Tarjeta', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'yape', name: 'Yape', icon: Smartphone, color: 'bg-purple-500' },
  { id: 'plin', name: 'Plin', icon: Smartphone, color: 'bg-orange-500' },
];

export default function PaymentTerminal({ order, onClose, onComplete }: PaymentTerminalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);

  const total = order?.total || 0;
  const paidAmount = parseFloat(amount) || 0;
  const change = Math.max(0, paidAmount - total);

  const handleSubmit = async () => {
    if (paidAmount < total) {
      alert('Monto insuficiente');
      return;
    }

    setProcessing(true);
    
    await onComplete({
      orderId: order?.id,
      amount: paidAmount,
      method,
      change,
    });
    
    setProcessing(false);
  };

  const quickAmounts = [10, 20, 50, 100, 200];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">Procesar Pago</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Info */}
          {order && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-sm text-zinc-400">Orden #{order.orderNumber}</p>
              <p className="text-2xl font-bold">S/{total.toFixed(2)}</p>
            </div>
          )}

          {/* Payment Methods */}
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  method === m.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className={`p-1.5 rounded ${m.color}`}>
                  <m.icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{m.name}</span>
              </button>
            ))}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Monto Recibido</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">S/</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-xl font-bold"
                placeholder="0.00"
              />
            </div>
            
            {/* Quick Amounts */}
            <div className="flex gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
                >
                  S/{amt}
                </button>
              ))}
              <button
                onClick={() => setAmount(total.toString())}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-sm"
              >
                Exacto
              </button>
            </div>
          </div>

          {/* Change Display */}
          {change > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-sm text-green-400">Vuelto</p>
              <p className="text-xl font-bold text-green-400">S/{change.toFixed(2)}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={processing || paidAmount < total}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold rounded-lg transition-colors"
          >
            {processing ? 'Procesando...' : `Cobrar S/${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
