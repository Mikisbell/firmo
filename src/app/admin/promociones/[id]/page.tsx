'use client';

/**
 * Edit Promotion Page
 * Requirements: 3.3, 3.4, 3.7, 3.9
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, AlertCircle, Trash2 } from 'lucide-react';
import { usePromotion } from '@/src/hooks/useSWRHooks';
import { Button, Card, CardFooter, PageHeader, Input, Select, Textarea, Checkbox } from '@/src/components/ui';

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
    <div className="p-4 space-y-6 max-w-2xl">
      <PageHeader
        title="Editar Promoción"
        description="Modificar oferta o descuento"
        backHref="/admin/promociones"
      />

      {formError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-4">
          <Input
            label="Nombre *"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={100}
          />

          <Select
            label="Tipo *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
            options={TYPE_OPTIONS}
          />

          <Input
            label="Valor *"
            type="number"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            required
            min={0}
            step={form.type === 'PERCENT' ? 1 : 0.01}
            hint={form.type === 'PERCENT' ? 'Porcentaje de descuento (0-100)' : 'Monto en soles'}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha Inicio *"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              required
            />
            <Input
              label="Fecha Fin *"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Reglas (JSON)"
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            rows={4}
            className="font-mono text-sm"
            hint="Reglas adicionales en formato JSON (opcional)"
          />

          <Checkbox
            label="Promoción activa"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-between">
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/admin/promociones')}
            >
              Cancelar
            </Button>
          </div>
          <Button
            type="button"
            variant="destructive"
            loading={deleting}
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
          >
            {deleting ? 'Desactivando...' : 'Desactivar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
