'use client';

/**
 * Caja Chica Page
 *
 * Petty cash management: balance, transactions, reconciliation.
 *
 * @module app/admin/caja-chica/page
 */

import { useState, useCallback } from 'react';
import { Wallet, Plus, Minus, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { usePettyCash } from '@/src/hooks/useSWRHooks';
import type { PettyCashCategory } from '@/src/core/services/petty-cash.service';

const CATEGORIES: { value: PettyCashCategory; label: string }[] = [
  { value: 'SUPPLIES', label: 'Insumos' },
  { value: 'TRANSPORT', label: 'Transporte' },
  { value: 'FOOD', label: 'Alimentos' },
  { value: 'CLEANING', label: 'Limpieza' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'OTHER', label: 'Otro' },
];

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

// TODO: Get from tenant config or URL params
const DEFAULT_LOCATION = 'loc-default';
const DEFAULT_SHIFT = 'shift-default';

export default function CajaChicaPage() {
  const { data, error, isLoading, mutate } = usePettyCash(DEFAULT_LOCATION);
  const [showForm, setShowForm] = useState<'INCOME' | 'EXPENSE' | null>(null);
  const [showReconcile, setShowReconcile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<PettyCashCategory>('SUPPLIES');
  const [description, setDescription] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [countedAmount, setCountedAmount] = useState('');

  const resetForm = () => {
    setAmount('');
    setCategory('SUPPLIES');
    setDescription('');
    setReceiptNumber('');
    setSupplierName('');
    setShowForm(null);
  };

  const handleSubmitTransaction = useCallback(async () => {
    if (!showForm || !amount || !description) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId: DEFAULT_LOCATION,
          shiftId: DEFAULT_SHIFT,
          type: showForm,
          amount: Math.round(parseFloat(amount) * 100),
          category,
          description,
          receiptNumber: receiptNumber || undefined,
          supplierName: supplierName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success(`${showForm === 'INCOME' ? 'Ingreso' : 'Egreso'} registrado`);
      resetForm();
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  }, [showForm, amount, category, description, receiptNumber, supplierName, mutate]);

  const handleReconcile = useCallback(async () => {
    if (!countedAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/petty-cash/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId: DEFAULT_LOCATION,
          countedAmount: Math.round(parseFloat(countedAmount) * 100),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      const result = await res.json();
      toast.success(
        `Reconciliado. Diferencia: ${formatCurrency(result.difference)}`,
      );
      setShowReconcile(false);
      setCountedAmount('');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al reconciliar');
    } finally {
      setSubmitting(false);
    }
  }, [countedAmount, mutate]);

  const handleApprove = useCallback(async (txId: string) => {
    try {
      const res = await fetch(`/api/admin/petty-cash/${txId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error');
      toast.success('Transacción aprobada');
      mutate();
    } catch {
      toast.error('Error al aprobar');
    }
  }, [mutate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-400" />
            Caja Chica
          </h1>
          <p className="text-zinc-400 mt-1">Control de gastos menores</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm('INCOME')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm min-h-[40px]"
          >
            <Plus className="w-4 h-4" /> Ingreso
          </button>
          <button
            onClick={() => setShowForm('EXPENSE')}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm min-h-[40px]"
          >
            <Minus className="w-4 h-4" /> Egreso
          </button>
          <button
            onClick={() => setShowReconcile(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4" /> Reconciliar
          </button>
        </div>
      </div>

      {/* Balance Card */}
      {data?.balance && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p className="text-xs text-zinc-500 uppercase">Saldo Actual</p>
          <p className="text-4xl font-bold mt-2 text-emerald-400">
            {formatCurrency(data.balance.currentBalance)}
          </p>
          <div className="flex gap-6 mt-4 text-sm text-zinc-400">
            <span>Min: {formatCurrency(data.balance.minBalance)}</span>
            <span>Max: {formatCurrency(data.balance.maxBalance)}</span>
            <span>Aprobación &gt; {formatCurrency(data.balance.approvalThreshold)}</span>
          </div>
        </div>
      )}

      {/* Transaction Form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            {showForm === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as PettyCashCategory)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-zinc-400">Descripción</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">N° Recibo (opcional)</label>
              <input type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Proveedor (opcional)</label>
              <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmitTransaction} disabled={submitting || !amount || !description}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg min-h-[40px] disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg min-h-[40px]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Reconcile Form */}
      {showReconcile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Reconciliar Caja</h2>
          <div className="max-w-xs">
            <label className="text-sm text-zinc-400">Monto Contado (S/)</label>
            <input type="number" step="0.01" min="0" value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px]"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleReconcile} disabled={submitting || !countedAmount}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg min-h-[40px] disabled:opacity-50"
            >
              {submitting ? 'Reconciliando...' : 'Reconciliar'}
            </button>
            <button onClick={() => setShowReconcile(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg min-h-[40px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar datos. Verifica la configuración de ubicación.
        </div>
      )}

      {/* Transactions Table */}
      {data && data.transactions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400">Fecha</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Categoría</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Descripción</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Monto</th>
                  <th className="text-center px-4 py-3 text-zinc-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(tx.createdAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}>
                        {tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{tx.category}</td>
                    <td className="px-4 py-3">{tx.description}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.requiresApproval && !tx.approvedBy ? (
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                        >
                          <Clock className="w-3 h-3" /> Pendiente
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.transactions.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <Wallet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No hay transacciones registradas</p>
        </div>
      )}
    </div>
  );
}
