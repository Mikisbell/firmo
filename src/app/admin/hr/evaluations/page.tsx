'use client';

/**
 * Evaluations Management Page - Evaluaciones de Desempeño
 * Admin view to create, view, and manage employee performance evaluations.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, Plus, Star, AlertTriangle, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';

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

export default function EvaluationsPage() {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ items: Evaluation[] }>(
    '/api/hr/evaluations',
    fetcher
  );

  const evaluations = data?.items ?? (Array.isArray(data) ? data : []);

  const filtered = evaluations.filter(e =>
    !search || e.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const avgScore = filtered.length > 0
    ? filtered.reduce((sum, e) => sum + (e.overall_score ?? 0), 0) / filtered.filter(e => e.overall_score).length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Evaluaciones</h1>
          <p className="text-zinc-400 text-sm">Revisiones de desempeño del personal</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
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
    </div>
  );
}
