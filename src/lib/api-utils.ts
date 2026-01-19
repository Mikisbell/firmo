/**
 * API Utilities
 * Shared utilities for API calls and error handling
 */

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

/**
 * Handle API errors with proper status codes and messages
 */
export async function handleApiCall<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const data: ApiError = await response.json();

      switch (response.status) {
        case 400:
          throw new Error(data.error || 'Datos inválidos');

        case 403:
          throw new Error('No tienes permisos para realizar esta acción');

        case 404:
          throw new Error('Registro no encontrado');

        case 409:
          throw new Error(data.error || 'Ya existe un registro con estos datos');

        case 500:
          throw new Error('Error del servidor. Intenta nuevamente.');

        default:
          throw new Error(data.error || 'Error desconocido');
      }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Sin conexión. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Format API error for display
 */
export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido';
}
