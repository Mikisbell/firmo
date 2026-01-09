/**
 * usePushSubscription Hook
 * Maneja la suscripción a notificaciones push para mozos
 * 
 * Requirements: 4.1, 4.2
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushSubscriptionState {
  /** Current notification permission state */
  permission: PermissionState;
  /** Whether the user is subscribed to push notifications */
  isSubscribed: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** VAPID public key from server */
  vapidPublicKey: string | null;
}

export interface UsePushSubscriptionReturn extends PushSubscriptionState {
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Request notification permission */
  requestPermission: () => Promise<PermissionState>;
  /** Check current subscription status */
  checkSubscription: () => Promise<void>;
}

/**
 * Convert base64 URL-safe string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Check if push notifications are supported
 */
function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [state, setState] = useState<PushSubscriptionState>({
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null,
    vapidPublicKey: null,
  });

  // Check initial state on mount
  useEffect(() => {
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Check current subscription status
   */
  const checkSubscription = useCallback(async () => {
    if (!isPushSupported()) {
      setState(prev => ({
        ...prev,
        permission: 'unsupported',
        isLoading: false,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current permission
      const permission = Notification.permission as PermissionState;

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      // Fetch VAPID public key from server
      let vapidKey = state.vapidPublicKey;
      if (!vapidKey) {
        try {
          const response = await fetch('/api/notifications/vapid-key');
          if (response.ok) {
            const data = await response.json();
            vapidKey = data.publicKey || null;
          }
        } catch {
          console.warn('[Push] Could not fetch VAPID key');
        }
      }

      setState({
        permission,
        isSubscribed: !!subscription,
        isLoading: false,
        error: null,
        vapidPublicKey: vapidKey,
      });
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al verificar suscripción',
      }));
    }
  }, [state.vapidPublicKey]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!isPushSupported()) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      const permission = result as PermissionState;
      
      setState(prev => ({ ...prev, permission }));
      return permission;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      return 'denied';
    }
  }, []);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      setState(prev => ({ ...prev, error: 'Notificaciones no soportadas' }));
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Request permission if needed
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          permission: permission as PermissionState,
          isLoading: false,
          error: 'Permiso de notificaciones denegado',
        }));
        return false;
      }

      // Get VAPID key if not available
      let vapidKey = state.vapidPublicKey;
      if (!vapidKey) {
        const response = await fetch('/api/notifications/vapid-key');
        if (!response.ok) {
          throw new Error('No se pudo obtener la clave VAPID');
        }
        const data = await response.json();
        vapidKey = data.publicKey;
      }

      if (!vapidKey) {
        throw new Error('Clave VAPID no disponible');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar suscripción en servidor');
      }

      setState(prev => ({
        ...prev,
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
        error: null,
        vapidPublicKey: vapidKey,
      }));

      console.log('[Push] Subscribed successfully');
      return true;
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error al suscribirse',
      }));
      return false;
    }
  }, [state.vapidPublicKey]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      console.log('[Push] Unsubscribed successfully');
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error al desuscribirse',
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    checkSubscription,
  };
}
