'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  RefreshCw,
  Filter,
  X,
  Calendar,
  Monitor,
  User,
  Fingerprint,
  Globe,
} from 'lucide-react';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState, DatePicker } from '@/src/components/ui';
import { useQueryStates } from '@/src/hooks/useQueryState';

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: string;
  terminal_id: string;
  employee_id: string;
  status: string;
  details: string;
}

interface AuditStats {
  total: number;
  login_success: number;
  login_failed: number;
  alerts: number;
}

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    login_success: 0,
    login_failed: 0,
    alerts: 0
  });
  const [filters, setFilters] = useQueryStates({
    startDate: '',
    endDate: '',
    terminal: '',
    employee: '',
    eventType: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.terminal) queryParams.append('terminal', filters.terminal);
      if (filters.employee) queryParams.append('employee', filters.employee);
      if (filters.eventType) queryParams.append('eventType', filters.eventType);

      const response = await fetch(`/api/admin/audit-log?${queryParams.toString()}`);
      const data = await response.json();
      setEvents(data.events || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      terminal: '',
      employee: '',
      eventType: ''
    });
  };

  const applyFilters = () => {
    loadAuditData();
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const getEventBadge = (eventType: string): { label: string; variant: 'success' | 'critical' | 'warning' } => {
    switch (eventType) {
      case 'login_success':
        return { label: 'Login Exitoso', variant: 'success' };
      case 'login_failed':
        return { label: 'Login Fallido', variant: 'critical' };
      default:
        return { label: 'Alerta de Seguridad', variant: 'warning' };
    }
  };

  const getRiskBadge = (status: string): { label: string; variant: 'success' | 'critical' | 'warning' } => {
    switch (status) {
      case 'success':
        return { label: 'BAJO', variant: 'success' };
      case 'failed':
        return { label: 'ALTO', variant: 'critical' };
      default:
        return { label: 'MEDIO', variant: 'warning' };
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro completo de eventos de seguridad"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={applyFilters}
            disabled={isLoading}
          >
            Actualizar
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Eventos"
          value={stats.total}
          icon={<Activity className="w-5 h-5 text-blue-400" />}
        />
        <MetricCard
          label="Login Exitoso"
          value={stats.login_success}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          label="Login Fallido"
          value={stats.login_failed}
          icon={<XCircle className="w-5 h-5 text-red-400" />}
        />
        <MetricCard
          label="Alertas"
          value={stats.alerts}
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-park-gray-400" />
          <span className="text-sm font-medium text-park-gray-300">Filtros</span>
          {hasActiveFilters && (
            <Badge variant="warning">Activos</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <DatePicker
              id="start-date"
              label="Fecha Inicio"
              value={filters.startDate}
              onChange={(v) => setFilters({ ...filters, startDate: v })}
            />
          </div>
          <div>
            <DatePicker
              id="end-date"
              label="Fecha Fin"
              value={filters.endDate}
              onChange={(v) => setFilters({ ...filters, endDate: v })}
            />
          </div>
          <div>
            <label htmlFor="terminal" className="block text-xs text-park-gray-500 mb-1.5">
              <Monitor className="w-3 h-3 inline mr-1" />
              Terminal
            </label>
            <select
              id="terminal"
              aria-label="Terminal"
              value={filters.terminal}
              onChange={(e) => setFilters({...filters, terminal: e.target.value})}
              className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-park-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
              <option value="CAJA-01">CAJA-01</option>
              <option value="MOZO-01">MOZO-01</option>
              <option value="KDS-01">KDS-01</option>
            </select>
          </div>
          <div>
            <label htmlFor="employee" className="block text-xs text-park-gray-500 mb-1.5">
              <User className="w-3 h-3 inline mr-1" />
              Empleado
            </label>
            <select
              id="employee"
              aria-label="Empleado"
              value={filters.employee}
              onChange={(e) => setFilters({...filters, employee: e.target.value})}
              className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-park-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label htmlFor="event-type" className="block text-xs text-park-gray-500 mb-1.5">
              <Shield className="w-3 h-3 inline mr-1" />
              Tipo de Evento
            </label>
            <select
              id="event-type"
              aria-label="Tipo de Evento"
              value={filters.eventType}
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-park-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
              <option value="login_success">Login Exitoso</option>
              <option value="login_failed">Login Fallido</option>
              <option value="security_alert">Alerta de Seguridad</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<X className="w-3.5 h-3.5" />}
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Limpiar filtros
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Filter className="w-3.5 h-3.5" />}
            onClick={applyFilters}
          >
            Aplicar
          </Button>
        </div>
      </Card>

      {/* Events Table */}
      <Card padding="none">
        {events.length === 0 ? (
          <EmptyState
            icon={<Shield />}
            title="Sin eventos de auditoría"
            description="No hay eventos de auditoría para los filtros seleccionados"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Evento</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Terminal</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Empleado</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Riesgo</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Fingerprint</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const eventBadge = getEventBadge(event.event_type);
                  const riskBadge = getRiskBadge(event.status);
                  return (
                    <tr key={event.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-park-gray-300 whitespace-nowrap">
                        {new Date(event.timestamp).toLocaleString('es-PE')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={eventBadge.variant} dot>{eventBadge.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-park-gray-300">
                          <Monitor className="w-3.5 h-3.5 text-park-gray-500" />
                          {event.terminal_id || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-park-gray-300">
                          <User className="w-3.5 h-3.5 text-park-gray-500" />
                          {event.employee_id || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={riskBadge.variant} size="sm">{riskBadge.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-park-gray-500 font-mono">
                          <Fingerprint className="w-3 h-3" />
                          abc123...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-park-gray-500 font-mono">
                          <Globe className="w-3 h-3" />
                          192.168.1.1
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
