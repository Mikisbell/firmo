'use client';

/**
 * Audit Page - Authentication Events Log & Security Alerts
 * 
 * Task 16.1, 16.2 - Terminal Architecture v2
 * Requirements: 6.3, 6.4
 * 
 * Lists all authentication events with filters:
 * - Date range
 * - Terminal ID
 * - Employee ID
 * - Event type
 * 
 * Also displays security alerts panel
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import SecurityAlertsPanel from '@/src/components/admin/SecurityAlertsPanel';
import type { AuthEventType } from '@/src/core/auth/audit-logger';

interface AuthEvent {
  id: string;
  tenant_id: string;
  terminal_id: string;
  employee_id: string | null;
  event_type: AuthEventType;
  risk_score: number | null;
  fingerprint_match: number | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ApiResponse {
  events: AuthEvent[];
  count: number;
  filters: {
    terminal_id?: string;
    employee_id?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    limit: number;
  };
}

// Event type labels and colors
const EVENT_TYPE_LABELS: Record<AuthEventType, string> = {
  terminal_created: 'Terminal Creado',
  activation_code_generated: 'Código Generado',
  device_activated: 'Dispositivo Activado',
  login_success: 'Login Exitoso',
  login_failed: 'Login Fallido',
  logout: 'Logout',
  session_expired: 'Sesión Expirada',
  fingerprint_drift_detected: 'Drift Detectado',
  step_up_auth_required: 'Auth Adicional',
  step_up_auth_success: 'Auth Adicional Exitosa',
  step_up_auth_failed: 'Auth Adicional Fallida',
  terminal_disabled: 'Terminal Deshabilitado',
  security_alert: 'Alerta de Seguridad',
};

const EVENT_TYPE_COLORS: Record<AuthEventType, string> = {
  terminal_created: 'bg-blue-500/20 text-blue-400',
  activation_code_generated: 'bg-cyan-500/20 text-cyan-400',
  device_activated: 'bg-green-500/20 text-green-400',
  login_success: 'bg-green-500/20 text-green-400',
  login_failed: 'bg-red-500/20 text-red-400',
  logout: 'bg-zinc-500/20 text-zinc-400',
  session_expired: 'bg-amber-500/20 text-amber-400',
  fingerprint_drift_detected: 'bg-orange-500/20 text-orange-400',
  step_up_auth_required: 'bg-amber-500/20 text-amber-400',
  step_up_auth_success: 'bg-green-500/20 text-green-400',
  step_up_auth_failed: 'bg-red-500/20 text-red-400',
  terminal_disabled: 'bg-red-500/20 text-red-400',
  security_alert: 'bg-red-500/20 text-red-400',
};

const EVENT_TYPE_ICONS: Record<AuthEventType, React.ReactNode> = {
  terminal_created: <Shield className="w-3 h-3" />,
  activation_code_generated: <Shield className="w-3 h-3" />,
  device_activated: <CheckCircle className="w-3 h-3" />,
  login_success: <CheckCircle className="w-3 h-3" />,
  login_failed: <XCircle className="w-3 h-3" />,
  logout: <Shield className="w-3 h-3" />,
  session_expired: <Clock className="w-3 h-3" />,
  fingerprint_drift_detected: <AlertTriangle className="w-3 h-3" />,
  step_up_auth_required: <AlertTriangle className="w-3 h-3" />,
  step_up_auth_success: <CheckCircle className="w-3 h-3" />,
  step_up_auth_failed: <XCircle className="w-3 h-3" />,
  terminal_disabled: <XCircle className="w-3 h-3" />,
  security_alert: <AlertTriangle className="w-3 h-3" />,
};

export default function AuditoriaPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'alerts'>('events');
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [terminalFilter, setTerminalFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Unique values for filters
  const [terminals, setTerminals] = useState<string[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (terminalFilter) params.append('terminal_id', terminalFilter);
      if (employeeFilter) params.append('employee_id', employeeFilter);
      if (eventTypeFilter) params.append('event_type', eventTypeFilter);
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      params.append('limit', '500'); // Get more events for better filtering
      
      const res = await fetch(`/api/admin/audit/events?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      
      const data: ApiResponse = await res.json();
      setEvents(data.events);
      
      // Extract unique terminals and employees for filters
      const uniqueTerminals = Array.from(new Set(data.events.map(e => e.terminal_id))).sort();
      const uniqueEmployees = Array.from(
        new Set(data.events.map(e => e.employee_id).filter(Boolean) as string[])
      ).sort();
      
      setTerminals(uniqueTerminals);
      setEmployees(uniqueEmployees);
      setError(null);
    } catch (err) {
      setError('Error al cargar eventos de auditoría');
      console.error('Audit events fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [terminalFilter, employeeFilter, eventTypeFilter, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleClearFilters = () => {
    setTerminalFilter('');
    setEmployeeFilter('');
    setEventTypeFilter('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = terminalFilter || employeeFilter || eventTypeFilter || startDate || endDate;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Risk score badge
  const getRiskBadge = (score: number | null) => {
    if (score === null) return null;
    
    let color = 'bg-green-500/20 text-green-400';
    if (score >= 70) color = 'bg-red-500/20 text-red-400';
    else if (score >= 40) color = 'bg-amber-500/20 text-amber-400';
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${color}`}>
        {score}
      </span>
    );
  };

  // Fingerprint match badge
  const getFingerprintBadge = (match: number | null) => {
    if (match === null) return <span className="text-zinc-500 text-xs">N/A</span>;
    
    let color = 'text-red-400';
    if (match >= 70) color = 'text-green-400';
    else if (match >= 50) color = 'text-amber-400';
    
    return <span className={`text-xs ${color}`}>{match}%</span>;
  };

  // Event type options for filter
  const eventTypeOptions = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const columns: Column<AuthEvent>[] = [
    {
      key: 'created_at',
      label: 'Fecha/Hora',
      width: '180px',
      render: (e) => (
        <div className="flex items-center gap-2" data-testid="audit-log-entry">
          <Calendar className="w-3 h-3 text-zinc-500" />
          <span className="text-xs">{formatDate(e.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'event_type',
      label: 'Evento',
      width: '200px',
      render: (e) => (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${EVENT_TYPE_COLORS[e.event_type]}`}>
          {EVENT_TYPE_ICONS[e.event_type]}
          {EVENT_TYPE_LABELS[e.event_type]}
        </span>
      ),
    },
    {
      key: 'terminal_id',
      label: 'Terminal',
      width: '120px',
      render: (e) => <span className="text-xs font-mono">{e.terminal_id}</span>,
    },
    {
      key: 'employee_id',
      label: 'Empleado',
      width: '120px',
      render: (e) => (
        <span className="text-xs font-mono">
          {e.employee_id || <span className="text-zinc-500">—</span>}
        </span>
      ),
    },
    {
      key: 'risk_score',
      label: 'Riesgo',
      width: '80px',
      render: (e) => getRiskBadge(e.risk_score),
    },
    {
      key: 'fingerprint_match',
      label: 'Fingerprint',
      width: '100px',
      render: (e) => getFingerprintBadge(e.fingerprint_match),
    },
    {
      key: 'ip_address',
      label: 'IP',
      width: '120px',
      render: (e) => <span className="text-xs font-mono text-zinc-400">{e.ip_address}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoría de Seguridad</h1>
          <p className="text-zinc-400 mt-1">Eventos de autenticación y alertas de seguridad</p>
        </div>
        <button
          onClick={activeTab === 'events' ? fetchEvents : undefined}
          disabled={loading}
          className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors min-h-[44px] min-w-[44px]"
          title="Actualizar"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-700">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'events'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-300'
          }`}
        >
          Eventos de Autenticación
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'alerts'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-300'
          }`}
        >
          Alertas de Seguridad
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'events' ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <p className="text-zinc-400 text-sm">Total Eventos</p>
              <p className="text-2xl font-bold">{events.length}</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-green-400 text-sm">Login Exitoso</p>
              <p className="text-2xl font-bold text-green-400">
                {events.filter(e => e.event_type === 'login_success').length}
              </p>
            </div>
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-red-400 text-sm">Login Fallido</p>
              <p className="text-2xl font-bold text-red-400">
                {events.filter(e => e.event_type === 'login_failed').length}
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <p className="text-amber-400 text-sm">Alertas</p>
              <p className="text-2xl font-bold text-amber-400">
                {events.filter(e => e.event_type === 'security_alert' || e.event_type === 'fingerprint_drift_detected').length}
              </p>
            </div>
          </div>

      {/* Filters */}
      <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Filtros</h2>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Fecha Inicio</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">Fecha Fin</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Terminal Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Terminal</label>
            <select
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Todos los terminales</option>
              {terminals.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Empleado</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Todos los empleados</option>
              {employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Tipo de Evento</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Todos los eventos</option>
              {eventTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Events Table */}
      <DataTable
        data={events}
        columns={columns}
        searchPlaceholder="Buscar en eventos..."
        searchKeys={['terminal_id', 'employee_id', 'ip_address']}
        loading={loading}
        emptyMessage="No hay eventos de auditoría"
        pageSize={20}
      />
        </>
      ) : (
        /* Alerts Tab */
        <SecurityAlertsPanel 
          showOnlyUnacknowledged={false}
          refreshInterval={30000}
          limit={100}
          employeeId="ADMIN"
        />
      )}
    </div>
  );
}

