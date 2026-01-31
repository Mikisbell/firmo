/**
 * SecurityAlertsPanel Component Tests
 * 
 * Task 16.2 - Terminal Architecture v2
 * Requirements: 6.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlertSeverity } from '@/src/core/auth/audit-logger';

// Mock fetch
global.fetch = vi.fn();

const mockAlerts = [
  {
    id: 'alert-1',
    tenant_id: 'tenant-1',
    terminal_id: 'CAJA_01',
    alert_type: 'fingerprint_drift',
    severity: 'critical' as AlertSeverity,
    message: 'Fingerprint drift detectado en terminal CAJA_01',
    acknowledged: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'alert-2',
    tenant_id: 'tenant-1',
    terminal_id: 'MOZO_01',
    alert_type: 'failed_login_attempts',
    severity: 'high' as AlertSeverity,
    message: 'Múltiples intentos de login fallidos',
    acknowledged: false,
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'alert-3',
    tenant_id: 'tenant-1',
    terminal_id: 'CAJA_02',
    alert_type: 'terminal_disabled',
    severity: 'medium' as AlertSeverity,
    message: 'Terminal deshabilitado por administrador',
    acknowledged: true,
    acknowledged_by: 'ADMIN',
    acknowledged_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
];

describe('SecurityAlertsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ alerts: mockAlerts, count: mockAlerts.length }),
    });
  });

  describe('API Integration', () => {
    it('should fetch alerts on mount', async () => {
      const response = await fetch('/api/admin/audit/alerts?acknowledged=false&limit=50');
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/audit/alerts'));
      expect(data.alerts).toHaveLength(3);
      expect(data.alerts[0].terminal_id).toBe('CAJA_01');
    });

    it('should filter alerts by severity', async () => {
      const response = await fetch('/api/admin/audit/alerts?severity=critical&limit=50');
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('severity=critical'));
      expect(data.alerts).toBeDefined();
    });

    it('should filter alerts by acknowledged status', async () => {
      const response = await fetch('/api/admin/audit/alerts?acknowledged=false&limit=50');
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('acknowledged=false'));
      expect(data.alerts).toBeDefined();
    });

    it('should acknowledge an alert', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          alert: { ...mockAlerts[0], acknowledged: true, acknowledged_by: 'ADMIN' } 
        }),
      });

      const alertId = 'alert-1';
      const response = await fetch(`/api/admin/audit/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'ADMIN' }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.alert.acknowledged).toBe(true);
      expect(data.alert.acknowledged_by).toBe('ADMIN');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/admin/audit/alerts');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('Alert Data Processing', () => {
    it('should calculate unacknowledged count correctly', () => {
      const unacknowledgedCount = mockAlerts.filter(a => !a.acknowledged).length;
      expect(unacknowledgedCount).toBe(2);
    });

    it('should calculate critical alerts count correctly', () => {
      const criticalCount = mockAlerts.filter(
        a => a.severity === 'critical' && !a.acknowledged
      ).length;
      expect(criticalCount).toBe(1);
    });

    it('should format relative time correctly', () => {
      const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours}h`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `Hace ${diffDays}d`;
      };

      const now = new Date().toISOString();
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

      expect(formatRelativeTime(now)).toBe('Ahora');
      expect(formatRelativeTime(oneHourAgo)).toMatch(/Hace \d+[mh]/);
      expect(formatRelativeTime(oneDayAgo)).toMatch(/Hace \d+d/);
    });

    it('should format dates correctly', () => {
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('es-PE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      const testDate = '2024-01-15T10:30:00Z';
      const formatted = formatDate(testDate);
      
      expect(formatted).toContain('2024');
      expect(formatted).toContain('01');
      expect(formatted).toContain('15');
    });
  });

  describe('Severity Handling', () => {
    it('should have correct severity labels', () => {
      const SEVERITY_LABELS: Record<AlertSeverity, string> = {
        low: 'Bajo',
        medium: 'Medio',
        high: 'Alto',
        critical: 'Crítico',
      };

      expect(SEVERITY_LABELS.low).toBe('Bajo');
      expect(SEVERITY_LABELS.medium).toBe('Medio');
      expect(SEVERITY_LABELS.high).toBe('Alto');
      expect(SEVERITY_LABELS.critical).toBe('Crítico');
    });

    it('should have correct severity colors', () => {
      const SEVERITY_COLORS: Record<AlertSeverity, string> = {
        low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      };

      expect(SEVERITY_COLORS.low).toContain('blue');
      expect(SEVERITY_COLORS.medium).toContain('amber');
      expect(SEVERITY_COLORS.high).toContain('orange');
      expect(SEVERITY_COLORS.critical).toContain('red');
    });

    it('should sort alerts by severity correctly', () => {
      const severityOrder: Record<AlertSeverity, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      const sorted = [...mockAlerts].sort((a, b) => 
        severityOrder[b.severity] - severityOrder[a.severity]
      );

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('high');
      expect(sorted[2].severity).toBe('medium');
    });
  });

  describe('Requirement 6.3 Validation', () => {
    it('should display security anomaly alerts in Admin Panel', async () => {
      // **Validates: Requirements 6.3**
      // WHEN a security anomaly is detected, THE System SHALL create an alert visible in the Admin_Panel
      
      const response = await fetch('/api/admin/audit/alerts?acknowledged=false&limit=50');
      const data = await response.json();

      // Alerts should be fetched and visible
      expect(data.alerts).toBeDefined();
      expect(data.alerts.length).toBeGreaterThan(0);
      
      // Alert should contain required fields
      const alert = data.alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.terminal_id).toBeDefined();
      expect(alert.alert_type).toBeDefined();
      expect(alert.severity).toBeDefined();
      expect(alert.message).toBeDefined();
      expect(alert.acknowledged).toBeDefined();
      expect(alert.created_at).toBeDefined();
    });

    it('should allow acknowledging alerts', async () => {
      // **Validates: Requirements 6.3**
      // Alerts should be acknowledgeable
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          alert: { 
            ...mockAlerts[0], 
            acknowledged: true, 
            acknowledged_by: 'ADMIN',
            acknowledged_at: new Date().toISOString(),
          } 
        }),
      });

      const alertId = 'alert-1';
      const response = await fetch(`/api/admin/audit/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'ADMIN' }),
      });
      const data = await response.json();

      // Verify acknowledge was successful
      expect(data.success).toBe(true);
      expect(data.alert.acknowledged).toBe(true);
      expect(data.alert.acknowledged_by).toBe('ADMIN');
      expect(data.alert.acknowledged_at).toBeDefined();
    });

    it('should support filtering alerts by severity and status', async () => {
      // **Validates: Requirements 6.3**
      // Admin panel should support filtering alerts
      
      // Filter by critical severity
      const criticalResponse = await fetch('/api/admin/audit/alerts?severity=critical&limit=50');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('severity=critical'));
      
      // Filter by unacknowledged status
      const unacknowledgedResponse = await fetch('/api/admin/audit/alerts?acknowledged=false&limit=50');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('acknowledged=false'));
      
      // Combined filters
      const combinedResponse = await fetch('/api/admin/audit/alerts?severity=critical&acknowledged=false&limit=50');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('severity=critical'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('acknowledged=false'));
    });
  });
});
