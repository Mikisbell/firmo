/**
 * Mozo Configuration Page
 * Notification preferences and settings
 * 
 * Requirements: 9.1, 9.2
 */

'use client';

import { useState, useEffect } from 'react';
import { usePushSubscription } from '../hooks/usePushSubscription';

interface NotificationPreferences {
  items_ready: boolean;
  request_check: boolean;
  sound_enabled: boolean;
}

export default function MozoConfiguracionPage() {
  const {
    permission,
    isSubscribed,
    isLoading: pushLoading,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    items_ready: true,
    request_check: true,
    sound_enabled: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          items_ready: data.items_ready ?? true,
          request_check: data.request_check ?? true,
          sound_enabled: data.sound_enabled ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setPrefsLoading(false);
    }
  };

  const savePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({
          items_ready: data.items_ready,
          request_check: data.request_check,
          sound_enabled: data.sound_enabled,
        });
        setMessage({ type: 'success', text: 'Preferencias guardadas' });
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: 'Error al guardar preferencias' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    savePreferences({ [key]: newValue });
  };

  const handleSubscriptionToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const sendTestNotification = async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Notificación de prueba enviada' });
      } else {
        throw new Error('Error al enviar');
      }
    } catch (error) {
      console.error('Error sending test:', error);
      setMessage({ type: 'error', text: 'Error al enviar notificación de prueba' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Push Notifications Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🔔 Notificaciones Push</h2>
          
          {permission === 'denied' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
              <p className="text-sm text-amber-700">
                Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador.
              </p>
            </div>
          )}

          {permission === 'unsupported' && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
              <p className="text-sm text-gray-600">
                Tu navegador no soporta notificaciones push.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-700">Notificaciones activas</p>
              <p className="text-sm text-gray-500">
                {isSubscribed ? 'Recibirás alertas en este dispositivo' : 'No recibirás alertas'}
              </p>
            </div>
            <button
              onClick={handleSubscriptionToggle}
              disabled={pushLoading || permission === 'denied' || permission === 'unsupported'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isSubscribed ? 'bg-blue-600' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {pushError && (
            <p className="text-sm text-red-600 mt-2">{pushError}</p>
          )}

          {isSubscribed && (
            <button
              onClick={sendTestNotification}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Enviar notificación de prueba
            </button>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Preferencias</h2>
          
          {prefsLoading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : (
            <div className="space-y-4">
              {/* Items Ready */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-700">Pedidos listos</p>
                  <p className="text-sm text-gray-500">Cuando un item está listo en cocina</p>
                </div>
                <button
                  onClick={() => handleToggle('items_ready')}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.items_ready ? 'bg-blue-600' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.items_ready ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Request Check */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-700">Solicitud de cuenta</p>
                  <p className="text-sm text-gray-500">Cuando un cliente pide la cuenta</p>
                </div>
                <button
                  onClick={() => handleToggle('request_check')}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.request_check ? 'bg-blue-600' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.request_check ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sound */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-700">Sonido</p>
                  <p className="text-sm text-gray-500">Reproducir sonido con notificaciones</p>
                </div>
                <button
                  onClick={() => handleToggle('sound_enabled')}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.sound_enabled ? 'bg-blue-600' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.sound_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back button */}
        <a
          href="/mozo"
          className="block text-center text-blue-600 hover:underline"
        >
          ← Volver al inicio
        </a>
      </div>
    </div>
  );
}
