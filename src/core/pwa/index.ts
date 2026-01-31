/**
 * PWA utilities
 * 
 * Serwist maneja el Service Worker automáticamente.
 * Este módulo exporta helpers para interactuar con el SW.
 */

import { logger } from '@/src/core/observability/logger';

export type SWRegistrationResult = {
    success: boolean;
    registration?: ServiceWorkerRegistration;
    error?: string;
};

/**
 * Obtiene el registro del Service Worker actual
 */
export async function getServiceWorkerRegistration(): Promise<SWRegistrationResult> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return { success: false, error: 'Service Workers not supported' };
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        return { success: true, registration };
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
}

/**
 * Fuerza la actualización del Service Worker
 */
export async function updateServiceWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        return true;
    } catch {
        return false;
    }
}

/**
 * Limpia todos los caches del Service Worker
 */
export async function clearAllCaches(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        logger.info('PWA_CACHES_CLEARED', 'All caches cleared', { count: cacheNames.length });
        return true;
    } catch (error) {
        logger.error('PWA_CACHE_CLEAR_FAILED', 'Failed to clear caches', error instanceof Error ? error : undefined, {});
        return false;
    }
}

/**
 * Desregistra el Service Worker (útil para debugging)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        return await registration.unregister();
    } catch {
        return false;
    }
}
