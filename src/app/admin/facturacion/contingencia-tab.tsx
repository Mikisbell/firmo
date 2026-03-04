'use client';

/**
 * Contingency Tab — SUNAT contingency mode management.
 *
 * Shows current status, pending/overdue invoices, and activate/deactivate controls.
 *
 * @module app/admin/facturacion/contingencia-tab
 */

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Power,
  PowerOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSunatContingency } from '@/src/hooks/useFacturacion';

export default function ContingenciaTab() {
  const { contingency, isLoading, mutate } = useSunatContingency();
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [reason, setReason] = useState<string>('MANUAL_ACTIVATION');

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/admin/facturacion/contingencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al activar');
        return;
      }

      toast.success('Modo contingencia activado');
      mutate();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch('/api/admin/facturacion/contingencia', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al desactivar');
        return;
      }

      toast.success('Modo contingencia desactivado');
      mutate();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeactivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const isActive = contingency?.active ?? false;
  const state = contingency?.state;
  const pendingInvoices = contingency?.pendingInvoices ?? [];
  const overdueInvoices = contingency?.overdueInvoices ?? [];
  const urgentInvoices = contingency?.urgentInvoices ?? [];

  const reasonLabels: Record<string, string> = {
    SUNAT_UNREACHABLE: 'SUNAT no disponible',
    NETWORK_OUTAGE: 'Caída de red',
    CERTIFICATE_ERROR: 'Error de certificado',
    MANUAL_ACTIVATION: 'Activación manual',
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={`rounded-xl border p-5 ${
          isActive
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isActive ? (
              <ShieldAlert className="w-8 h-8 text-red-400" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-green-400" />
            )}
            <div>
              <h2 className={`text-lg font-bold ${isActive ? 'text-red-300' : 'text-green-300'}`}>
                Modo Contingencia: {isActive ? 'ACTIVO' : 'INACTIVO'}
              </h2>
              {state && isActive && (
                <p className="text-sm text-zinc-400 mt-0.5">
                  {reasonLabels[state.reason] ?? state.reason}
                  {' '}
                  {state.autoActivated && '(automático)'}
                  {' — '}
                  {new Date(state.activatedAt).toLocaleString('es-PE')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isActive && state && (
              <span className="text-xs text-zinc-400 mr-2">
                {state.pendingCount} pendientes
              </span>
            )}
            <span
              className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}
            />
          </div>
        </div>
      </div>

      {/* Overdue Invoices Alert */}
      {overdueInvoices.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-red-300 uppercase">
              Comprobantes Vencidos ({overdueInvoices.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/20">
                  <th className="px-3 py-2 text-left text-xs font-bold text-red-400/70">Serie-Nro</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-red-400/70">Emitido</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-red-400/70">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-red-500/10">
                    <td className="px-3 py-2 font-mono text-red-200">{inv.series}-{inv.number}</td>
                    <td className="px-3 py-2 text-red-300 text-xs">
                      {new Date(inv.issuedAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-3 py-2 text-red-300 text-xs font-bold">
                      {new Date(inv.reconcileBy).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Urgent Invoices Warning */}
      {urgentInvoices.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-bold text-yellow-300 uppercase">
              Vencen en menos de 24h ({urgentInvoices.length})
            </h3>
          </div>
          <div className="space-y-1">
            {urgentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/5 rounded p-2">
                <span className="font-mono">{inv.series}-{inv.number}</span>
                <span className="text-yellow-400/60">vence {new Date(inv.reconcileBy).toLocaleString('es-PE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invoices Table */}
      {pendingInvoices.length > 0 && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700">
            <h3 className="text-sm font-bold text-zinc-100 uppercase">
              Comprobantes en Contingencia ({pendingInvoices.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Serie-Nro</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Emitido</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Conciliar Antes De</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-zinc-400 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map((inv) => {
                  const isOverdue = new Date(inv.reconcileBy) < new Date();
                  const isUrgent =
                    !isOverdue &&
                    new Date(inv.reconcileBy).getTime() - Date.now() < 24 * 60 * 60 * 1000;

                  return (
                    <tr key={inv.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/30">
                      <td className="px-4 py-3 font-mono text-zinc-100">{inv.series}-{inv.number}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {new Date(inv.issuedAt).toLocaleDateString('es-PE')}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold ${
                        isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-zinc-300'
                      }`}>
                        {new Date(inv.reconcileBy).toLocaleDateString('es-PE')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.reconciledAt ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                            <CheckCircle className="w-3 h-3" />
                            Conciliado
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3" />
                            Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activate / Deactivate Actions */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
        <h3 className="text-sm font-bold text-zinc-100 uppercase mb-3">Acciones</h3>

        {!isActive ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                Motivo de Activación
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none"
              >
                <option value="MANUAL_ACTIVATION">Activación manual</option>
                <option value="SUNAT_UNREACHABLE">SUNAT no disponible</option>
                <option value="NETWORK_OUTAGE">Caída de red</option>
                <option value="CERTIFICATE_ERROR">Error de certificado</option>
              </select>
            </div>
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Activar Contingencia
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={handleDeactivate}
              disabled={deactivating || overdueInvoices.length > 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
              Desactivar Contingencia
            </button>
            {overdueInvoices.length > 0 && (
              <p className="text-xs text-red-400 mt-2">
                No se puede desactivar: hay {overdueInvoices.length} comprobante(s) vencido(s) sin conciliar
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
