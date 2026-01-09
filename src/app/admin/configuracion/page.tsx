'use client';

/**
 * Business Configuration Page
 * Requirements: 8.1, 8.2, 8.3
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Building2, Receipt, AlertCircle } from 'lucide-react';

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
  // Get role from localStorage (set by admin layout)
  const [userRole, setUserRole] = useState<string | null>(null);
  const canEditFiscal = userRole?.toUpperCase() === 'OWNER';
  
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setUserRole(parsed.role);
      } catch {}
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/config');
      if (!res.ok) throw new Error('Failed to fetch');
      setSettings(await res.json());
      setError(null);
    } catch {
      setError('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    
    // Validate RUC (11 digits)
    if (settings.ruc && !/^\d{11}$/.test(settings.ruc)) {
      setError('RUC debe tener exactamente 11 dígitos');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

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
              <input type="text" value={settings?.legal_name || ''} onChange={(e) => setSettings((s) => s ? { ...s, legal_name: e.target.value } : s)} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">RUC (11 dígitos)</label>
              <input type="text" value={settings?.ruc || ''} onChange={(e) => setSettings((s) => s ? { ...s, ruc: e.target.value } : s)} maxLength={11} pattern="\d{11}" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px] font-mono" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Dirección</label>
              <input type="text" value={settings?.address_text || ''} onChange={(e) => setSettings((s) => s ? { ...s, address_text: e.target.value } : s)} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px]" />
            </div>
          </div>
        </div>

        {/* Fiscal Config - OWNER only */}
        <div className={`p-4 bg-zinc-900 rounded-lg border ${canEditFiscal ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'}`}>
          <h2 className="font-medium flex items-center gap-2 mb-4"><Receipt className="w-4 h-4" />Configuración Fiscal {!canEditFiscal && <span className="text-xs text-amber-400">(Solo OWNER)</span>}</h2>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tasa de IGV (%)</label>
            <input type="number" value={settings?.tax_rate || 18} onChange={(e) => setSettings((s) => s ? { ...s, tax_rate: Number(e.target.value) } : s)} disabled={!canEditFiscal} min={0} max={100} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg min-h-[44px] disabled:opacity-50" />
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
