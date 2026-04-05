'use client';

/**
 * Wrapper unificado de sonner con estilos consistentes de PARK.
 * Provee API tipada con variantes: success, error, info, warning, promise.
 */

import { toast as sonnerToast } from 'sonner';

type ToastOptions = { description?: string; duration?: number };

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, options);
  },
  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, options);
  },
  info: (message: string, options?: { description?: string }) => {
    return sonnerToast(message, options);
  },
  warning: (message: string, options?: { description?: string }) => {
    return sonnerToast.warning(message, options);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) => {
    return sonnerToast.promise(promise, messages);
  },
};
