'use client';

/**
 * Training Management Page - Capacitaciones
 * Admin view to record and track employee training and certifications.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { GraduationCap, Plus, AlertTriangle, Search, Award, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

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

interface EmployeeOption {
  id: string;
  name: string;
}

const TYPE_BADGE: Record<string, { label: string; variant: 'critical' | 'warning' | 'info' | 'success' | 'neutral' }> = {
  SAFETY: { label: 'Seguridad', variant: 'critical' },
  FOOD_HANDLING: { label: 'Manipulación Alimentos', variant: 'warning' },
  CUSTOMER_SERVICE: { label: 'Atención al Cliente', variant: 'info' },
  TECHNICAL: { label: 'Técnico', variant: 'info' },
  MANAGEMENT: { label: 'Gestión', variant: 'success' },
  COMPLIANCE: { label: 'Cumplimiento', variant: 'warning' },
  OTHER: { label: 'Otro', variant: 'neutral' },
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

const EMPTY_FORM = {
  employee_id: '',
  training_name: '',
  training_type: 'OTHER',
  provider: '',
  duration_hours: 1,
  completion_date: new Date().toISOString().slice(0, 10),
  expires_at: '',
  certificate_url: '',
};

export default function TrainingPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, error, isLoading, mutate } = useSWR<{ items: Training[] }>(
    `/api/hr/training${typeFilter ? `?type=${typeFilter}` : ''}`,
    fetcher
  );

  const { data: empData } = useSWR<{ items: EmployeeOption[] }>(
    showModal ? '/api/hr/employees?pageSize=1000' : null,
    fetcher
  );
  const employees = empData?.items ?? [];

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

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.training_name || !form.completion_date) {
      toast.error('Empleado, título y fecha de completado son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employee_id: form.employee_id,
        training_name: form.training_name,
        training_type: form.training_type,
        duration_hours: Number(form.duration_hours),
        completion_date: form.completion_date,
      };
      if (form.provider.trim()) body.provider = form.provider.trim();
      if (form.expires_at) body.expires_at = form.expires_at;
      if (form.certificate_url.trim()) body.certificate_url = form.certificate_url.trim();

      const res = await fetch('/api/hr/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Error al registrar');
      }
      toast.success('Capacitación registrada');
      setShowModal(false);
      mutate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-park-gray-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );

  const inputCls = 'w-full bg-park-gray-900 border border-park-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500';

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
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
      <PageHeader
        title="Capacitación"
        description="Registro de entrenamientos y certificaciones"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpen}
          >
            Registrar Capacitación
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Registros"
          value={trainings.length}
          icon={<GraduationCap className="w-5 h-5" />}
        />
        <MetricCard
          label="Horas Totales"
          value={`${totalHours}h`}
        />
        <MetricCard
          label="Por Vencer (30d)"
          value={expiringSoon.length}
        />
        <MetricCard
          label="Tipos Distintos"
          value={new Set(trainings.map(t => t.training_type)).size}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-park-gray-500" />
          <input
            type="text"
            placeholder="Buscar por empleado o título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-park-gray-800 border border-park-gray-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-park-gray-800 border border-park-gray-700 text-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_BADGE).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding="none">
        {error ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Error al cargar capacitaciones"
            description="No se pudieron cargar los datos. Intente nuevamente."
          />
        ) : !filtered.length ? (
          <EmptyState
            icon={<GraduationCap />}
            title="Sin capacitaciones"
            description="No hay capacitaciones registradas."
            action={{ label: 'Registrar Capacitación', onClick: handleOpen }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Empleado</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Título</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Proveedor</th>
                  <th className="px-4 py-3 text-center text-park-gray-400 font-medium">Horas</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Completado</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const typeConfig = TYPE_BADGE[t.training_type] ?? TYPE_BADGE.OTHER;
                  const isExpiring = t.expires_at ? new Date(t.expires_at) <= new Date(Date.now() + 30 * 86400000) : false;
                  const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
                  return (
                    <tr key={t.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{t.employee_name ?? t.employee_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-park-gray-300">
                        <div className="flex items-center gap-2">
                          {t.title}
                          {t.certificate_url && <span title="Certificado"><Award className="w-3.5 h-3.5 text-yellow-400" /></span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeConfig.variant} dot>{typeConfig.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-park-gray-400">{t.provider ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-park-gray-300">{t.hours}h</td>
                      <td className="px-4 py-3 text-park-gray-300">{t.completed_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        {t.expires_at ? (
                          <span className={`text-sm ${isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-park-gray-300'}`}>
                            {t.expires_at.slice(0, 10)}
                            {isExpired && ' (Vencido)'}
                          </span>
                        ) : (
                          <span className="text-park-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-park-gray-900 border border-park-gray-700 rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-park-gray-700">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-teal-400" />
                <h2 className="text-white font-semibold">Registrar Capacitación</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-park-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {field('Empleado *',
                <select
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              {field('Título / Nombre de la capacitación *',
                <input
                  type="text"
                  value={form.training_name}
                  onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))}
                  placeholder="Ej. Manipulación de alimentos DIGESA"
                  className={inputCls}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                {field('Tipo',
                  <select
                    value={form.training_type}
                    onChange={e => setForm(f => ({ ...f, training_type: e.target.value }))}
                    className={inputCls}
                  >
                    {Object.entries(TYPE_BADGE).map(([k, { label }]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                )}
                {field('Horas',
                  <input
                    type="number"
                    min={1}
                    value={form.duration_hours}
                    onChange={e => setForm(f => ({ ...f, duration_hours: Number(e.target.value) }))}
                    className={inputCls}
                  />
                )}
              </div>
              {field('Proveedor / Institución',
                <input
                  type="text"
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  placeholder="Ej. SENATI, SENCICO..."
                  className={inputCls}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                {field('Fecha de completado *',
                  <input
                    type="date"
                    value={form.completion_date}
                    onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
                    className={inputCls}
                  />
                )}
                {field('Fecha de vencimiento',
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    className={inputCls}
                  />
                )}
              </div>
              {field('URL del certificado',
                <input
                  type="url"
                  value={form.certificate_url}
                  onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-park-gray-700">
              <Button
                variant="ghost"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Registrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
