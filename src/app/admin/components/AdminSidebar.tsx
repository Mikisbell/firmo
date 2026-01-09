'use client';

/**
 * Admin Sidebar Component
 * Navigation lateral para el panel de administración
 * Responsive: colapsa a hamburger en móvil
 * 
 * Requirements: 2.1, 10.1, 10.3
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Users,
  Monitor,
  Gift,
  ChefHat,
  Settings,
  BarChart3,
  Menu,
  X,
  Warehouse,
  Grid3X3,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
  { href: '/admin/productos', label: 'Productos', icon: Package, permission: 'manage_products' },
  { href: '/admin/mesas', label: 'Mesas', icon: Grid3X3, permission: 'manage_config' },
  { href: '/admin/empleados', label: 'Empleados', icon: Users, permission: 'manage_employees' },
  { href: '/admin/terminales', label: 'Terminales', icon: Monitor, permission: 'manage_terminals' },
  { href: '/admin/promociones', label: 'Promociones', icon: Gift, permission: 'manage_promotions' },
  { href: '/admin/estaciones', label: 'Estaciones KDS', icon: ChefHat, permission: 'manage_stations' },
  { href: '/inventario', label: 'Inventario', icon: Warehouse, permission: 'manage_products' },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, permission: 'manage_config' },
  { href: '/admin/reportes', label: 'Reportes', icon: BarChart3, permission: 'view_reports' },
];

interface AdminSidebarProps {
  permissions?: Record<string, boolean>;
}

export default function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = NAV_ITEMS.filter(item => {
    if (!item.permission) return true;
    if (!permissions) return true;
    return permissions[item.permission];
  });

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900 rounded-lg border border-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-zinc-900 border-r border-zinc-800
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-xl">🍗</span>
            <span className="font-bold text-lg">PARK POS</span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {filteredItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg transition-colors
                  min-h-[44px]
                  ${active
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            Panel de Administración
          </p>
        </div>
      </aside>
    </>
  );
}
