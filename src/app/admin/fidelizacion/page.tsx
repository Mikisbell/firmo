'use client';

/**
 * Admin Fidelización Page
 * Loyalty program management: config, tiers, customer balances/history
 */

import { useState, useCallback } from 'react';
import { Award, Settings, Users, Star, Save, Loader2, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import useSWR, { mutate } from 'swr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
}

interface LoyaltyConfig {
  enabled: boolean;
  points_per_sol: number;
  redemption_rate: number;
  tiers: LoyaltyTier[];
  min_redemption_points: number;
}

interface CustomerLoyalty {
  balance: number;
  lifetimePoints: number;
  tier: string;
  nextTier: { name: string; minPoints: number; pointsNeeded: number } | null;
}

interface LedgerEntry {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  referenceType: string | null;
  description: string | null;
  multiplier: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
});

// ---------------------------------------------------------------------------
// Tier Badge
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  BRONCE: 'bg-amber-100 text-amber-800',
  PLATA: 'bg-gray-100 text-gray-700',
  ORO: 'bg-yellow-100 text-yellow-800',
  PLATINO: 'bg-purple-100 text-purple-800',
};

function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <Star className="h-3 w-3" />
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Config Tab
// ---------------------------------------------------------------------------

function ConfigTab() {
  const { data: config, error, isLoading } = useSWR<LoyaltyConfig>('/api/admin/loyalty/config', fetcher);
  const [form, setForm] = useState<LoyaltyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Init form from fetched config
  const currentForm = form ?? config;

  const handleSave = useCallback(async () => {
    if (!currentForm) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(body.error ?? 'Error al guardar');
      } else {
        setMsg('Configuración guardada');
        mutate('/api/admin/loyalty/config');
        setForm(null);
      }
    } catch {
      setMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  }, [currentForm]);

  if (isLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (error || !currentForm) return <div className="p-8 text-center text-red-500">Error al cargar configuración</div>;

  const update = (patch: Partial<LoyaltyConfig>) => setForm({ ...currentForm, ...patch });

  const updateTier = (idx: number, patch: Partial<LoyaltyTier>) => {
    const tiers = [...currentForm.tiers];
    tiers[idx] = { ...tiers[idx], ...patch };
    update({ tiers });
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <h3 className="font-medium">Programa de Fidelización</h3>
          <p className="text-sm text-gray-500">Acumula puntos por cada compra</p>
        </div>
        <button
          onClick={() => update({ enabled: !currentForm.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${currentForm.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${currentForm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {currentForm.enabled && (
        <>
          {/* Points Config */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Puntos por Sol</label>
              <input
                type="number"
                min={1}
                max={100}
                value={currentForm.points_per_sol}
                onChange={(e) => update({ points_per_sol: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Puntos ganados por cada S/1.00</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tasa de Canje</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={currentForm.redemption_rate}
                onChange={(e) => update({ redemption_rate: parseInt(e.target.value) || 100 })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">{currentForm.redemption_rate} pts = S/1.00 descuento</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mínimo para Canjear</label>
              <input
                type="number"
                min={0}
                max={100000}
                value={currentForm.min_redemption_points}
                onChange={(e) => update({ min_redemption_points: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Puntos mínimos para canjear</p>
            </div>
          </div>

          {/* Tiers Table */}
          <div>
            <h3 className="mb-2 font-medium">Tiers de Lealtad</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Tier</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Puntos Mínimos</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Multiplicador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentForm.tiers.map((tier, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <input
                          value={tier.name}
                          onChange={(e) => updateTier(idx, { name: e.target.value })}
                          className="w-full rounded border-gray-300 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          value={tier.minPoints}
                          onChange={(e) => updateTier(idx, { minPoints: parseInt(e.target.value) || 0 })}
                          className="w-full rounded border-gray-300 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step={0.1}
                          min={0.1}
                          max={10}
                          value={tier.multiplier}
                          onChange={(e) => updateTier(idx, { multiplier: parseFloat(e.target.value) || 1 })}
                          className="w-full rounded border-gray-300 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        {msg && <span className={`text-sm ${msg.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customers Tab
// ---------------------------------------------------------------------------

function CustomersTab() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // List customers with loyalty data from general customers endpoint
  const { data: customers } = useSWR(
    '/api/admin/customers?limit=50&sortBy=total_spent&sortOrder=desc',
    fetcher,
  );

  const { data: balance } = useSWR<CustomerLoyalty>(
    selectedId ? `/api/admin/loyalty/customers/${selectedId}` : null,
    fetcher,
  );

  const { data: history } = useSWR(
    selectedId ? `/api/admin/loyalty/customers/${selectedId}/history?limit=20` : null,
    fetcher,
  );

  const items = (customers?.data ?? []) as Array<{
    id: string;
    name: string | null;
    phone: string;
    doc_number: string | null;
    total_spent: number;
  }>;

  const filtered = search
    ? items.filter((c) =>
        (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.doc_number ?? '').includes(search) ||
        c.phone.includes(search)
      )
    : items;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Customer List */}
      <div>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        <div className="divide-y divide-gray-100 rounded-lg border">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-gray-50 ${selectedId === c.id ? 'bg-blue-50' : ''}`}
            >
              <div>
                <p className="text-sm font-medium">{c.name ?? c.phone}</p>
                <p className="text-xs text-gray-500">{c.doc_number ?? c.phone}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-gray-400">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Customer Detail */}
      <div>
        {selectedId && balance ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <TierBadge tier={balance.tier} />
              <span className="text-2xl font-bold">{balance.balance.toLocaleString()}</span>
              <span className="text-sm text-gray-500">puntos</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-gray-500">Puntos Acumulados</p>
                <p className="text-lg font-semibold">{balance.lifetimePoints.toLocaleString()}</p>
              </div>
              {balance.nextTier && (
                <div className="rounded-lg border p-3">
                  <p className="text-gray-500">Próximo Tier: {balance.nextTier.name}</p>
                  <p className="text-lg font-semibold">{balance.nextTier.pointsNeeded.toLocaleString()} pts</p>
                </div>
              )}
            </div>

            {/* History */}
            <h4 className="font-medium">Historial de Puntos</h4>
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border text-sm">
              {(history?.data ?? []).map((entry: LedgerEntry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      {entry.points > 0 ? (
                        <ArrowUp className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className={entry.points > 0 ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{entry.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Saldo: {entry.balanceAfter}</p>
                    <p>{new Date(entry.createdAt).toLocaleDateString('es-PE')}</p>
                  </div>
                </div>
              ))}
              {(!history?.data || history.data.length === 0) && (
                <p className="p-4 text-center text-gray-400">Sin movimientos</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-60 items-center justify-center text-sm text-gray-400">
            Selecciona un cliente para ver sus puntos
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = 'config' | 'customers';

export default function FidelizacionPage() {
  const [tab, setTab] = useState<Tab>('config');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-yellow-500" />
        <h1 className="text-xl font-semibold">Fidelización</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab('config')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'config' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Settings className="h-4 w-4" />
          Configuración
        </button>
        <button
          onClick={() => setTab('customers')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'customers' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Users className="h-4 w-4" />
          Clientes
        </button>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border bg-white p-6">
        {tab === 'config' ? <ConfigTab /> : <CustomersTab />}
      </div>
    </div>
  );
}
