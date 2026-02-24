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

const STAT_CARDS = [
  {
    key: 'total' as const,
    label: 'Total Eventos',
    icon: Activity,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20',
  },
  {
    key: 'login_success' as const,
    label: 'Login Exitoso',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
  },
  {
    key: 'login_failed' as const,
    label: 'Login Fallido',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    iconBg: 'bg-red-500/20',
  },
  {
    key: 'alerts' as const,
    label: 'Alertas',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
  },
];

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    login_success: 0,
    login_failed: 0,
    alerts: 0
  });
  const [filters, setFilters] = useState({
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

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'login_success':
        return { label: 'Login Exitoso', className: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30' };
      case 'login_failed':
        return { label: 'Login Fallido', className: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' };
      default:
        return { label: 'Alerta de Seguridad', className: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30' };
    }
  };

  const getRiskBadge = (status: string) => {
    switch (status) {
      case 'success':
        return { label: 'BAJO', className: 'text-emerald-400' };
      case 'failed':
        return { label: 'ALTO', className: 'text-red-400' };
      default:
        return { label: 'MEDIO', className: 'text-amber-400' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Auditoría de Autenticación</h1>
            <p className="text-sm text-zinc-400">Registro completo de eventos de seguridad</p>
          </div>
        </div>
        <button
          onClick={applyFilters}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`${card.bg} border ${card.border} rounded-xl p-4 transition-colors`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">{card.label}</span>
                <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {stats[card.key]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Filtros</span>
          {hasActiveFilters && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              Activos
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-xs text-zinc-500 mb-1.5">
              <Calendar className="w-3 h-3 inline mr-1" />
              Fecha Inicio
            </label>
            <input
              id="start-date"
              type="date"
              aria-label="Fecha Inicio"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-xs text-zinc-500 mb-1.5">
              <Calendar className="w-3 h-3 inline mr-1" />
              Fecha Fin
            </label>
            <input
              id="end-date"
              type="date"
              aria-label="Fecha Fin"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="terminal" className="block text-xs text-zinc-500 mb-1.5">
              <Monitor className="w-3 h-3 inline mr-1" />
              Terminal
            </label>
            <select
              id="terminal"
              aria-label="Terminal"
              value={filters.terminal}
              onChange={(e) => setFilters({...filters, terminal: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
              <option value="CAJA-01">CAJA-01</option>
              <option value="MOZO-01">MOZO-01</option>
              <option value="KDS-01">KDS-01</option>
            </select>
          </div>
          <div>
            <label htmlFor="employee" className="block text-xs text-zinc-500 mb-1.5">
              <User className="w-3 h-3 inline mr-1" />
              Empleado
            </label>
            <select
              id="employee"
              aria-label="Empleado"
              value={filters.employee}
              onChange={(e) => setFilters({...filters, employee: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label htmlFor="event-type" className="block text-xs text-zinc-500 mb-1.5">
              <Shield className="w-3 h-3 inline mr-1" />
              Tipo de Evento
            </label>
            <select
              id="event-type"
              aria-label="Tipo de Evento"
              value={filters.eventType}
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            >
              <option value="">Todos</option>
              <option value="login_success">Login Exitoso</option>
              <option value="login_failed">Login Fallido</option>
              <option value="security_alert">Alerta de Seguridad</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
          <button
            onClick={applyFilters}
            title="Aplicar filtros"
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Aplicar
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center">
            <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Cargando eventos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Evento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Terminal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Riesgo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Fingerprint</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Shield className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">No hay eventos de auditoría</p>
                    </td>
                  </tr>
                ) : (
                  events.map((event) => {
                    const eventBadge = getEventBadge(event.event_type);
                    const riskBadge = getRiskBadge(event.status);
                    return (
                      <tr key={event.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-zinc-300 whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString('es-PE')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${eventBadge.className}`}>
                            {eventBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                            <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                            {event.terminal_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                            <User className="w-3.5 h-3.5 text-zinc-500" />
                            {event.employee_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${riskBadge.className}`}>
                            {riskBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 font-mono">
                            <Fingerprint className="w-3 h-3" />
                            abc123...
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 font-mono">
                            <Globe className="w-3 h-3" />
                            192.168.1.1
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
