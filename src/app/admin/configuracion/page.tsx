'use client';

/**
 * Business Configuration Page
 * Requirements: 8.1, 8.2, 8.3
 */

import { useState, useEffect } from 'react';
import { Save, Building2, Receipt, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminData, useAdminMutation } from '@/src/hooks/useAdminData';

interface TenantSettings {
  tenant_id: string;
  legal_name: string;
  ruc: string | null;
  address_text: string | null;
  timezone: string;
  currency: string;
  tax_rate?: number;
}

export default function ConfigurationPage() {
  // Get role from session API (httpOnly cookie)
  const [userRole, setUserRole] = useState<string | null>(null);
  const canEditFiscal = userRole?.toUpperCase() === 'OWNER';
  
  const { data: settingsArray, loading, error: fetchError, refetch } = useAdminData<TenantSettings>('/api/admin/config');
  const { mutate: updateConfig, loading: saving, error: saveError } = useAdminMutation<TenantSettings>('/api/admin/config', 'PUT');
  
  const settings = settingsArray && settingsArray.length > 0 ? settingsArray[0] : null;
  const [form, setForm] = useState<TenantSettings | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.employee) {
            setUserRole(data.employee.role);
          }
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!form) return;
    
    // Validate RUC (11 digits)
    if (form.ruc && !/^\d{11}$/.test(form.ruc)) {
      const errorMsg = 'RUC debe tener exactamente 11 dígitos';
      toast.error('Validación fallida', {
        description: errorMsg,
      });
      return;
    }

    // Validate tax rate range
    if (form.tax_rate !== undefined && (form.tax_rate < 0 || form.tax_rate > 100)) {
      const errorMsg = 'La tasa de IGV debe estar entre 0 y 100';
      toast.error('Validación fallida', {
        description: errorMsg,
      });
      return;
    }

    // Confirmation dialog for critical settings (tax rate changes)
    if (canEditFiscal && form.tax_rate !== undefined) {
      const confirmed = window.confirm(
        `¿Está seguro de cambiar la tasa de IGV a ${form.tax_rate}%?\n\nEsto afectará todos los cálculos de impuestos en el sistema.`
      );
      if (!confirmed) return;
    }
    
    try {
      await updateConfig(form);
      setSuccess(true);
      toast.success('Configuración guardada', {
        description: 'Los cambios han sido aplicados exitosamente',
      });
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
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-zinc-400 mt-1">Ajustes del negocio</p>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">Configuración guardada</div>}

      <div className="space-y-6">
        {/* Business Info */}
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <h2 className="font-medium flex items-center gap-2 mb-4"><Building2 className="w-4 h-4" />Información del Negocio</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Razón Social</label>
              <input type="text" value={form?.legal_name || ''} onChange={(e) => setForm((s) => s ? { ...s, legal_name: e.target.value } : s)} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">RUC (11 dígitos)</label>
              <input type="text" value={form?.ruc || ''} onChange={(e) => setForm((s) => s ? { ...s, ruc: e.target.value } : s)} maxLength={11} pattern="\d{11}" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px] font-mono" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Dirección</label>
              <input type="text" value={form?.address_text || ''} onChange={(e) => setForm((s) => s ? { ...s, address_text: e.target.value } : s)} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]" />
            </div>
          </div>
        </div>

        {/* Fiscal Config - OWNER only */}
        <div className={`p-4 bg-zinc-900 rounded-lg border ${canEditFiscal ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'}`}>
          <h2 className="font-medium flex items-center gap-2 mb-4"><Receipt className="w-4 h-4" />Configuración Fiscal {!canEditFiscal && <span className="text-xs text-amber-400">(Solo OWNER)</span>}</h2>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tasa de IGV (%)</label>
            <input type="number" value={form?.tax_rate || 18} onChange={(e) => setForm((s) => s ? { ...s, tax_rate: Number(e.target.value) } : s)} disabled={!canEditFiscal} min={0} max={100} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px] disabled:opacity-50" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px] disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </div>
  );
}
