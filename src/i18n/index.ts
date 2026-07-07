/**
 * i18n Foundation for FIRMO POS
 *
 * Minimal translation layer. Spanish is the default locale.
 * This module provides the `t()` function and `useLocale()` hook
 * for future multi-language support without migrating any pages yet.
 */

export type Locale = 'es' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Common actions
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.noResults': 'Sin resultados',
    'common.confirm': 'Confirmar',
    'common.back': 'Volver',
    'common.close': 'Cerrar',
    'common.submit': 'Enviar',
    'common.retry': 'Reintentar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.select': 'Seleccionar',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.add': 'Agregar',
    'common.remove': 'Quitar',
    'common.filter': 'Filtrar',
    'common.sort': 'Ordenar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.print': 'Imprimir',
    'common.download': 'Descargar',
    'common.upload': 'Subir',
    'common.refresh': 'Actualizar',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.actions': 'Acciones',

    // Status
    'status.active': 'Activo',
    'status.inactive': 'Inactivo',
    'status.pending': 'Pendiente',
    'status.completed': 'Completado',
    'status.error': 'Error',
  },
  en: {
    // Common actions
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.noResults': 'No results',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.submit': 'Submit',
    'common.retry': 'Retry',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.select': 'Select',
    'common.all': 'All',
    'common.none': 'None',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.filter': 'Filter',
    'common.sort': 'Sort',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.print': 'Print',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.refresh': 'Refresh',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.actions': 'Actions',

    // Status
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.pending': 'Pending',
    'status.completed': 'Completed',
    'status.error': 'Error',
  },
};

/**
 * Translate a key to the given locale.
 * Returns the key itself if no translation is found (graceful fallback).
 */
export function t(key: string, locale: Locale = 'es'): string {
  return translations[locale]?.[key] ?? key;
}

/**
 * Get the current locale.
 * For now always returns 'es'. Later: read from cookie/localStorage/URL param.
 */
export function useLocale(): Locale {
  return 'es';
}

export { KEYS } from './keys';
export type { TranslationKey } from './keys';
