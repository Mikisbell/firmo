'use client';

/**
 * Training Management Page - Capacitaciones
 * Admin view to record and track employee training and certifications.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { GraduationCap, Plus, AlertTriangle, Search, Calendar, Award } from 'lucide-react';
import { toast } from 'sonner';

interface Training {
  id: string;
  employee_id: string;
  employee_name?: string;
  training_type: string;
  title: string;
  description?: string;
  provider?: string;
  hours: number;
  completed_at: string;
  expires_at?: string;
  certificate_url?: string;
  status?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SAFETY: { label: 'Seguridad', color: 'text-red-400 bg-red-500/20' },
  FOOD_HANDLING: { label: 'Manipulación Alimentos', color: 'text-orange-400 bg-orange-500/20' },
  CUSTOMER_SERVICE: { label: 'Atención al Cliente', color: 'text-blue-400 bg-blue-500/20' },
  TECHNICAL: { label: 'Técnico', color: 'text-purple-400 bg-purple-500/20' },
  MANAGEMENT: { label: 'Gestión', color: 'text-teal-400 bg-teal-500/20' },
  COMPLIANCE: { label: 'Cumplimiento', color: 'text-yellow-400 bg-yellow-500/20' },
  OTHER: { label: 'Otro', color: 'text-zinc-400 bg-zinc-500/20' },
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

export default function TrainingPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, error, isLoading, mutate } = useSWR<{ items: Training[] }>(
    `/api/hr/training${typeFilter ? `?type=${typeFilter}` : ''}`,
    fetcher
  );

  const trainings = data?.items ?? (Array.isArray(data) ? data : []);

  const filtered = trainings.filter(t =>
    !search ||
    t.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.title?.toLowerCase().includes(search.toLowerCase())
  );

  const totalHours = filtered.reduce((sum, t) => sum + (t.hours ?? 0), 0);
  const expiringSoon = filtered.filter(t => {
    if (!t.expires_at) return false;
    const expiryDate = new Date(t.expires_at);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Capacitaciones</h1>
          <p className="text-zinc-400 text-sm">Registro de entrenamientos y certificaciones</p>
        </div>
        <button
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Capacitación
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Total Registros</p>
          <p className="text-2xl font-bold text-white">{trainings.length}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Horas Totales</p>
          <p className="text-2xl font-bold text-teal-400">{totalHours}h</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Por Vencer (30d)</p>
          <p className={`text-2xl font-bold ${expiringSoon.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {expiringSoon.length}
          </p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Tipos Distintos</p>
          <p className="text-2xl font-bold text-purple-400">
            {new Set(trainings.map(t => t.training_type)).size}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por empleado o título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Cargando...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar capacitaciones
        </div>
      ) : !filtered.length ? (
        <div className="text-zinc-500 text-center py-12">
          No hay capacitaciones registradas.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-left">
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4 text-center">Horas</th>
                <th className="py-3 px-4">Completado</th>
                <th className="py-3 px-4">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const typeConfig = TYPE_LABELS[t.training_type] ?? TYPE_LABELS.OTHER;
                const isExpiring = t.expires_at ? new Date(t.expires_at) <= new Date(Date.now() + 30 * 86400000) : false;
                const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
                return (
                  <tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 px-4 text-white">{t.employee_name ?? t.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-zinc-300">
                      <div className="flex items-center gap-2">
                        {t.title}
                        {t.certificate_url && <span title="Certificado"><Award className="w-3.5 h-3.5 text-yellow-400" /></span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{t.provider ?? '—'}</td>
                    <td className="py-3 px-4 text-center text-zinc-300">{t.hours}h</td>
                    <td className="py-3 px-4 text-zinc-300">{t.completed_at?.slice(0, 10)}</td>
                    <td className="py-3 px-4">
                      {t.expires_at ? (
                        <span className={`text-sm ${isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-zinc-300'}`}>
                          {t.expires_at.slice(0, 10)}
                          {isExpired && ' (Vencido)'}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
