/**
 * Notification Types
 * Tipos para el servicio de notificaciones push
 */

export type NotificationType = 
  | 'ITEM_READY' 
  | 'REQUEST_CHECK' 
  | 'TEST'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_READY_FOR_DISPATCH'
  | 'DELIVERY_DELAYED';

export interface WebPushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: WebPushKeys;
  expirationTime?: number | null;
}

export interface PushSubscription {
  id: string;
  tenant_id: string;
  employee_id: string;
  endpoint: string;
  keys: WebPushKeys;
  device_info?: string;
  created_at: string;
  last_used_at: string;
}

export interface NotificationPreferences {
  employee_id: string;
  items_ready: boolean;
  request_check: boolean;
  sound_enabled: boolean;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data: {
    order_id: string;
    table_number?: string;
    station?: string;
    url?: string;
    delivery_id?: string;
    driver_id?: string;
    address?: string;
  };
  tag?: string;
}

export interface EmployeeSubscriptionStatus {
  employee_id: string;
  employee_name: string;
  has_subscription: boolean;
  last_active: string | null;
  days_inactive: number;
}

// Error codes
export enum NotificationErrorCode {
  SUBSCRIPTION_EXPIRED = 'NOTIF_001',
  PUSH_FAILED = 'NOTIF_002',
  EMPLOYEE_NOT_FOUND = 'NOTIF_003',
  INVALID_PAYLOAD = 'NOTIF_004',
  PREFERENCE_BLOCKED = 'NOTIF_005',
}
