'use client';

/**
 * Admin Layout
 * Layout principal del panel de administración con sidebar y header
 * Incluye autenticación por PIN y manejo de permisos
 * Uses httpOnly cookies for secure authentication via AuthContext
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 10.1, 10.2, 10.3
 * UX Improvements: Toast notifications (P0), httpOnly cookies (P0 - SECURITY)
 * Performance: SWR global config para deduplicación y caché optimizado
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import AdminLoginScreen from './components/AdminLoginScreen';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { CommandPalette } from '@/src/components/ui/CommandPalette';
import { KeyboardShortcuts } from '@/src/components/ui/KeyboardShortcuts';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantBrandingProvider } from '@/src/core/tenant/branding-context';
import { swrGlobalConfig } from '@/src/lib/swr-config';

interface AuthEmployee {
  id: string;
  name: string;
  role: string;
}

// Rutas que no requieren el layout completo (ya tienen su propia autenticación)
const STANDALONE_ROUTES = ['/inventario'];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, employee, permissions, login, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  // Check if current route is standalone
  const isStandaloneRoute = STANDALONE_ROUTES.some(route => pathname.startsWith(route));

  // Online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAuthSuccess = useCallback((emp: AuthEmployee) => {
    login(emp);
    router.push('/admin/dashboard');
  }, [login, router]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // For standalone routes, just render children
  if (isStandaloneRoute) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Cargando...</div>
      </div>
    );
  }

  // Not authenticated - show professional login screen
  if (!isAuthenticated) {
    return (
      <AdminLoginScreen
        onSuccess={handleAuthSuccess}
        onBack={() => router.push('/')}
      />
    );
  }

  // Authenticated - show full layout
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-white flex">
        {/* Command Palette (Cmd+K / Ctrl+K) */}
        <CommandPalette />

        {/* Keyboard Shortcuts (? key) */}
        <KeyboardShortcuts />

        {/* Toast Notifications */}
        <Toaster 
          position="top-right"
          theme="dark"
          richColors
          closeButton
          duration={5000}
        />

        {/* Sidebar */}
        <AdminSidebar 
          permissions={permissions ? {
            view_dashboard: permissions.view_dashboard,
            manage_products: permissions.manage_products,
            manage_employees: permissions.manage_employees,
            manage_terminals: permissions.manage_terminals,
            manage_promotions: permissions.manage_promotions,
            manage_stations: permissions.manage_stations,
            manage_config: permissions.manage_config,
            view_reports: permissions.view_reports,
          } : undefined}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
          {/* Header */}
          <AdminHeader
            employee={employee}
            isOnline={isOnline}
            onLogout={handleLogout}
          />

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>

          {/* Page footer — credit */}
          <footer className="py-3 text-center">
            <p className="text-[11px] text-zinc-700">
              Desarrollado por{' '}
              <a
                href="https://www.freecloud.pe/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600/70 hover:text-emerald-400 transition-colors"
              >
                Miguel Rivera — FreeCloud
              </a>
            </p>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TenantBrandingProvider>
        {/* 
          SWRConfig proporciona configuración global de caché para todos los componentes hijos.
          Esto habilita:
          - Deduplicación automática de requests (2s window)
          - Caché persistente en memoria
          - Revalidación inteligente
          - Error retry con backoff exponencial
          
          Todos los hooks useSWR en componentes hijos heredarán esta configuración.
        */}
        <SWRConfig value={swrGlobalConfig}>
          <AdminLayoutContent>{children}</AdminLayoutContent>
        </SWRConfig>
      </TenantBrandingProvider>
    </AuthProvider>
  );
}
