// src/core/auth/types.ts
// Types for terminal registration and authentication

export type TerminalRole = 'CASHIER' | 'WAITER' | 'KDS' | 'ADMIN' | 'BAR';
export type EmployeeRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'BAR' | 'DELIVERY';

export interface TerminalConfig {
  terminal_id: string;
  tenant_id: string;
  actor_id: string; // UUID for event actor_id field
  device_fingerprint: string;
  device_name: string;
  role: TerminalRole;
  location_id: string;
  station_id?: string;
  is_allowed: boolean;
  registered_at: string;
}

export interface AuthSession {
  terminal_id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: EmployeeRole;
  terminal_role: TerminalRole;
  shift_id?: string;
  logged_in_at: string;
  last_activity_at: string;
}

export interface LocationConfig {
  location_id: string;
  name: string;
  // Geofence
  lat?: number;
  lng?: number;
  radius_m?: number;
  // Network
  allowed_ip_prefix?: string; // e.g., "192.168.1."
}

export interface SecurityCheck {
  allowed: boolean;
  reason?: string;
  checks: {
    terminal_registered: boolean;
    terminal_active: boolean;
    in_location: boolean;
    has_active_shift?: boolean;
  };
}
