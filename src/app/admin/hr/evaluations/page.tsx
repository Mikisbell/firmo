'use client';

/**
 * Evaluations Management Page - Evaluaciones de Desempeño
 * Admin view to create, view, and manage employee performance evaluations.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, Plus, Star, AlertTriangle, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

interface EmployeeOption {
  id: string;
  name: string;
}

interface Evaluation {
  id: string;
  employee_id: string;
  employee_name?: string;
  evaluator_id: string;
  period_start: string;
  period_end: string;
  status: string;
  overall_score?: number;
  scores?: Record<string, number>;
  comments?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-zinc-400 bg-zinc-500/20' },
  IN_PROGRESS: { label: 'En Progreso', color: 'text-blue-400 bg-blue-500/20' },
  COMPLETED: { label: 'Completado', color: 'text-green-400 bg-green-500/20' },
  REVIEWED: { label: 'Revisado', color: 'text-purple-400 bg-purple-500/20' },
};

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-400';
  if (score >= 3) return 'text-yellow-400';
  if (score >= 2) return 'text-orange-400';
  return 'text-red-400';
}

function renderStars(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`w-3.5 h-3.5 ${i < Math.round(score) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}`}
    />
  ));
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

const EVAL_CRITERIA = ['puntualidad', 'presentacion', 'productividad', 'trabajo_equipo', 'atencion_cliente'];
const CRITERIA_LABELS: Record<string, string> = {
  puntualidad: 'Puntualidad',
  presentacion: 'Presentación',
  productividad: 'Productividad',
  trabajo_equipo: 'Trabajo en Equipo',
  atencion_cliente: 'Atención al Cliente',
};

function makeEmptyForm() {
  return {
    employee_id: '',
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    comments: '',
    scores: Object.fromEntries(EVAL_CRITERIA.map(c => [c, 5])) as Record<string, number>,
  };
}

export default function EvaluationsPage() {
  const { employee: adminEmployee } = useAuth();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);

  const { data, error, isLoading, mutate } = useSWR<{ items: Evaluation[] }>(
    '/api/hr/evaluations',
    fetcher
  );

  const { data: empData } = useSWR<{ items: EmployeeOption[] }>(
    showCreateModal ? '/api/hr/employees?pageSize=1000' : null,
    fetcher
  );
  const employees = empData?.items ?? [];

  const evaluations = data?.items ?? (Array.isArray(data) ? data : []);

  const filtered = evaluations.filter(e =>
    !search || e.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const avgScore = filtered.length > 0
    ? filtered.reduce((sum, e) => sum + (e.overall_score ?? 0), 0) / filtered.filter(e => e.overall_score).length
    : 0;

  const handleOpen = () => {
    setForm(makeEmptyForm());
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.period_start || !form.period_end) {
      toast.error('Empleado y período son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/hr/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          evaluator_id: adminEmployee?.id ?? form.employee_id,
          period_start: form.period_start,
          period_end: form.period_end,
          scores: form.scores,
          comments: form.comments || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Error al crear');
      }
      toast.success('Evaluación creada');
      setShowCreateModal(false);
      mutate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Evaluaciones</h1>
          <p className="text-zinc-400 text-sm">Revisiones de desempeño del personal</p>
        </div>
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Evaluación
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Total Evaluaciones</p>
          <p className="text-2xl font-bold text-white">{evaluations.length}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Promedio General</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-bold ${avgScore > 0 ? getScoreColor(avgScore) : 'text-zinc-500'}`}>
              {avgScore > 0 ? avgScore.toFixed(1) : '--'}
            </p>
            {avgScore > 0 && <div className="flex">{renderStars(avgScore)}</div>}
          </div>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-400">
            {evaluations.filter(e => e.status === 'DRAFT' || e.status === 'IN_PROGRESS').length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por empleado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Cargando...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar evaluaciones
        </div>
      ) : !filtered.length ? (
        <div className="text-zinc-500 text-center py-12">
          No hay evaluaciones registradas. Haz clic en &quot;Nueva Evaluación&quot; para crear una.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-left">
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-center">Puntuación</th>
                <th className="py-3 px-4">Comentarios</th>
                <th className="py-3 px-4">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => {
                const status = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.DRAFT;
                return (
                  <tr key={ev.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 px-4 text-white">{ev.employee_name ?? ev.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-zinc-300">
                      {ev.period_start?.slice(0, 10)} — {ev.period_end?.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {ev.overall_score ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-bold ${getScoreColor(ev.overall_score)}`}>
                            {ev.overall_score.toFixed(1)}
                          </span>
                          <div className="flex">{renderStars(ev.overall_score)}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-center block">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 max-w-[200px] truncate">{ev.comments ?? '—'}</td>
                    <td className="py-3 px-4 text-zinc-300">{ev.created_at?.slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <h2 className="text-white font-semibold">Nueva Evaluación</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs mb-1">Empleado *</label>
                <select
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Período inicio *</label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Período fin *</label>
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-2">Puntuaciones (1–10)</label>
                <div className="space-y-2">
                  {EVAL_CRITERIA.map(c => (
                    <div key={c} className="flex items-center justify-between gap-3">
                      <span className="text-zinc-300 text-sm flex-1">{CRITERIA_LABELS[c]}</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form.scores[c]}
                        onChange={e => setForm(f => ({ ...f, scores: { ...f.scores, [c]: Number(e.target.value) } }))}
                        className="w-20 bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2 py-1 text-sm text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1">Comentarios</label>
                <textarea
                  value={form.comments}
                  onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                  rows={3}
                  placeholder="Observaciones del período..."
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-700">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Crear Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
