'use client';

/**
 * Business Configuration Page
 * Requirements: 8.1, 8.2, 8.3
 */

import { useState, useEffect } from 'react';
import { Save, Building2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminMutation } from '@/src/hooks/useAdminData';
import { Button, Card, CardHeader, CardContent, PageHeader, Input, FormField } from '@/src/components/ui';

interface TenantSettings {
  tenant_id: string;
  legal_name: string;
  ruc: string | null;
  address_text: string | null;
  timezone: string;
  currency: string;
}

export default function ConfigurationPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState<TenantSettings | null>(null);
  const [success, setSuccess] = useState(false);

  const { mutate: updateConfig, loading: saving, error: saveError } = useAdminMutation<TenantSettings>('/api/admin/config', 'PUT');

  const refetch = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch('/api/admin/config');
      if (!res.ok) throw new Error('Error al cargar configuración');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!form) return;

    if (form.ruc && !/^\d{11}$/.test(form.ruc)) {
      toast.error('Validación fallida', { description: 'RUC debe tener exactamente 11 dígitos' });
      return;
    }

    try {
      await updateConfig(form);
      setSuccess(true);
      toast.success('Configuración guardada', { description: 'Los cambios han sido aplicados exitosamente' });
      setTimeout(() => setSuccess(false), 3000);
      refetch();
    } catch (error) {
      toast.error('Error al guardar configuración', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  };

  const error = fetchError || saveError;

  if (loading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Configuración General"
        description="Ajustes del negocio"
      />

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">Configuración guardada</div>}

      <Card>
        <h2 className="font-medium flex items-center gap-2 mb-4 text-white"><Building2 className="w-4 h-4" />Información del Negocio</h2>
        <div className="space-y-4">
          <FormField label="Razón Social">
            <Input
              type="text"
              value={form?.legal_name || ''}
              onChange={(e) => setForm((s) => s ? { ...s, legal_name: e.target.value } : s)}
              data-testid="tenant-name"
            />
          </FormField>
          <Input
            label="RUC (11 dígitos)"
            type="text"
            value={form?.ruc || ''}
            onChange={(e) => setForm((s) => s ? { ...s, ruc: e.target.value } : s)}
            maxLength={11}
            pattern="\d{11}"
            className="font-mono"
          />
          <Input
            label="Dirección"
            type="text"
            value={form?.address_text || ''}
            onChange={(e) => setForm((s) => s ? { ...s, address_text: e.target.value } : s)}
          />
        </div>
      </Card>

      <Button
        variant="primary"
        icon={<Save className="w-4 h-4" />}
        onClick={handleSave}
        loading={saving}
      >
        {saving ? 'Guardando...' : 'Guardar Cambios'}
      </Button>

      <Card padding="md">
        <CardHeader>
          <h3 className="font-medium text-white">Respaldo de Datos</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-park-gray-400">
            <p>Backup automatico activo</p>
            <p>Frecuencia: Diario a las 3:00 AM UTC (10:00 PM Lima)</p>
            <p>Retencion: 30 dias</p>
            <p>Destino: GitHub Artifacts</p>
            <p>Base de datos: PostgreSQL (Supabase Cloud)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
