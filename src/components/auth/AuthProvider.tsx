'use client';

// src/components/auth/AuthProvider.tsx
// Auth wrapper - handles login flow for protected routes with risk-based authentication

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { LoginScreen } from './LoginScreen';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig, AuthSession } from '@/src/core/auth/types';
import { 
  validateSession as validateSessionV2, 
  updateActivity as updateActivityV2,
  logout as logoutV2,
  restoreSession as restoreSessionV2,
  setFingerprintProvider,
  startPeriodicFingerprintValidation,
  stopPeriodicFingerprintValidation,
  type SecureSession 
} from '@/src/core/auth/session-v2';
import { generateFingerprintV2, type FingerprintResult } from '@/src/core/auth/fingerprint-v2';
import { assessRisk, type RiskAssessment } from '@/src/core/auth/risk-validator';
import { getTerminal } from '@/src/core/auth/terminal-registry';
import { StepUpAuthModal } from './StepUpAuthModal';
import { safeStorage } from '@/src/lib/storage';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

interface AuthContextValue {
  terminal: TerminalConfig | null;
  session: SecureSession | null;
  logout: () => void;
  isLoading: boolean;
  riskAssessment: RiskAssessment | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
}

// Session storage key
const SESSION_STORAGE_KEY = 'park_session_v2';

export function AuthProvider({ children, requireAuth = true }: AuthProviderProps) {
  const [terminal, setTerminal] = useState<TerminalConfig | null>(null);
  const [session, setSession] = useState<SecureSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [noTerminal, setNoTerminal] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [showStepUpAuth, setShowStepUpAuth] = useState(false);
  const [stepUpReason, setStepUpReason] = useState<string>('');

  // Initialize session and fingerprint validation
  useEffect(() => {
    async function initializeAuth() {
      const storedConfig = getStoredTerminalConfig();
      
      // =========================================================
      // Bypass de login SOLO en desarrollo (dev/tester sin fricción).
      // En producción (NODE_ENV=production) se exige el flujo de login real.
      // GATE DE GO-LIVE: validar LoginScreen + /api/auth/session + fingerprint
      // antes de lanzar (ver Engram: bugs/authprovider-bypass-unconditional).
      // =========================================================
      const isBypassEnabled = process.env.NODE_ENV !== 'production';

      if (isBypassEnabled) {
        const bypassTerminal: TerminalConfig = {
          terminal_id: 'CAJA_BYPASS_001',
          tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          device_fingerprint: 'bypass_virtual_device',
          device_name: 'Virtual Bypass Terminal',
          location_id: 'default',
          is_allowed: true,
          registered_at: new Date().toISOString(),
          actor_id: '00000000-0000-0000-0000-000000000005', // empleado real (Pedro Ruiz)
          role: 'CASHIER'
        };
        
        const mockSession: SecureSession = {
          id: `bypass-session-${Date.now()}`,
          terminal_id: bypassTerminal.terminal_id,
          employee_id: '00000000-0000-0000-0000-000000000005', // UUID real - evita sync errors
          employee_name: 'Pedro Ruiz',
          employee_role: 'CASHIER',
          terminal_role: 'CAJA',
          fingerprint_at_login: bypassTerminal.device_fingerprint,
          fingerprint_signals_at_login: JSON.stringify({ bypass: true }),
          risk_score_at_login: 0,
          created_at: new Date(),
          last_activity_at: new Date(),
          last_fingerprint_check: new Date(),
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000),
        };

        setTerminal(bypassTerminal);
        setSession(mockSession);
        setNeedsLogin(false);
        setIsLoading(false);
        return;
      }

      // Native Supervisor Mode: Check global admin session
      let hasAdminCookie = false;
      let adminEmployee = null;
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.valid && data.employee) {
            if ((ADMIN_ROLES as readonly string[]).includes(data.employee.role)) {
              hasAdminCookie = true;
              adminEmployee = data.employee;
            }
          }
        }
      } catch (err) {
        console.error('Error checking admin session:', err);
      }

      // If user is admin but has no terminal, auto-start a virtual terminal session
      if (hasAdminCookie && adminEmployee && !storedConfig?.terminal_id) {
        const virtualConfig: TerminalConfig = {
          terminal_id: `COLAB_ADMIN_${adminEmployee.id.substring(0, 8)}`,
          tenant_id: 'default',
          device_fingerprint: 'supervisor_virtual_device',
          device_name: 'Virtual Supervisor Terminal',
          location_id: 'default',
          is_allowed: true,
          registered_at: new Date().toISOString(),
          actor_id: adminEmployee.id,
          role: 'ADMIN'
        };
        
        const mockSession: SecureSession = {
          id: `supervisor-session-${Date.now()}`,
          terminal_id: virtualConfig.terminal_id,
          employee_id: adminEmployee.id,
          employee_name: adminEmployee.name,
          employee_role: adminEmployee.role as SecureSession['employee_role'],
          terminal_role: 'CAJA' as SecureSession['terminal_role'],
          fingerprint_at_login: virtualConfig.device_fingerprint,
          fingerprint_signals_at_login: JSON.stringify({}),
          risk_score_at_login: 0,
          created_at: new Date(),
          last_activity_at: new Date(),
          last_fingerprint_check: new Date(),
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
        };

        setTerminal(virtualConfig);
        setSession(mockSession);
        setNeedsLogin(false);
        setIsLoading(false);
        return;
      }

      if (!storedConfig?.terminal_id) {
        // No hay terminal configurada - redirigir a home
        setNoTerminal(true);
        setIsLoading(false);
        return;
      }

      setTerminal(storedConfig);

      // Special handling for COLAB_* sessions (collaborator login — bypass LoginScreen)
      if (storedConfig.terminal_id.startsWith('COLAB_')) {
        const storedSessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (storedSessionData) {
          try {
            const storedSession = JSON.parse(storedSessionData);
            const expiresAt = new Date(storedSession.expires_at);
            if (expiresAt > new Date()) {
              // Valid collaborator session — restore it into the Map so periodic check works
              const restoredSession: SecureSession = {
                ...storedSession,
                created_at: new Date(storedSession.created_at),
                last_activity_at: new Date(),
                last_fingerprint_check: new Date(storedSession.last_fingerprint_check ?? new Date()),
                expires_at: new Date(storedSession.expires_at),
              };
              restoreSessionV2(restoredSession); // re-populate the in-memory Map
              setSession(restoredSession);
              setNeedsLogin(false);
              setIsLoading(false);
              return;
            }
          } catch {
            // Invalid JSON — fall through to clear and redirect
          }
        }
        // Expired or missing session — clear config and redirect to home
        clearTerminalConfig();
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (typeof window !== 'undefined') window.location.href = '/';
        setIsLoading(false);
        return;
      }

      // Check if we're in E2E test mode - bypass authentication
      const isE2E = typeof window !== 'undefined' && safeStorage.getItem('e2e_mode') === 'true';
      if (isE2E) {
        // Use the role set by E2E helpers (setupKDSTerminal, setupWaiterTerminal, etc.)
        // stored in localStorage 'park_session', fallback to storedConfig.role or WAITER
        let e2eRole: string = 'WAITER';
        let e2eTerminalRole: string = 'MOZO';
        try {
          const parkSession = JSON.parse(localStorage.getItem('park_session') || '{}');
          if (parkSession.role) {
            e2eRole = parkSession.role;
            const roleToTerminal: Record<string, string> = {
              CASHIER: 'CAJA', WAITER: 'MOZO', DRIVER: 'MOZO',
              KITCHEN: 'KDS_COCINA', COOK: 'KDS_COCINA', PACKER: 'KDS_COCINA',
              BAR: 'KDS_BAR', ADMIN: 'MOZO', MANAGER: 'MOZO',
              OWNER: 'MOZO', SUPERVISOR: 'MOZO',
            };
            e2eTerminalRole = roleToTerminal[e2eRole] ?? 'MOZO';
          }
        } catch { /* keep defaults */ }

        // Create a mock session for E2E tests
        const mockSession: SecureSession = {
          id: `e2e-test-session-${Date.now()}`,
          terminal_id: storedConfig.terminal_id,
          employee_id: storedConfig.actor_id,
          employee_name: 'E2E Test User',
          employee_role: e2eRole as SecureSession['employee_role'],
          terminal_role: e2eTerminalRole as SecureSession['terminal_role'],
          fingerprint_at_login: storedConfig.device_fingerprint,
          fingerprint_signals_at_login: JSON.stringify({}),
          risk_score_at_login: 0,
          created_at: new Date(),
          last_activity_at: new Date(),
          last_fingerprint_check: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };
        
        setSession(mockSession);
        setNeedsLogin(false);
        setIsLoading(false);
        return;
      }

      // Check for existing session in sessionStorage
      const storedSessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSessionData) {
        try {
          const storedSession = JSON.parse(storedSessionData) as SecureSession;
          
          // First try in-memory validation (fast path)
          const validation = validateSessionV2(storedSession.id);
          
          if (validation.valid && validation.session) {
            setSession(validation.session);
            setNeedsLogin(false);
            
            // Set up fingerprint provider for periodic checks
            setFingerprintProvider(generateFingerprintV2);
            startPeriodicFingerprintValidation();
          } else if (validation.reason === 'not_found') {
            // In-memory session map was cleared (server hot-reload / serverless cold start)
            // Validate directly from the stored session data instead of asking for PIN
            const expiresAt = new Date(storedSession.expires_at);
            const lastActivity = new Date(storedSession.last_activity_at);
            const now = new Date();
            const inactiveMs = now.getTime() - lastActivity.getTime();
            const SESSION_MAX_INACTIVE_MS = 8 * 60 * 60 * 1000; // 8 hours (full shift)

            if (expiresAt > now && inactiveMs < SESSION_MAX_INACTIVE_MS) {
              // Session data is still fresh — restore without PIN
              // Re-populate the in-memory Map so periodic check and updateActivity work
              const refreshedSession: SecureSession = {
                ...storedSession,
                expires_at: new Date(now.getTime() + SESSION_MAX_INACTIVE_MS),
                last_activity_at: now,
                created_at: new Date(storedSession.created_at),
                last_fingerprint_check: new Date(storedSession.last_fingerprint_check),
              };
              restoreSessionV2(refreshedSession); // critical: puts back into Map
              sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshedSession));
              setSession(refreshedSession);
              setNeedsLogin(false);
              setFingerprintProvider(generateFingerprintV2);
              startPeriodicFingerprintValidation();
            } else {
              // Actually expired or too long inactive
              sessionStorage.removeItem(SESSION_STORAGE_KEY);
              setNeedsLogin(true);
              setStepUpReason('Tu sesión ha expirado. Por favor ingresá nuevamente.');
            }
          } else {
            // Session invalid for another reason (fingerprint_changed, superseded, etc.)
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setNeedsLogin(true);
            
            if (validation.reason) {
              const reasonMessages = {
                expired: 'Tu sesión ha expirado',
                inactive: 'Sesión cerrada por inactividad',
                fingerprint_changed: 'Se detectó un cambio en el dispositivo',
                superseded: 'Se inició sesión en otro dispositivo',
                not_found: 'Sesión no encontrada',
              };
              setStepUpReason(reasonMessages[validation.reason] || 'Debes iniciar sesión nuevamente');
            }
          }
        } catch (error) {
          console.error('Error parsing stored session:', error);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setNeedsLogin(true);
        }
      } else {
        setNeedsLogin(true);
      }
      
      setIsLoading(false);
    }

    initializeAuth();

    // Cleanup on unmount
    return () => {
      stopPeriodicFingerprintValidation();
    };
  }, []);

  // Función de logout consolidada con useCallback
  // Se usa tanto en el Context Provider como en el useEffect de validación periódica
  const handleLogout = useCallback(() => {
    if (session) {
      logoutV2(session.id);
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    stopPeriodicFingerprintValidation();
    setSession(null);
    setRiskAssessment(null);
    setNeedsLogin(true);
  }, [session]);

  // Track activity and update session (Map + sessionStorage)
  useEffect(() => {
    if (!session) return;

    const handleActivity = () => {
      updateActivityV2(session.id);
      // Also keep sessionStorage in sync so last_activity persists across refreshes
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.last_activity_at = new Date().toISOString();
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [session]);

  // Periodic session validation — only kills session for security-relevant reasons
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const validation = validateSessionV2(session.id);
      
      if (!validation.valid) {
        if (validation.reason === 'not_found') {
          // Map was cleared (hot-reload, module re-init) — silently restore instead of logging out
          restoreSessionV2(session);
          return;
        }

        // Legitimate security reasons — log out
        handleLogout();
        
        if (validation.reason === 'fingerprint_changed') {
          setStepUpReason('Se detectó un cambio en el dispositivo. Por favor, vuelve a autenticarte.');
          setShowStepUpAuth(true);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [session, handleLogout]);

  const handleLogin = useCallback(async (newSession: SecureSession, risk: RiskAssessment) => {
    // Store session in sessionStorage
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    
    setSession(newSession);
    setRiskAssessment(risk);
    setNeedsLogin(false);
    
    // Set up fingerprint provider for periodic checks
    setFingerprintProvider(generateFingerprintV2);
    startPeriodicFingerprintValidation();

    // Check if step-up auth is required
    if (risk.requiredAuth === 'pin_plus_manager') {
      setStepUpReason('Se requiere confirmación de manager debido a cambios en el dispositivo');
      setShowStepUpAuth(true);
    }
  }, []);

  const handleStepUpAuthComplete = useCallback(() => {
    setShowStepUpAuth(false);
    setStepUpReason('');
  }, []);

  const handleStepUpAuthCancel = useCallback(() => {
    // If step-up auth is cancelled, logout
    handleLogout();
  }, [handleLogout]);

  const handleTerminalError = useCallback(() => {
    clearTerminalConfig();
    handleLogout();
    window.location.href = '/login';
  }, [handleLogout]);

  const logout = handleLogout;

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No terminal - redirect to home
  if (noTerminal) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  // Need login
  if (requireAuth && needsLogin && terminal) {
    return (
      <LoginScreen
        terminal={terminal}
        onLogin={handleLogin}
        onTerminalError={handleTerminalError}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ terminal, session, logout, isLoading, riskAssessment }}>
      {children}
      
      {/* Step-up authentication modal */}
      {showStepUpAuth && session && (
        <StepUpAuthModal
          session={session}
          reason={stepUpReason}
          onComplete={handleStepUpAuthComplete}
          onCancel={handleStepUpAuthCancel}
        />
      )}
    </AuthContext.Provider>
  );
}
