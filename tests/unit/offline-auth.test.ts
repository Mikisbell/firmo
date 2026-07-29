import { describe, it, expect, beforeEach } from 'vitest';
import { cacheEmployeeForOffline, verifyOfflineEmployee } from '@/src/core/auth/offline-auth';

describe('Offline Auth Cache Service', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should cache employee credentials on successful login', () => {
    const employee = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Admin Principal',
      dni: '43708661',
      role: 'ADMIN',
      tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    };

    cacheEmployeeForOffline(employee, '160902');

    const result = verifyOfflineEmployee('43708661', '160902');
    expect(result.success).toBe(true);
    expect(result.employee?.name).toBe('Admin Principal');
    expect(result.employee?.role).toBe('ADMIN');
  });

  it('should reject offline login with incorrect PIN', () => {
    const employee = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'María García',
      dni: '11111111',
      role: 'CASHIER',
    };

    cacheEmployeeForOffline(employee, '1111');

    const result = verifyOfflineEmployee('11111111', '9999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('incorrecta');
  });

  it('should return error when DNI is not in offline cache', () => {
    const result = verifyOfflineEmployee('99999999', '1234');
    expect(result.success).toBe(false);
  });
});
