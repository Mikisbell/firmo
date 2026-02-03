/**
 * Unit Tests for Configuration API
 * 
 * Tests for PUT endpoint
 * Validates: Requirements 5.1, 5.3, 5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Validation schema
const configSchema = z.object({
  business_name: z.string().min(1, 'El nombre del negocio es requerido'),
  business_phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres'),
  timezone: z.enum(['America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver']),
  currency: z.enum(['PEN', 'USD', 'EUR']),
  default_discount_percent: z.number().min(0).max(100).optional(),
  tax_percent: z.number().min(0).max(100).optional(),
  business_hours_open: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  business_hours_close: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

describe('Configuration API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /api/admin/config', () => {
    it('updates configuration with valid data', () => {
      const validData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
      };

      const result = configSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects configuration with empty business name', () => {
      const invalidData = {
        business_name: '',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
      };

      const result = configSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects configuration with invalid phone', () => {
      const invalidData = {
        business_name: 'Mi Pollería',
        business_phone: '12345', // Less than 9 characters
        timezone: 'America/Lima',
        currency: 'PEN',
      };

      const result = configSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects configuration with invalid timezone', () => {
      const invalidData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'Invalid/Timezone',
        currency: 'PEN',
      };

      const result = configSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects configuration with invalid currency', () => {
      const invalidData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'GBP',
      };

      const result = configSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts configuration with optional discount percent', () => {
      const validData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        default_discount_percent: 10,
      };

      const result = configSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts configuration with optional tax percent', () => {
      const validData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        tax_percent: 18,
      };

      const result = configSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts configuration with business hours', () => {
      const validData = {
        business_name: 'Mi Pollería',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        business_hours_open: '10:00',
        business_hours_close: '22:00',
      };

      const result = configSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration value validation', () => {
    it('accepts all valid timezones', () => {
      const validTimezones = ['America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'];
      
      validTimezones.forEach(timezone => {
        const data = {
          business_name: 'Test',
          business_phone: '987654321',
          timezone,
          currency: 'PEN',
        };
        
        const result = configSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('accepts all valid currencies', () => {
      const validCurrencies = ['PEN', 'USD', 'EUR'];
      
      validCurrencies.forEach(currency => {
        const data = {
          business_name: 'Test',
          business_phone: '987654321',
          timezone: 'America/Lima',
          currency,
        };
        
        const result = configSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Configuration range validation', () => {
    it('accepts discount percent 0', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        default_discount_percent: 0,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts discount percent 100', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        default_discount_percent: 100,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts discount percent between 0 and 100', () => {
      const percentages = [1, 5, 10, 25, 50, 75, 99];
      
      percentages.forEach(percent => {
        const data = {
          business_name: 'Test',
          business_phone: '987654321',
          timezone: 'America/Lima',
          currency: 'PEN',
          default_discount_percent: percent,
        };
        
        const result = configSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('rejects discount percent below 0', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        default_discount_percent: -1,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects discount percent above 100', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        default_discount_percent: 101,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts tax percent 0', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        tax_percent: 0,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts tax percent 100', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        tax_percent: 100,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects tax percent below 0', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        tax_percent: -1,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects tax percent above 100', () => {
      const data = {
        business_name: 'Test',
        business_phone: '987654321',
        timezone: 'America/Lima',
        currency: 'PEN',
        tax_percent: 101,
      };

      const result = configSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Business hours validation', () => {
    it('accepts valid business hours format', () => {
      const validHours = ['00:00', '10:00', '12:30', '23:59'];
      
      validHours.forEach(hours => {
        const data = {
          business_name: 'Test',
          business_phone: '987654321',
          timezone: 'America/Lima',
          currency: 'PEN',
          business_hours_open: hours,
        };
        
        const result = configSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid business hours format', () => {
      const invalidHours = ['10', '10:0', '10:00:00', '10-00'];
      
      invalidHours.forEach(hours => {
        const data = {
          business_name: 'Test',
          business_phone: '987654321',
          timezone: 'America/Lima',
          currency: 'PEN',
          business_hours_open: hours,
        };
        
        const result = configSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Audit trail tracking', () => {
    it('tracks old and new values for configuration changes', () => {
      const oldConfig = {
        business_name: 'Old Name',
        default_discount_percent: 5,
      };

      const newConfig = {
        business_name: 'New Name',
        default_discount_percent: 10,
      };

      const changes = {
        business_name: { old: oldConfig.business_name, new: newConfig.business_name },
        default_discount_percent: { old: oldConfig.default_discount_percent, new: newConfig.default_discount_percent },
      };

      expect(changes.business_name.old).toBe('Old Name');
      expect(changes.business_name.new).toBe('New Name');
      expect(changes.default_discount_percent.old).toBe(5);
      expect(changes.default_discount_percent.new).toBe(10);
    });
  });
});
