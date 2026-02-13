'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Lock, Shield, Smartphone } from 'lucide-react';
import { useSecurityData } from '@/src/hooks/useSWRHooks';

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

export default function SecurityDashboard() {
  const router = useRouter();
  
  // Usar SWR para fetch con deduplicación y revalidación automática
  const { sessions, devices, alerts, error, isLoading, mutate } = useSecurityData();

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
        mutate(); // Revalidar datos con SWR
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
        mutate(); // Revalidar datos con SWR
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor active sessions, devices, and security alerts</p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Active Sessions Tab */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Active Sessions ({sessions.filter(s => s.is_active).length})</h2>
          {sessions.filter(s => s.is_active).length === 0 ? (
            <p className="text-gray-500">No active sessions</p>
          ) : (
            <div className="space-y-4">
              {sessions.filter(s => s.is_active).map((session) => (
                <div key={session.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{session.employee.name}</p>
                      <p className="text-sm text-gray-600">{session.employee.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Revoke
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Terminal:</span>
                      <p className="font-mono">{session.terminal_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">MAC Address:</span>
                      <p className="font-mono">{session.mac_address}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Started:</span>
                      <p>{new Date(session.started_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Activity:</span>
                      <p>{new Date(session.last_activity_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {session.is_suspicious && (
                    <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-2 rounded">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Suspicious activity detected</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Devices Tab */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Registered Devices ({devices.length})</h2>
          {devices.length === 0 ? (
            <p className="text-gray-500">No devices registered</p>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device.mac_address} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        {device.mac_address}
                      </p>
                      <p className="text-sm text-gray-600">{device.employee.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs rounded font-semibold ${
                        device.trust_level === 'TRUSTED' ? 'bg-green-100 text-green-700' :
                        device.trust_level === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {device.trust_level}
                      </span>
                      {device.trust_level !== 'BLOCKED' && (
                        <button
                          onClick={() => handleBlockDevice(device.mac_address)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Block
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Terminal:</span>
                      <p className="font-mono">{device.terminal_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Access Count:</span>
                      <p>{device.access_count}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">First Seen:</span>
                      <p>{new Date(device.first_seen).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Seen:</span>
                      <p>{new Date(device.last_seen).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts Tab */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Security Alerts ({alerts.filter(a => !a.is_resolved).length})</h2>
          {alerts.length === 0 ? (
            <p className="text-gray-500">No alerts</p>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`border rounded-lg p-4 space-y-2 ${
                  alert.is_resolved ? 'bg-gray-50' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 ${alert.is_resolved ? 'text-gray-400' : 'text-red-600'}`} />
                        {alert.alert_type}
                      </p>
                      <p className="text-sm text-gray-600">{alert.reason}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded font-semibold ${
                      alert.is_resolved ? 'bg-gray-200 text-gray-700' : 'bg-red-200 text-red-700'
                    }`}>
                      {alert.is_resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                  {alert.mac_address && (
                    <p className="text-sm text-gray-600">MAC: <span className="font-mono">{alert.mac_address}</span></p>
                  )}
                  <p className="text-xs text-gray-500">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
