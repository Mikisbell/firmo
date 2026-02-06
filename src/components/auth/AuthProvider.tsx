'use client';

// src/components/auth/AuthProvider.tsx
// Auth wrapper - handles login flow for protected routes with risk-based authentication

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { LoginScreen } from './LoginScreen';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig, AuthSession } from '@/src/core/auth/types';
import { 
  validateSession as validateSessionV2, 
  updateActivity as updateActivityV2,
  logout as logoutV2,
  setFingerprintProvider,
  startPeriodicFingerprintValidation,
  stopPeriodicFingerprintValidation,
  type SecureSession 
} from '@/src/core/auth/session-v2';
import { generateFingerprintV2, type FingerprintResult } from '@/src/core/auth/fingerprint-v2';
import { assessRisk, type RiskAssessment } from '@/src/core/auth/risk-validator';
import { getTerminal } from '@/src/core/auth/terminal-registry';
import { StepUpAuthModal } from './StepUpAuthModal';

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
      
      if (!storedConfig?.terminal_id) {
        // No hay terminal configurada - redirigir a home
        setNoTerminal(true);
        setIsLoading(false);
        return;
      }

      setTerminal(storedConfig);

      // Check if we're in E2E test mode - bypass authentication
      const isE2E = typeof window !== 'undefined' && localStorage.getItem('e2e_mode') === 'true';
      if (isE2E) {
        // Create a mock session for E2E tests
        const mockSession: SecureSession = {
          id: `e2e-test-session-${Date.now()}`,
          terminal_id: storedConfig.terminal_id,
          actor_id: storedConfig.actor_id,
          role: storedConfig.role,
          created_at: Date.now(),
          last_activity: Date.now(),
          fingerprint: storedConfig.device_fingerprint,
          risk_level: 'low'
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
          
          // Validate session
          const validation = validateSessionV2(storedSession.id);
          
          if (validation.valid && validation.session) {
            setSession(validation.session);
            setNeedsLogin(false);
            
            // Set up fingerprint provider for periodic checks
            setFingerprintProvider(generateFingerprintV2);
            startPeriodicFingerprintValidation();
          } else {
            // Session invalid - need to re-login
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setNeedsLogin(true);
            
            // Show reason for re-auth if needed
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

  // Track activity and update session
  useEffect(() => {
    if (!session) return;

    const handleActivity = () => {
      updateActivityV2(session.id);
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

  // Periodic session validation
  useEffect(() => {
    if (!session) return;

    const handleLogout = () => {
      if (session) {
        logoutV2(session.id);
      }
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      stopPeriodicFingerprintValidation();
      setSession(null);
      setRiskAssessment(null);
      setNeedsLogin(true);
    };

    const interval = setInterval(() => {
      const validation = validateSessionV2(session.id);
      
      if (!validation.valid) {
        // Session became invalid - logout
        handleLogout();
        
        if (validation.reason === 'fingerprint_changed') {
          setStepUpReason('Se detectó un cambio en el dispositivo. Por favor, vuelve a autenticarte.');
          setShowStepUpAuth(true);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [session]);

  const handleLogin = async (newSession: SecureSession, risk: RiskAssessment) => {
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
  };

  const handleStepUpAuthComplete = () => {
    setShowStepUpAuth(false);
    setStepUpReason('');
  };

  const handleStepUpAuthCancel = () => {
    // If step-up auth is cancelled, logout
    handleLogout();
  };

  const handleTerminalError = () => {
    clearTerminalConfig();
    handleLogout();
    window.location.href = '/';
  };

  const handleLogout = () => {
    if (session) {
      logoutV2(session.id);
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    stopPeriodicFingerprintValidation();
    setSession(null);
    setRiskAssessment(null);
    setNeedsLogin(true);
  };

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
