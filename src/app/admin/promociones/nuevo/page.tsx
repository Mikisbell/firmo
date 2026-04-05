'use client';

/**
 * Create Promotion Page
 * Requirements: 3.1, 3.2, 3.3, 3.7, 3.9
 *
 * Phase 1 Critical Review - Issue #1: Loading State Validation
 * - Added loading spinner during network requests
 * - Added error toast with retry button
 * - Validates UI resilience during throttling
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle, Loader, X } from 'lucide-react';
import {
  Button,
  Card,
  PageHeader,
  Input,
  Select,
  Textarea,
  Switch,
  Breadcrumbs,
} from '@/src/components/ui';

const TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Porcentaje (%)' },
  { value: 'FIXED', label: 'Monto Fijo (S/)' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour' },
  { value: '2X1', label: '2x1' },
  { value: 'COMBO', label: 'Combo' },
];

export default function NewPromotionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENT' as string,
    value: 0,
    starts_at: '',
    ends_at: '',
    rules: '{}',
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validate dates
    if (new Date(form.starts_at) >= new Date(form.ends_at)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin');
      setSaving(false);
      return;
    }

    // Validate JSON rules
    try {
      JSON.parse(form.rules);
    } catch {
      setError('Las reglas deben ser un JSON válido');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rules: JSON.parse(form.rules),
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
        }),
        signal: AbortSignal.timeout(3000), // 3 second timeout for network resilience testing
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear promoción');
      }

      router.push('/admin/promociones');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMsg);
      console.error('Promotion creation error:', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    // Trigger form submission again
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Promociones', href: '/admin/promociones' },
            { label: 'Nueva' },
          ]}
        />
      </div>
      <PageHeader
        title="Nueva Promoción"
        description="Crear una nueva oferta o descuento"
      />

      {error && (
        <div data-testid="error-toast" className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Error al crear promoción</p>
            <p className="text-red-300 mt-1">{error}</p>
            <div className="flex gap-2 mt-3">
              <button
                data-testid="retry-btn"
                onClick={handleRetry}
                disabled={saving}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                Reintentar
              </button>
              <button
                onClick={() => setError(null)}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 p-1 hover:bg-red-500/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saving && (
        <div data-testid="loading-spinner" className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
          <Loader className="w-5 h-5 animate-spin text-amber-500" />
          <div>
            <p className="font-medium text-amber-400">Creando promoción...</p>
            <p className="text-xs text-amber-300 mt-1">Por favor espera mientras se procesa tu solicitud</p>
            {retryCount > 0 && (
              <p className="text-xs text-amber-300 mt-1">Intento #{retryCount + 1}</p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-4">
          {/* Name */}
          <Input
            label="Nombre *"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={100}
            placeholder="Ej: Descuento 20% en pollos"
          />

          {/* Type */}
          <Select
            label="Tipo *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={TYPE_OPTIONS}
            required
          />

          {/* Value */}
          <Input
            label="Valor *"
            type="number"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            required
            min={0}
            step={form.type === 'PERCENT' ? 1 : 0.01}
            placeholder={form.type === 'PERCENT' ? '20' : '10.00'}
            hint={form.type === 'PERCENT' ? 'Porcentaje de descuento (0-100)' : 'Monto en soles'}
          />

          {/* Dates */}
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

          {/* Rules (JSON) */}
          <Textarea
            label="Reglas (JSON)"
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            rows={4}
            className="font-mono text-sm"
            placeholder='{"min_amount": 50, "products": ["PROD-001"]}'
            hint="Reglas adicionales en formato JSON (opcional)"
          />

          {/* Active */}
          <Switch
            label="Promoción activa"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            {saving ? 'Guardando...' : 'Crear Promoción'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/promociones')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
