'use client';

/**
 * Admin CRM Page
 * Marketing: Segments, Campaigns, Templates management
 */

import { useState, useCallback } from 'react';
import { Users2, Target, Send, FileText, Plus, Loader2, Play, X, Eye, BarChart3 } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

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
// Status Badge mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'critical'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  COMPLETED: 'warning',
  CANCELLED: 'critical',
};

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const segments = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Segmentos de Clientes</h3>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreating(!creating)}
        >
          Nuevo Segmento
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nombre del segmento"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2"
            />
            <div className="grid grid-cols-3 gap-2">
              <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2">
                <option value="rfm_segment">Segmento RFM</option>
                <option value="loyalty_tier">Tier Lealtad</option>
                <option value="monetary_30d">Gasto 30d (centavos)</option>
                <option value="frequency_30d">Frecuencia 30d</option>
                <option value="recency_days">Recencia (dias)</option>
                <option value="orders_count">Total Pedidos</option>
              </select>
              <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)} className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2">
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
                className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={saving || !name || !filterValue}
              loading={saving}
            >
              Crear Segmento
            </Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-park-gray-800">
          {segments.map((seg) => (
            <div key={seg.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{seg.name}</p>
                <p className="text-xs text-park-gray-500">
                  {seg.definition.type} — {seg.definition.filters.length} filtro(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewId(previewId === seg.id ? null : seg.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(seg.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {segments.length === 0 && (
            <div className="p-4 text-center text-sm text-park-gray-500">Sin segmentos creados</div>
          )}
        </div>
      </Card>

      {previewId && previewData && (
        <Card className="border-blue-500/20">
          <p className="mb-2 text-sm font-medium text-white">
            {previewData.count ?? 0} clientes en este segmento
          </p>
          <div className="max-h-40 overflow-y-auto text-sm">
            {(previewData.customers ?? []).slice(0, 10).map((c: any) => (
              <div key={c.id} className="flex justify-between py-1">
                <span className="text-park-gray-200">{c.name ?? c.phone}</span>
                <span className="text-park-gray-500">{c.rfm_segment ?? '-'} / {c.loyalty_tier ?? '-'}</span>
              </div>
            ))}
          </div>
        </Card>
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

  const vars = content.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/[{}]/g, '')) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const templates = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Plantillas de Mensaje</h3>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreating(!creating)}
        >
          Nueva Plantilla
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2"
              />
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <textarea
              placeholder="Contenido del mensaje. Usa {{nombre}}, {{puntos}}, {{tier}} como variables."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="block w-full rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2"
            />
            {vars.length > 0 && (
              <p className="text-xs text-blue-400">
                Variables detectadas: {vars.map((v) => `{{${v}}}`).join(', ')}
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={saving || !name || !content}
              loading={saving}
            >
              Crear Plantilla
            </Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-park-gray-800">
          {templates.map((tpl) => (
            <div key={tpl.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{tpl.name}</p>
                  <p className="text-xs text-park-gray-500">
                    {tpl.channel} — <Badge variant={tpl.is_active ? 'success' : 'neutral'} size="sm">{tpl.is_active ? 'Activa' : 'Inactiva'}</Badge>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tpl.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-park-gray-400 line-clamp-2">{tpl.content}</p>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="p-4 text-center text-sm text-park-gray-500">Sin plantillas creadas</div>
          )}
        </div>
      </Card>
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
      alert(`Campana lanzada: ${data.messagesQueued} mensajes en cola`);
      mutate('/api/admin/crm/campaigns');
    }
  }, []);

  const handleCancel = useCallback(async (id: string) => {
    await fetch(`/api/admin/crm/campaigns/${id}/cancel`, { method: 'POST' });
    mutate('/api/admin/crm/campaigns');
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const campaigns = data?.data ?? [];
  const segments = segData?.data ?? [];
  const templates = tplData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Campanas de Marketing</h3>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreating(!creating)}
        >
          Nueva Campana
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nombre de la campana"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2">
                <option value="">Seleccionar segmento...</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="rounded-lg bg-park-gray-800 border border-park-gray-700 text-sm px-3 py-2">
                <option value="">Seleccionar plantilla...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={saving || !name || !segmentId || !templateId}
              loading={saving}
            >
              Crear Campana
            </Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-park-gray-800">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'}>{c.status}</Badge>
                </div>
                <p className="text-xs text-park-gray-500">
                  {c.marketing_segments?.name ?? '\u2014'} → {c.channel}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLaunch(c.id)}
                    className="text-green-400"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {c.status === 'ACTIVE' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(c.id)}
                    className="text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatsId(statsId === c.id ? null : c.id)}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="p-4 text-center text-sm text-park-gray-500">Sin campanas creadas</div>
          )}
        </div>
      </Card>

      {statsId && statsData?.stats && (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Total" value={statsData.stats.total} />
          <MetricCard label="En Cola" value={statsData.stats.queued} />
          <MetricCard label="Enviados" value={statsData.stats.sent} />
          <MetricCard label="Fallidos" value={statsData.stats.failed} />
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
    <div className="p-4 space-y-6">
      <PageHeader
        title="CRM"
        description="Marketing: segmentos, campanas y plantillas"
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-park-gray-900 p-1 border border-park-gray-800">
        <Button
          variant={tab === 'segments' ? 'primary' : 'ghost'}
          size="sm"
          icon={<Target className="h-4 w-4" />}
          onClick={() => setTab('segments')}
        >
          Segmentos
        </Button>
        <Button
          variant={tab === 'campaigns' ? 'primary' : 'ghost'}
          size="sm"
          icon={<Send className="h-4 w-4" />}
          onClick={() => setTab('campaigns')}
        >
          Campanas
        </Button>
        <Button
          variant={tab === 'templates' ? 'primary' : 'ghost'}
          size="sm"
          icon={<FileText className="h-4 w-4" />}
          onClick={() => setTab('templates')}
        >
          Plantillas
        </Button>
      </div>

      {/* Tab Content */}
      {tab === 'segments' && <SegmentsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}
