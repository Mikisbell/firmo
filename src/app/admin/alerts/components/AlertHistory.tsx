/**
 * Componente de Historial de Alertas
 * 
 * Muestra el historial de alertas disparadas con:
 * - Filtros por tipo, severidad y estado
 * - Acciones para reconocer y resolver alertas
 * - Detalles de cada alerta
 * 
 * @module app/admin/alerts/components
 */

'use client';

import { useState, useEffect } from 'react';
import type { AlertEvent } from '@/src/core/alerts/alert-notifier';

const SEVERITY_COLORS = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const STATUS_COLORS = {
  ACTIVE: 'bg-red-100 text-red-800',
  ACKNOWLEDGED: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  SNOOZED: 'bg-gray-100 text-gray-800',
};

export function AlertHistory() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  async function loadAlerts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter.toUpperCase());
      }
      
      const response = await fetch(`/api/admin/alerts/events?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar historial');
      }
      
      const data = await response.json();
      setAlerts(data.events || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeAlert(id: string) {
    try {
      const response = await fetch(`/api/admin/alerts/events/${id}/acknowledge`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al reconocer alerta');
      }

      await loadAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  async function resolveAlert(id: string) {
    try {
      const response = await fetch(`/api/admin/alerts/events/${id}/resolve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al resolver alerta');
      }

      await loadAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        <p className="mt-2 text-gray-600">Cargando historial...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'active'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Activas
        </button>
        <button
          onClick={() => setFilter('acknowledged')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'acknowledged'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Reconocidas
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'resolved'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Resueltas
        </button>
      </div>

      {/* Lista de Alertas */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay alertas en el historial</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white shadow-sm rounded-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[alert.status]}`}>
                      {alert.status}
                    </span>
                    {alert.escalated && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        ESCALADA
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {alert.message}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    Valor actual: {alert.currentValue} | Umbral: {alert.thresholdValue}
                  </p>
                  
                  <p className="text-xs text-gray-500">
                    {new Date(alert.createdAt).toLocaleString('es-PE')}
                  </p>
                </div>

                <div className="flex space-x-2">
                  {alert.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        Reconocer
                      </button>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Resolver
                      </button>
                    </>
                  )}
                  {alert.status === 'ACKNOWLEDGED' && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
