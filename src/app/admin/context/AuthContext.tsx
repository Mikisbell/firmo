'use client';

/**
 * AuthContext
 * Context API para manejar autenticación del panel de administración
 * Usa httpOnly cookies - NO expone tokens en el frontend
 * 
 * Security:
 * - httpOnly cookies protegen contra XSS
 * - SameSite=strict protege contra CSRF
 * - No almacena tokens en localStorage
 * - Refresh automático cada 15 minutos
 * 
 * Requirements: 1.1, 1.2, 1.3, 10.1 (Security)
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ROLE_PERMISSIONS, AdminRole, AdminPermissions } from '../lib/permissions';

export interface AuthEmployee {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  employee: AuthEmployee | null;
  permissions: AdminPermissions | null;
  login: (employee: AuthEmployee) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);

  // Check session validity
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include', // Important: include httpOnly cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.employee) {
          setEmployee(data.employee);
          setPermissions(ROLE_PERMISSIONS[data.employee.role as AdminRole] || null);
          setIsAuthenticated(true);
          return true;
        }
      }

      // Session invalid
      setEmployee(null);
      setPermissions(null);
      setIsAuthenticated(false);
      return false;
    } catch (error) {
      console.error('Session check error:', error);
      setEmployee(null);
      setPermissions(null);
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  // Login function (called after successful PIN authentication)
  const login = useCallback((emp: AuthEmployee) => {
    console.log('[AuthContext] login() called with:', emp);
    setEmployee(emp);
    console.log('[AuthContext] setEmployee() called');
    setPermissions(ROLE_PERMISSIONS[emp.role as AdminRole] || null);
    console.log('[AuthContext] setPermissions() called');
    setIsAuthenticated(true);
    console.log('[AuthContext] setIsAuthenticated(true) called');
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Call logout API to clear cookie and revoke session
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setEmployee(null);
      setPermissions(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession().finally(() => setIsLoading(false));
  }, [checkSession]);

  // Auto-refresh session every 15 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      checkSession();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, checkSession]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    employee,
    permissions,
    login,
    logout,
    checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 * Throws error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check specific permission
 */
export function usePermission(permission: keyof AdminPermissions): boolean {
  const { permissions } = useAuth();
  if (!permissions) return false;
  return permissions[permission];
}

