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
import { usePettyCash, useLocations } from '@/src/hooks/useSWRHooks';
import type { PettyCashCategory } from '@/src/core/services/petty-cash.service';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState, Alert } from '@/src/components/ui';

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

const DEFAULT_SHIFT = 'shift-default';

export default function CajaChicaPage() {
  const { data: locationsData } = useLocations();
  const locationId = locationsData?.locations[0]?.id ?? null;
  const { data, error, isLoading, mutate } = usePettyCash(locationId);
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
          locationId: locationId,
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
          locationId: locationId,
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
      toast.success('Transaccion aprobada');
      mutate();
    } catch {
      toast.error('Error al aprobar');
    }
  }, [mutate]);

  // Loading skeleton
  if (isLoading) {
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
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Caja Chica"
        description="Gastos menores y reembolsos"
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowForm('INCOME')}
            >
              Ingreso
            </Button>
            <Button
              variant="destructive"
              icon={<Minus className="w-4 h-4" />}
              onClick={() => setShowForm('EXPENSE')}
            >
              Egreso
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => setShowReconcile(true)}
            >
              Reconciliar
            </Button>
          </div>
        }
      />

      {/* Saldo negativo alert */}
      {data?.balance && data.balance.currentBalance < 0 && (
        <Alert
          variant="critical"
          title="Saldo negativo"
          description={`La caja chica tiene un saldo negativo de ${formatCurrency(data.balance.currentBalance)}. Se requiere reposicion inmediata.`}
        />
      )}

      {/* Balance Card */}
      {data?.balance && (
        <Card padding="md">
          <p className="text-xs text-park-gray-400 uppercase">Saldo Actual</p>
          <p className="text-4xl font-bold mt-2 text-emerald-400">
            {formatCurrency(data.balance.currentBalance)}
          </p>
          <div className="flex gap-6 mt-4 text-sm text-park-gray-400">
            <span>Min: {formatCurrency(data.balance.minBalance)}</span>
            <span>Max: {formatCurrency(data.balance.maxBalance)}</span>
            <span>Aprobacion &gt; {formatCurrency(data.balance.approvalThreshold)}</span>
          </div>
        </Card>
      )}

      {/* Transaction Form */}
      {showForm && (
        <Card padding="md">
          <h2 className="text-lg font-semibold mb-4">
            {showForm === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-park-gray-400">Monto (S/)</label>
              <input type="number" step="0.01" min="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-park-gray-400">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as PettyCashCategory)}
                className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-park-gray-400">Descripcion</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-park-gray-400">N Recibo (opcional)</label>
              <input type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
            <div>
              <label className="text-sm text-park-gray-400">Proveedor (opcional)</label>
              <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="primary"
              onClick={handleSubmitTransaction}
              disabled={submitting || !amount || !description}
              loading={submitting}
            >
              Guardar
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Reconcile Form */}
      {showReconcile && (
        <Card padding="md">
          <h2 className="text-lg font-semibold mb-4">Reconciliar Caja</h2>
          <div className="max-w-xs">
            <label className="text-sm text-park-gray-400">Monto Contado (S/)</label>
            <input type="number" step="0.01" min="0" value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              className="w-full mt-1 bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 min-h-[40px]"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="primary"
              onClick={handleReconcile}
              disabled={submitting || !countedAmount}
              loading={submitting}
            >
              Reconciliar
            </Button>
            <Button variant="secondary" onClick={() => setShowReconcile(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card padding="sm">
          <p className="text-red-400 text-sm">
            Error al cargar datos. Verifica la configuracion de ubicacion.
          </p>
        </Card>
      )}

      {/* Transactions Table */}
      {data && data.transactions.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Categoria</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Descripcion</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Monto</th>
                  <th className="text-center px-4 py-3 text-park-gray-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-park-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.type === 'INCOME' ? 'success' : 'critical'}>
                        {tx.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-park-gray-300">{tx.category}</td>
                    <td className="px-4 py-3 text-park-gray-300">{tx.description}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.requiresApproval && !tx.approvedBy ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(tx.id)}
                        >
                          <Clock className="w-3 h-3" /> Pendiente
                        </Button>
                      ) : (
                        <Badge variant="success" dot>OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && data.transactions.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<Wallet />}
            title="Sin transacciones"
            description="No hay transacciones registradas"
            action={{ label: 'Registrar Ingreso', onClick: () => setShowForm('INCOME') }}
          />
        </Card>
      )}
    </div>
  );
}
