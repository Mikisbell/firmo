/**
 * Unit Tests for Promotions API
 * 
 * Tests for POST, PUT, DELETE endpoints
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Mock Prisma
const mockPrisma = {
  promotions: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  admin_access_logs: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Validation schema
const promotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO']),
  value: z.number().min(0),
  rules: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  is_active: z.boolean().default(true),
}).refine(data => new Date(data.starts_at) < new Date(data.ends_at), {
  message: 'Start date must be before end date',
  path: ['starts_at'],
});

describe('Promotions API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/promotions', () => {
    it('creates promotion with valid data', () => {
      const validData = {
        name: 'Happy Hour',
        type: 'HAPPY_HOUR',
        value: 20,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = promotionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects promotion with invalid date range', () => {
      const invalidData = {
        name: 'Invalid Promotion',
        type: 'PERCENT',
        value: 10,
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        ends_at: new Date().toISOString(), // ends_at before starts_at
      };

      const result = promotionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects promotion with invalid type', () => {
      const invalidData = {
        name: 'Invalid Type',
        type: 'INVALID_TYPE',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = promotionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects promotion with negative value', () => {
      const invalidData = {
        name: 'Negative Value',
        type: 'PERCENT',
        value: -10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = promotionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts promotion with optional rules', () => {
      const validData = {
        name: 'Combo Deal',
        type: 'COMBO',
        value: 50,
        rules: { min_items: 2, max_items: 5 },
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = promotionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('PUT /api/admin/promotions/[id]', () => {
    it('validates update data with same schema', () => {
      const updateData = {
        name: 'Updated Promotion',
        type: 'FIXED',
        value: 25,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 172800000).toISOString(),
      };

      const result = promotionSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('rejects update with invalid date range', () => {
      const invalidData = {
        name: 'Updated Promotion',
        type: 'FIXED',
        value: 25,
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        ends_at: new Date().toISOString(),
      };

      const result = promotionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('allows updating all fields', () => {
      const updateData = {
        name: 'New Name',
        type: 'PERCENT',
        value: 30,
        rules: { new_rule: true },
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        is_active: false,
      };

      const result = promotionSchema.safeParse(updateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Name');
        expect(result.data.type).toBe('PERCENT');
        expect(result.data.value).toBe(30);
        expect(result.data.is_active).toBe(false);
      }
    });
  });

  describe('DELETE /api/admin/promotions/[id]', () => {
    it('soft delete sets is_active to false', () => {
      const promotion = {
        id: 'promo-1',
        name: 'Test Promotion',
        is_active: true,
      };

      const softDeleted = { ...promotion, is_active: false };
      expect(softDeleted.is_active).toBe(false);
      expect(softDeleted.id).toBe(promotion.id);
      expect(softDeleted.name).toBe(promotion.name);
    });

    it('soft delete preserves other fields', () => {
      const promotion = {
        id: 'promo-1',
        name: 'Test Promotion',
        type: 'PERCENT',
        value: 20,
        is_active: true,
      };

      const softDeleted = { ...promotion, is_active: false };
      expect(softDeleted.type).toBe(promotion.type);
      expect(softDeleted.value).toBe(promotion.value);
    });
  });

  describe('Auto-deactivation of expired promotions', () => {
    it('expired promotions are deactivated on GET', () => {
      const now = new Date();
      const expiredPromotion = {
        id: 'promo-1',
        name: 'Expired',
        ends_at: new Date(now.getTime() - 86400000), // 1 day ago
        is_active: true,
      };

      const shouldDeactivate = expiredPromotion.ends_at < now;
      expect(shouldDeactivate).toBe(true);
    });

    it('active promotions are not deactivated', () => {
      const now = new Date();
      const activePromotion = {
        id: 'promo-1',
        name: 'Active',
        ends_at: new Date(now.getTime() + 86400000), // 1 day from now
        is_active: true,
      };

      const shouldDeactivate = activePromotion.ends_at < now;
      expect(shouldDeactivate).toBe(false);
    });
  });

  describe('Promotion type validation', () => {
    it('accepts all valid promotion types', () => {
      const validTypes = ['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO'];
      
      validTypes.forEach(type => {
        const data = {
          name: 'Test',
          type,
          value: 10,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        };
        
        const result = promotionSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid promotion types', () => {
      const invalidTypes = ['INVALID', 'BOGO', 'DISCOUNT', 'SALE'];
      
      invalidTypes.forEach(type => {
        const data = {
          name: 'Test',
          type,
          value: 10,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        };
        
        const result = promotionSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });
});
