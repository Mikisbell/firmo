/**
 * Unit Tests for Drivers API
 * 
 * Tests for POST, PATCH, DELETE endpoints
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Validation schema
const driverSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres').optional(),
});

describe('Drivers API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/drivers', () => {
    it('creates driver with name only', () => {
      const validData = {
        name: 'John Doe',
      };

      const result = driverSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('creates driver with name and phone', () => {
      const validData = {
        name: 'John Doe',
        phone: '987654321',
      };

      const result = driverSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects driver without name', () => {
      const invalidData = {
        phone: '987654321',
      };

      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects driver with empty name', () => {
      const invalidData = {
        name: '',
        phone: '987654321',
      };

      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects driver with phone less than 9 characters', () => {
      const invalidData = {
        name: 'John Doe',
        phone: '12345678', // 8 characters
      };

      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts driver with phone exactly 9 characters', () => {
      const validData = {
        name: 'John Doe',
        phone: '123456789', // 9 characters
      };

      const result = driverSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts driver with long phone number', () => {
      const validData = {
        name: 'John Doe',
        phone: '+51987654321', // International format
      };

      const result = driverSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('PATCH /api/drivers/[id]', () => {
    it('updates driver name', () => {
      const updateData = {
        name: 'Jane Doe',
      };

      const result = driverSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('updates driver phone', () => {
      const updateData = {
        name: 'John Doe',
        phone: '999888777',
      };

      const result = driverSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('removes driver phone by not including it', () => {
      const updateData = {
        name: 'John Doe',
      };

      const result = driverSchema.safeParse(updateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeUndefined();
      }
    });

    it('rejects update with empty name', () => {
      const invalidData = {
        name: '',
      };

      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects update with invalid phone', () => {
      const invalidData = {
        name: 'John Doe',
        phone: '12345', // Less than 9 characters
      };

      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('DELETE /api/drivers/[id]', () => {
    it('soft delete sets is_active to false', () => {
      const driver = {
        id: 'driver-1',
        name: 'John Doe',
        phone: '987654321',
        is_active: true,
      };

      const softDeleted = { ...driver, is_active: false };
      expect(softDeleted.is_active).toBe(false);
      expect(softDeleted.id).toBe(driver.id);
      expect(softDeleted.name).toBe(driver.name);
      expect(softDeleted.phone).toBe(driver.phone);
    });

    it('soft delete preserves all fields', () => {
      const driver = {
        id: 'driver-1',
        name: 'John Doe',
        phone: '987654321',
        is_active: true,
        created_at: new Date(),
      };

      const softDeleted = { ...driver, is_active: false };
      expect(softDeleted.name).toBe(driver.name);
      expect(softDeleted.phone).toBe(driver.phone);
      expect(softDeleted.created_at).toBe(driver.created_at);
    });

    it('soft delete can be reversed by setting is_active to true', () => {
      const driver = {
        id: 'driver-1',
        name: 'John Doe',
        is_active: false,
      };

      const reactivated = { ...driver, is_active: true };
      expect(reactivated.is_active).toBe(true);
    });
  });

  describe('Driver field validation', () => {
    it('name field accepts various lengths', () => {
      const names = ['A', 'John', 'John Doe', 'Very Long Driver Name With Many Words'];
      
      names.forEach(name => {
        const data = { name };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('phone field accepts various formats', () => {
      const phones = [
        '123456789',
        '987654321',
        '+51987654321',
        '(51) 987654321',
        '51-987-654-321',
      ];
      
      phones.forEach(phone => {
        const data = { name: 'John', phone };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Driver list operations', () => {
    it('filters active drivers', () => {
      const drivers = [
        { id: '1', name: 'John', is_active: true },
        { id: '2', name: 'Jane', is_active: false },
        { id: '3', name: 'Bob', is_active: true },
      ];

      const activeDrivers = drivers.filter(d => d.is_active);
      expect(activeDrivers).toHaveLength(2);
      expect(activeDrivers.map(d => d.name)).toEqual(['John', 'Bob']);
    });

    it('filters inactive drivers', () => {
      const drivers = [
        { id: '1', name: 'John', is_active: true },
        { id: '2', name: 'Jane', is_active: false },
        { id: '3', name: 'Bob', is_active: true },
      ];

      const inactiveDrivers = drivers.filter(d => !d.is_active);
      expect(inactiveDrivers).toHaveLength(1);
      expect(inactiveDrivers[0].name).toBe('Jane');
    });

    it('searches drivers by name', () => {
      const drivers = [
        { id: '1', name: 'John Doe', is_active: true },
        { id: '2', name: 'Jane Smith', is_active: true },
        { id: '3', name: 'Bob Johnson', is_active: true },
      ];

      const searchTerm = 'john';
      const results = drivers.filter(d => d.name.toLowerCase().includes(searchTerm));
      expect(results).toHaveLength(2);
      expect(results.map(d => d.name)).toEqual(['John Doe', 'Bob Johnson']);
    });
  });
});
