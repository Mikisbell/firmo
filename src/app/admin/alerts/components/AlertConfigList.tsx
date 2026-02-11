/**
 * Componente de Lista de Configuraciones de Alertas
 * 
 * Muestra todas las configuraciones de alertas del tenant actual
 * con opciones para editar, habilitar/deshabilitar y eliminar.
 * 
 * @module app/admin/alerts/components
 */

'use client';

import { useState, useEffect } from 'react';
import type { AlertConfiguration } from '@/src/core/alerts/alert-config';

const ALERT_TYPE_LABELS: Record<string, string> = {
  ERROR_RATE: 'Tasa de Errores',
  RESPONSE_TIME: 'Tiempo de Respuesta',
  UPTIME: 'Disponibilidad',
  CACHE_HIT_RATE: 'Tasa de Aciertos de Caché',
  DB_POOL: 'Pool de Base de Datos',
};

const UNIT_LABELS: Record<string, string> = {
  PERCENTAGE: '%',
  MILLISECONDS: 'ms',
  COUNT: 'unidades',
};

const OPERATOR_LABELS: Record<string, string> = {
  GT: '>',
  LT: '<',
  GTE: '>=',
  LTE: '<=',
  EQ: '=',
};

export function AlertConfigList() {
  const [configs, setConfigs] = useState<AlertConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/alerts/configurations');
      
      if (!response.ok) {
        throw new Error('Error al cargar configuraciones');
      }
      
      const data = await response.json();
      setConfigs(data.configurations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      const response = await fetch(`/api/admin/alerts/configurations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar configuración');
      }

      await loadConfigs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        <p className="mt-2 text-gray-600">Cargando configuraciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No hay configuraciones de alertas</p>
        <p className="text-sm text-gray-500 mt-1">
          Crea una nueva configuración para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Tipo de Alerta
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Umbral
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Canales
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {configs.map((config) => (
            <tr key={config.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {ALERT_TYPE_LABELS[config.alertType] || config.alertType}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {OPERATOR_LABELS[config.comparisonOperator]} {config.thresholdValue}
                  {UNIT_LABELS[config.thresholdUnit]}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {config.notificationChannels.map((channel) => (
                    <span
                      key={channel}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <button
                  onClick={() => toggleEnabled(config.id, !config.enabled)}
                  className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${config.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                    }
                  `}
                >
                  {config.enabled ? 'Activa' : 'Inactiva'}
                </button>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button className="text-amber-600 hover:text-amber-900 mr-3">
                  Editar
                </button>
                <button className="text-red-600 hover:text-red-900">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
