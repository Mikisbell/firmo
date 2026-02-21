/**
 * Terminal Confirmation Service Tests
 *
 * @module core/services/__tests__/terminal-confirmation.service.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalConfirmationService } from '../terminal-confirmation.service';

let service: TerminalConfirmationService;

const TENANT = 'tenant-1';
const TERMINAL = 'CAJA_01';
const EMPLOYEE = 'emp-1';

beforeEach(() => {
  service = new TerminalConfirmationService();
});

// ============================================================================
// generateCode
// ============================================================================

describe('generateCode', () => {
  it('debe generar código de 6 dígitos', () => {
    const result = service.generateCode(TENANT, TERMINAL, EMPLOYEE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toHaveLength(6);
      expect(result.data.code).toMatch(/^\d{6}$/);
      expect(result.data.terminalId).toBe(TERMINAL);
      expect(result.data.tenantId).toBe(TENANT);
      expect(result.data.employeeId).toBe(EMPLOYEE);
      expect(result.data.maxAttempts).toBe(3);
      expect(result.data.attempts).toBe(0);
      expect(result.data.lockedUntil).toBeNull();
    }
  });

  it('debe rechazar generación durante lockout', () => {
    const gen = service.generateCode(TENANT, TERMINAL, EMPLOYEE);
    expect(gen.success).toBe(true);
    if (!gen.success) return;

    // Fail 3 times to trigger lockout
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000000');
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000000');
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000000');

    const result = service.generateCode(TENANT, TERMINAL, EMPLOYEE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('bloqueado');
    }
  });
});

// ============================================================================
// verifyCode
// ============================================================================

describe('verifyCode', () => {
  it('debe aceptar código correcto', () => {
    const gen = service.generateCode(TENANT, TERMINAL, EMPLOYEE);
    expect(gen.success).toBe(true);
    if (!gen.success) return;

    const result = service.verifyCode(TENANT, TERMINAL, EMPLOYEE, gen.data.code);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(true);
    }
  });

  it('debe rechazar código incorrecto', () => {
    service.generateCode(TENANT, TERMINAL, EMPLOYEE);

    const result = service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000000');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(false);
      expect(result.data.attemptsRemaining).toBe(2);
    }
  });

  it('debe bloquear tras 3 intentos fallidos', () => {
    const gen = service.generateCode(TENANT, TERMINAL, EMPLOYEE);
    expect(gen.success).toBe(true);

    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '111111');
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '222222');
    const result = service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '333333');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(false);
      expect(result.data.attemptsRemaining).toBe(0);
      expect(result.data.lockedUntil).toBeDefined();
    }
  });

  it('debe rechazar código expirado', () => {
    const gen = service.generateCode(TENANT, TERMINAL, EMPLOYEE);
    expect(gen.success).toBe(true);
    if (!gen.success) return;

    // Manually expire the code by manipulating internal state
    const key = `${TENANT}:${TERMINAL}:${EMPLOYEE}`;
    const stored = (service as any).codes.get(key);
    stored.expiresAt = Date.now() - 1000; // expired 1 sec ago

    const result = service.verifyCode(TENANT, TERMINAL, EMPLOYEE, gen.data.code);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('expirado');
    }
  });

  it('debe retornar error sin código pendiente', () => {
    const result = service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '123456');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('No hay código');
    }
  });

  it('debe aislar por tenant', () => {
    const gen = service.generateCode(TENANT, TERMINAL, EMPLOYEE);
    expect(gen.success).toBe(true);
    if (!gen.success) return;

    // Try with different tenant
    const result = service.verifyCode('other-tenant', TERMINAL, EMPLOYEE, gen.data.code);

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// isLockedOut
// ============================================================================

describe('isLockedOut', () => {
  it('debe retornar false sin lockout', () => {
    expect(service.isLockedOut(TENANT, TERMINAL, EMPLOYEE)).toBe(false);
  });

  it('debe retornar true durante lockout', () => {
    service.generateCode(TENANT, TERMINAL, EMPLOYEE);

    // Fail 3 times
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000001');
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000002');
    service.verifyCode(TENANT, TERMINAL, EMPLOYEE, '000003');

    expect(service.isLockedOut(TENANT, TERMINAL, EMPLOYEE)).toBe(true);
  });
});
