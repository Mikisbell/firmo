'use client';

// src/components/auth/AuthProvider.tsx
// Auth wrapper - handles login flow for protected routes

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { LoginScreen } from './LoginScreen';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
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
  const [needsLogin, setNeedsLogin] = useState(false);
  const [noTerminal, setNoTerminal] = useState(false);

  useEffect(() => {
    const storedConfig = getStoredTerminalConfig();
    
    if (!storedConfig?.terminal_id) {
      // No hay terminal configurada - redirigir a home
      setNoTerminal(true);
      setIsLoading(false);
      return;
    }

    setTerminal(storedConfig);

    const existingSession = getSession();
    if (existingSession) {
      setSession(existingSession);
    } else {
      setNeedsLogin(true);
    }
    
    setIsLoading(false);
  }, []);

  // Track activity
  useEffect(() => {
    if (!session) return;
    const handleActivity = () => updateActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [session]);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    setNeedsLogin(false);
  };

  const handleTerminalError = () => {
    clearTerminalConfig();
    clearSession();
    window.location.href = '/';
  };

  const logout = () => {
    clearSession();
    setSession(null);
    setNeedsLogin(true);
  };

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
    <AuthContext.Provider value={{ terminal, session, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
