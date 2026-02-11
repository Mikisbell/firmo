/**
 * Formulario de Configuración de Alertas
 * 
 * Permite crear y editar configuraciones de alertas con:
 * - Selección de tipo de alerta
 * - Configuración de umbral y operador
 * - Selección de canales de notificación
 * - Configuración específica por canal (email, Slack, webhook)
 * 
 * @module app/admin/alerts/components
 */

'use client';

import { useState } from 'react';
import type { AlertType, NotificationChannel } from '@/src/core/alerts/alert-config';

interface AlertConfigFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editingId?: string;
}

const ALERT_TYPES: { value: AlertType; label: string; description: string }[] = [
  {
    value: 'ERROR_RATE',
    label: 'Tasa de Errores',
    description: 'Porcentaje de errores en las solicitudes',
  },
  {
    value: 'RESPONSE_TIME',
    label: 'Tiempo de Respuesta',
    description: 'Tiempo promedio de respuesta de APIs',
  },
  {
    value: 'UPTIME',
    label: 'Disponibilidad',
    description: 'Porcentaje de tiempo que el sistema está disponible',
  },
  {
    value: 'CACHE_HIT_RATE',
    label: 'Tasa de Aciertos de Caché',
    description: 'Porcentaje de solicitudes servidas desde caché',
  },
  {
    value: 'DB_POOL',
    label: 'Pool de Base de Datos',
    description: 'Número de conexiones activas en el pool',
  },
];

export function AlertConfigForm({ onClose, onSuccess, editingId }: AlertConfigFormProps) {
  const [alertType, setAlertType] = useState<AlertType>('ERROR_RATE');
  const [thresholdValue, setThresholdValue] = useState('');
  const [comparisonOperator, setComparisonOperator] = useState<'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ'>('GT');
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleChannel(channel: NotificationChannel) {
    setChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!thresholdValue || channels.length === 0) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      setSubmitting(true);

      const notificationConfig: any = {};
      
      if (channels.includes('email') && emailRecipients) {
        notificationConfig.email = {
          recipients: emailRecipients.split(',').map(e => e.trim()),
        };
      }
      
      if (channels.includes('slack') && slackWebhook) {
        notificationConfig.slack = {
          webhookUrl: slackWebhook,
        };
      }
      
      if (channels.includes('webhook') && webhookUrl) {
        notificationConfig.webhook = {
          url: webhookUrl,
          method: 'POST',
        };
      }

      const response = await fetch('/api/admin/alerts/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType,
          thresholdValue: parseFloat(thresholdValue),
          thresholdUnit: getThresholdUnit(alertType),
          comparisonOperator,
          notificationChannels: channels,
          notificationConfig,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear configuración');
      }

      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  function getThresholdUnit(type: AlertType): string {
    switch (type) {
      case 'ERROR_RATE':
      case 'UPTIME':
      case 'CACHE_HIT_RATE':
        return 'PERCENTAGE';
      case 'RESPONSE_TIME':
        return 'MILLISECONDS';
      case 'DB_POOL':
        return 'COUNT';
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Nueva Configuración de Alerta
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Alerta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Alerta *
              </label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as AlertType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              >
                {ALERT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Umbral */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operador *
                </label>
                <select
                  value={comparisonOperator}
                  onChange={(e) => setComparisonOperator(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="GT">Mayor que (&gt;)</option>
                  <option value="GTE">Mayor o igual (≥)</option>
                  <option value="LT">Menor que (&lt;)</option>
                  <option value="LTE">Menor o igual (≤)</option>
                  <option value="EQ">Igual a (=)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor del Umbral *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  placeholder="Ej: 5.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Canales de Notificación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canales de Notificación *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={channels.includes('email')}
                    onChange={() => toggleChannel('email')}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={channels.includes('slack')}
                    onChange={() => toggleChannel('slack')}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Slack</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={channels.includes('webhook')}
                    onChange={() => toggleChannel('webhook')}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Webhook</span>
                </label>
              </div>
            </div>

            {/* Configuración de Email */}
            {channels.includes('email') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destinatarios de Email (separados por coma)
                </label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="admin@example.com, ops@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            )}

            {/* Configuración de Slack */}
            {channels.includes('slack') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL de Slack
                </label>
                <input
                  type="url"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            )}

            {/* Configuración de Webhook */}
            {channels.includes('webhook') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/alerts"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
