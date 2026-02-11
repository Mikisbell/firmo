'use client';

import { useState, useEffect } from 'react';

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Auditoría de Autenticación</h1>
        <p className="text-gray-600">Registro completo de eventos de seguridad</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Total Eventos</h3>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Login Exitoso</h3>
          <p className="text-2xl font-bold text-green-600">{stats.login_success}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Login Fallido</h3>
          <p className="text-2xl font-bold text-red-600">{stats.login_failed}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Alertas</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.alerts}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm mb-1">Fecha Inicio</label>
            <input
              id="start-date"
              type="date"
              aria-label="Fecha Inicio"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm mb-1">Fecha Fin</label>
            <input
              id="end-date"
              type="date"
              aria-label="Fecha Fin"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor="terminal" className="block text-sm mb-1">Terminal</label>
            <select
              id="terminal"
              aria-label="Terminal"
              value={filters.terminal}
              onChange={(e) => setFilters({...filters, terminal: e.target.value})}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Todos</option>
              <option value="CAJA-01">CAJA-01</option>
              <option value="MOZO-01">MOZO-01</option>
              <option value="KDS-01">KDS-01</option>
            </select>
          </div>
          <div>
            <label htmlFor="employee" className="block text-sm mb-1">Empleado</label>
            <select
              id="employee"
              aria-label="Empleado"
              value={filters.employee}
              onChange={(e) => setFilters({...filters, employee: e.target.value})}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label htmlFor="event-type" className="block text-sm mb-1">Tipo de Evento</label>
            <select
              id="event-type"
              aria-label="Tipo de Evento"
              value={filters.eventType}
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="w-full border rounded px-2 py-1"
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
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Limpiar filtros
          </button>
          <button
            onClick={applyFilters}
            title="Actualizar"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">
            Cargando eventos...
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Fecha/Hora</th>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-left">Terminal</th>
                <th className="px-4 py-2 text-left">Empleado</th>
                <th className="px-4 py-2 text-left">Riesgo</th>
                <th className="px-4 py-2 text-left">Fingerprint</th>
                <th className="px-4 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay eventos de auditoría
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="px-4 py-2">{new Date(event.timestamp).toLocaleString('es-PE')}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        event.event_type === 'login_success' ? 'bg-green-100 text-green-800' :
                        event.event_type === 'login_failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {event.event_type === 'login_success' ? 'Login Exitoso' :
                         event.event_type === 'login_failed' ? 'Login Fallido' :
                         'Alerta de Seguridad'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{event.terminal_id}</td>
                    <td className="px-4 py-2">{event.employee_id}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        event.status === 'success' ? 'text-green-400' :
                        event.status === 'failed' ? 'text-red-400' :
                        'text-amber-400'
                      }`}>
                        {event.status === 'success' ? 'BAJO' :
                         event.status === 'failed' ? 'ALTO' :
                         'MEDIO'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">abc123...</td>
                    <td className="px-4 py-2 text-xs text-gray-500">192.168.1.1</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
