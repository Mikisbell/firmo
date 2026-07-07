/**
 * Custom SWR Hooks para FIRMO POS
 * 
 * Hooks reutilizables para data fetching con deduplicación automática,
 * revalidación inteligente y manejo de errores consistente.
 * 
 * Spec: performance-optimization-vercel-best-practices
 * Requirements: 2.1, 2.4
 */

'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { fetcher } from '@/src/lib/swr-config';

// ============ TYPES ============

interface CatalogItem {
  id: string;
  name: string;
  price_cents: number;
  sku?: string;
  station?: string;
  category?: string;
}

interface CatalogResponse {
  items: CatalogItem[];
}

interface DeliveryOrder {
  id: string;
  order_id: string;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: number;
  status: 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';
  created_at: string;
  assigned_at: string | null;
  dispatched_at: string | null;
}

interface DeliveryResponse {
  deliveries: DeliveryOrder[];
}

interface Employee {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  is_active: boolean;
  pin_hash?: string;
  dni?: string | null;
}

interface Station {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  terminals_count: number;
  printers_count: number;
}

interface StationsResponse {
  items: Station[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface Table {
  id: string;
  number: string;
  display_name: string | null;
  capacity: number;
  shape: string;
  status: string;
  is_active: boolean;
  zone_id: string | null;
  zone: { id: string; code: string; name: string; color: string } | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
}

interface TablesResponse {
  items: Table[];
}

interface MetricsData {
  metrics: Array<{
    name: string;
    type: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    latest: number;
    tags: Record<string, string[]>;
  }>;
  summary: {
    totalMetrics: number;
    period: string;
    startTime: string;
    endTime: string;
    filters: {
      tenantId: string | null;
      terminalId: string | null;
      metricType: string | null;
    };
  };
  counters: Record<string, number>;
  histograms: Record<string, {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  }>;
}

interface MetricsResponse {
  success: boolean;
  data: MetricsData;
}

interface TerminalDevice {
  id: string;
  terminal_id: string;
  role: string;
  status: string;
  device_name: string;
  location_id: string | null;
  bound_at: string | null;
  last_seen_at: string | null;
  drift_score: number;
  activation_code: {
    code: string;
    expires_at: string;
  } | null;
}

interface TerminalsSummary {
  total: number;
  active: number;
  pending: number;
  disabled: number;
}

interface TerminalsResponse {
  devices: TerminalDevice[];
  summary: TerminalsSummary;
}

interface Session {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  terminal_id: string;
  device_id: string;
  mac_address: string;
  ip_address?: string;
  started_at: string;
  last_activity_at: string;
  is_active: boolean;
  is_suspicious: boolean;
}

interface Device {
  mac_address: string;
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  terminal_id: string;
  trust_level: 'TRUSTED' | 'UNKNOWN' | 'BLOCKED';
  first_seen: string;
  last_seen: string;
  is_active: boolean;
  access_count: number;
}

interface Alert {
  id: string;
  employee_id: string;
  alert_type: string;
  reason: string;
  mac_address?: string;
  ip_address?: string;
  is_resolved: boolean;
  created_at: string;
}

interface SecurityResponse {
  sessions: Session[];
  devices: Device[];
  alerts: Alert[];
}

interface DashboardAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

interface DashboardStats {
  salesToday: number;
  salesYesterday: number;
  deltaPercent: number;
  activeOrders: number;
  terminalsOnline: number;
  totalProducts: number;
  lowStockCount?: number;
  alerts: DashboardAlert[];
  recentActivity: { id: string; type: string; message: string; timestamp: string }[];
  syncStatus: {
    synced: boolean;
    pendingEvents: number;
  };
  lastUpdated: string;
  // E4: Enhanced KPIs
  ordersCountToday?: number;
  avgTicketCents?: number;
  topProducts?: { name: string; qty: number; revenueCents: number }[];
  paymentBreakdown?: Record<string, { count: number; totalCents: number }>;
  hourlySales?: number[];
}

// ============ HOOKS ============

/**
 * Hook para obtener el catálogo de productos
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading } = useCatalog();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <ProductGrid products={data.items} />;
 */
export function useCatalog(config?: SWRConfiguration) {
  return useSWR<CatalogResponse>(
    '/api/catalog/latest',
    fetcher,
    {
      // Revalidar cada 5 minutos (catálogo no cambia frecuentemente)
      refreshInterval: 5 * 60 * 1000,
      // Mantener datos stale mientras se revalida
      revalidateOnFocus: false,
      // Deduplicar requests en ventana de 2s
      dedupingInterval: 2000,
      ...config,
    }
  );
}

/**
 * Hook para obtener entregas de un motorizado
 * 
 * @param driverId - ID del motorizado
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useDeliveryOrders('driver-123');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <DeliveryList deliveries={data.deliveries} onUpdate={mutate} />;
 */
export function useDeliveryOrders(driverId: string | null, config?: SWRConfiguration) {
  return useSWR<DeliveryResponse>(
    driverId ? `/api/delivery/driver/${driverId}` : null,
    fetcher,
    {
      // Revalidar cada 15 segundos (entregas cambian frecuentemente)
      refreshInterval: 15 * 1000,
      // Revalidar al recibir foco (importante para app móvil)
      revalidateOnFocus: true,
      // Revalidar al reconectar (crítico para offline-first)
      revalidateOnReconnect: true,
      ...config,
    }
  );
}

/**
 * Hook para obtener lista de terminales
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useTerminals();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <TerminalsList devices={data.devices} summary={data.summary} onUpdate={mutate} />;
 */
export function useTerminals(config?: SWRConfiguration) {
  return useSWR<TerminalsResponse>(
    '/api/admin/terminals-v2',
    fetcher,
    {
      // Revalidar cada 30 segundos (estado de terminales cambia moderadamente)
      refreshInterval: 30 * 1000,
      // Revalidar al recibir foco
      revalidateOnFocus: true,
      // Incluir credenciales para autenticación
      fetcher: (url: string) => fetch(url, { credentials: 'include' }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch terminals');
        return res.json();
      }),
      ...config,
    }
  );
}

/**
 * Hook para obtener datos de seguridad (sesiones, dispositivos, alertas)
 * 
 * @returns {object} { sessions, devices, alerts, error, isLoading, mutate }
 * 
 * @example
 * const { sessions, devices, alerts, error, isLoading } = useSecurityData();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <SecurityDashboard sessions={sessions} devices={devices} alerts={alerts} />;
 */
export function useSecurityData(config?: SWRConfiguration) {
  // Fetch sessions
  const { data: sessionsData, error: sessionsError, isLoading: sessionsLoading, mutate: mutateSessions } = useSWR<{ sessions: Session[] }>(
    '/api/admin/security/sessions',
    fetcher,
    {
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      ...config,
    }
  );

  // Fetch devices
  const { data: devicesData, error: devicesError, isLoading: devicesLoading, mutate: mutateDevices } = useSWR<{ devices: Device[] }>(
    '/api/admin/security/devices',
    fetcher,
    {
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      ...config,
    }
  );

  // Fetch alerts
  const { data: alertsData, error: alertsError, isLoading: alertsLoading, mutate: mutateAlerts } = useSWR<{ alerts: Alert[] }>(
    '/api/admin/security/alerts',
    fetcher,
    {
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      ...config,
    }
  );

  return {
    sessions: sessionsData?.sessions || [],
    devices: devicesData?.devices || [],
    alerts: alertsData?.alerts || [],
    error: sessionsError || devicesError || alertsError,
    isLoading: sessionsLoading || devicesLoading || alertsLoading,
    mutate: () => {
      mutateSessions();
      mutateDevices();
      mutateAlerts();
    },
  };
}

/**
 * Hook para obtener estadísticas del dashboard admin
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading } = useAdminStats();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <DashboardStats stats={data} />;
 */
export function useAdminStats(config?: SWRConfiguration) {
  return useSWR<DashboardStats>(
    '/api/admin/dashboard/stats',
    fetcher,
    {
      // Revalidar cada 60 segundos (métricas en tiempo real)
      refreshInterval: 60 * 1000,
      // Revalidar al recibir foco
      revalidateOnFocus: true,
      // Revalidar al reconectar
      revalidateOnReconnect: true,
      // Incluir credenciales para autenticación
      fetcher: (url: string) => fetch(url, { credentials: 'include' }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch admin stats');
        return res.json();
      }),
      ...config,
    }
  );
}

/**
 * Hook para obtener lista de drivers (motorizados)
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading } = useDrivers();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <DriversList drivers={data.drivers} />;
 */
export function useDrivers(config?: SWRConfiguration) {
  return useSWR<{ drivers: Array<{ id: string; name: string; is_active: boolean }> }>(
    '/api/drivers',
    fetcher,
    {
      // Drivers no cambian frecuentemente, revalidar solo al montar
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

// ============ FASE 3 - NUEVOS HOOKS ============

interface AdminReportsResponse {
  period: string;
  sales_net: number;
  discounts: number;
  tips: number;
  order_count: number;
  by_payment_method: Array<{
    method: string;
    total: number;
  }>;
}

/**
 * Hook para obtener reportes administrativos
 * 
 * @param period - Período del reporte ('today', 'week', 'month', 'year')
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading } = useAdminReports('today');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <ReportsView reports={data} />;
 */
export function useAdminReports(period: string, config?: SWRConfiguration) {
  return useSWR<AdminReportsResponse>(
    period ? `/api/admin/reports?period=${period}` : null,
    fetcher,
    {
      // Reportes cambian cada hora, revalidar moderadamente
      refreshInterval: 60 * 60 * 1000,
      revalidateOnFocus: true,
      ...config,
    }
  );
}

interface ProductImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: 'jpeg' | 'png' | 'webp';
  order: number;
  uploaded_at: string;
  uploaded_by: string;
}

interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  short_name: string | null;
  price_cents: number;
  category: string;
  station: string;
  type: string;
  is_active: boolean;
  is_special_sla?: boolean;
  stock_quantity?: number;
  low_stock_threshold?: number;
  images?: ProductImage[];
  description?: string;
}

/**
 * Hook para obtener detalles de un producto específico
 * 
 * @param id - ID del producto
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useProduct('prod-123');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <ProductDetails product={data} onUpdate={mutate} />;
 */
export function useProduct(id: string | null, config?: SWRConfiguration) {
  return useSWR<Product>(
    id ? `/api/admin/products/${id}` : null,
    fetcher,
    {
      // Productos no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

/**
 * Hook para obtener detalles de un empleado específico
 * 
 * @param id - ID del empleado
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useEmployee('emp-123');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <EmployeeDetails employee={data} onUpdate={mutate} />;
 */
export function useEmployee(id: string | null, config?: SWRConfiguration) {
  return useSWR<Employee>(
    id ? `/api/admin/employees/${id}` : null,
    fetcher,
    {
      // Empleados no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

/**
 * Hook para obtener métricas del sistema
 * 
 * @param params - Parámetros de las métricas (opcional)
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading } = useMetrics({ timeRange: '1h' });
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <MetricsChart metrics={data} />;
 */
export function useMetrics(params?: Record<string, string>, config?: SWRConfiguration) {
  const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
  
  return useSWR<MetricsResponse>(
    `/api/metrics${queryString}`,
    fetcher,
    {
      // Métricas en tiempo real, revalidar frecuentemente
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      ...config,
    }
  );
}

interface EmployeeSubscriptionStatus {
  employee_id: string;
  employee_name: string;
  has_subscription: boolean;
  last_active: string | null;
  days_inactive: number;
}

interface NotificationStatusResponse {
  employees: EmployeeSubscriptionStatus[];
}

/**
 * Hook para obtener estado de notificaciones
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useNotificationStatus();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <NotificationBadge count={data.unread} onUpdate={mutate} />;
 */
export function useNotificationStatus(config?: SWRConfiguration) {
  return useSWR<NotificationStatusResponse>(
    '/api/admin/notifications/status',
    fetcher,
    {
      // Notificaciones cambian frecuentemente
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      ...config,
    }
  );
}

// ============ IN-APP NOTIFICATIONS ============

export interface InAppNotification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  type: 'LEAVE_REQUEST' | 'ADVANCE_REQUEST' | 'PAYSLIP_READY' | 'SHIFT_REMINDER' | 'GENERAL';
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface InAppNotificationsResponse {
  data: InAppNotification[];
  unread_count: number;
}

/**
 * Hook para obtener notificaciones in-app del empleado autenticado
 * Polling cada 30s para mantener el badge actualizado
 */
export function useInAppNotifications(config?: SWRConfiguration) {
  return useSWR<InAppNotificationsResponse>(
    '/api/admin/notifications',
    fetcher,
    {
      refreshInterval: 30 * 1000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      ...config,
    },
  );
}

interface Promotion {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  type: 'PERCENT' | 'FIXED' | 'HAPPY_HOUR' | '2X1' | 'COMBO';
  value: number;
  starts_at: string;
  end_date: string;
  ends_at: string;
  is_active: boolean;
  rules?: Record<string, any>;
  conditions?: Record<string, any>;
  discount_type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_value?: number;
  start_date?: string;
}

interface PromotionsResponse {
  items: Promotion[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

/**
 * Hook para obtener lista de promociones
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = usePromotions();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <PromotionsList promotions={data.promotions} onUpdate={mutate} />;
 */
export function usePromotions(config?: SWRConfiguration) {
  return useSWR<PromotionsResponse>(
    '/api/admin/promotions?pageSize=100',
    fetcher,
    {
      // Promociones no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

/**
 * Hook para obtener detalles de una promoción específica
 * 
 * @param id - ID de la promoción
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = usePromotion('promo-123');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <PromotionDetails promotion={data} onUpdate={mutate} />;
 */
export function usePromotion(id: string | null, config?: SWRConfiguration) {
  return useSWR<Promotion>(
    id ? `/api/admin/promotions/${id}` : null,
    fetcher,
    {
      // Promociones no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

/**
 * Hook para obtener lista de mesas
 * 
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useTables();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <TablesList tables={data.tables} onUpdate={mutate} />;
 */
export function useTables(config?: SWRConfiguration) {
  return useSWR<TablesResponse>(
    '/api/admin/tables?pageSize=100',
    fetcher,
    {
      // Mesas no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

interface CustomerItem {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  doc_type: string | null;
  doc_number: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  updated_at: string;
}

interface CustomersResponse {
  items: CustomerItem[];
  total: number;
  page: number;
  limit: number;
}

export function useCustomers(
  params?: { search?: string; doc_type?: string; page?: number },
  config?: SWRConfiguration,
) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.doc_type) searchParams.set('doc_type', params.doc_type);
  if (params?.page) searchParams.set('page', String(params.page));

  return useSWR<CustomersResponse>(
    `/api/admin/customers?${searchParams.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      ...config,
    },
  );
}

/**
 * Hook para obtener lista de estaciones de cocina
 *
 * @returns {object} { data, error, isLoading, mutate }
 *
 * @example
 * const { data, error, isLoading, mutate } = useStations();
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <StationsList stations={data.stations} onUpdate={mutate} />;
 */
export function useStations(config?: SWRConfiguration) {
  return useSWR<StationsResponse>(
    '/api/admin/stations?pageSize=100',
    fetcher,
    {
      // Estaciones no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
}

interface InventoryStatsResponse {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
  categories: Array<{
    name: string;
    count: number;
    value: number;
  }>;
}

/**
 * Hook para obtener estadísticas de inventario
 * 
 * @param tenantId - ID del tenant
 * @returns {object} { data, error, isLoading, mutate }
 * 
 * @example
 * const { data, error, isLoading, mutate } = useInventoryStats('tenant-123');
 * if (isLoading) return <Loading />;
 * if (error) return <Error />;
 * return <InventoryDashboard stats={data} onUpdate={mutate} />;
 */
export function useInventoryStats(tenantId: string | null, config?: SWRConfiguration) {
  return useSWR<InventoryStatsResponse>(
    tenantId ? `/api/inventory/stats?tenant_id=${tenantId}` : null,
    fetcher,
    {
      // Inventario cambia moderadamente
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: true,
      ...config,
    }
  );
}

// ============ FASE C3 - RANKING MOZOS ============

import type { WaiterRankingReport, RankingSortField } from '@/src/core/types/waiter-ranking';

interface WaiterRankingResponse {
  rankings: WaiterRankingReport['rankings'];
  summary: WaiterRankingReport['summary'];
  period: WaiterRankingReport['period'];
}

/**
 * Hook para obtener ranking de mozos
 *
 * @param params - start, end (YYYY-MM-DD), sort opcional
 * @returns {object} { data, error, isLoading, mutate }
 */
export function useWaiterRanking(
  params: { start: string; end: string; sort?: RankingSortField } | null,
  config?: SWRConfiguration,
) {
  const queryString = params
    ? `?start=${params.start}&end=${params.end}${params.sort ? `&sort=${params.sort}` : ''}`
    : null;

  return useSWR<WaiterRankingResponse>(
    queryString ? `/api/admin/waiter-ranking${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...config,
    },
  );
}

// ============ FASE C2 - CONTABILIDAD ============

import type {
  PettyCashBalance,
  PettyCashTransaction,
} from '@/src/core/services/petty-cash.service';
import type { PurchaseOrder } from '@/src/core/services/purchases.service';
import type { PnLReport } from '@/src/core/services/pnl-report.service';

interface PettyCashResponse {
  balance: PettyCashBalance;
  transactions: PettyCashTransaction[];
}

export interface Location {
  id: string;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
}

export function useLocations(config?: SWRConfiguration) {
  return useSWR<{ locations: Location[] }>(
    '/api/admin/locations',
    fetcher,
    { revalidateOnFocus: false, ...config }
  );
}

/**
 * Hook para obtener balance y transacciones de caja chica
 */
export function usePettyCash(locationId: string | null, config?: SWRConfiguration) {
  return useSWR<PettyCashResponse>(
    locationId ? `/api/admin/petty-cash?locationId=${locationId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      ...config,
    },
  );
}

/**
 * Hook para obtener órdenes de compra
 */
export function usePurchaseOrders(
  params: { locationId: string; status?: string } | null,
  config?: SWRConfiguration,
) {
  const queryString = params
    ? `?locationId=${params.locationId}${params.status ? `&status=${params.status}` : ''}`
    : null;

  return useSWR<{ orders: PurchaseOrder[] }>(
    queryString ? `/api/admin/purchases${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...config,
    },
  );
}

/**
 * Hook para obtener reporte de Estado de Resultados (P&L)
 */
export function usePnLReport(
  params: { start: string; end: string } | null,
  config?: SWRConfiguration,
) {
  const queryString = params
    ? `?start=${params.start}&end=${params.end}`
    : null;

  return useSWR<PnLReport>(
    queryString ? `/api/admin/pnl${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      ...config,
    },
  );
}

// ============ FASE C4 - CONCILIACIÓN ============

import type { Settlement } from '@/src/core/services/reconciliation.service';

/**
 * Hook para obtener liquidaciones de conciliación
 */
export function useSettlements(
  params?: { status?: string; method?: string },
  config?: SWRConfiguration,
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.method) searchParams.set('method', params.method);
  const qs = searchParams.toString();

  return useSWR<{ settlements: Settlement[] }>(
    `/api/admin/reconciliation${qs ? `?${qs}` : ''}`,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      ...config,
    },
  );
}

// ============ FASE C1 - PLATAFORMAS EXTERNAS ============

import type { PlatformOrderRecord } from '@/src/core/services/platform-order.service';
import type { PlatformName, PlatformOrderStatus } from '@/src/core/types/platform';

interface PlatformOrdersResponse {
  orders: PlatformOrderRecord[];
}

interface PlatformConfigItem {
  id: string;
  tenantId: string;
  platform: PlatformName;
  isActive: boolean;
  apiKey: string | null;
  storeId: string | null;
  commissionRate: number;
  markupRate: number;
  autoAccept: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlatformConfigsResponse {
  configs: PlatformConfigItem[];
}

/**
 * Hook para obtener pedidos de plataformas externas
 */
export function usePlatformOrders(
  params?: { platform?: PlatformName; status?: PlatformOrderStatus; limit?: number },
  config?: SWRConfiguration,
) {
  const searchParams = new URLSearchParams();
  if (params?.platform) searchParams.set('platform', params.platform);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useSWR<PlatformOrdersResponse>(
    `/api/admin/platform-orders${qs ? `?${qs}` : ''}`,
    fetcher,
    {
      refreshInterval: 15 * 1000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      ...config,
    },
  );
}

/**
 * Hook para obtener configuración de plataformas
 */
export function usePlatformConfigs(config?: SWRConfiguration) {
  return useSWR<PlatformConfigsResponse>(
    '/api/admin/platform-config',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      ...config,
    },
  );
}

// ============ FASE D1 - MESAS OPERACIONES ============

import type { TableStatusSummary } from '@/src/core/services/mesa.service';

/**
 * Hook para obtener estado de mesas en tiempo real
 */
export function useTableStatus(locationId?: string, config?: SWRConfiguration) {
  const qs = locationId ? `?location_id=${locationId}` : '';
  return useSWR<TableStatusSummary>(
    `/api/admin/mesas/status${qs}`,
    fetcher,
    {
      refreshInterval: 10 * 1000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
      ...config,
    },
  );
}

// ============ EXPORTS ============

// ============ DASHBOARD EJECUTIVO ============

import type { ExecutiveDashboardData, PeriodRange } from '@/src/core/types/executive-dashboard';

/**
 * Hook para obtener datos del dashboard ejecutivo unificado
 */
export function useExecutiveDashboard(
  period: PeriodRange | null,
  config?: SWRConfiguration,
) {
  const queryString = period
    ? `?preset=${period.preset}&start=${period.start}&end=${period.end}`
    : null;

  return useSWR<ExecutiveDashboardData>(
    queryString ? `/api/admin/executive-dashboard${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60000,
      dedupingInterval: 10000,
      ...config,
    },
  );
}

export type {
  CatalogItem,
  CatalogResponse,
  DeliveryOrder,
  DeliveryResponse,
  TerminalDevice,
  TerminalsSummary,
  TerminalsResponse,
  Session,
  Device,
  Alert,
  SecurityResponse,
  DashboardAlert,
  DashboardStats,
  EmployeeSubscriptionStatus,
  NotificationStatusResponse,
  AdminReportsResponse,
  ProductImage,
  Product,
  Promotion,
  PromotionsResponse,
  InventoryStatsResponse,
  WaiterRankingResponse,
  PettyCashResponse,
  PlatformOrdersResponse,
  PlatformConfigItem,
  PlatformConfigsResponse,
};
