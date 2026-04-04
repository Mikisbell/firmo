'use client';

/**
 * Terminals Management Page v2
 * Lista de terminales con estado, códigos de activación y device binding
 *
 * Requirements: 2.1, 3.1, 6.1 (Terminal Architecture v2)
 */

import { useState } from 'react';
import { RefreshCw, Check, Wifi, WifiOff, Copy, Smartphone, Monitor, ChefHat, Wine, Plus, X, Eye } from 'lucide-react';
import TerminalDetailPanel from '@/src/components/admin/TerminalDetailPanel';
import { useTerminals } from '@/src/hooks/useSWRHooks';
import { TERMINAL_ROLE_LABELS } from '@/src/core/constants/roles';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

interface ActivationCode {
  code: string;
  expires_at: string;
}

interface TerminalDevice {
  id: string;
  terminal_id: string;
  role: string;
  status: string;
  device_name: string;
  location_id: string | null;
  bound_at: string | null;
  last_seen_at: string | null;
  drift_score: number;
  activation_code: ActivationCode | null;
}

interface Summary {
  total: number;
  active: number;
  pending: number;
  disabled: number;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  CAJA:      <Monitor className="w-4 h-4" />,
  MOZO:      <Smartphone className="w-4 h-4" />,
  KDS_COCINA: <ChefHat className="w-4 h-4" />,
  KDS_HORNO:  <ChefHat className="w-4 h-4" />,
  KDS_BAR:    <Wine className="w-4 h-4" />,
};

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical'; label: string }> = {
  active: { variant: 'success', label: 'Activo' },
  pending: { variant: 'warning', label: 'Pendiente' },
  disabled: { variant: 'critical', label: 'Deshabilitado' },
};

export default function TerminalsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);

  // Usar SWR para fetch con deduplicación y revalidación automática
  const { data, error, isLoading, mutate } = useTerminals();
  const devices = data?.devices || [];
  const summary = data?.summary || null;

  const copyCode = (code: string) => {
    const formatted = `${code.slice(0, 3)}-${code.slice(3)}`;
    navigator.clipboard.writeText(formatted);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return new Date(lastSeen).getTime() > fiveMinutesAgo;
  };

  const filteredDevices = devices.filter(d => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const handleCreateTerminal = async (formData: {
    terminal_id: string;
    role: string;
    location_id: string;
    device_name: string;
  }) => {
    try {
      setCreating(true);
      const res = await fetch('/api/admin/terminals-v2/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create terminal');
      }

      const data = await res.json();

      // Show success message with activation code
      alert(`Terminal creado exitosamente!\n\nCódigo de activación: ${data.activation_code.formatted}\nExpira: ${new Date(data.activation_code.expires_at).toLocaleString()}`);

      // Revalidar lista con SWR
      await mutate();
      setShowCreateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear terminal');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Terminales"
        description="Gestión de dispositivos con device binding"
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Nuevo Terminal
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => mutate()}
              disabled={isLoading}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total" value={summary.total} />
          <MetricCard label="Activos" value={summary.active} />
          <MetricCard label="Pendientes" value={summary.pending} />
          <MetricCard label="Deshabilitados" value={summary.disabled} />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'pending', 'disabled'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : STATUS_BADGE[f]?.label ?? f}
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Devices Grid */}
      {filteredDevices.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Smartphone />}
            title="Sin terminales"
            description={`No hay terminales ${filter !== 'all' ? `con estado "${STATUS_BADGE[filter]?.label}"` : ''}`}
            action={{ label: 'Nuevo Terminal', onClick: () => setShowCreateModal(true) }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map(device => (
            <Card key={device.id} hover>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-park-gray-700 rounded-lg">
                    {ROLE_ICONS[device.role] || <Smartphone className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{device.device_name}</p>
                    <p className="text-xs text-park-gray-500">{device.terminal_id}</p>
                  </div>
                </div>
                <Badge variant={STATUS_BADGE[device.status]?.variant ?? 'neutral'} dot>
                  {STATUS_BADGE[device.status]?.label ?? device.status}
                </Badge>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-park-gray-400">Rol</span>
                  <span className="text-white">{TERMINAL_ROLE_LABELS[device.role] || device.role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-park-gray-400">Conexión</span>
                  <span className={`flex items-center gap-1 ${isOnline(device.last_seen_at) ? 'text-green-400' : 'text-park-gray-500'}`}>
                    {isOnline(device.last_seen_at) ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isOnline(device.last_seen_at) ? 'Online' : 'Offline'}
                  </span>
                </div>
                {device.drift_score > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-park-gray-400">Drift Score</span>
                    <span className={device.drift_score > 50 ? 'text-amber-400' : 'text-white'}>{device.drift_score}%</span>
                  </div>
                )}
              </div>

              {/* Activation Code (for pending devices) */}
              {device.status === 'pending' && device.activation_code && (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-400 mb-1">Código de Activación</p>
                      <p className="font-mono font-bold tracking-wider text-white">
                        {device.activation_code.code.slice(0, 3)}-{device.activation_code.code.slice(3)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(device.activation_code!.code)}
                    >
                      {copiedCode === device.activation_code.code ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-amber-400" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-park-gray-500 mt-1">
                    Expira: {new Date(device.activation_code.expires_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Bound info (for active devices) */}
              {device.status === 'active' && device.bound_at && (
                <div className="mt-3 pt-3 border-t border-park-gray-700">
                  <p className="text-xs text-park-gray-500">
                    Vinculado: {new Date(device.bound_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* View Details Button */}
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                icon={<Eye className="w-4 h-4" />}
                onClick={() => setSelectedTerminalId(device.terminal_id)}
              >
                Ver Detalles
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Create Terminal Modal */}
      {showCreateModal && (
        <CreateTerminalModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTerminal}
          creating={creating}
        />
      )}

      {/* Terminal Detail Panel */}
      {selectedTerminalId && (
        <TerminalDetailPanel
          terminalId={selectedTerminalId}
          onClose={() => setSelectedTerminalId(null)}
          onUpdate={mutate}
        />
      )}
    </div>
  );
}

// ============ CREATE TERMINAL MODAL ============

interface CreateTerminalModalProps {
  onClose: () => void;
  onCreate: (data: {
    terminal_id: string;
    role: string;
    location_id: string;
    device_name: string;
  }) => void;
  creating: boolean;
}

function CreateTerminalModal({ onClose, onCreate, creating }: CreateTerminalModalProps) {
  const [formData, setFormData] = useState({
    terminal_id: '',
    role: 'CAJA',
    location_id: 'MAIN',
    device_name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-park-gray-900 rounded-xl border border-park-gray-700 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-park-gray-700">
          <h2 className="text-lg font-bold text-white">Crear Nuevo Terminal</h2>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-2 rounded-lg hover:bg-park-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Terminal ID */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-2">
              ID del Terminal <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.terminal_id}
              onChange={(e) => setFormData({ ...formData, terminal_id: e.target.value.toUpperCase() })}
              placeholder="CAJA_01, MOZO_01, etc."
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white"
              required
              disabled={creating}
            />
            <p className="text-xs text-park-gray-500 mt-1">
              Formato: CAJA_01, MOZO_01, SPC_HORNO, etc.
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-2">
              Rol <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white"
              required
              disabled={creating}
            >
              <option value="CAJA">Caja (CASHIER)</option>
              <option value="MOZO">Mesero (WAITER)</option>
              <option value="KDS_COCINA">Cocina (KDS)</option>
              <option value="KDS_HORNO">Horno (KDS)</option>
              <option value="KDS_BAR">Bar (KDS)</option>
            </select>
          </div>

          {/* Device Name */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-2">
              Nombre del Dispositivo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.device_name}
              onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              placeholder="iPad Caja Principal, Tablet Mesero 1, etc."
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white"
              required
              disabled={creating}
            />
          </div>

          {/* Location ID */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-2">
              Ubicación <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value.toUpperCase() })}
              placeholder="MAIN, SALON_1, COCINA, etc."
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white"
              required
              disabled={creating}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={creating}
              disabled={creating}
            >
              {creating ? 'Creando...' : 'Crear Terminal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
