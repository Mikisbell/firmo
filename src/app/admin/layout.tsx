'use client';

/**
 * Admin Layout
 * Layout principal del panel de administración con sidebar y header
 * Incluye autenticación por PIN y manejo de permisos
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 10.1, 10.2, 10.3
 * UX Improvements: Toast notifications (P0)
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import { PinModal } from '@/src/components/inventory/PinModal';
import { ROLE_PERMISSIONS, AdminRole, AdminPermissions } from './lib/permissions';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

interface AuthEmployee {
  id: string;
  name: string;
  role: string;
}

// Rutas que no requieren el layout completo (ya tienen su propia autenticación)
const STANDALONE_ROUTES = ['/inventario'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check if current route is standalone
  const isStandaloneRoute = STANDALONE_ROUTES.some(route => pathname.startsWith(route));

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedSession = localStorage.getItem('admin_session');
        if (storedSession) {
          const session = JSON.parse(storedSession);
          // Validate token is not expired
          if (session.expiresAt && new Date(session.expiresAt) > new Date()) {
            setEmployee(session.employee);
            setPermissions(ROLE_PERMISSIONS[session.employee.role as AdminRole] || null);
            setIsAuthenticated(true);
          } else {
            // Session expired, clear it
            localStorage.removeItem('admin_session');
            if (!isStandaloneRoute) {
              setShowPinModal(true);
            }
          }
        } else if (!isStandaloneRoute) {
          setShowPinModal(true);
        }
      } catch {
        if (!isStandaloneRoute) {
          setShowPinModal(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [isStandaloneRoute]);

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

  const handleAuthSuccess = useCallback((emp: AuthEmployee, token: string) => {
    setEmployee(emp);
    setPermissions(ROLE_PERMISSIONS[emp.role as AdminRole] || null);
    setIsAuthenticated(true);
    setShowPinModal(false);

    // Store session
    const session = {
      employee: emp,
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };
    localStorage.setItem('admin_session', JSON.stringify(session));
  }, []);

  const handleLogout = useCallback(() => {
    setEmployee(null);
    setPermissions(null);
    setIsAuthenticated(false);
    localStorage.removeItem('admin_session');
  }, []);

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
