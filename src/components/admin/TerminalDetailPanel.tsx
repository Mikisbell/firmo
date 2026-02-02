/**
 * Terminal Detail Panel Component
 * 
 * Shows detailed information about a terminal device with options to:
 * - Regenerate activation code (for pending terminals)
 * - Disable/enable terminal
 * - View activation code history
 * - View device binding information
 * 
 * Requirements: 2.1, 3.3 (Terminal Architecture v2)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Power,
  PowerOff,
  Copy,
  Check,
  Clock,
  Fingerprint,
  MapPin,
  Monitor,
  AlertTriangle,
  History,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ============ TYPES ============

interface ActivationCodeHistory {
  id: string;
  code: string;
  expires_at: string;
  attempts: number;
  used: boolean;
  created_by: string;
  created_at: string;
}

interface TerminalDevice {
  id: string;
  terminal_id: string;
  tenant_id: string;
  role: string;
  status: string;
  device_name: string;
  location_id: string;
  fingerprint_hash: string | null;
  bound_at: string | null;
  last_seen_at: string | null;
  last_fingerprint_check: string | null;
  drift_score: number;
  created_at: string;
  updated_at: string;
}

interface TerminalDetailData {
  terminal: TerminalDevice;
  activation_codes: ActivationCodeHistory[];
  current_code: ActivationCodeHistory | null;
}

interface TerminalDetailPanelProps {
  terminalId: string;
  onClose: () => void;
  onUpdate: () => void;
}

// ============ CONSTANTS ============

const ROLE_LABELS: Record<string, string> = {
  CAJA: 'Caja',
  MOZO: 'Mesero',
  KDS_COCINA: 'Cocina',
  KDS_HORNO: 'Horno',
  KDS_BAR: 'Bar',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  disabled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  disabled: 'Deshabilitado',
};

// ============ COMPONENT ============

export default function TerminalDetailPanel({ terminalId, onClose, onUpdate }: TerminalDetailPanelProps) {
  const [data, setData] = useState<TerminalDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch terminal details
  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/terminals-v2/${terminalId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch terminal details');
      const data = await res.json();
      setData(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar detalles del terminal');
      console.error('Terminal details fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [terminalId]);

  const copyCode = (code: string) => {
    const formatted = `${code.slice(0, 3)}-${code.slice(3)}`;
    navigator.clipboard.writeText(formatted);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!confirm('¿Generar un nuevo código de activación? El código anterior será invalidado.')) {
      return;
    }

    try {
      setActionLoading('regenerate');
      const res = await fetch(`/api/admin/terminals-v2/${terminalId}/regenerate-code`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to regenerate code');
      }

      const result = await res.json();
      alert(`Nuevo código generado:\n\n${result.code.formatted}\n\nExpira: ${new Date(result.code.expires_at).toLocaleString()}`);
      
      await fetchDetails();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al generar código');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!data) return;

    const newStatus = data.terminal.status === 'disabled' ? 'active' : 'disabled';
    const action = newStatus === 'disabled' ? 'deshabilitar' : 'habilitar';

    if (!confirm(`¿Está seguro de ${action} este terminal?`)) {
      return;
    }

    try {
      setActionLoading('toggle');
      const res = await fetch(`/api/admin/terminals-v2/${terminalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      await fetchDetails();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbind = async () => {
    if (!data || data.terminal.status === 'pending') return;

    if (!confirm('¿Está seguro de desvincular este terminal?\n\nEl dispositivo actual se desvinculará y se podrá activar en un nuevo dispositivo.')) {
      return;
    }

    try {
      setActionLoading('unbind');
      const res = await fetch(`/api/admin/terminals-v2/${terminalId}/unbind`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        const errorDetails = data.details ? `\n\nDetalles: ${JSON.stringify(data.details, null, 2)}` : '';
        throw new Error((data.error || 'Failed to unbind terminal') + errorDetails);
      }

      const result = await res.json();
      alert(`Terminal desvinculado exitosamente.\n\nSe ha generado un nuevo código de activación para vincular un nuevo dispositivo.`);

      await fetchDetails();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desvincular terminal');
    } finally {
      setActionLoading(null);
    }
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return new Date(lastSeen).getTime() > fiveMinutesAgo;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="p-6 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl p-6">
          <div className="text-red-400 mb-4">{error || 'Terminal no encontrado'}</div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { terminal, activation_codes, current_code } = data;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-bold">{terminal.device_name}</h2>
            <p className="text-sm text-zinc-400">{terminal.terminal_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Status & Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase">Información General</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Estado</p>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[terminal.status]}`}>
                  {STATUS_LABELS[terminal.status]}
                </span>
              </div>

              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Rol</p>
                <p className="font-medium">{ROLE_LABELS[terminal.role] || terminal.role}</p>
              </div>

              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Ubicación
                </p>
                <p className="font-medium">{terminal.location_id}</p>
              </div>

              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  {isOnline(terminal.last_seen_at) ? (
                    <Wifi className="w-3 h-3 text-green-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-zinc-500" />
                  )}
                  Conexión
                </p>
                <p className={`font-medium ${isOnline(terminal.last_seen_at) ? 'text-green-400' : 'text-zinc-500'}`}>
                  {isOnline(terminal.last_seen_at) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          {/* Device Binding Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              Device Binding
            </h3>

            {terminal.fingerprint_hash ? (
              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Fingerprint Hash</span>
                  <span className="text-xs font-mono text-green-400">Vinculado</span>
                </div>
                <p className="text-xs font-mono text-zinc-400 break-all">
                  {terminal.fingerprint_hash.slice(0, 32)}...
                </p>
                
                {terminal.bound_at && (
                  <div className="pt-2 border-t border-zinc-700">
                    <p className="text-xs text-zinc-500">
                      Vinculado: {formatDate(terminal.bound_at)}
                    </p>
                  </div>
                )}

                {terminal.drift_score > 0 && (
                  <div className="pt-2 border-t border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Drift Score</span>
                      <span className={`text-xs font-medium ${terminal.drift_score > 50 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {terminal.drift_score}%
                      </span>
                    </div>
                    {terminal.drift_score > 50 && (
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Requiere re-activación
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <p className="text-sm text-amber-400">
                  Este terminal no tiene un dispositivo vinculado
                </p>
              </div>
            )}
          </div>

          {/* Current Activation Code */}
          {terminal.status === 'pending' && current_code && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase">Código de Activación Actual</h3>
              
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-amber-400 mb-1">Código</p>
                    <p className="text-2xl font-mono font-bold tracking-wider">
                      {current_code.code.slice(0, 3)}-{current_code.code.slice(3)}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(current_code.code)}
                    className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                    title="Copiar código"
                  >
                    {copiedCode === current_code.code ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-amber-400" />
                    )}
                  </button>
                </div>

                <div className="space-y-1 text-xs text-zinc-400">
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expira: {formatDate(current_code.expires_at)}
                  </p>
                  <p>Intentos: {current_code.attempts} / 5</p>
                </div>
              </div>
            </div>
          )}

          {/* Activation Code History */}
          {activation_codes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
                <History className="w-4 h-4" />
                Historial de Códigos
              </h3>

              <div className="space-y-2">
                {activation_codes.map((code) => (
                  <div
                    key={code.id}
                    className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-medium">
                        {code.code.slice(0, 3)}-{code.code.slice(3)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        code.used ? 'bg-zinc-700 text-zinc-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {code.used ? 'Usado' : 'Activo'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 space-y-1">
                      <p>Creado: {formatDate(code.created_at)}</p>
                      <p>Expira: {formatDate(code.expires_at)}</p>
                      <p>Intentos: {code.attempts}</p>
                      <p>Por: {code.created_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase">Timestamps</h3>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 mb-1">Creado</p>
                <p>{formatDate(terminal.created_at)}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 mb-1">Actualizado</p>
                <p>{formatDate(terminal.updated_at)}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 mb-1">Última Conexión</p>
                <p>{formatDate(terminal.last_seen_at)}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 mb-1">Último Check Fingerprint</p>
                <p>{formatDate(terminal.last_fingerprint_check)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-zinc-700 flex gap-2">
          {terminal.status === 'pending' && (
            <button
              onClick={handleRegenerateCode}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'regenerate' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Regenerar Código
            </button>
          )}

          {terminal.status !== 'pending' && (
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading !== null}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-medium rounded-lg transition-colors disabled:opacity-50 ${
                terminal.status === 'disabled'
                  ? 'bg-green-500 hover:bg-green-600 text-black'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {actionLoading === 'toggle' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : terminal.status === 'disabled' ? (
                <Power className="w-4 h-4" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
              {terminal.status === 'disabled' ? 'Habilitar' : 'Deshabilitar'}
            </button>
          )}

          {terminal.status !== 'pending' && terminal.status !== 'disabled' && (
            <button
              onClick={handleUnbind}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              title="Desvincular dispositivo y permitir reactivación en nuevo dispositivo"
            >
              {actionLoading === 'unbind' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Desvincular
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            disabled={actionLoading !== null}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
