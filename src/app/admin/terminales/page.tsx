'use client';

/**
 * Terminals Management Page
 * Lista de terminales con estado, rangos y activación
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, X, Wifi, WifiOff, Copy, Key } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';

interface Terminal {
  id: string;
  terminal_id: string;
  station_id: string | null;
  is_allowed: boolean;
  last_seen_at: string | null;
}

interface ActivationCode {
  code: string;
  expires_at: string;
}

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Revocado' },
];

const filters: FilterConfig[] = [
  { key: 'is_allowed', label: 'Estado', options: STATUS_OPTIONS },
];

export default function TerminalsPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<ActivationCode | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchTerminals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/terminals');
      if (!res.ok) throw new Error('Failed to fetch terminals');
      const data = await res.json();
      setTerminals(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar terminales');
      console.error('Terminals fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  const generateActivationCode = async () => {
    try {
      setGenerating(true);
      const res = await fetch('/api/admin/terminals/activate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate code');
      const data = await res.json();
      setActivationCode(data);
    } catch (err) {
      setError('Error al generar código');
      console.error('Activation code error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (activationCode) {
      navigator.clipboard.writeText(activationCode.code);
    }
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return new Date(lastSeen).getTime() > fiveMinutesAgo;
  };

  const columns: Column<Terminal>[] = [
    { key: 'terminal_id', label: 'Terminal ID' },
    {
      key: 'status',
      label: 'Conexión',
      width: '120px',
      render: (t) => {
        const online = isOnline(t.last_seen_at);
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              online
                ? 'bg-green-500/20 text-green-400'
                : 'bg-zinc-500/20 text-zinc-400'
            }`}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'Online' : 'Offline'}
          </span>
        );
      },
    },
    {
      key: 'last_seen_at',
      label: 'Última conexión',
      render: (t) =>
        t.last_seen_at
          ? new Date(t.last_seen_at).toLocaleString()
          : 'Nunca',
    },
    {
      key: 'is_allowed',
      label: 'Estado',
      width: '100px',
      render: (t) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            t.is_allowed
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {t.is_allowed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {t.is_allowed ? 'Activo' : 'Revocado'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Terminales</h1>
          <p className="text-zinc-400 mt-1">Gestionar dispositivos conectados</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTerminals}
            disabled={loading}
            className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors min-h-[44px] min-w-[44px]"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={generateActivationCode}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
          >
            <Key className="w-4 h-4" />
            {generating ? 'Generando...' : 'Nuevo Código'}
          </button>
        </div>
      </div>

      {/* Activation code display */}
      {activationCode && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-400 mb-1">Código de Activación</p>
              <p className="text-2xl font-mono font-bold tracking-wider">
                {activationCode.code}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Expira: {new Date(activationCode.expires_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="p-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors min-h-[44px] min-w-[44px]"
              title="Copiar código"
            >
              <Copy className="w-5 h-5 text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Terminals table */}
      <DataTable
        data={terminals}
        columns={columns}
        filters={filters}
        searchPlaceholder="Buscar por ID..."
        searchKeys={['terminal_id']}
        loading={loading}
        emptyMessage="No hay terminales registrados"
      />
    </div>
  );
}
