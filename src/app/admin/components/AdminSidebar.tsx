'use client';

/**
 * Admin Sidebar Component — Vercel/Stripe/Linear inspired
 *
 * Features:
 * - Collapsible icon-only mode (w-[260px] ↔ w-16)
 * - Color system per group for instant orientation
 * - Animated collapse/expand with framer-motion
 * - Tooltips in collapsed mode
 * - State persisted in localStorage
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
  CalendarClock,
  Shield,
  Store,
  Activity,
  TrendingUp,
  BookOpen,
  Egg,
  Smartphone,
  QrCode,
  FileText,
  Wallet,
  ShoppingCart,
  PieChart,
  Scale,
  Globe,
  LayoutGrid,
  MessageSquare,
  Printer,
  Palette,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LineChart,
  Rocket,
  UserCheck,
  Building2,
} from 'lucide-react';
import { Tooltip } from '@/src/components/ui/Tooltip';
import { useSidebarBadges } from '../hooks/useSidebarBadges';
import { TenantLogo } from '@/src/components/branding';
import { useTenantBranding } from '@/src/core/tenant/branding-context';
import { useAdminPreload } from '@/src/lib/lazy-admin-components';
import { APP_VERSION } from '@/src/core/constants/version';

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  permission?: string;
  badgeKey?: 'auditoria' | 'delivery';
}

/* ─── Color system per group ─── */
interface GroupTheme {
  activeHeader: string;
  inactiveIcon: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  activeIconShadow: string;
  hoverBg: string;
}

const GROUP_THEMES: Record<string, GroupTheme> = {
  operaciones: {
    activeHeader: 'text-orange-400',
    inactiveIcon: 'text-orange-500/40',
    activeBg: 'bg-orange-500/15',
    activeText: 'text-orange-300',
    activeBorder: 'border-l-orange-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]',
    hoverBg: 'hover:bg-orange-500/5',
  },
  catalogo: {
    activeHeader: 'text-blue-400',
    inactiveIcon: 'text-blue-500/40',
    activeBg: 'bg-blue-500/15',
    activeText: 'text-blue-300',
    activeBorder: 'border-l-blue-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]',
    hoverBg: 'hover:bg-blue-500/5',
  },
  equipo: {
    activeHeader: 'text-violet-400',
    inactiveIcon: 'text-violet-500/40',
    activeBg: 'bg-violet-500/15',
    activeText: 'text-violet-300',
    activeBorder: 'border-l-violet-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]',
    hoverBg: 'hover:bg-violet-500/5',
  },
  finanzas: {
    activeHeader: 'text-emerald-400',
    inactiveIcon: 'text-emerald-500/40',
    activeBg: 'bg-emerald-500/15',
    activeText: 'text-emerald-300',
    activeBorder: 'border-l-emerald-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    hoverBg: 'hover:bg-emerald-500/5',
  },
  reportes: {
    activeHeader: 'text-cyan-400',
    inactiveIcon: 'text-cyan-500/40',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-300',
    activeBorder: 'border-l-cyan-500',
    activeIconShadow: 'drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]',
    hoverBg: 'hover:bg-cyan-500/5',
  },
  configuracion: {
    activeHeader: 'text-zinc-300',
    inactiveIcon: 'text-zinc-500/60',
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

const ONBOARDING_ITEM: NavItem = {
  href: '/admin/onboarding', label: 'Configuracion Inicial', description: 'Guia paso a paso para configurar tu negocio', icon: Rocket, permission: 'manage_config',
};

const NAV_GROUPS: NavGroup[] = [
  // ── VENTAS: operación diaria del restaurante ──
  {
    id: 'operaciones',
    label: 'Ventas',
    icon: LayoutGrid,
    items: [
      { href: '/admin/mesas', label: 'Mesas', description: 'Gestión de mesas, zonas y QR', icon: Grid3X3, permission: 'manage_config' },
      { href: '/admin/delivery', label: 'Delivery', description: 'Pedidos de delivery en curso', icon: Truck, permission: 'manage_config', badgeKey: 'delivery' },
      { href: '/admin/plataformas', label: 'Plataformas', description: 'PedidosYa, Rappi, LlamaFood', icon: Globe, permission: 'manage_config' },
      { href: '/admin/reservas', label: 'Reservas', description: 'Reservas y disponibilidad', icon: CalendarClock, permission: 'manage_config' },
      { href: '/admin/feedback', label: 'Opiniones', description: 'Quejas, sugerencias y elogios', icon: MessageSquare, permission: 'manage_config' },
      { href: '/admin/clientes', label: 'Clientes', description: 'Datos fiscales, fidelización y CRM', icon: UserCheck, permission: 'manage_config' },
    ],
  },
  // ── MENÚ: carta, recetas, stock ──
  {
    id: 'catalogo',
    label: 'Menú',
    icon: Package,
    items: [
      { href: '/admin/productos', label: 'Productos', description: 'Carta, precios y categorías', icon: Package, permission: 'manage_products' },
      { href: '/admin/recetas', label: 'Recetas', description: 'Ingredientes y costos por plato', icon: BookOpen, permission: 'manage_products' },
      { href: '/admin/pollo-control', label: 'Control Pollo', description: 'Producción y merma diaria', icon: Egg, permission: 'manage_products' },
      { href: '/inventario', label: 'Inventario', description: 'Stock de insumos y alertas', icon: Warehouse, permission: 'manage_products' },
      { href: '/admin/compras', label: 'Compras', description: 'Órdenes de compra a proveedores', icon: ShoppingCart, permission: 'manage_products' },
      { href: '/admin/promociones', label: 'Promociones', description: 'Descuentos y combos activos', icon: Gift, permission: 'manage_promotions' },
    ],
  },
  // ── EQUIPO: personal del restaurante (unified) ──
  {
    id: 'equipo',
    label: 'Equipo',
    icon: Users,
    items: [
      { href: '/admin/equipo', label: 'Equipo', description: 'Gestion unificada del personal', icon: Users, permission: 'manage_employees' },
      { href: '/employee', label: 'Portal Empleado', description: 'Vista del empleado (boletas, horarios)', icon: Store, permission: 'manage_employees' },
    ],
  },
  // ── FINANZAS: dinero y facturación ──
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: Wallet,
    items: [
      { href: '/admin/caja-chica', label: 'Caja Chica', description: 'Gastos menores y reembolsos', icon: Wallet, permission: 'manage_config' },
      { href: '/admin/facturacion', label: 'Facturación', description: 'Boletas, facturas y notas SUNAT', icon: FileText, permission: 'manage_config' },
      { href: '/admin/sales-notes', label: 'Notas de Venta', description: 'Pre-cuentas internas (no fiscales) convertibles', icon: FileText, permission: 'view_reports' },
      { href: '/admin/conciliacion', label: 'Conciliación', description: 'Cruce de caja vs ventas del día', icon: Scale, permission: 'view_reports' },
      { href: '/admin/estado-resultados', label: 'P&L', description: 'Estado de resultados detallado', icon: PieChart, permission: 'view_reports' },
    ],
  },
  // ── REPORTES: análisis y métricas ──
  {
    id: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { href: '/admin/ejecutivo', label: 'Ejecutivo', description: 'Vista unificada de rentabilidad', icon: TrendingUp, permission: 'view_reports' },
      { href: '/admin/dashboard', label: 'Analytics', description: 'KPIs, ventas por hora, top productos', icon: LineChart, permission: 'view_reports' },
      { href: '/admin/sucursales', label: 'Sucursales', description: 'Comparativa por sede', icon: Building2, permission: 'view_reports' },
      { href: '/admin/reports/profitability', label: 'Rentabilidad', description: 'Margen por producto y categoría', icon: TrendingUp, permission: 'view_reports' },
      { href: '/admin/reportes', label: 'Exportables', description: 'Reportes por período', icon: BarChart3, permission: 'view_reports' },
    ],
  },
  // ── CONFIGURACIÓN: setup y seguridad ──
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { href: '/admin/configuracion', label: 'General', description: 'Nombre, RUC, logo, Yape/Plin', icon: Settings, permission: 'manage_config' },
      { href: '/admin/estaciones', label: 'Estaciones KDS', description: 'Pantallas de cocina y despacho', icon: ChefHat, permission: 'manage_stations' },
      { href: '/admin/impresoras', label: 'Impresoras', description: 'Impresoras térmicas y cola', icon: Printer, permission: 'manage_stations' },
      { href: '/admin/terminales', label: 'Terminales', description: 'Dispositivos POS registrados', icon: Monitor, permission: 'manage_terminals' },
      { href: '/admin/auditoria', label: 'Auditoría', description: 'Historial de acciones y seguridad', icon: Shield, permission: 'manage_terminals', badgeKey: 'auditoria' },
      { href: '/admin/monitoring', label: 'Monitoreo', description: 'Salud del sistema y performance', icon: Activity, permission: 'view_dashboard' },
      { href: '/admin/design-system', label: 'Sistema de Diseño', description: 'Catálogo de componentes UI', icon: Palette, permission: 'manage_config' },
    ],
  },
];

const STORAGE_KEY = 'admin_sidebar_groups';
const COLLAPSED_KEY = 'admin_sidebar_collapsed';

interface AdminSidebarProps {
  permissions?: Record<string, boolean>;
}

export default function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const badges = useSidebarBadges();
  const { branding } = useTenantBranding();
  const { preloadOnHover } = useAdminPreload();

  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem(STORAGE_KEY);
      if (savedGroups) setCollapsedGroups(JSON.parse(savedGroups));
      const savedCollapsed = localStorage.getItem(COLLAPSED_KEY);
      if (savedCollapsed) setCollapsed(JSON.parse(savedCollapsed));
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

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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

  // Si no hay permisos (rol sin acceso o no autenticado), ocultar todo por defecto
  const hasPermission = (item: NavItem) => {
    if (!item.permission) return true;
    if (!permissions) return false;
    return !!permissions[item.permission as keyof typeof permissions];
  };

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(hasPermission),
  })).filter(group => group.items.length > 0);

  const showDashboard = hasPermission(DASHBOARD_ITEM);
  const dashboardActive = isActive(DASHBOARD_ITEM.href);
  const showOnboarding = hasPermission(ONBOARDING_ITEM);
  const onboardingActive = isActive(ONBOARDING_ITEM.href);

  /* ── Expanded mode: full nav link ── */
  const renderNavLink = (item: NavItem, theme: GroupTheme) => {
    const active = isActive(item.href);
    const badgeCount = getBadgeCount(item);
    const ItemIcon = item.icon;

    return (
      <Tooltip key={item.href} content={collapsed ? item.label : (item.description || item.label)} disabled={!collapsed && !item.description}>
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          onMouseEnter={() => {
            const k = getPreloadKey(item.href);
            if (k) preloadOnHover(k);
          }}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150
            min-h-[36px] relative border-l-2
            ${active
              ? `${theme.activeBg} ${theme.activeText} ${theme.activeBorder} font-medium`
              : `border-l-transparent text-zinc-500 ${theme.hoverBg} hover:text-zinc-200`
            }
          `}
        >
          <ItemIcon className={`w-4 h-4 flex-shrink-0 ${active ? theme.activeIconShadow : ''}`} />
          {!collapsed && <span className="text-[13px] flex-1 truncate">{item.label}</span>}
          {!collapsed && badgeCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
          {collapsed && badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>
      </Tooltip>
    );
  };

  /* ── Collapsed mode: icon-only group ── */
  const renderCollapsedGroup = (group: NavGroup & { items: NavItem[] }) => {
    const groupActive = isGroupActive(group);
    const theme = GROUP_THEMES[group.id] || GROUP_THEMES.configuracion;
    const GroupIcon = group.icon;
    const groupBadgeCount = group.items.reduce((sum, item) => sum + getBadgeCount(item), 0);

    return (
      <div key={group.id} className="space-y-0.5">
        {/* Group icon as section indicator */}
        <Tooltip content={group.label}>
          <div className={`
            flex items-center justify-center w-10 h-6 mx-auto rounded transition-colors
            ${groupActive ? theme.activeHeader : 'text-zinc-700'}
          `}>
            <GroupIcon className="w-3 h-3" />
          </div>
        </Tooltip>
        {/* Items as icons */}
        {group.items.map(item => renderNavLink(item, theme))}
      </div>
    );
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-[260px]';

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-700/50 min-w-[44px] min-h-[44px] flex items-center justify-center shadow-lg shadow-black/20"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5 text-zinc-300" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${sidebarWidth} bg-zinc-950 border-r border-zinc-800/60
          transition-all duration-200 ease-in-out
          flex flex-col
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`
          flex items-center h-14 border-b border-zinc-800/60 flex-shrink-0
          ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}
        `}>
          {collapsed ? (
            <Link href="/admin" className="flex items-center justify-center">
              <TenantLogo
                logoUrl={branding?.logo_url}
                legalName={branding?.legal_name || 'FIRMO POS'}
                size="sm"
              />
            </Link>
          ) : (
            <>
              <Link href="/admin" className="flex items-center gap-2 flex-1 min-w-0 group">
                <TenantLogo
                  logoUrl={branding?.logo_url}
                  legalName={branding?.legal_name || 'FIRMO POS'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate text-zinc-100 group-hover:text-emerald-400 transition-colors">
                    FIRMO POS
                  </div>
                  <div className="text-[11px] text-zinc-600 truncate">
                    Panel de Administraci&oacute;n
                  </div>
                </div>
              </Link>
              {/* Close button — mobile only */}
              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 text-zinc-500 hover:text-white"
                aria-label="Cerrar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={`
          flex-1 overflow-y-auto py-2 space-y-0.5
          ${collapsed ? 'px-1.5' : 'px-2'}
        `}>
          {/* Dashboard */}
          {showDashboard && (
            <Tooltip content="Dashboard" disabled={!collapsed}>
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => preloadOnHover('dashboard')}
                className={`
                  flex items-center gap-3 rounded-lg transition-all duration-150
                  ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  ${dashboardActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent'
                  }
                `}
              >
                <LayoutDashboard className={`w-[18px] h-[18px] flex-shrink-0 ${dashboardActive ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}`} />
                {!collapsed && <span className="text-sm font-medium">Dashboard</span>}
              </Link>
            </Tooltip>
          )}

          {/* Onboarding */}
          {showOnboarding && (
            <Tooltip content={collapsed ? 'Configuracion Inicial' : 'Guia paso a paso para configurar tu negocio'} disabled={!collapsed}>
              <Link
                href="/admin/onboarding"
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg transition-all duration-150
                  ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  ${onboardingActive
                    ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/10 text-violet-400 border border-violet-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent'
                  }
                `}
              >
                <Rocket className={`w-[18px] h-[18px] flex-shrink-0 ${onboardingActive ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' : ''}`} />
                {!collapsed && <span className="text-sm font-medium">Configuracion Inicial</span>}
              </Link>
            </Tooltip>
          )}

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-1 my-1.5" />

          {/* Groups */}
          {collapsed ? (
            /* ── COLLAPSED: icon-only with group indicators ── */
            <div className="space-y-2">
              {filteredGroups.map(group => renderCollapsedGroup(group))}
            </div>
          ) : (
            /* ── EXPANDED: full groups with labels ── */
            filteredGroups.map(group => {
              const groupActive = isGroupActive(group);
              const isGroupCollapsed = collapsedGroups[group.id] && !groupActive;
              const GroupIcon = group.icon;
              const theme = GROUP_THEMES[group.id] || GROUP_THEMES.configuracion;
              const groupBadgeCount = group.items.reduce((sum, item) => sum + getBadgeCount(item), 0);

              return (
                <div key={group.id} className="pt-2 first:pt-0.5">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-150
                      text-[11px] font-bold uppercase tracking-[0.08em]
                      ${groupActive
                        ? `${theme.activeHeader} bg-white/[0.03]`
                        : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]'
                      }
                    `}
                  >
                    <GroupIcon className={`w-3.5 h-3.5 flex-shrink-0 ${groupActive ? theme.activeHeader : theme.inactiveIcon}`} />
                    <span className="flex-1 text-left">{group.label}</span>
                    {groupBadgeCount > 0 && (
                      <span className="flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-red-500 text-white rounded-full mr-0.5">
                        {groupBadgeCount > 99 ? '99+' : groupBadgeCount}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {!isGroupCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-1 space-y-0.5 pt-0.5">
                          {group.items.map(item => renderNavLink(item, theme))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </nav>

        {/* Footer with collapse toggle */}
        <div className="flex-shrink-0 border-t border-zinc-800/40">
          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50 transition-colors"
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span className="text-[11px]">Colapsar</span>
              </>
            )}
          </button>

          {/* Version info — only when expanded */}
          {!collapsed && (
            <div className="px-3 pb-2.5 pt-0.5">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span>FIRMO POS</span>
                <span>&middot;</span>
                <span>v{APP_VERSION}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
