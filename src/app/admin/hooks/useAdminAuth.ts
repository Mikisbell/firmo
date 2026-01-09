/**
 * useAdminAuth Hook
 * Hook para manejar autenticación del panel de administración
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { useState, useEffect, useCallback } from 'react';
import { ROLE_PERMISSIONS, AdminRole, AdminPermissions } from '../lib/permissions';

const SESSION_KEY = 'admin_session';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface AdminEmployee {
  id: string;
  name: string;
  role: string;
}

export interface AdminSession {
  employee: AdminEmployee;
  token: string;
  expiresAt: string;
}

export interface UseAdminAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  employee: AdminEmployee | null;
  permissions: AdminPermissions | null;
  token: string | null;
  login: (employee: AdminEmployee, token: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => boolean;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<AdminEmployee | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) {
          setIsLoading(false);
          return;
        }

        const session: AdminSession = JSON.parse(stored);
        
        // Check if session is expired
        if (new Date(session.expiresAt) <= new Date()) {
          localStorage.removeItem(SESSION_KEY);
          setIsLoading(false);
          return;
        }

        // Session is valid
        setEmployee(session.employee);
        setToken(session.token);
        setPermissions(ROLE_PERMISSIONS[session.employee.role as AdminRole] || null);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Login function
  const login = useCallback((emp: AdminEmployee, tok: string) => {
    const session: AdminSession = {
      employee: emp,
      token: tok,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setEmployee(emp);
    setToken(tok);
    setPermissions(ROLE_PERMISSIONS[emp.role as AdminRole] || null);
    setIsAuthenticated(true);
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    // Call logout API if we have a token
    if (token) {
      try {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout API error:', error);
      }
    }

    // Clear local state
    localStorage.removeItem(SESSION_KEY);
    setEmployee(null);
    setToken(null);
    setPermissions(null);
    setIsAuthenticated(false);
  }, [token]);

  // Refresh session (extend expiration)
  const refreshSession = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return false;

      const session: AdminSession = JSON.parse(stored);
      
      // Check if session is expired
      if (new Date(session.expiresAt) <= new Date()) {
        localStorage.removeItem(SESSION_KEY);
        setIsAuthenticated(false);
        return false;
      }

      // Extend session
      session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    employee,
    permissions,
    token,
    login,
    logout,
    refreshSession,
  };
}

/**
 * Hook para verificar permisos específicos
 */
export function useAdminPermission(permission: keyof AdminPermissions): boolean {
  const { permissions } = useAdminAuth();
  if (!permissions) return false;
  return permissions[permission];
}
