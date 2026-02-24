'use client';

/**
 * Admin Sidebar Component
 * Navigation lateral para el panel de administración
 * Responsive: colapsa a hamburger en móvil
 *
 * Sistema de color por grupo:
 * Cada sección tiene su propio acento visual para orientación inmediata.
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

/* ─── Color system per group ─── */
interface GroupTheme {
  /** Header icon + text when group is active */
  activeHeader: string;
  /** Header icon color (inactive) */
  inactiveIcon: string;
  /** Active link: bg + text + left border */
  activeBg: string;
  activeText: string;
  activeBorder: string;
  /** Active icon glow */
  activeIconShadow: string;
  /** Hover state for links */
  hoverBg: string;
}

const GROUP_THEMES: Record<string, GroupTheme> = {
  operaciones: {
    activeHeader: 'text-orange-400',
    inactiveIcon: 'text-orange-500/50',
    activeBg: 'bg-orange-500/15',
    activeText: 'text-orange-300',
    activeBorder: 'border-l-orange-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]',
    hoverBg: 'hover:bg-orange-500/5',
  },
  catalogo: {
    activeHeader: 'text-blue-400',
    inactiveIcon: 'text-blue-500/50',
    activeBg: 'bg-blue-500/15',
    activeText: 'text-blue-300',
    activeBorder: 'border-l-blue-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]',
    hoverBg: 'hover:bg-blue-500/5',
  },
  equipo: {
    activeHeader: 'text-violet-400',
    inactiveIcon: 'text-violet-500/50',
    activeBg: 'bg-violet-500/15',
    activeText: 'text-violet-300',
    activeBorder: 'border-l-violet-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]',
    hoverBg: 'hover:bg-violet-500/5',
  },
  finanzas: {
    activeHeader: 'text-emerald-400',
    inactiveIcon: 'text-emerald-500/50',
    activeBg: 'bg-emerald-500/15',
    activeText: 'text-emerald-300',
    activeBorder: 'border-l-emerald-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    hoverBg: 'hover:bg-emerald-500/5',
  },
  reportes: {
    activeHeader: 'text-cyan-400',
    inactiveIcon: 'text-cyan-500/50',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-300',
    activeBorder: 'border-l-cyan-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]',
    hoverBg: 'hover:bg-cyan-500/5',
  },
  seguridad: {
    activeHeader: 'text-amber-400',
    inactiveIcon: 'text-amber-500/50',
    activeBg: 'bg-amber-500/15',
    activeText: 'text-amber-300',
    activeBorder: 'border-l-amber-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]',
    hoverBg: 'hover:bg-amber-500/5',
  },
  configuracion: {
    activeHeader: 'text-zinc-300',
    inactiveIcon: 'text-zinc-500/70',
    activeBg: 'bg-zinc-700/30',
    activeText: 'text-zinc-200',
    activeBorder: 'border-l-zinc-400',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(161,161,170,0.3)]',
    hoverBg: 'hover:bg-zinc-800/50',
  },
};

/* ─── Navigation structure ─── */
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

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(hasPermission),
  })).filter(group => group.items.length > 0);

  const showDashboard = hasPermission(DASHBOARD_ITEM);
  const dashboardActive = isActive(DASHBOARD_ITEM.href);

  const renderNavLink = (item: NavItem, theme: GroupTheme) => {
    const active = isActive(item.href);
    const badgeCount = getBadgeCount(item);
    const ItemIcon = item.icon;

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
            flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
            min-h-[38px] relative border-l-2
            ${active
              ? `${theme.activeBg} ${theme.activeText} ${theme.activeBorder} font-medium`
              : `border-l-transparent text-zinc-500 ${theme.hoverBg} hover:text-zinc-200`
            }
          `}
        >
          <ItemIcon
            className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
              active ? theme.activeIconShadow : ''
            }`}
          />
          <span className="text-[13px] flex-1 truncate">{item.label}</span>

          {badgeCount > 0 && (
            <span
              className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse"
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
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-700/50 min-w-[44px] min-h-[44px] flex items-center justify-center shadow-lg shadow-black/20"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5 text-zinc-300" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[260px] bg-zinc-950 border-r border-zinc-800/60
          transform transition-transform duration-200 ease-in-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header — glass effect */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800/60 flex-shrink-0 bg-zinc-900/50 backdrop-blur-sm">
          <Link href="/admin" className="flex items-center gap-2.5 flex-1 min-w-0 group">
            <TenantLogo
              logoUrl={branding?.logo_url}
              legalName={branding?.legal_name || 'PARK POS'}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-zinc-100 group-hover:text-emerald-400 transition-colors">
                {branding?.legal_name || 'PARK POS'}
              </div>
              <div className="text-[11px] text-zinc-600 truncate">
                {branding?.ruc ? `RUC: ${branding.ruc}` : 'Sistema POS'}
              </div>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
            aria-label="Cerrar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — scrollable */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {/* Dashboard — prominent top item */}
          {showDashboard && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              onMouseEnter={() => preloadOnHover('dashboard')}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                min-h-[42px] mb-2
                ${dashboardActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                ${dashboardActive
                  ? 'bg-emerald-500/20 shadow-inner'
                  : 'bg-zinc-800/50'
                }
              `}>
                <LayoutDashboard className={`w-4 h-4 ${dashboardActive ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}`} />
              </div>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
          )}

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-2 my-1" />

          {/* Grouped navigation */}
          {filteredGroups.map(group => {
            const groupActive = isGroupActive(group);
            const isCollapsed = collapsedGroups[group.id] && !groupActive;
            const GroupIcon = group.icon;
            const theme = GROUP_THEMES[group.id] || GROUP_THEMES.configuracion;
            const groupBadgeCount = group.items.reduce((sum, item) => sum + getBadgeCount(item), 0);

            return (
              <div key={group.id} className="pt-2.5 first:pt-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200
                    text-[11px] font-bold uppercase tracking-[0.08em]
                    ${groupActive
                      ? `${theme.activeHeader} bg-white/[0.03]`
                      : `text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]`
                    }
                  `}
                >
                  <GroupIcon
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200 ${
                      groupActive ? theme.activeHeader : theme.inactiveIcon
                    }`}
                  />
                  <span className="flex-1 text-left">{group.label}</span>
                  {groupBadgeCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full mr-0.5 animate-pulse">
                      {groupBadgeCount > 99 ? '99+' : groupBadgeCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>

                {/* Group items */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pl-1.5 space-y-0.5 pt-1">
                        {group.items.map(item => renderNavLink(item, theme))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800/40">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase">
              PARK POS &middot; Admin
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
