'use client';

/**
 * Admin Layout
 * Layout principal del panel de administración con sidebar y header
 * Incluye autenticación por PIN y manejo de permisos
 * Uses httpOnly cookies for secure authentication via AuthContext
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 10.1, 10.2, 10.3
 * UX Improvements: Toast notifications (P0), httpOnly cookies (P0 - SECURITY)
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import { PinModal } from '@/src/components/inventory/PinModal';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';

interface AuthEmployee {
  id: string;
  name: string;
  role: string;
}

// Rutas que no requieren el layout completo (ya tienen su propia autenticación)
const STANDALONE_ROUTES = ['/inventario'];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, employee, permissions, login, logout } = useAuth();
  const [showPinModal, setShowPinModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Check if current route is standalone
  const isStandaloneRoute = STANDALONE_ROUTES.some(route => pathname.startsWith(route));

  // Show PIN modal if not authenticated and not loading
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isStandaloneRoute) {
      setShowPinModal(true);
    }
  }, [isLoading, isAuthenticated, isStandaloneRoute]);

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
    setShowPinModal(false);
  }, [login]);

  const handleLogout = useCallback(async () => {
    await logout();
    setShowPinModal(true);
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

  // Not authenticated - show PIN modal
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <PinModal
          isOpen={showPinModal}
          onClose={() => window.history.back()}
          onSuccess={handleAuthSuccess}
          allowedRoles={['OWNER', 'ADMIN', 'MANAGER']}
          title="Acceso al Panel de Administración"
        />
      </div>
    );
  }

  // Authenticated - show full layout
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-white flex">
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
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  );
}
