'use client';

/**
 * Employee Vacation Page - Mis Vacaciones
 * Self-service view to check vacation balance and submit leave requests.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Calendar, Plus, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface VacationBalance {
  total_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Check }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-500/20', icon: Clock },
  APPROVED: { label: 'Aprobado', color: 'text-green-400 bg-green-500/20', icon: Check },
  REJECTED: { label: 'Rechazado', color: 'text-red-400 bg-red-500/20', icon: X },
  CANCELLED: { label: 'Cancelado', color: 'text-zinc-400 bg-zinc-500/20', icon: X },
};

const LEAVE_TYPES = [
  { value: 'VACATION', label: 'Vacaciones' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'MEDICAL', label: 'Médico' },
];

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

export default function VacationPage() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'VACATION',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: balance, isLoading: loadingBalance } = useSWR<VacationBalance>(
    '/api/hr/me/vacation-balance',
    fetcher
  );

  const { data: requestsData, error, isLoading: loadingRequests, mutate } = useSWR<{ items: LeaveRequest[] }>(
    '/api/hr/me/leave-requests',
    fetcher
  );

  const requests = requestsData?.items ?? (Array.isArray(requestsData) ? requestsData : []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/me/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al enviar solicitud');
      }
      toast.success('Solicitud enviada exitosamente');
      setShowForm(false);
      setForm({ leave_type: 'VACATION', start_date: '', end_date: '', reason: '' });
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Mis Vacaciones</h1>
          <p className="text-zinc-400 text-sm">Balance y solicitudes de permisos</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Solicitar
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-xs">Disponibles</p>
          <p className={`text-3xl font-bold mt-1 ${loadingBalance ? 'animate-pulse text-zinc-500' : 'text-green-400'}`}>
            {loadingBalance ? '...' : balance?.available_days ?? 0}
          </p>
          <p className="text-zinc-500 text-xs mt-1">días</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-xs">Usados</p>
          <p className={`text-3xl font-bold mt-1 ${loadingBalance ? 'animate-pulse text-zinc-500' : 'text-blue-400'}`}>
            {loadingBalance ? '...' : balance?.used_days ?? 0}
          </p>
          <p className="text-zinc-500 text-xs mt-1">de {balance?.total_days ?? 30} días</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-xs">Pendientes</p>
          <p className={`text-3xl font-bold mt-1 ${loadingBalance ? 'animate-pulse text-zinc-500' : 'text-yellow-400'}`}>
            {loadingBalance ? '...' : balance?.pending_days ?? 0}
          </p>
          <p className="text-zinc-500 text-xs mt-1">por aprobar</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-xs">Total Anual</p>
          <p className={`text-3xl font-bold mt-1 ${loadingBalance ? 'animate-pulse text-zinc-500' : 'text-white'}`}>
            {loadingBalance ? '...' : balance?.total_days ?? 30}
          </p>
          <p className="text-zinc-500 text-xs mt-1">días/año</p>
        </div>
      </div>

      {/* Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-white">Nueva Solicitud</h3>

          <div>
            <label className="block text-zinc-400 text-xs mb-1">Tipo</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm(f => ({ ...f, leave_type: e.target.value }))}
              className="w-full bg-zinc-900 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              {LEAVE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs mb-1">Desde</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1">Hasta</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-xs mb-1">Motivo</label>
            <textarea
              required
              rows={2}
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Describe el motivo de tu solicitud..."
              className="w-full bg-zinc-900 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      )}

      {/* Request History */}
      <div>
        <h3 className="font-semibold text-white mb-3">Historial de Solicitudes</h3>
        {loadingRequests ? (
          <div className="text-zinc-400 text-center py-8">Cargando...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-8 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Error al cargar solicitudes
          </div>
        ) : !requests.length ? (
          <div className="text-zinc-500 text-center py-8">
            No tienes solicitudes de permiso.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = status.icon;
              return (
                <div key={r.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm">
                          {r.leave_type === 'VACATION' ? 'Vacaciones' : r.leave_type === 'MEDICAL' ? 'Médico' : r.leave_type}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs">
                        {r.start_date?.slice(0, 10)} — {r.end_date?.slice(0, 10)} ({r.days_requested} días)
                      </p>
                      {r.reason && (
                        <p className="text-zinc-500 text-xs mt-1">{r.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
