'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Shield, Smartphone } from 'lucide-react';
import { useSecurityData } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, CardHeader, PageHeader, MetricCard, EmptyState, Tabs, TabsContent } from '@/src/components/ui';
import { toast } from 'sonner';

type SecurityTab = 'sessions' | 'devices' | 'alerts';

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

const TRUST_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical'; label: string }> = {
  TRUSTED: { variant: 'success', label: 'Confiable' },
  UNKNOWN: { variant: 'warning', label: 'Desconocido' },
  BLOCKED: { variant: 'critical', label: 'Bloqueado' },
};

export default function SecurityDashboard() {
  const { sessions, devices, alerts, error, isLoading, mutate } = useSecurityData();
  const [activeTab, setActiveTab] = useState<SecurityTab>('sessions');

  // Optimización: Memoizar sesiones activas para evitar filtrar dos veces
  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.is_active);
  }, [sessions]);

  const handleBlockDevice = async (macAddress: string) => {
    if (!confirm(`¿Bloquear el dispositivo ${macAddress}?`)) return;

    try {
      const res = await fetch(`/api/admin/security/devices/${macAddress}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bloqueado por administrador' }),
      });

      if (res.ok) {
        toast.success('Dispositivo bloqueado');
        mutate();
      } else {
        toast.error('Error al bloquear el dispositivo');
      }
    } catch (err) {
      console.error('Error blocking device:', err);
      toast.error('Error al bloquear el dispositivo');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('¿Revocar esta sesión?')) return;

    try {
      const res = await fetch(`/api/admin/security/sessions/${sessionId}/revoke`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Sesión revocada');
        mutate();
      } else {
        toast.error('Error al revocar la sesión');
      }
    } catch (err) {
      console.error('Error revoking session:', err);
      toast.error('Error al revocar la sesión');
    }
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Seguridad"
        description="Monitoreá sesiones activas, dispositivos y alertas de seguridad"
      />

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Sesiones Activas"
          value={activeSessions.length}
          icon={<Shield className="w-5 h-5" />}
        />
        <MetricCard
          label="Dispositivos Registrados"
          value={devices.length}
          icon={<Smartphone className="w-5 h-5" />}
        />
        <MetricCard
          label="Alertas Sin Resolver"
          value={alerts.filter(a => !a.is_resolved).length}
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as SecurityTab)}
        tabs={[
          { value: 'sessions', label: 'Sesiones', icon: <Shield size={16} />, badge: <Badge variant="neutral" size="sm">{activeSessions.length}</Badge> },
          { value: 'devices', label: 'Dispositivos', icon: <Smartphone size={16} />, badge: <Badge variant="neutral" size="sm">{devices.length}</Badge> },
          { value: 'alerts', label: 'Alertas', icon: <AlertCircle size={16} />, badge: <Badge variant={alerts.filter((a) => !a.is_resolved).length > 0 ? 'critical' : 'neutral'} size="sm">{alerts.filter((a) => !a.is_resolved).length}</Badge> },
        ]}
      />

      <TabsContent value="sessions" activeValue={activeTab}>
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Sesiones Activas ({activeSessions.length})</h2>
          </CardHeader>
          {activeSessions.length === 0 ? (
            <EmptyState
              icon={<Shield />}
              title="Sin sesiones activas"
              description="No hay sesiones activas en este momento"
            />
          ) : (
            <div className="p-6 space-y-4">
              {activeSessions.map((session) => (
                <Card key={session.id} padding="sm" className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{session.employee.name}</p>
                      <p className="text-sm text-park-gray-400">{session.employee.email}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revocar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-park-gray-400">Terminal:</span>
                      <p className="font-mono text-park-gray-200">{session.terminal_id}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">MAC:</span>
                      <p className="font-mono text-park-gray-200">{session.mac_address}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Inicio:</span>
                      <p className="text-park-gray-200">{new Date(session.started_at).toLocaleString('es-PE')}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Última actividad:</span>
                      <p className="text-park-gray-200">{new Date(session.last_activity_at).toLocaleString('es-PE')}</p>
                    </div>
                  </div>
                  {session.is_suspicious && (
                    <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 p-2 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Actividad sospechosa detectada</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="devices" activeValue={activeTab}>
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Dispositivos Registrados ({devices.length})</h2>
          </CardHeader>
          {devices.length === 0 ? (
            <EmptyState
              icon={<Smartphone />}
              title="Sin dispositivos registrados"
              description="No hay dispositivos registrados aún"
            />
          ) : (
            <div className="p-6 space-y-4">
              {devices.map((device) => (
                <Card key={device.mac_address} padding="sm" className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        {device.mac_address}
                      </p>
                      <p className="text-sm text-park-gray-400">{device.employee.name}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={TRUST_BADGE[device.trust_level]?.variant ?? 'neutral'} dot>
                        {TRUST_BADGE[device.trust_level]?.label ?? device.trust_level}
                      </Badge>
                      {device.trust_level !== 'BLOCKED' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBlockDevice(device.mac_address)}
                        >
                          Bloquear
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-park-gray-400">Terminal:</span>
                      <p className="font-mono text-park-gray-200">{device.terminal_id}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Accesos:</span>
                      <p className="text-park-gray-200">{device.access_count}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Primera vez:</span>
                      <p className="text-park-gray-200">{new Date(device.first_seen).toLocaleString('es-PE')}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Última vez:</span>
                      <p className="text-park-gray-200">{new Date(device.last_seen).toLocaleString('es-PE')}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="alerts" activeValue={activeTab}>
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Alertas de Seguridad ({alerts.filter(a => !a.is_resolved).length} sin resolver)</h2>
          </CardHeader>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<AlertCircle />}
              title="Sin alertas"
              description="No se han disparado alertas de seguridad"
            />
          ) : (
            <div className="p-6 space-y-4">
              {alerts.map((alert) => (
                <Card
                  key={alert.id}
                  padding="sm"
                  className={`space-y-2 ${!alert.is_resolved ? 'border-red-500/30' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 ${alert.is_resolved ? 'text-park-gray-400' : 'text-red-400'}`} />
                        {alert.alert_type}
                      </p>
                      <p className="text-sm text-park-gray-400">{alert.reason}</p>
                    </div>
                    <Badge variant={alert.is_resolved ? 'neutral' : 'critical'} dot>
                      {alert.is_resolved ? 'Resuelto' : 'Activo'}
                    </Badge>
                  </div>
                  {alert.mac_address && (
                    <p className="text-sm text-park-gray-400">MAC: <span className="font-mono">{alert.mac_address}</span></p>
                  )}
                  <p className="text-xs text-park-gray-500">{new Date(alert.created_at).toLocaleString('es-PE')}</p>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>
    </div>
  );
}
