'use client';

// src/components/auth/AuthProvider.tsx
// Main auth wrapper that handles terminal registration and login flow

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { TerminalSetup } from './TerminalSetup';
import { LoginScreen } from './LoginScreen';
import { 
  getStoredTerminalConfig, 
  generateDeviceFingerprint,
  clearTerminalConfig,
} from '@/src/core/auth/fingerprint';
import { getSession, clearSession, updateActivity } from '@/src/core/auth/session';
import type { TerminalConfig, AuthSession } from '@/src/core/auth/types';

interface AuthContextValue {
  terminal: TerminalConfig | null;
  session: AuthSession | null;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function AuthProvider({ children, requireAuth = true }: AuthProviderProps) {
  const [terminal, setTerminal] = useState<TerminalConfig | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  // Initialize on mount
  useEffect(() => {
    async function init() {
      try {
        // Check for stored terminal config
        const storedConfig = getStoredTerminalConfig();
        
        // Force re-setup if old format (no terminal_id or invalid)
        if (storedConfig && !storedConfig.terminal_id) {
          clearTerminalConfig();
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }
        
        if (!storedConfig) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        // Verify terminal is still valid
        const fingerprint = await generateDeviceFingerprint();
        const response = await fetch('/api/auth/verify-terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: storedConfig.tenant_id,
            terminal_id: storedConfig.terminal_id,
            device_fingerprint: fingerprint,
          }),
        });

        const data = await response.json();

        if (!data.valid) {
          // Terminal no longer valid, need to re-register
          clearTerminalConfig();
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        setTerminal(storedConfig);

        // Check for existing session
        const existingSession = getSession();
        if (existingSession) {
          setSession(existingSession);
        } else {
          setNeedsLogin(true);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        // On error, show login (offline mode)
        const storedConfig = getStoredTerminalConfig();
        if (storedConfig) {
          setTerminal(storedConfig);
          setNeedsLogin(true);
        } else {
          setNeedsSetup(true);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Track activity for auto-logout
  useEffect(() => {
    if (!session) return;

    const handleActivity = () => {
      updateActivity();
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

  const handleTerminalSetup = (config: TerminalConfig) => {
    setTerminal(config);
    setNeedsSetup(false);
    setNeedsLogin(true);
  };

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    setNeedsLogin(false);
  };

  const handleTerminalError = () => {
    clearTerminalConfig();
    clearSession();
    setTerminal(null);
    setSession(null);
    setNeedsSetup(true);
    setNeedsLogin(false);
  };

  const logout = () => {
    clearSession();
    setSession(null);
    setNeedsLogin(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Terminal setup needed
  if (needsSetup) {
    return <TerminalSetup onComplete={handleTerminalSetup} />;
  }

  // Login needed
  if (requireAuth && needsLogin && terminal) {
    return (
      <LoginScreen
        terminal={terminal}
        onLogin={handleLogin}
        onTerminalError={handleTerminalError}
      />
    );
  }

  // Authenticated - render children
  return (
    <AuthContext.Provider value={{ terminal, session, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
