/**
 * PushSubscriptionPrompt Component
 * Shows a prompt to subscribe to push notifications
 * 
 * Requirements: 4.1, 4.4
 */

'use client';

import { useState, useEffect } from 'react';
import { usePushSubscription } from '../hooks/usePushSubscription';

interface PushSubscriptionPromptProps {
  /** Called when user dismisses the prompt */
  onDismiss?: () => void;
}

const DISMISSED_KEY = 'push_prompt_dismissed';
const DISMISSED_EXPIRY_DAYS = 7;

export function PushSubscriptionPrompt({ onDismiss }: PushSubscriptionPromptProps) {
  const {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
  } = usePushSubscription();

  const [isDismissed, setIsDismissed] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if prompt was dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysDiff = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < DISMISSED_EXPIRY_DAYS) {
        setIsDismissed(true);
        return;
      }
    }
    setIsDismissed(false);
  }, []);

  // Don't show if already subscribed, loading, or dismissed
  if (isLoading || isSubscribed || isDismissed) {
    return null;
  }

  // Show denied banner
  if (permission === 'denied') {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-amber-400 text-xl">⚠️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-amber-700">
              <strong>Notificaciones bloqueadas.</strong> Para recibir alertas cuando tus pedidos estén listos, 
              habilita las notificaciones en la configuración de tu navegador.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Configuración → Sitios → Notificaciones → Permitir
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show unsupported message
  if (permission === 'unsupported') {
    return null; // Don't show anything if not supported
  }

  // Show success message briefly
  if (showSuccess) {
    return (
      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
        <div className="flex items-center">
          <span className="text-green-500 text-xl mr-2">✓</span>
          <p className="text-sm text-green-700">
            ¡Notificaciones activadas! Recibirás alertas cuando tus pedidos estén listos.
          </p>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-blue-500 text-xl">🔔</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>¿Activar notificaciones?</strong> Recibe alertas instantáneas cuando tus pedidos estén listos.
            </p>
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Activando...' : 'Activar'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1 text-blue-600 text-sm hover:underline"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
