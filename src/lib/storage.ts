/**
 * Utilidad centralizada para acceso seguro a localStorage
 * 
 * Implementa manejo de errores con try-catch y fallback en memoria
 * para evitar crashes en modo incógnito o cuando localStorage no está disponible.
 * 
 * @module lib/storage
 */

/**
 * Interface para operaciones de storage
 */
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  clear(): boolean;
  isAvailable(): boolean;
}

/**
 * Implementación de SafeStorage con fallback en memoria
 * 
 * Características:
 * - Try-catch en todas las operaciones
 * - Fallback automático a Map en memoria
 * - Logging de errores sin crashear
 * - Detección de modo incógnito
 */
class SafeStorageImpl implements SafeStorage {
  private memoryFallback: Map<string, string> = new Map();
  private storageAvailable: boolean;

  constructor() {
    this.storageAvailable = this.checkAvailability();
  }

  /**
   * Verifica si localStorage está disponible
   * 
   * Intenta escribir y leer un valor de prueba.
   * Si falla (modo incógnito, QuotaExceeded, SecurityError), retorna false.
   * 
   * @returns true si localStorage está disponible, false en caso contrario
   */
  private checkAvailability(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage not available, using memory fallback', e);
      return false;
    }
  }

  /**
   * Obtiene un valor de storage
   * 
   * Intenta leer de localStorage primero.
   * Si falla o no está disponible, lee del fallback en memoria.
   * 
   * @param key - Clave del valor a obtener
   * @returns Valor almacenado o null si no existe
   */
  getItem(key: string): string | null {
    try {
      if (this.storageAvailable) {
        return localStorage.getItem(key);
      }
      return this.memoryFallback.get(key) ?? null;
    } catch (error) {
      console.error(`Error getting item ${key} from storage:`, error);
      return this.memoryFallback.get(key) ?? null;
    }
  }

  /**
   * Almacena un valor en storage
   * 
   * Intenta escribir en localStorage primero.
   * Siempre escribe en fallback en memoria como backup.
   * 
   * @param key - Clave del valor a almacenar
   * @param value - Valor a almacenar (debe ser string)
   * @returns true si se almacenó exitosamente, false si hubo error
   */
  setItem(key: string, value: string): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.setItem(key, value);
      }
      this.memoryFallback.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key} in storage:`, error);
      this.memoryFallback.set(key, value);
      return false;
    }
  }

  /**
   * Elimina un valor de storage
   * 
   * Intenta eliminar de localStorage primero.
   * Siempre elimina del fallback en memoria.
   * 
   * @param key - Clave del valor a eliminar
   * @returns true si se eliminó exitosamente, false si hubo error
   */
  removeItem(key: string): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.removeItem(key);
      }
      this.memoryFallback.delete(key);
      return true;
    } catch (error) {
      console.error(`Error removing item ${key} from storage:`, error);
      this.memoryFallback.delete(key);
      return false;
    }
  }

  /**
   * Limpia todo el storage
   * 
   * Intenta limpiar localStorage primero.
   * Siempre limpia el fallback en memoria.
   * 
   * @returns true si se limpió exitosamente, false si hubo error
   */
  clear(): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.clear();
      }
      this.memoryFallback.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      this.memoryFallback.clear();
      return false;
    }
  }

  /**
   * Verifica si localStorage está disponible
   * 
   * @returns true si localStorage está disponible, false si se está usando fallback
   */
  isAvailable(): boolean {
    return this.storageAvailable;
  }
}

/**
 * Instancia singleton de SafeStorage
 * 
 * Uso:
 * ```typescript
 * import { safeStorage } from '@/lib/storage';
 * 
 * // Leer valor
 * const value = safeStorage.getItem('key');
 * 
 * // Escribir valor
 * safeStorage.setItem('key', 'value');
 * 
 * // Eliminar valor
 * safeStorage.removeItem('key');
 * 
 * // Limpiar todo
 * safeStorage.clear();
 * 
 * // Verificar disponibilidad
 * if (!safeStorage.isAvailable()) {
 *   console.warn('Using memory fallback');
 * }
 * ```
 */
export const safeStorage = new SafeStorageImpl();
