'use client';

/**
 * Admin Header Component
 * Header con información del usuario y logout
 * Displays tenant branding (logo, legal name)
 * 
 * Requirements: 2.1, 10.1, 10.2, 6.1, 6.2
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  LogOut,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { TenantLogo, TenantInfo } from '@/src/components/branding';
import { useTenantBranding } from '@/src/core/tenant/branding-context';

interface AdminHeaderProps {
  employee: {
    id: string;
    name: string;
    role: string;
  } | null;
  isOnline?: boolean;
  onLogout: () => void;
}

export default function AdminHeader({ employee, isOnline = true, onLogout }: AdminHeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const { branding } = useTenantBranding();

  const handleLogout = () => {
    setShowDropdown(false);
    onLogout();
    router.push('/');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-500/20 text-purple-400';
      case 'ADMIN': return 'bg-blue-500/20 text-blue-400';
      case 'MANAGER': return 'bg-green-500/20 text-green-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 px-4 lg:px-6 flex items-center justify-between">
      {/* Left side - Tenant branding (hidden on mobile, shown on desktop) */}
      <div className="hidden lg:flex items-center gap-3 flex-1">
        <TenantLogo
          logoUrl={branding?.logo_url}
          legalName={branding?.legal_name || 'PARK POS'}
          size="sm"
        />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold">{branding?.legal_name || 'Panel de Administración'}</h1>
          {branding?.ruc && <p className="text-xs text-zinc-500">RUC: {branding.ruc}</p>}
        </div>
      </div>

      {/* Spacer for mobile (hamburger is in sidebar) */}
      <div className="lg:hidden w-12" />

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className={`flex items-center gap-2 text-sm ${isOnline ? 'text-green-400' : 'text-amber-400'}`}>
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="hidden sm:inline">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="hidden sm:inline">Sin conexión</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px]"
          >
            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-amber-400" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium">{employee?.name || 'Usuario'}</p>
              <p className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(employee?.role || '')}`}>
                {employee?.role || 'N/A'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {showDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                
                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-zinc-700">
                    <p className="text-sm font-medium">{employee?.name}</p>
                    <p className="text-xs text-zinc-400">{employee?.role}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors min-h-[44px]"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
