'use client';

/**
 * Security Alerts Panel Component
 * 
 * Task 16.2 - Terminal Architecture v2
 * Requirements: 6.3
 * 
 * Displays active security alerts with:
 * - Alert type, severity, message, terminal, timestamp
 * - Acknowledge button for each alert
 * - Filtering by severity and acknowledged status
 * - Auto-refresh capability
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  CheckCircle, 
  RefreshCw, 
  Clock,
  Terminal as TerminalIcon,
  AlertCircle,
  XCircle
} from 'lucide-react';
import type { AlertSeverity } from '@/src/core/auth/audit-logger';

interface SecurityAlert {
  id: string;
  tenant_id: string;
  terminal_id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
}

interface SecurityAlertsPanelProps {
  /** Show only unacknowledged alerts by default */
  showOnlyUnacknowledged?: boolean;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Maximum number of alerts to display */
  limit?: number;
  /** Compact mode for dashboard embedding */
  compact?: boolean;
  /** Employee ID for acknowledging alerts */
  employeeId?: string;
}

// Severity labels and colors
const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Crítico',
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SEVERITY_ICONS: Record<AlertSeverity, React.ReactNode> = {
  low: <AlertCircle className="w-4 h-4" />,
  medium: <AlertTriangle className="w-4 h-4" />,
  high: <AlertTriangle className="w-4 h-4" />,
  critical: <XCircle className="w-4 h-4" />,
};

export default function SecurityAlertsPanel({
  showOnlyUnacknowledged = true,
  refreshInterval = 30000, // 30 seconds default
  limit = 50,
  compact = false,
  employeeId = 'ADMIN',
}: SecurityAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());
  
  // Filter states
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | ''>('');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<boolean | null>(
    showOnlyUnacknowledged ? false : null
  );

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (severityFilter) params.append('severity', severityFilter);
      if (acknowledgedFilter !== null) params.append('acknowledged', String(acknowledgedFilter));
      params.append('limit', String(limit));
      
      const res = await fetch(`/api/admin/audit/alerts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      
      const data = await res.json();
      setAlerts(data.alerts);
      setError(null);
    } catch (err) {
      setError('Error al cargar alertas de seguridad');
      console.error('Security alerts fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, acknowledgedFilter, limit]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      setAcknowledging(prev => new Set(prev).add(alertId));
      
      const res = await fetch(`/api/admin/audit/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: employeeId }),
      });
      
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      
      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, acknowledged_by: employeeId, acknowledged_at: new Date().toISOString() }
          : alert
      ));
      
      // If showing only unacknowledged, remove from list
      if (acknowledgedFilter === false) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      }
    } catch (err) {
      console.error('Acknowledge alert error:', err);
      alert('Error al reconocer la alerta. Por favor, intente nuevamente.');
    } finally {
      setAcknowledging(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;

  if (compact) {
    // Compact mode for dashboard embedding
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-medium">Alertas de Seguridad</h3>
            {unacknowledgedCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {unacknowledgedCount}
              </span>
            )}
          </div>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Alerts List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              {acknowledgedFilter === false ? 'No hay alertas pendientes' : 'No hay alertas'}
            </div>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.acknowledged 
                    ? 'bg-zinc-800/30 border-zinc-700/50 opacity-60' 
                    : SEVERITY_COLORS[alert.severity]
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {SEVERITY_ICONS[alert.severity]}
                      <span className="text-xs font-medium">
                        {SEVERITY_LABELS[alert.severity]}
                      </span>
                      <span className="text-xs text-zinc-500">•</span>
                      <span className="text-xs text-zinc-400">
                        {formatRelativeTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mb-1">{alert.message}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <TerminalIcon className="w-3 h-3" />
                      <span className="font-mono">{alert.terminal_id}</span>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledging.has(alert.id)}
                      className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs transition-colors whitespace-nowrap disabled:opacity-50"
                      title="Reconocer alerta"
                    >
                      {acknowledging.has(alert.id) ? '...' : 'OK'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Full mode for dedicated page
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold">Alertas de Seguridad</h2>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Monitoreo de anomalías y eventos de seguridad
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors min-h-[44px] min-w-[44px]"
          title="Actualizar"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <p className="text-zinc-400 text-sm">Total Alertas</p>
          <p className="text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-sm">Pendientes</p>
          <p className="text-2xl font-bold text-amber-400">{unacknowledgedCount}</p>
        </div>
        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
          <p className="text-red-400 text-sm">Críticas</p>
          <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
        </div>
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
          <p className="text-green-400 text-sm">Reconocidas</p>
          <p className="text-2xl font-bold text-green-400">
            {alerts.filter(a => a.acknowledged).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-4">
        <h3 className="text-sm font-medium">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Severidad</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | '')}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Todas las severidades</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Medio</option>
              <option value="low">Bajo</option>
            </select>
          </div>

          {/* Acknowledged Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Estado</label>
            <select
              value={acknowledgedFilter === null ? 'all' : String(acknowledgedFilter)}
              onChange={(e) => {
                const val = e.target.value;
                setAcknowledgedFilter(val === 'all' ? null : val === 'true');
              }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">Todas las alertas</option>
              <option value="false">Solo pendientes</option>
              <option value="true">Solo reconocidas</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {loading && alerts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Cargando alertas...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
            <p className="text-lg font-medium mb-1">No hay alertas</p>
            <p className="text-sm">
              {acknowledgedFilter === false 
                ? 'Todas las alertas han sido reconocidas' 
                : 'No se encontraron alertas con los filtros seleccionados'}
            </p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${
                alert.acknowledged 
                  ? 'bg-zinc-800/30 border-zinc-700/50' 
                  : SEVERITY_COLORS[alert.severity]
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    {SEVERITY_ICONS[alert.severity]}
                    <span className="font-medium">
                      {SEVERITY_LABELS[alert.severity]}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-sm text-zinc-400">{alert.alert_type}</span>
                    {alert.acknowledged && (
                      <>
                        <span className="text-zinc-500">•</span>
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Reconocida
                        </span>
                      </>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm mb-3">{alert.message}</p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <TerminalIcon className="w-3 h-3" />
                      <span className="font-mono">{alert.terminal_id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(alert.created_at)}</span>
                      <span className="text-zinc-600">({formatRelativeTime(alert.created_at)})</span>
                    </div>
                    {alert.acknowledged && alert.acknowledged_by && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" />
                        <span>Por: {alert.acknowledged_by}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging.has(alert.id)}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors whitespace-nowrap disabled:opacity-50 min-h-[44px]"
                    title="Reconocer alerta"
                  >
                    {acknowledging.has(alert.id) ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Reconocer'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
