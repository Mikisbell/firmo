'use client';

/**
 * Admin CRM Page
 * Marketing: Segments, Campaigns, Templates management
 */

import { useState, useCallback } from 'react';
import { Users2, Target, Send, FileText, Plus, Loader2, Play, X, Eye, RefreshCw, BarChart3 } from 'lucide-react';
import useSWR, { mutate } from 'swr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
  id: string;
  name: string;
  definition: { type: string; filters: Array<{ field: string; operator: string; value: unknown }>; logic: string };
  is_active: boolean;
  updated_at: string;
}

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  created_at: string;
  marketing_segments?: { name: string } | null;
  message_templates?: { name: string } | null;
}

interface Template {
  id: string;
  name: string;
  channel: string;
  content: string;
  variables_schema: Record<string, string> | null;
  is_active: boolean;
  updated_at: string;
}

interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
});

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segments Tab
// ---------------------------------------------------------------------------

function SegmentsTab() {
  const { data, isLoading } = useSWR<{ data: Segment[] }>('/api/admin/crm/segments', fetcher);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [filterField, setFilterField] = useState('rfm_segment');
  const [filterOp, setFilterOp] = useState('eq');
  const [filterValue, setFilterValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data: previewData } = useSWR(
    previewId ? `/api/admin/crm/segments/${previewId}/evaluate` : null,
    (url: string) => fetch(url, { method: 'POST' }).then((r) => r.json()),
  );

  const handleCreate = useCallback(async () => {
    if (!name || !filterValue) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          definition: {
            type: 'CUSTOM',
            filters: [{ field: filterField, operator: filterOp, value: isNaN(Number(filterValue)) ? filterValue : Number(filterValue) }],
            logic: 'AND',
          },
        }),
      });
      if (res.ok) {
        mutate('/api/admin/crm/segments');
        setCreating(false);
        setName('');
        setFilterValue('');
      }
    } finally {
      setSaving(false);
    }
  }, [name, filterField, filterOp, filterValue]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/admin/crm/segments/${id}`, { method: 'DELETE' });
    mutate('/api/admin/crm/segments');
  }, []);

  if (isLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  const segments = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Segmentos de Clientes</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Segmento
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <input
            type="text"
            placeholder="Nombre del segmento"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-md border-gray-300 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="rounded-md border-gray-300 text-sm">
              <option value="rfm_segment">Segmento RFM</option>
              <option value="loyalty_tier">Tier Lealtad</option>
              <option value="monetary_30d">Gasto 30d (centavos)</option>
              <option value="frequency_30d">Frecuencia 30d</option>
              <option value="recency_days">Recencia (días)</option>
              <option value="orders_count">Total Pedidos</option>
            </select>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)} className="rounded-md border-gray-300 text-sm">
              <option value="eq">Igual a</option>
              <option value="gt">Mayor que</option>
              <option value="gte">Mayor o igual</option>
              <option value="lt">Menor que</option>
              <option value="lte">Menor o igual</option>
            </select>
            <input
              type="text"
              placeholder="Valor"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="rounded-md border-gray-300 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name || !filterValue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear Segmento
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-lg border">
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{seg.name}</p>
              <p className="text-xs text-gray-500">
                {seg.definition.type} — {seg.definition.filters.length} filtro(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewId(previewId === seg.id ? null : seg.id)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(seg.id)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Eliminar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {segments.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">Sin segmentos creados</p>
        )}
      </div>

      {previewId && previewData && (
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="mb-2 text-sm font-medium">
            {previewData.count ?? 0} clientes en este segmento
          </p>
          <div className="max-h-40 overflow-y-auto text-sm">
            {(previewData.customers ?? []).slice(0, 10).map((c: any) => (
              <div key={c.id} className="flex justify-between py-1">
                <span>{c.name ?? c.phone}</span>
                <span className="text-gray-500">{c.rfm_segment ?? '-'} / {c.loyalty_tier ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates Tab
// ---------------------------------------------------------------------------

function TemplatesTab() {
  const { data, isLoading } = useSWR<{ data: Template[] }>('/api/admin/crm/templates', fetcher);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('WHATSAPP');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name || !content) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, channel, content }),
      });
      if (res.ok) {
        mutate('/api/admin/crm/templates');
        setCreating(false);
        setName('');
        setContent('');
      }
    } finally {
      setSaving(false);
    }
  }, [name, channel, content]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/admin/crm/templates/${id}`, { method: 'DELETE' });
    mutate('/api/admin/crm/templates');
  }, []);

  // Extract variables from content for live preview
  const vars = content.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/[{}]/g, '')) ?? [];

  if (isLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  const templates = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Plantillas de Mensaje</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Plantilla
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border-gray-300 text-sm"
            />
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border-gray-300 text-sm">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <textarea
            placeholder="Contenido del mensaje. Usa {{nombre}}, {{puntos}}, {{tier}} como variables."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="block w-full rounded-md border-gray-300 text-sm"
          />
          {vars.length > 0 && (
            <p className="text-xs text-blue-600">
              Variables detectadas: {vars.map((v) => `{{${v}}}`).join(', ')}
            </p>
          )}
          <button
            onClick={handleCreate}
            disabled={saving || !name || !content}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear Plantilla
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-lg border">
        {templates.map((tpl) => (
          <div key={tpl.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tpl.name}</p>
                <p className="text-xs text-gray-500">{tpl.channel} — {tpl.is_active ? 'Activa' : 'Inactiva'}</p>
              </div>
              <button
                onClick={() => handleDelete(tpl.id)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600 line-clamp-2">{tpl.content}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">Sin plantillas creadas</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------

function CampaignsTab() {
  const { data, isLoading } = useSWR<{ data: Campaign[] }>('/api/admin/crm/campaigns', fetcher);
  const { data: segData } = useSWR<{ data: Segment[] }>('/api/admin/crm/segments', fetcher);
  const { data: tplData } = useSWR<{ data: Template[] }>('/api/admin/crm/templates', fetcher);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [statsId, setStatsId] = useState<string | null>(null);
  const { data: statsData } = useSWR<Campaign & { stats: CampaignStats | null }>(
    statsId ? `/api/admin/crm/campaigns/${statsId}` : null,
    fetcher,
  );

  const handleCreate = useCallback(async () => {
    if (!name || !segmentId || !templateId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, segment_id: segmentId, template_id: templateId, channel: 'WHATSAPP' }),
      });
      if (res.ok) {
        mutate('/api/admin/crm/campaigns');
        setCreating(false);
        setName('');
      }
    } finally {
      setSaving(false);
    }
  }, [name, segmentId, templateId]);

  const handleLaunch = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/crm/campaigns/${id}/launch`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      alert(`Campaña lanzada: ${data.messagesQueued} mensajes en cola`);
      mutate('/api/admin/crm/campaigns');
    }
  }, []);

  const handleCancel = useCallback(async (id: string) => {
    await fetch(`/api/admin/crm/campaigns/${id}/cancel`, { method: 'POST' });
    mutate('/api/admin/crm/campaigns');
  }, []);

  if (isLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  const campaigns = data?.data ?? [];
  const segments = segData?.data ?? [];
  const templates = tplData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Campañas de Marketing</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <input
            type="text"
            placeholder="Nombre de la campaña"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-md border-gray-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="rounded-md border-gray-300 text-sm">
              <option value="">Seleccionar segmento...</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="rounded-md border-gray-300 text-sm">
              <option value="">Seleccionar plantilla...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name || !segmentId || !templateId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear Campaña
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-lg border">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{c.name}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-gray-500">
                {c.marketing_segments?.name ?? '—'} → {c.channel}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                <button
                  onClick={() => handleLaunch(c.id)}
                  className="rounded p-1.5 text-green-600 hover:bg-green-50"
                  title="Lanzar"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              {c.status === 'ACTIVE' && (
                <button
                  onClick={() => handleCancel(c.id)}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setStatsId(statsId === c.id ? null : c.id)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Stats"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">Sin campañas creadas</p>
        )}
      </div>

      {statsId && statsData?.stats && (
        <div className="grid grid-cols-4 gap-3 rounded-lg border bg-purple-50 p-4">
          <div className="text-center">
            <p className="text-lg font-bold">{statsData.stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-blue-600">{statsData.stats.queued}</p>
            <p className="text-xs text-gray-500">En Cola</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">{statsData.stats.sent}</p>
            <p className="text-xs text-gray-500">Enviados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-600">{statsData.stats.failed}</p>
            <p className="text-xs text-gray-500">Fallidos</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = 'segments' | 'campaigns' | 'templates';

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>('segments');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users2 className="h-6 w-6 text-pink-500" />
        <h1 className="text-xl font-semibold">CRM — Marketing</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab('segments')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'segments' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Target className="h-4 w-4" />
          Segmentos
        </button>
        <button
          onClick={() => setTab('campaigns')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'campaigns' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Send className="h-4 w-4" />
          Campañas
        </button>
        <button
          onClick={() => setTab('templates')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'templates' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <FileText className="h-4 w-4" />
          Plantillas
        </button>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border bg-white p-6">
        {tab === 'segments' && <SegmentsTab />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
}
