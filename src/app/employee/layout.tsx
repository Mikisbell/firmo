'use client';

/**
 * Employee Self-Service Portal Layout
 *
 * Mobile-first layout with bottom navigation tabs for employee access.
 * Fetches the authenticated employee's profile to display their name.
 * Uses the same dark theme as the admin panel.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Toaster } from 'sonner';
import { Home, Calendar, Clock, DollarSign, Palmtree, ArrowLeft, Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar');
  return r.json();
});

const tabs = [
  { href: '/employee', label: 'Inicio', icon: Home },
  { href: '/employee/schedule', label: 'Turnos', icon: Calendar },
  { href: '/employee/attendance', label: 'Asistencia', icon: Clock },
  { href: '/employee/payslips', label: 'Boletas', icon: DollarSign },
  { href: '/employee/vacation', label: 'Vacaciones', icon: Palmtree },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: profile, isLoading } = useSWR('/api/hr/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const isActiveTab = (href: string) => {
    if (href === '/employee') return pathname === '/employee';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        duration={4000}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-400 font-bold text-sm">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Mi Portal</h1>
              {isLoading ? (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando...
                </div>
              ) : (
                <p className="text-xs text-zinc-400 truncate max-w-[180px]">
                  {profile?.name || 'Empleado'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              // Si hay historial de navegación, volver al workspace.
              // Sino, ir al inicio (el empleado accedió directo a /employee).
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.replace('/');
              }
            }}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Volver al área de trabajo"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 pb-24 max-w-lg mx-auto w-full overflow-auto">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 safe-area-pb">
        <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1">
          {tabs.map((tab) => {
            const active = isActiveTab(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-colors min-w-[56px] ${
                  active
                    ? 'text-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
