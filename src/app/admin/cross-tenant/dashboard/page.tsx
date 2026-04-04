'use client';

/**
 * Cross-Tenant Admin Dashboard
 * Dashboard para administradores cross-tenant mostrando todos los tenants, su salud, y controles de acceso
 * 
 * Features:
 * - Lista de todos los tenants con estado de salud
 * - Indicadores de salud (healthy/warning/critical)
 * - Controles de acceso a tenants (grant/revoke admin access)
 * - Visor de audit logs de acciones cross-tenant
 * - Selección de tenant para acceso
 * - Auto-refresh cada 30s
 * 
 * Requirements: 9.5, 9.6, 9.7
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Users,
  Lock,
  Unlock,
  Clock,
  Eye,
  Shield,
  TrendingUp,
  ShoppingCart,
  Zap,
} from 'lucide-react';
import { Button, Badge, Card, PageHeader } from '@/src/components/ui';

const REFRESH_INTERVAL = 30000; // 30 seconds

interface TenantWithHealth {
  id: string;
  legal_name: string;
  ruc?: string;
  address_text?: string;
  logo_url?: string;
  health_status: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  active_terminals: number;
  recent_orders: number;
  sync_errors: number;
  created_at: string;
  tenant_settings?: {
    timezone: string;
    currency: string;
  };
}

interface HealthCheck {
  type: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface CrossTenantAdmin {
  id: string;
  employee_id: string;
  is_active: boolean;
  expires_at?: string;
  permissions: {
    can_view_configuration: boolean;
    can_view_events: boolean;
    can_view_orders: boolean;
    can_view_analytics: boolean;
    can_modify_configuration: boolean;
    can_modify_quotas: boolean;
    can_deactivate_tenant: boolean;
  };
  employee?: {
    id: string;
    name: string;
    email?: string;
  };
}

interface AuditLog {
  id: string;
  admin_id: string;
  tenant_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  created_at: string;
}

export default function CrossTenantAdminDashboardPage() {
  const [tenants, setTenants] = useState<TenantWithHealth[]>([]);
  const [admins, setAdmins] = useState<CrossTenantAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'tenants' | 'admins' | 'audit'>('tenants');

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch all data in parallel
      const [tenantsRes, adminsRes, auditRes] = await Promise.allSettled([
        fetch('/api/admin/cross-tenant/tenants'),
        fetch('/api/admin/cross-tenant/access-control'),
        fetch('/api/admin/cross-tenant/audit-log?limit=50'),
      ]);

      // Extract data with fallbacks
      const tenantsData = tenantsRes.status === 'fulfilled' && tenantsRes.value.ok
        ? await tenantsRes.value.json()
        : [];

      const adminsData = adminsRes.status === 'fulfilled' && adminsRes.value.ok
        ? await adminsRes.value.json()
        : [];

      const auditData = auditRes.status === 'fulfilled' && auditRes.value.ok
        ? await auditRes.value.json()
        : [];

      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      setAdmins(Array.isArray(adminsData) ? adminsData : []);
      setAuditLogs(Array.isArray(auditData) ? auditData : []);
      setLastUpdated(new Date());

      // Show warning if some APIs failed
      const failedApis = [tenantsRes, adminsRes, auditRes]
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
        .length;

      if (failedApis > 0) {
        console.warn(`${failedApis} cross-tenant dashboard APIs failed`);
      }
    } catch (err) {
      console.error('Cross-tenant dashboard fetch error:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warn':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-park-gray-800/50 border-park-gray-700';
    }
  };

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'critical':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-park-gray-700 text-park-gray-300 border-park-gray-600';
    }
  };

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Panel de administración multi-local"
        description="Gestión de múltiples tenants, salud del sistema y controles de acceso"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchData}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-park-gray-800">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'tenants'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-park-gray-400 hover:text-park-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Tenants ({tenants.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'admins'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-park-gray-400 hover:text-park-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Admins ({admins.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'audit'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-park-gray-400 hover:text-park-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Audit Log ({auditLogs.length})
          </div>
        </button>
      </div>

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {tenants.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {tenants.map((tenant) => (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-6 ${getHealthStatusColor(tenant.health_status)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Tenant Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Building2 className="w-5 h-5" />
                        <div>
                          <h3 className="font-semibold">{tenant.legal_name}</h3>
                          {tenant.ruc && (
                            <p className="text-xs text-park-gray-400">RUC: {tenant.ruc}</p>
                          )}
                        </div>
                      </div>

                      {/* Health Status Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getHealthStatusBadge(
                            tenant.health_status
                          )}`}
                        >
                          {tenant.health_status === 'healthy'
                            ? '✓ Saludable'
                            : tenant.health_status === 'warning'
                            ? '⚠ Advertencia'
                            : '✕ Crítico'}
                        </span>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-blue-400" />
                          <div>
                            <p className="text-xs text-park-gray-400">Terminales</p>
                            <p className="font-semibold">{tenant.active_terminals}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-green-400" />
                          <div>
                            <p className="text-xs text-park-gray-400">Órdenes (24h)</p>
                            <p className="font-semibold">{tenant.recent_orders}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <div>
                            <p className="text-xs text-park-gray-400">Errores Sync</p>
                            <p className="font-semibold">{tenant.sync_errors}</p>
                          </div>
                        </div>
                      </div>

                      {/* Health Checks */}
                      <div className="space-y-2">
                        {tenant.checks.map((check) => (
                          <div key={check.type} className="flex items-center gap-2 text-sm">
                            {getHealthStatusIcon(check.status)}
                            <span className="text-park-gray-300">{check.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setSelectedTenant(tenant.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-park-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No se encontraron locales</p>
            </div>
          )}
        </div>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          {admins.length > 0 ? (
            <div className="bg-park-gray-900 rounded-xl border border-park-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-park-gray-800 bg-park-gray-800/50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-park-gray-400 uppercase">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-park-gray-400 uppercase">
                        Permisos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-park-gray-400 uppercase">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-park-gray-400 uppercase">
                        Expira
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-park-gray-400 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-b border-park-gray-800 hover:bg-park-gray-800/50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium">{admin.employee?.name || 'Desconocido'}</p>
                            <p className="text-xs text-park-gray-500">{admin.employee?.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(admin.permissions)
                              .filter(([_, value]) => value)
                              .map(([key]) => (
                                <span
                                  key={key}
                                  className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300"
                                >
                                  {key.replace(/^can_/, '').replace(/_/g, ' ')}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              admin.is_active
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {admin.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {admin.expires_at
                            ? new Date(admin.expires_at).toLocaleDateString()
                            : 'Sin expiración'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              // TODO: Implement revoke functionality
                              console.log('Revoke admin:', admin.employee_id);
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                          >
                            <Unlock className="w-3 h-3" />
                            Revocar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-park-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No se encontraron administradores cross-tenant</p>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-park-gray-900 rounded-lg border border-park-gray-800 p-4 hover:border-park-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-park-gray-500" />
                        <p className="font-medium">{log.action}</p>
                        {log.resource_type && (
                          <span className="text-xs bg-park-gray-800 px-2 py-1 rounded text-park-gray-400">
                            {log.resource_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-park-gray-500">
                        Tenant: {log.tenant_id} • {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.details && (
                        <p className="text-xs text-park-gray-400 mt-2">
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details).substring(0, 100)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-park-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No se encontraron registros de auditoría</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-park-gray-500 text-right">
          Última actualización: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
