'use client';

/**
 * Plataformas Externas - Config Page
 *
 * Manage configurations for external delivery platforms
 * (PedidosYa, LlamaFood, Rappi).
 *
 * @module app/admin/plataformas/page
 */

import { useState, useCallback } from 'react';
import { Globe, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { usePlatformConfigs } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, PageHeader } from '@/src/components/ui';

interface PlatformInfo {
  key: string;
  name: string;
  color: string;
  defaultCommission: number;
}

const PLATFORMS: PlatformInfo[] = [
  { key: 'PEDIDOSYA', name: 'PedidosYa', color: 'bg-red-500', defaultCommission: 0.27 },
  { key: 'LLAMAFOOD', name: 'LlamaFood', color: 'bg-green-500', defaultCommission: 0.22 },
  { key: 'RAPPI', name: 'Rappi', color: 'bg-orange-500', defaultCommission: 0.30 },
];

export default function PlataformasPage() {
  const { data, error, isLoading, mutate } = usePlatformConfigs();
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  const configs = data?.configs ?? [];

  const getConfig = (platform: string) =>
    configs.find((c) => c.platform === platform);

  const getEditValue = (platform: string, field: string, defaultVal: any) => {
    if (editValues[platform]?.[field] !== undefined) {
      return editValues[platform][field];
    }
    const cfg = getConfig(platform);
    if (!cfg) return defaultVal;
    return (cfg as any)[field] ?? defaultVal;
  };

  const setEditField = (platform: string, field: string, value: any) => {
    setEditValues((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const handleSave = useCallback(async (platform: string) => {
    setSaving(platform);
    try {
      const updates = editValues[platform] || {};
      const res = await fetch('/api/admin/platform-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platform, ...updates }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success(`${platform} actualizado`);
      setEditValues((prev) => {
        const copy = { ...prev };
        delete copy[platform];
        return copy;
      });
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(null);
    }
  }, [editValues, mutate]);

  const handleToggle = useCallback(async (platform: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platform, isActive: !currentActive }),
      });
      if (!res.ok) throw new Error('Error');
      toast.success(`${platform} ${!currentActive ? 'activado' : 'desactivado'}`);
      mutate();
    } catch {
      toast.error('Error al cambiar estado');
    }
  }, [mutate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plataformas"
        description="Configurar integraciones con apps de delivery"
      />

      {isLoading && (
        <div className="p-4 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          Error al cargar configuración.
        </div>
      )}

      {/* Platform Cards */}
      <div className="grid gap-6">
        {PLATFORMS.map((p) => {
          const cfg = getConfig(p.key);
          const isActive = getEditValue(p.key, 'isActive', cfg?.isActive ?? false);
          const hasEdits = !!editValues[p.key];

          return (
            <Card key={p.key}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${p.color}`} />
                  <h2 className="text-lg font-bold">{p.name}</h2>
                  {cfg && (
                    <Badge variant={cfg.isActive ? 'success' : 'neutral'} dot>
                      {cfg.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(p.key, cfg?.isActive ?? false)}
                  className="text-zinc-400 hover:text-white"
                >
                  {cfg?.isActive ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-park-gray-500 block mb-1">Clave API</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={getEditValue(p.key, 'apiKey', '')}
                    onChange={(e) => setEditField(p.key, 'apiKey', e.target.value)}
                    className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-park-gray-500 block mb-1">ID de Tienda</label>
                  <input
                    type="text"
                    placeholder={cfg?.storeId || 'ID de tienda'}
                    value={getEditValue(p.key, 'storeId', cfg?.storeId ?? '')}
                    onChange={(e) => setEditField(p.key, 'storeId', e.target.value)}
                    className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-park-gray-500 block mb-1">Clave Webhook</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={getEditValue(p.key, 'webhookSecret', '')}
                    onChange={(e) => setEditField(p.key, 'webhookSecret', e.target.value)}
                    className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-park-gray-500 block mb-1">Comisión (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={getEditValue(p.key, 'commissionRate', cfg?.commissionRate ?? p.defaultCommission) * 100}
                    onChange={(e) => setEditField(p.key, 'commissionRate', parseFloat(e.target.value) / 100)}
                    className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-park-gray-500 block mb-1">Recargo (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={getEditValue(p.key, 'markupRate', cfg?.markupRate ?? 0.20) * 100}
                    onChange={(e) => setEditField(p.key, 'markupRate', parseFloat(e.target.value) / 100)}
                    className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={getEditValue(p.key, 'autoAccept', cfg?.autoAccept ?? false)}
                      onChange={(e) => setEditField(p.key, 'autoAccept', e.target.checked)}
                      className="rounded border-zinc-600"
                    />
                    <span className="text-sm text-zinc-300">Auto-aceptar</span>
                  </label>
                </div>
              </div>

              {hasEdits && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="primary"
                    icon={<Save className="w-4 h-4" />}
                    onClick={() => handleSave(p.key)}
                    loading={saving === p.key}
                    size="sm"
                  >
                    {saving === p.key ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
