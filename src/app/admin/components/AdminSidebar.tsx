'use client';

/**
 * Admin Sidebar Component
 * Navigation lateral para el panel de administración
 * Responsive: colapsa a hamburger en móvil
 * 
 * P0 Improvements (27 Enero 2026):
 * - Badges de notificaciones (Auditoría, Delivery)
 * - Tooltips en desktop para labels completos
 * - Icono consistente (Lucide Store en vez de emoji)
 * 
 * Requirements: 2.1, 10.1, 10.3, 6.1
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
  Truck,
  Bike,
  Shield,
  Store,
  Activity,
  TrendingUp,
  Briefcase,
  BookOpen,
  Egg,
  Smartphone,
  QrCode,
  FileText,
  Award,
  Wallet,
  ShoppingCart,
  PieChart,
  Scale,
  Globe,
  LayoutGrid,
} from 'lucide-react';
import { Tooltip } from '@/src/components/ui/Tooltip';
import { useSidebarBadges } from '../hooks/useSidebarBadges';
import { TenantLogo } from '@/src/components/branding';
import { useTenantBranding } from '@/src/core/tenant/branding-context';
import { useAdminPreload } from '@/src/lib/lazy-admin-components';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badgeKey?: 'auditoria' | 'delivery';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
  { href: '/admin/productos', label: 'Productos', icon: Package, permission: 'manage_products' },
  { href: '/admin/recetas', label: 'Recetas', icon: BookOpen, permission: 'manage_products' },
  { href: '/admin/pollo-control', label: 'Control Pollo', icon: Egg, permission: 'manage_products' },
  { href: '/admin/mesas', label: 'Mesas', icon: Grid3X3, permission: 'manage_config' },
  { href: '/admin/mesas/qr', label: 'QR Mesas', icon: QrCode, permission: 'manage_config' },
  { href: '/admin/mesas/operaciones', label: 'Operaciones Mesa', icon: LayoutGrid, permission: 'manage_config' },
  { href: '/admin/empleados', label: 'Empleados', icon: Users, permission: 'manage_employees' },
  { href: '/admin/hr', label: 'Recursos Humanos', icon: Briefcase, permission: 'manage_employees' },
  { href: '/admin/terminales', label: 'Terminales', icon: Monitor, permission: 'manage_terminals' },
  { href: '/admin/auditoria', label: 'Auditoría', icon: Shield, permission: 'manage_terminals', badgeKey: 'auditoria' },
  { href: '/admin/promociones', label: 'Promociones', icon: Gift, permission: 'manage_promotions' },
  { href: '/admin/estaciones', label: 'Estaciones KDS', icon: ChefHat, permission: 'manage_stations' },
  { href: '/admin/delivery', label: 'Delivery', icon: Truck, permission: 'manage_config', badgeKey: 'delivery' },
  { href: '/admin/drivers', label: 'Motorizados', icon: Bike, permission: 'manage_employees' },
  { href: '/inventario', label: 'Inventario', icon: Warehouse, permission: 'manage_products' },
  { href: '/admin/monitoring', label: 'Monitoreo', icon: Activity, permission: 'view_dashboard' },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, permission: 'manage_config' },
  { href: '/admin/configuracion/yape-plin', label: 'Yape / Plin', icon: Smartphone, permission: 'manage_config' },
  { href: '/admin/facturacion', label: 'Facturación', icon: FileText, permission: 'manage_config' },
  { href: '/admin/ranking-meseros', label: 'Ranking Meseros', icon: Award, permission: 'view_reports' },
  { href: '/admin/caja-chica', label: 'Caja Chica', icon: Wallet, permission: 'manage_config' },
  { href: '/admin/compras', label: 'Compras', icon: ShoppingCart, permission: 'manage_products' },
  { href: '/admin/estado-resultados', label: 'Estado Resultados', icon: PieChart, permission: 'view_reports' },
  { href: '/admin/conciliacion', label: 'Conciliación', icon: Scale, permission: 'view_reports' },
  { href: '/admin/plataformas', label: 'Plataformas', icon: Globe, permission: 'manage_config' },
  { href: '/admin/plataformas/pedidos', label: 'Pedidos App', icon: Smartphone, permission: 'manage_config' },
  { href: '/admin/reportes', label: 'Reportes', icon: BarChart3, permission: 'view_reports' },
  { href: '/admin/reports/profitability', label: 'Rentabilidad', icon: TrendingUp, permission: 'view_reports' },
  { href: '/employee', label: 'Portal Empleado', icon: Store, permission: 'manage_employees' },
];

interface AdminSidebarProps {
  permissions?: Record<string, boolean>;
}

export default function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const badges = useSidebarBadges();
  const { branding } = useTenantBranding();
  const { preloadOnHover } = useAdminPreload();

  const filteredItems = NAV_ITEMS.filter(item => {
    if (!item.permission) return true;
    if (!permissions) return true;
    return permissions[item.permission];
  });

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const getBadgeCount = (item: NavItem): number => {
    if (!item.badgeKey) return 0;
    return badges[item.badgeKey] || 0;
  };

  // Map routes to preload keys
  const getPreloadKey = (href: string): keyof typeof import('@/src/lib/lazy-admin-components').preloadAdminComponents | null => {
    if (href === '/admin/reportes') return 'reports';
    if (href === '/admin') return 'dashboard';
    if (href === '/admin/auditoria') return 'auditoria';
    if (href === '/admin/security') return 'security';
    if (href === '/admin/cross-tenant/dashboard') return 'crossTenant';
    if (href === '/admin/tenant/dashboard') return 'tenantDashboard';
    if (href === '/admin/tenant/provisioning') return 'tenantProvisioning';
    if (href === '/admin/delivery') return 'delivery';
    if (href === '/admin/delivery/historial') return 'deliveryHistory';
    if (href === '/admin/notificaciones') return 'notifications';
    return null;
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
          <Link href="/admin" className="flex items-center gap-2 flex-1 min-w-0">
            <TenantLogo
              logoUrl={branding?.logo_url}
              legalName={branding?.legal_name || 'PARK POS'}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">
                {branding?.legal_name || 'PARK POS'}
              </div>
              <div className="text-xs text-zinc-500 truncate">
                {branding?.ruc ? `RUC: ${branding.ruc}` : 'Sistema POS'}
              </div>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {filteredItems.map((item) => {
            const active = isActive(item.href);
            const badgeCount = getBadgeCount(item);
            
            return (
              <Tooltip key={item.href} content={item.label} disabled={isOpen}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={() => {
                    const preloadKey = getPreloadKey(item.href);
                    if (preloadKey) {
                      preloadOnHover(preloadKey);
                    }
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-lg transition-colors
                    min-h-[44px] relative
                    ${active
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  
                  {/* Badge */}
                  {badgeCount > 0 && (
                    <span 
                      className="
                        flex items-center justify-center
                        min-w-[20px] h-5 px-1.5
                        text-xs font-bold
                        bg-red-500 text-white
                        rounded-full
                      "
                      aria-label={`${badgeCount} notificaciones`}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </Link>
              </Tooltip>
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
