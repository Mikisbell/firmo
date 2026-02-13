'use client';

/**
 * Edit Promotion Page
 * Requirements: 3.3, 3.4, 3.7, 3.9
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, AlertCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePromotion } from '@/src/hooks/useSWRHooks';

const TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Porcentaje (%)' },
  { value: 'FIXED', label: 'Monto Fijo (S/)' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour' },
  { value: '2X1', label: '2x1' },
  { value: 'COMBO', label: 'Combo' },
];

export default function EditPromotionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Migrado a SWR - Tarea 9.3 Lote 2
  const { data, error: swrError, isLoading: loading, mutate } = usePromotion(id);
  const error = swrError ? 'Promoción no encontrada' : null;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: data?.name || '',
    type: data?.type || 'PERCENT' as string,
    value: data?.value || 0,
    starts_at: data?.starts_at ? new Date(data.starts_at).toISOString().slice(0, 16) : '',
    ends_at: data?.ends_at ? new Date(data.ends_at).toISOString().slice(0, 16) : '',
    rules: JSON.stringify(data?.rules || {}, null, 2),
    is_active: data?.is_active ?? true,
  });

  // Actualizar form cuando data cambia
  if (data && !form.name) {
    setForm({
      name: data.name,
      type: data.type,
      value: data.value,
      starts_at: new Date(data.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(data.ends_at).toISOString().slice(0, 16),
      rules: JSON.stringify(data.rules || {}, null, 2),
      is_active: data.is_active,
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    // Validate dates
    if (new Date(form.starts_at) >= new Date(form.ends_at)) {
      setFormError('La fecha de inicio debe ser anterior a la fecha de fin');
      setSaving(false);
      return;
    }

    // Validate JSON rules
    try {
      JSON.parse(form.rules);
    } catch {
      setFormError('Las reglas deben ser un JSON válido');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rules: JSON.parse(form.rules),
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar promoción');
      }

      mutate(); // Revalidar con SWR
      router.push('/admin/promociones');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Desactivar esta promoción?')) return;

    setDeleting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al desactivar');
      }

      mutate(); // Revalidar con SWR
      router.push('/admin/promociones');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/promociones"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar Promoción</h1>
          <p className="text-zinc-400 mt-1">Modificar oferta o descuento</p>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-800 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tipo <span className="text-red-400">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Valor <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              required
              min={0}
              step={form.type === 'PERCENT' ? 1 : 0.01}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {form.type === 'PERCENT' ? 'Porcentaje de descuento (0-100)' : 'Monto en soles'}
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha Inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha Fin <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]"
              />
            </div>
          </div>

          {/* Rules (JSON) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reglas (JSON)
            </label>
            <textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-sm"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Reglas adicionales en formato JSON (opcional)
            </p>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="text-sm">
              Promoción activa
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-between">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <Link
              href="/admin/promociones"
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px] flex items-center"
            >
              Cancelar
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors min-h-[44px] disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Desactivando...' : 'Desactivar'}
          </button>
        </div>
      </form>
    </div>
  );
}
