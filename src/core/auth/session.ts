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

  // Fire-and-forget clock-out before wiping session data
  try {
    const session = getSession();
    const raw = localStorage.getItem('park_terminal_config');
    const cfg = raw ? JSON.parse(raw) : null;
    if (session && cfg?.tenant_id) {
      fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': cfg.tenant_id },
        body: JSON.stringify({ employee_id: session.employee_id }),
      }).catch(() => {});
    }
  } catch { /* silencioso */ }

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

  // Sync actor_id in park_terminal_config so events carry the employee's UUID
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('park_terminal_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        cfg.actor_id = employee.id;
        localStorage.setItem('park_terminal_config', JSON.stringify(cfg));
      }
    } catch { /* silencioso */ }
  }

  // Fire-and-forget clock-in (does not block login)
  if (typeof window !== 'undefined') {
    const tenantId = terminal.tenant_id;
    fetch('/api/attendance/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        employee_id: employee.id,
        terminal_id: terminal.terminal_id,
        role: employee.role,
      }),
    }).catch(() => { /* silencioso — no bloquear login */ });
  }

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
  OWNER:      120,
  ADMIN:      100,
  MANAGER:     80,
  SUPERVISOR:  70,
  CASHIER:     60,
  WAITER:      40,
  KITCHEN:     40,
  COOK:        40,
  PACKER:      35,
  BAR:         40,
  DRIVER:      20,
};

export function hasMinimumRole(
  session: AuthSession | null,
  minimumRole: AuthSession['employee_role']
): boolean {
  if (!session) return false;
  return ROLE_HIERARCHY[session.employee_role] >= ROLE_HIERARCHY[minimumRole];
}
