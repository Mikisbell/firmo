// src/core/auth/session.ts
// Session management for authenticated users

import type { AuthSession, TerminalConfig } from './types';

const SESSION_KEY = 'park_auth_session';
const AUTO_LOGOUT_MINUTES = 15; // Auto logout after 15 min inactivity

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const data = sessionStorage.getItem(SESSION_KEY);
  if (!data) return null;
  
  try {
    const session: AuthSession = JSON.parse(data);
    
    // Check for auto-logout
    const lastActivity = new Date(session.last_activity_at).getTime();
    const now = Date.now();
    const inactiveMinutes = (now - lastActivity) / 60000;
    
    if (inactiveMinutes > AUTO_LOGOUT_MINUTES) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  session.last_activity_at = new Date().toISOString();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateActivity(): void {
  const session = getSession();
  if (session) {
    session.last_activity_at = new Date().toISOString();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function createSession(
  terminal: TerminalConfig,
  employee: {
    id: string;
    name: string;
    role: AuthSession['employee_role'];
  },
  shiftId?: string
): AuthSession {
  const session: AuthSession = {
    terminal_id: terminal.terminal_id,
    tenant_id: terminal.tenant_id,
    employee_id: employee.id,
    employee_name: employee.name,
    employee_role: employee.role,
    terminal_role: terminal.role,
    shift_id: shiftId,
    logged_in_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };
  
  setSession(session);
  return session;
}

// Check if user can perform action based on role
export function canPerformAction(
  session: AuthSession | null,
  requiredRoles: AuthSession['employee_role'][]
): boolean {
  if (!session) return false;
  return requiredRoles.includes(session.employee_role);
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<AuthSession['employee_role'], number> = {
  ADMIN: 100,
  MANAGER: 80,
  CASHIER: 60,
  WAITER: 40,
  KITCHEN: 40,
  BAR: 40,
  DELIVERY: 20,
};

export function hasMinimumRole(
  session: AuthSession | null,
  minimumRole: AuthSession['employee_role']
): boolean {
  if (!session) return false;
  return ROLE_HIERARCHY[session.employee_role] >= ROLE_HIERARCHY[minimumRole];
}
