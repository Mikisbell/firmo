'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Shield, Smartphone } from 'lucide-react';
import { useSecurityData } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, CardHeader, PageHeader, MetricCard, EmptyState, Tabs, TabsContent } from '@/src/components/ui';

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
  TRUSTED: { variant: 'success', label: 'TRUSTED' },
  UNKNOWN: { variant: 'warning', label: 'UNKNOWN' },
  BLOCKED: { variant: 'critical', label: 'BLOCKED' },
};

export default function SecurityDashboard() {
  // Usar SWR para fetch con deduplicación y revalidación automática
  const { sessions, devices, alerts, error, isLoading, mutate } = useSecurityData();
  const [activeTab, setActiveTab] = useState<SecurityTab>('sessions');

  // Optimización: Memoizar sesiones activas para evitar filtrar dos veces
  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.is_active);
  }, [sessions]);

  const handleBlockDevice = async (macAddress: string) => {
    if (!confirm(`Block device ${macAddress}?`)) return;

    try {
      const res = await fetch(`/api/admin/security/devices/${macAddress}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Blocked by admin' }),
      });

      if (res.ok) {
        alert('Device blocked successfully');
        mutate();
      } else {
        alert('Error blocking device');
      }
    } catch (err) {
      console.error('Error blocking device:', err);
      alert('Error blocking device');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Revoke this session?')) return;

    try {
      const res = await fetch(`/api/admin/security/sessions/${sessionId}/revoke`, {
        method: 'POST',
      });

      if (res.ok) {
        alert('Session revoked successfully');
        mutate();
      } else {
        alert('Error revoking session');
      }
    } catch (err) {
      console.error('Error revoking session:', err);
      alert('Error revoking session');
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
        description="Monitor active sessions, devices, and security alerts"
      />

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Active Sessions"
          value={activeSessions.length}
          icon={<Shield className="w-5 h-5" />}
        />
        <MetricCard
          label="Registered Devices"
          value={devices.length}
          icon={<Smartphone className="w-5 h-5" />}
        />
        <MetricCard
          label="Unresolved Alerts"
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
        {/* Active Sessions */}
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Active Sessions ({activeSessions.length})</h2>
          </CardHeader>
          {activeSessions.length === 0 ? (
            <EmptyState
              icon={<Shield />}
              title="No active sessions"
              description="There are no active sessions at this time"
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
                      Revoke
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-park-gray-400">Terminal:</span>
                      <p className="font-mono text-park-gray-200">{session.terminal_id}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">MAC Address:</span>
                      <p className="font-mono text-park-gray-200">{session.mac_address}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Started:</span>
                      <p className="text-park-gray-200">{new Date(session.started_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Last Activity:</span>
                      <p className="text-park-gray-200">{new Date(session.last_activity_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {session.is_suspicious && (
                    <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 p-2 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Suspicious activity detected</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="devices" activeValue={activeTab}>
        {/* Devices */}
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Registered Devices ({devices.length})</h2>
          </CardHeader>
          {devices.length === 0 ? (
            <EmptyState
              icon={<Smartphone />}
              title="No devices registered"
              description="No devices have been registered yet"
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
                        {device.trust_level}
                      </Badge>
                      {device.trust_level !== 'BLOCKED' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBlockDevice(device.mac_address)}
                        >
                          Block
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
                      <span className="text-park-gray-400">Access Count:</span>
                      <p className="text-park-gray-200">{device.access_count}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">First Seen:</span>
                      <p className="text-park-gray-200">{new Date(device.first_seen).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-park-gray-400">Last Seen:</span>
                      <p className="text-park-gray-200">{new Date(device.last_seen).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="alerts" activeValue={activeTab}>
        {/* Alerts */}
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <h2 className="text-xl font-bold">Security Alerts ({alerts.filter(a => !a.is_resolved).length})</h2>
          </CardHeader>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<AlertCircle />}
              title="No alerts"
              description="No security alerts have been triggered"
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
                      {alert.is_resolved ? 'Resolved' : 'Active'}
                    </Badge>
                  </div>
                  {alert.mac_address && (
                    <p className="text-sm text-park-gray-400">MAC: <span className="font-mono">{alert.mac_address}</span></p>
                  )}
                  <p className="text-xs text-park-gray-500">{new Date(alert.created_at).toLocaleString()}</p>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>
    </div>
  );
}
