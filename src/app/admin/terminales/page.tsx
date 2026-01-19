'use client';

/**
 * Terminals Management Page v2
 * Lista de terminales con estado, códigos de activación y device binding
 * 
 * Requirements: 2.1, 3.1, 6.1 (Terminal Architecture v2)
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, Wifi, WifiOff, Copy, Smartphone, Monitor, ChefHat, Wine, Plus, X, Eye } from 'lucide-react';
import TerminalDetailPanel from '@/src/components/admin/TerminalDetailPanel';

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
  CASHIER: <Monitor className="w-4 h-4" />,
  WAITER: <Smartphone className="w-4 h-4" />,
  KDS: <ChefHat className="w-4 h-4" />,
  BAR: <Wine className="w-4 h-4" />,
};

const ROLE_LABELS: Record<string, string> = {
  CASHIER: 'Caja',
  WAITER: 'Mesero',
  KDS: 'Cocina',
  BAR: 'Bar',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  pending: 'bg-amber-500/20 text-amber-400',
  disabled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  disabled: 'Deshabilitado',
};

export default function TerminalsPage() {
  const [devices, setDevices] = useState<TerminalDevice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/terminals-v2');
      if (!res.ok) throw new Error('Failed to fetch devices');
      const data = await res.json();
      setDevices(data.devices);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError('Error al cargar terminales');
      console.error('Devices fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

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
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create terminal');
      }

      const data = await res.json();
      
      // Show success message with activation code
      alert(`Terminal creado exitosamente!\n\nCódigo de activación: ${data.activation_code.formatted}\nExpira: ${new Date(data.activation_code.expires_at).toLocaleString()}`);
      
      // Refresh list
      await fetchDevices();
      setShowCreateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear terminal');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Terminales v2</h1>
          <p className="text-zinc-400 mt-1">Gestión de dispositivos con device binding</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            Nuevo Terminal
          </button>
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors min-h-[44px] min-w-[44px]"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <p className="text-zinc-400 text-sm">Total</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-green-400 text-sm">Activos</p>
            <p className="text-2xl font-bold text-green-400">{summary.active}</p>
          </div>
          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <p className="text-amber-400 text-sm">Pendientes</p>
            <p className="text-2xl font-bold text-amber-400">{summary.pending}</p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <p className="text-red-400 text-sm">Deshabilitados</p>
            <p className="text-2xl font-bold text-red-400">{summary.disabled}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'active', 'pending', 'disabled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f === 'all' ? 'Todos' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Devices Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map(device => (
            <div
              key={device.id}
              className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-zinc-700 rounded-lg">
                    {ROLE_ICONS[device.role] || <Smartphone className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium">{device.device_name}</p>
                    <p className="text-xs text-zinc-500">{device.terminal_id}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[device.status]}`}>
                  {STATUS_LABELS[device.status]}
                </span>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Rol</span>
                  <span>{ROLE_LABELS[device.role] || device.role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Conexión</span>
                  <span className={`flex items-center gap-1 ${isOnline(device.last_seen_at) ? 'text-green-400' : 'text-zinc-500'}`}>
                    {isOnline(device.last_seen_at) ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isOnline(device.last_seen_at) ? 'Online' : 'Offline'}
                  </span>
                </div>
                {device.drift_score > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Drift Score</span>
                    <span className={device.drift_score > 50 ? 'text-amber-400' : ''}>{device.drift_score}%</span>
                  </div>
                )}
              </div>

              {/* Activation Code (for pending devices) */}
              {device.status === 'pending' && device.activation_code && (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-400 mb-1">Código de Activación</p>
                      <p className="font-mono font-bold tracking-wider">
                        {device.activation_code.code.slice(0, 3)}-{device.activation_code.code.slice(3)}
                      </p>
                    </div>
                    <button
                      onClick={() => copyCode(device.activation_code!.code)}
                      className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                      title="Copiar código"
                    >
                      {copiedCode === device.activation_code.code ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Expira: {new Date(device.activation_code.expires_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Bound info (for active devices) */}
              {device.status === 'active' && device.bound_at && (
                <div className="mt-3 pt-3 border-t border-zinc-700">
                  <p className="text-xs text-zinc-500">
                    Vinculado: {new Date(device.bound_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* View Details Button */}
              <button
                onClick={() => setSelectedTerminalId(device.terminal_id)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                Ver Detalles
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredDevices.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No hay terminales {filter !== 'all' ? `con estado "${STATUS_LABELS[filter]}"` : ''}
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
          onUpdate={fetchDevices}
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
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-bold">Crear Nuevo Terminal</h2>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Terminal ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ID del Terminal <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.terminal_id}
              onChange={(e) => setFormData({ ...formData, terminal_id: e.target.value.toUpperCase() })}
              placeholder="CAJA_01, MOZO_01, etc."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-500"
              required
              disabled={creating}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Formato: CAJA_01, MOZO_01, SPC_HORNO, etc.
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Rol <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-500"
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
            <label className="block text-sm font-medium mb-2">
              Nombre del Dispositivo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.device_name}
              onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              placeholder="iPad Caja Principal, Tablet Mesero 1, etc."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-500"
              required
              disabled={creating}
            />
          </div>

          {/* Location ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ubicación <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value.toUpperCase() })}
              placeholder="MAIN, SALON_1, COCINA, etc."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-500"
              required
              disabled={creating}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear Terminal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
