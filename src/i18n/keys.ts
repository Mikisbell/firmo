/**
 * Type-safe translation key constants.
 * Use these instead of raw strings to get compile-time safety.
 *
 * Usage:
 *   import { KEYS } from '@/src/i18n';
 *   t(KEYS.SAVE)  // 'Guardar'
 */

export const KEYS = {
  // Common actions
  SAVE: 'common.save',
  CANCEL: 'common.cancel',
  DELETE: 'common.delete',
  EDIT: 'common.edit',
  CREATE: 'common.create',
  SEARCH: 'common.search',
  LOADING: 'common.loading',
  NO_RESULTS: 'common.noResults',
  CONFIRM: 'common.confirm',
  BACK: 'common.back',
  CLOSE: 'common.close',
  SUBMIT: 'common.submit',
  RETRY: 'common.retry',
  YES: 'common.yes',
  NO: 'common.no',
  SELECT: 'common.select',
  ALL: 'common.all',
  NONE: 'common.none',
  ADD: 'common.add',
  REMOVE: 'common.remove',
  FILTER: 'common.filter',
  SORT: 'common.sort',
  EXPORT: 'common.export',
  IMPORT: 'common.import',
  PRINT: 'common.print',
  DOWNLOAD: 'common.download',
  UPLOAD: 'common.upload',
  REFRESH: 'common.refresh',
  NEXT: 'common.next',
  PREVIOUS: 'common.previous',
  ACTIONS: 'common.actions',

  // Status
  STATUS_ACTIVE: 'status.active',
  STATUS_INACTIVE: 'status.inactive',
  STATUS_PENDING: 'status.pending',
  STATUS_COMPLETED: 'status.completed',
  STATUS_ERROR: 'status.error',
} as const;

/** Union type of all valid translation keys */
export type TranslationKey = (typeof KEYS)[keyof typeof KEYS];
