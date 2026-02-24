'use client';

/**
 * Admin Sidebar Component
 * Navigation lateral para el panel de administración
 * Responsive: colapsa a hamburger en móvil
 *
 * Agrupación inteligente por contexto de negocio:
 * Operaciones, Catálogo, Equipo, Finanzas, Reportes, Seguridad, Configuración
 *
 * Requirements: 2.1, 10.1, 10.3, 6.1
 */

import { useState, useCallback, useEffect } from 'react';
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
  ChevronDown,
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

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard',
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: LayoutGrid,
    items: [
      { href: '/admin/mesas', label: 'Mesas', icon: Grid3X3, permission: 'manage_config' },
      { href: '/admin/mesas/qr', label: 'QR Mesas', icon: QrCode, permission: 'manage_config' },
      { href: '/admin/mesas/operaciones', label: 'Operaciones Mesa', icon: LayoutGrid, permission: 'manage_config' },
      { href: '/admin/estaciones', label: 'Estaciones KDS', icon: ChefHat, permission: 'manage_stations' },
      { href: '/admin/delivery', label: 'Delivery', icon: Truck, permission: 'manage_config', badgeKey: 'delivery' },
      { href: '/admin/drivers', label: 'Motorizados', icon: Bike, permission: 'manage_employees' },
      { href: '/admin/plataformas', label: 'Plataformas', icon: Globe, permission: 'manage_config' },
      { href: '/admin/plataformas/pedidos', label: 'Pedidos App', icon: Smartphone, permission: 'manage_config' },
    ],
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    icon: Package,
    items: [
      { href: '/admin/productos', label: 'Productos', icon: Package, permission: 'manage_products' },
      { href: '/admin/recetas', label: 'Recetas', icon: BookOpen, permission: 'manage_products' },
      { href: '/admin/pollo-control', label: 'Control Pollo', icon: Egg, permission: 'manage_products' },
      { href: '/inventario', label: 'Inventario', icon: Warehouse, permission: 'manage_products' },
      { href: '/admin/promociones', label: 'Promociones', icon: Gift, permission: 'manage_promotions' },
    ],
  },
  {
    id: 'equipo',
    label: 'Equipo',
    icon: Users,
    items: [
      { href: '/admin/empleados', label: 'Empleados', icon: Users, permission: 'manage_employees' },
      { href: '/admin/hr', label: 'Recursos Humanos', icon: Briefcase, permission: 'manage_employees' },
      { href: '/admin/ranking-meseros', label: 'Ranking Meseros', icon: Award, permission: 'view_reports' },
      { href: '/employee', label: 'Portal Empleado', icon: Store, permission: 'manage_employees' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: Wallet,
    items: [
      { href: '/admin/caja-chica', label: 'Caja Chica', icon: Wallet, permission: 'manage_config' },
      { href: '/admin/compras', label: 'Compras', icon: ShoppingCart, permission: 'manage_products' },
      { href: '/admin/facturacion', label: 'Facturación', icon: FileText, permission: 'manage_config' },
      { href: '/admin/conciliacion', label: 'Conciliación', icon: Scale, permission: 'view_reports' },
      { href: '/admin/estado-resultados', label: 'Estado Resultados', icon: PieChart, permission: 'view_reports' },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { href: '/admin/reportes', label: 'Reportes', icon: BarChart3, permission: 'view_reports' },
      { href: '/admin/reports/profitability', label: 'Rentabilidad', icon: TrendingUp, permission: 'view_reports' },
      { href: '/admin/monitoring', label: 'Monitoreo', icon: Activity, permission: 'view_dashboard' },
    ],
  },
  {
    id: 'seguridad',
    label: 'Seguridad',
    icon: Shield,
    items: [
      { href: '/admin/auditoria', label: 'Auditoría', icon: Shield, permission: 'manage_terminals', badgeKey: 'auditoria' },
      { href: '/admin/terminales', label: 'Terminales', icon: Monitor, permission: 'manage_terminals' },
    ],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { href: '/admin/configuracion', label: 'General', icon: Settings, permission: 'manage_config' },
      { href: '/admin/configuracion/yape-plin', label: 'Yape / Plin', icon: Smartphone, permission: 'manage_config' },
    ],
  },
];

const STORAGE_KEY = 'admin_sidebar_groups';

interface AdminSidebarProps {
  permissions?: Record<string, boolean>;
}

export default function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const badges = useSidebarBadges();
  const { branding } = useTenantBranding();
  const { preloadOnHover } = useAdminPreload();

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCollapsedGroups(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }, [pathname]);

  const isGroupActive = useCallback((group: NavGroup) => {
    return group.items.some(item => isActive(item.href));
  }, [isActive]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const getBadgeCount = (item: NavItem): number => {
    if (!item.badgeKey) return 0;
    return badges[item.badgeKey] || 0;
  };

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

  const hasPermission = (item: NavItem) => {
    if (!item.permission) return true;
    if (!permissions) return true;
    return permissions[item.permission];
  };

  // Filter groups: only show groups that have at least 1 visible item
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(hasPermission),
  })).filter(group => group.items.length > 0);

  const showDashboard = hasPermission(DASHBOARD_ITEM);

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    const badgeCount = getBadgeCount(item);

    return (
      <Tooltip key={item.href} content={item.label} disabled={isOpen}>
        <Link
          href={item.href}
          onClick={() => setIsOpen(false)}
          onMouseEnter={() => {
            const preloadKey = getPreloadKey(item.href);
            if (preloadKey) preloadOnHover(preloadKey);
          }}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
            min-h-[40px] relative
            ${active
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }
          `}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm flex-1">{item.label}</span>

          {badgeCount > 0 && (
            <span
              className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-red-500 text-white rounded-full"
              aria-label={`${badgeCount} notificaciones`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </Link>
      </Tooltip>
    );
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900 rounded-lg border border-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Abrir menu"
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
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800 flex-shrink-0">
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
            aria-label="Cerrar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — scrollable */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {/* Dashboard — always visible at top */}
          {showDashboard && renderNavLink(DASHBOARD_ITEM)}

          {/* Grouped navigation */}
          {filteredGroups.map(group => {
            const groupActive = isGroupActive(group);
            // Auto-expand if group contains active route, otherwise respect saved state
            const isCollapsed = collapsedGroups[group.id] && !groupActive;
            const GroupIcon = group.icon;

            // Count badges in this group
            const groupBadgeCount = group.items.reduce((sum, item) => sum + getBadgeCount(item), 0);

            return (
              <div key={group.id} className="pt-3 first:pt-2">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors rounded-md"
                >
                  <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  {groupBadgeCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full mr-1">
                      {groupBadgeCount > 99 ? '99+' : groupBadgeCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>

                {/* Group items — animated collapse */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pl-2 space-y-0.5 pt-0.5">
                        {group.items.map(renderNavLink)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            Panel de Administraci&oacute;n
          </p>
        </div>
      </aside>
    </>
  );
}
