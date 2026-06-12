'use client';

/**
 * Command Palette (Cmd+K / Ctrl+K)
 *
 * Global search overlay inspired by Vercel, Linear, and Stripe.
 * Searches pages (instant), orders, employees, and products (API, debounced).
 *
 * Requirements: keyboard navigation, recent searches, grouped results,
 * accessible (focus trap, aria roles), cancel inflight requests.
 */

import { useState, useEffect, useRef, useCallback, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, Clock, Trash2 } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Users,
  Monitor,
  Gift,
  ChefHat,
  Settings,
  BarChart3,
  Warehouse,
  Grid3X3,
  Truck,
  Bike,
  CalendarClock,
  Shield,
  Store,
  Activity,
  TrendingUp,
  Briefcase,
  BookOpen,
  Egg,
  ShoppingCart,
  PieChart,
  Scale,
  Globe,
  LayoutGrid,
  MessageSquare,
  Printer,
  Palette,
  LineChart,
  Rocket,
  UserCheck,
  Building2,
  FileText,
  Award,
  Wallet,
} from 'lucide-react';

// ─── Page definitions (mirrored from AdminSidebar NAV_GROUPS) ───

interface PageEntry {
  href: string;
  label: string;
  description: string;
  icon: ElementType;
  keywords?: string[];
}

const ALL_PAGES: PageEntry[] = [
  { href: '/admin', label: 'Dashboard', description: 'Panel principal', icon: LayoutDashboard, keywords: ['inicio', 'home'] },
  { href: '/admin/onboarding', label: 'Configuración Inicial', description: 'Guía paso a paso para configurar tu negocio', icon: Rocket },
  // Ventas
  { href: '/admin/mesas', label: 'Mesas', description: 'Gestión de mesas, zonas y QR', icon: Grid3X3 },
  { href: '/admin/delivery', label: 'Delivery', description: 'Pedidos de delivery en curso', icon: Truck },
  { href: '/admin/plataformas', label: 'Plataformas', description: 'PedidosYa, Rappi, LlamaFood', icon: Globe },
  { href: '/admin/reservas', label: 'Reservas', description: 'Reservas y disponibilidad', icon: CalendarClock },
  { href: '/admin/feedback', label: 'Opiniones', description: 'Quejas, sugerencias y elogios', icon: MessageSquare },
  { href: '/admin/clientes', label: 'Clientes', description: 'Datos fiscales, fidelización y CRM', icon: UserCheck },
  // Menú
  { href: '/admin/productos', label: 'Productos', description: 'Carta, precios y categorías', icon: Package },
  { href: '/admin/recetas', label: 'Recetas', description: 'Ingredientes y costos por plato', icon: BookOpen },
  { href: '/admin/pollo-control', label: 'Control Pollo', description: 'Producción y merma diaria', icon: Egg },
  { href: '/inventario', label: 'Inventario', description: 'Stock de insumos y alertas', icon: Warehouse },
  { href: '/admin/compras', label: 'Compras', description: 'Órdenes de compra a proveedores', icon: ShoppingCart },
  { href: '/admin/promociones', label: 'Promociones', description: 'Descuentos y combos activos', icon: Gift },
  // Equipo
  { href: '/admin/empleados', label: 'Empleados', description: 'Altas, bajas y roles del personal', icon: Users },
  { href: '/admin/drivers', label: 'Motorizados', description: 'Repartidores de delivery', icon: Bike },
  { href: '/admin/hr', label: 'Recursos Humanos', description: 'Asistencia, planillas y vacaciones', icon: Briefcase },
  { href: '/admin/ranking-mozos', label: 'Ranking Mozos', description: 'Desempeño y ventas por mozo', icon: Award },
  { href: '/employee', label: 'Portal Empleado', description: 'Vista del empleado (boletas, horarios)', icon: Store },
  // Finanzas
  { href: '/admin/caja-chica', label: 'Caja Chica', description: 'Gastos menores y reembolsos', icon: Wallet },
  { href: '/admin/facturacion', label: 'Facturación', description: 'Boletas, facturas y notas SUNAT', icon: FileText },
  { href: '/admin/conciliacion', label: 'Conciliación', description: 'Cruce de caja vs ventas del día', icon: Scale },
  { href: '/admin/estado-resultados', label: 'P&L', description: 'Estado de resultados detallado', icon: PieChart },
  // Reportes
  { href: '/admin/ejecutivo', label: 'Ejecutivo', description: 'Vista unificada de rentabilidad', icon: TrendingUp },
  { href: '/admin/dashboard', label: 'Analytics', description: 'KPIs, ventas por hora, top productos', icon: LineChart },
  { href: '/admin/sucursales', label: 'Sucursales', description: 'Comparativa por sede', icon: Building2 },
  { href: '/admin/reports/profitability', label: 'Rentabilidad', description: 'Margen por producto y categoría', icon: TrendingUp },
  { href: '/admin/reportes', label: 'Exportables', description: 'Reportes por período', icon: BarChart3 },
  // Configuración
  { href: '/admin/configuracion', label: 'General', description: 'Nombre, RUC, logo, Yape/Plin', icon: Settings },
  { href: '/admin/estaciones', label: 'Estaciones KDS', description: 'Pantallas de cocina y despacho', icon: ChefHat },
  { href: '/admin/impresoras', label: 'Impresoras', description: 'Impresoras térmicas y cola', icon: Printer },
  { href: '/admin/terminales', label: 'Terminales', description: 'Dispositivos POS registrados', icon: Monitor },
  { href: '/admin/auditoria', label: 'Auditoría', description: 'Historial de acciones y seguridad', icon: Shield },
  { href: '/admin/monitoring', label: 'Monitoreo', description: 'Salud del sistema y performance', icon: Activity },
  { href: '/admin/design-system', label: 'Sistema de Diseño', description: 'Catálogo de componentes UI', icon: Palette },
];

// ─── Types ───

interface SearchResultItem {
  id: string;
  label: string;
  description: string;
  icon: ElementType;
  href: string;
  category: 'pages' | 'orders' | 'employees' | 'products';
}

interface ApiSearchResponse {
  orders: Array<{
    id: string;
    order_number: number;
    order_type: string;
    total_cents: number;
    created_at: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    role: string;
    is_active: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    station: string;
    price_cents: number;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  pages: 'Páginas',
  orders: 'Órdenes',
  employees: 'Empleados',
  products: 'Productos',
};

const RECENT_KEY = 'park_cmd_k_recent';
const MAX_RECENT = 5;

// ─── Helpers ───

function formatCents(cents: number): string {
  return `S/. ${(cents / 100).toFixed(2)}`;
}

function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

function searchPages(query: string): SearchResultItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ALL_PAGES
    .filter(p => {
      const haystack = `${p.label} ${p.description} ${(p.keywords || []).join(' ')}`.toLowerCase();
      return q.split(/\s+/).every(word => haystack.includes(word));
    })
    .slice(0, 6)
    .map(p => ({
      id: `page:${p.href}`,
      label: p.label,
      description: p.description,
      icon: p.icon,
      href: p.href,
      category: 'pages' as const,
    }));
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(queries: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(queries.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

// ─── Component ───

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Global keyboard shortcut ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Focus input when opened ──
  useEffect(() => {
    if (open) {
      setRecentSearches(loadRecent());
      // Small delay to let the animation start
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setLoading(false);
    }
  }, [open]);

  // ── Search logic ──
  const performSearch = useCallback(async (q: string) => {
    // Cancel previous request
    abortRef.current?.abort();

    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Instant page search
    const pageResults = searchPages(trimmed);

    // API search
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(trimmed)}&limit=5`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        setResults(pageResults);
        setLoading(false);
        return;
      }

      const data: ApiSearchResponse = await res.json();

      const orderResults: SearchResultItem[] = data.orders.map(o => ({
        id: `order:${o.id}`,
        label: `#${o.order_number}`,
        description: `${o.order_type} — ${formatCents(o.total_cents)} — ${timeAgo(o.created_at)}`,
        icon: LayoutGrid,
        href: `/admin/orders/${o.id}`,
        category: 'orders',
      }));

      const employeeResults: SearchResultItem[] = data.employees.map(e => ({
        id: `employee:${e.id}`,
        label: e.name,
        description: `${e.role} — ${e.is_active ? 'Activo' : 'Inactivo'}`,
        icon: Users,
        href: `/admin/empleados/${e.id}`,
        category: 'employees',
      }));

      const productResults: SearchResultItem[] = data.products.map(p => ({
        id: `product:${p.id}`,
        label: p.name,
        description: `${p.station} — ${formatCents(p.price_cents)}`,
        icon: Package,
        href: `/admin/productos/${p.id}`,
        category: 'products',
      }));

      setResults([...pageResults, ...orderResults, ...employeeResults, ...productResults]);
      setSelectedIndex(0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setResults(pageResults);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounced input handler ──
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Pages are instant
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Show page results immediately
    const pageResults = searchPages(trimmed);
    setResults(prev => {
      const nonPage = prev.filter(r => r.category !== 'pages');
      return [...pageResults, ...nonPage];
    });

    // Debounce API call
    setLoading(true);
    debounceRef.current = setTimeout(() => performSearch(trimmed), 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, performSearch]);

  // ── Navigate to result ──
  const navigate = useCallback((item: SearchResultItem) => {
    // Save to recent
    const updated = [query.trim(), ...recentSearches.filter(r => r !== query.trim())].slice(0, MAX_RECENT);
    saveRecent(updated);
    setRecentSearches(updated);

    setOpen(false);
    router.push(item.href);
  }, [query, recentSearches, router]);

  // ── Navigate to recent search ──
  const applyRecent = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const clearRecent = useCallback(() => {
    saveRecent([]);
    setRecentSearches([]);
  }, []);

  // ── Group results by category ──
  const grouped = results.reduce<Record<string, SearchResultItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatResults = results;

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatResults[selectedIndex];
      if (item) navigate(item);
      return;
    }
  }, [flatResults, selectedIndex, navigate]);

  // ── Scroll selected into view ──
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (typeof window === 'undefined') return null;

  const showRecent = !query.trim() && recentSearches.length > 0;
  const showEmpty = query.trim() && !loading && flatResults.length === 0;
  let globalIndex = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="dialog"
            aria-label="Paleta de comandos"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none"
          >
            <div
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden pointer-events-auto"
              onKeyDown={handleKeyDown}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
                <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar páginas, órdenes, empleados, productos..."
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
                  aria-label="Buscar"
                  autoComplete="off"
                  spellCheck={false}
                />
                {loading && (
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin flex-shrink-0" />
                )}
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 bg-zinc-800 border border-zinc-700 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results area */}
              <div
                ref={listRef}
                className="max-h-[60vh] overflow-y-auto overscroll-contain"
                role="listbox"
                aria-label="Resultados de búsqueda"
              >
                {/* Recent searches */}
                {showRecent && (
                  <div className="py-2">
                    <div className="flex items-center justify-between px-4 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Búsquedas recientes
                      </span>
                      <button
                        onClick={clearRecent}
                        className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpiar
                      </button>
                    </div>
                    {recentSearches.map(q => (
                      <button
                        key={q}
                        onClick={() => applyRecent(q)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
                      >
                        <Clock className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Grouped results */}
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category} className="py-1.5">
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                    </div>
                    {items.map(item => {
                      globalIndex++;
                      const idx = globalIndex;
                      const isSelected = idx === selectedIndex;
                      const ItemIcon = item.icon;

                      return (
                        <button
                          key={item.id}
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={() => navigate(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                            ${isSelected
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                            }
                          `}
                        >
                          <ItemIcon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            <div className="text-[12px] text-zinc-500 truncate">{item.description}</div>
                          </div>
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Empty state */}
                {showEmpty && (
                  <div className="py-12 text-center">
                    <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">
                      Sin resultados para &lsquo;{query.trim()}&rsquo;
                    </p>
                  </div>
                )}

                {/* Initial state (no query, no recents) */}
                {!query.trim() && recentSearches.length === 0 && (
                  <div className="py-10 text-center">
                    <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">
                      Escribí para buscar en todo el sistema
                    </p>
                    <p className="text-[12px] text-zinc-600 mt-1">
                      Páginas, órdenes por número, empleados, productos
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px]">↑↓</kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px]">↵</kbd>
                  abrir
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px]">esc</kbd>
                  cerrar
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
