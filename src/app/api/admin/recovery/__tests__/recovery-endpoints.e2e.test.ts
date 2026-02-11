/**
 * Tests E2E para Recovery Action API Endpoints
 * 
 * Valida que los endpoints de recuperación funcionen correctamente
 * con autenticación, validación y ejecución de acciones.
 * 
 * @module api/admin/recovery/__tests__/recovery-endpoints.e2e.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecoveryService } from '@/src/core/recovery/recovery-service';

// Mock de Next.js Request/Response
class MockNextRequest {
  private body: unknown;
  private headers: Map<string, string>;

  constructor(body: unknown, headers: Record<string, string> = {}) {
    this.body = body;
    this.headers = new Map(Object.entries(headers));
  }

  async json() {
    return this.body;
  }

  get(name: string) {
    return this.headers.get(name.toLowerCase());
  }
}

// Mock de getSessionFromRequest
vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: vi.fn(),
}));

import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { POST as clearCachePOST } from '../clear-cache/route';
import { POST as resetSyncPOST } from '../reset-sync/route';
import { POST as rebuildProjectionsPOST } from '../rebuild-projections/route';

describe('Recovery Action API Endpoints - E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/recovery/clear-cache', () => {
    it('debe retornar 401 si no hay sesión', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const request = new MockNextRequest({
        reason: 'Test de limpieza de caché',
      }) as any;

      // Act
      const response = await clearCachePOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('debe retornar 403 si el usuario no es admin', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'WAITER',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Test de limpieza de caché',
      }) as any;

      // Act
      const response = await clearCachePOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('debe retornar 400 si la razón es muy corta', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Corto', // Menos de 10 caracteres
      }) as any;

      // Act
      const response = await clearCachePOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe ejecutar la acción de limpieza de caché exitosamente', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const recoveryService = RecoveryService.getInstance();
      const executeSpy = vi.spyOn(recoveryService, 'executeRecoveryAction').mockResolvedValue({
        success: true,
      });

      const request = new MockNextRequest({
        reason: 'Limpieza de caché por mantenimiento programado',
        tags: ['products', 'tenants'],
      }) as any;

      // Act
      const response = await clearCachePOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('exitosamente');
      expect(executeSpy).toHaveBeenCalledWith('CLEAR_CACHE', {
        reason: 'Limpieza de caché por mantenimiento programado',
        tags: ['products', 'tenants'],
        initiatedBy: 'admin-123',
        tenantId: 'tenant-123',
      });
    });

    it('debe retornar 500 si la acción falla', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const recoveryService = RecoveryService.getInstance();
      vi.spyOn(recoveryService, 'executeRecoveryAction').mockResolvedValue({
        success: false,
        error: 'Redis no disponible',
      });

      const request = new MockNextRequest({
        reason: 'Limpieza de caché por mantenimiento programado',
      }) as any;

      // Act
      const response = await clearCachePOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error.code).toBe('RECOVERY_FAILED');
      expect(data.error.message).toContain('Redis no disponible');
    });
  });

  describe('POST /api/admin/recovery/reset-sync', () => {
    it('debe retornar 401 si no hay sesión', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const request = new MockNextRequest({
        reason: 'Test de reset de sincronización',
      }) as any;

      // Act
      const response = await resetSyncPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('debe retornar 403 si el usuario no es admin', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'CASHIER',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Test de reset de sincronización',
      }) as any;

      // Act
      const response = await resetSyncPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('debe retornar 400 si el terminalId no es UUID válido', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Reset de sincronización por error',
        terminalId: 'invalid-uuid',
      }) as any;

      // Act
      const response = await resetSyncPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe ejecutar el reset de sincronización exitosamente', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const recoveryService = RecoveryService.getInstance();
      const executeSpy = vi.spyOn(recoveryService, 'executeRecoveryAction').mockResolvedValue({
        success: true,
      });

      const request = new MockNextRequest({
        reason: 'Reset de sincronización por backlog acumulado',
        terminalId: '123e4567-e89b-12d3-a456-426614174000',
        force: true,
      }) as any;

      // Act
      const response = await resetSyncPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('exitosamente');
      expect(executeSpy).toHaveBeenCalledWith('RESET_SYNC', {
        reason: 'Reset de sincronización por backlog acumulado',
        terminalId: '123e4567-e89b-12d3-a456-426614174000',
        force: true,
        initiatedBy: 'admin-123',
        tenantId: 'tenant-123',
      });
    });
  });

  describe('POST /api/admin/recovery/rebuild-projections', () => {
    it('debe retornar 401 si no hay sesión', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const request = new MockNextRequest({
        reason: 'Test de reconstrucción de proyecciones',
      }) as any;

      // Act
      const response = await rebuildProjectionsPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('debe retornar 403 si el usuario no es admin', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'KDS',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Test de reconstrucción de proyecciones',
      }) as any;

      // Act
      const response = await rebuildProjectionsPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('debe retornar 400 si el projectionType es inválido', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });
      const request = new MockNextRequest({
        reason: 'Reconstrucción de proyecciones por inconsistencia',
        projectionType: 'invalid-type',
      }) as any;

      // Act
      const response = await rebuildProjectionsPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe ejecutar la reconstrucción de proyecciones exitosamente', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const recoveryService = RecoveryService.getInstance();
      const executeSpy = vi.spyOn(recoveryService, 'executeRecoveryAction').mockResolvedValue({
        success: true,
      });

      const request = new MockNextRequest({
        reason: 'Reconstrucción de proyecciones por inconsistencia detectada',
        projectionType: 'sales',
        fromDate: '2026-02-01T00:00:00Z',
        dryRun: false,
      }) as any;

      // Act
      const response = await rebuildProjectionsPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('exitosamente');
      expect(executeSpy).toHaveBeenCalledWith('REBUILD_PROJECTIONS', {
        reason: 'Reconstrucción de proyecciones por inconsistencia detectada',
        projectionType: 'sales',
        fromDate: '2026-02-01T00:00:00Z',
        dryRun: false,
        initiatedBy: 'admin-123',
        tenantId: 'tenant-123',
      });
    });

    it('debe ejecutar dry run exitosamente', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const recoveryService = RecoveryService.getInstance();
      vi.spyOn(recoveryService, 'executeRecoveryAction').mockResolvedValue({
        success: true,
      });

      const request = new MockNextRequest({
        reason: 'Simulación de reconstrucción de proyecciones',
        projectionType: 'all',
        dryRun: true,
      }) as any;

      // Act
      const response = await rebuildProjectionsPOST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Simulación');
      expect(data.details.dryRun).toBe(true);
    });
  });

  describe('Validación de autenticación común', () => {
    it('todos los endpoints deben rechazar usuarios sin rol ADMIN', async () => {
      // Arrange
      const nonAdminRoles = ['WAITER', 'CASHIER', 'KDS', 'MANAGER'];
      const endpoints = [clearCachePOST, resetSyncPOST, rebuildProjectionsPOST];

      for (const role of nonAdminRoles) {
        for (const endpoint of endpoints) {
          vi.mocked(getSessionFromRequest).mockResolvedValue({
            userId: 'user-123',
            tenantId: 'tenant-123',
            role: role as any,
            terminalId: 'terminal-123',
          });

          const request = new MockNextRequest({
            reason: 'Test de autorización',
          }) as any;

          // Act
          const response = await endpoint(request);
          const data = await response.json();

          // Assert
          expect(response.status).toBe(403);
          expect(data.error.code).toBe('FORBIDDEN');
        }
      }
    });
  });

  describe('Validación de entrada común', () => {
    it('todos los endpoints deben validar que reason tenga mínimo 10 caracteres', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const endpoints = [clearCachePOST, resetSyncPOST, rebuildProjectionsPOST];

      for (const endpoint of endpoints) {
        const request = new MockNextRequest({
          reason: 'Corto', // Menos de 10 caracteres
        }) as any;

        // Act
        const response = await endpoint(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('todos los endpoints deben validar que reason no exceda 500 caracteres', async () => {
      // Arrange
      vi.mocked(getSessionFromRequest).mockResolvedValue({
        userId: 'admin-123',
        tenantId: 'tenant-123',
        role: 'ADMIN',
        terminalId: 'terminal-123',
      });

      const endpoints = [clearCachePOST, resetSyncPOST, rebuildProjectionsPOST];
      const longReason = 'A'.repeat(501); // Más de 500 caracteres

      for (const endpoint of endpoints) {
        const request = new MockNextRequest({
          reason: longReason,
        }) as any;

        // Act
        const response = await endpoint(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
