/**
 * Custom SWR Hooks para PARK POS
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
  alerts: DashboardAlert[];
  recentActivity: any[];
  syncStatus: {
    synced: boolean;
    pendingEvents: number;
  };
  lastUpdated: string;
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
  return useSWR(
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
  return useSWR(
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
  return useSWR(
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
  
  return useSWR(
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
  return useSWR(
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
  return useSWR(
    '/api/admin/promotions',
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
  return useSWR(
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
  return useSWR(
    '/api/admin/tables',
    fetcher,
    {
      // Mesas no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
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
  return useSWR(
    '/api/admin/stations',
    fetcher,
    {
      // Estaciones no cambian frecuentemente
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...config,
    }
  );
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
  return useSWR(
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

// ============ EXPORTS ============

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
};
