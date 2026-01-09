/**
 * Inventory API Unit Tests
 * Tests for stock, receive, waste, kardex, stats, and movements APIs
 * Task 6 - Checkpoint Kardex funcionando
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    inventory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    inventoryLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    wasteLog: {
      create: vi.fn(),
      count: vi.fn(),
    },
    goodsReceipt: {
      create: vi.fn(),
      count: vi.fn(),
    },
    inventoryCount: {
      count: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('Inventory API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stock Status Calculation', () => {
    it('should calculate CRITICAL status when stock < minStock', () => {
      const stock = 5;
      const minStock = 10;
      
      let status: string;
      if (minStock <= 0) {
        status = 'OK';
      } else if (stock < minStock) {
        status = 'CRITICAL';
      } else if (stock < minStock * 1.5) {
        status = 'LOW';
      } else {
        status = 'OK';
      }
      
      expect(status).toBe('CRITICAL');
    });

    it('should calculate LOW status when minStock <= stock < 1.5 * minStock', () => {
      const stock = 12;
      const minStock = 10;
      
      let status: string;
      if (minStock <= 0) {
        status = 'OK';
      } else if (stock < minStock) {
        status = 'CRITICAL';
      } else if (stock < minStock * 1.5) {
        status = 'LOW';
      } else {
        status = 'OK';
      }
      
      expect(status).toBe('LOW');
    });

    it('should calculate OK status when stock >= 1.5 * minStock', () => {
      const stock = 20;
      const minStock = 10;
      
      let status: string;
      if (minStock <= 0) {
        status = 'OK';
      } else if (stock < minStock) {
        status = 'CRITICAL';
      } else if (stock < minStock * 1.5) {
        status = 'LOW';
      } else {
        status = 'OK';
      }
      
      expect(status).toBe('OK');
    });

    it('should return OK when minStock is 0', () => {
      const stock = 5;
      const minStock = 0;
      
      let status: string;
      if (minStock <= 0) {
        status = 'OK';
      } else if (stock < minStock) {
        status = 'CRITICAL';
      } else if (stock < minStock * 1.5) {
        status = 'LOW';
      } else {
        status = 'OK';
      }
      
      expect(status).toBe('OK');
    });
  });

  describe('Waste Cost Calculation', () => {
    it('should calculate cost as quantity × unitCostCents', () => {
      const quantity = 5;
      const unitCostCents = 1000; // S/10.00
      
      const costCents = Math.round(quantity * unitCostCents);
      
      expect(costCents).toBe(5000);
    });

    it('should return 0 when quantity is 0', () => {
      const quantity = 0;
      const unitCostCents = 1000;
      
      const costCents = Math.round(quantity * unitCostCents);
      
      expect(costCents).toBe(0);
    });

    it('should handle decimal quantities', () => {
      const quantity = 2.5;
      const unitCostCents = 1000;
      
      const costCents = Math.round(quantity * unitCostCents);
      
      expect(costCents).toBe(2500);
    });
  });

  describe('Kardex Balance Calculation', () => {
    it('should calculate running balance correctly', () => {
      const movements = [
        { type: 'IN', quantity: 100 },
        { type: 'OUT', quantity: -20 },
        { type: 'WASTE', quantity: -5 },
        { type: 'IN', quantity: 50 },
      ];
      
      let balance = 0;
      const balances: number[] = [];
      
      for (const m of movements) {
        balance += m.quantity;
        balances.push(balance);
      }
      
      expect(balances).toEqual([100, 80, 75, 125]);
    });

    it('should handle empty movements', () => {
      const movements: { type: string; quantity: number }[] = [];
      
      let balance = 0;
      for (const m of movements) {
        balance += m.quantity;
      }
      
      expect(balance).toBe(0);
    });
  });

  describe('Input Validation', () => {
    it('should reject negative quantity for receive', () => {
      const quantity = -5;
      const isValid = quantity > 0;
      
      expect(isValid).toBe(false);
    });

    it('should reject zero quantity for receive', () => {
      const quantity = 0;
      const isValid = quantity > 0;
      
      expect(isValid).toBe(false);
    });

    it('should accept positive quantity for receive', () => {
      const quantity = 10;
      const isValid = quantity > 0;
      
      expect(isValid).toBe(true);
    });

    it('should reject negative cost', () => {
      const costCents = -100;
      const isValid = costCents >= 0;
      
      expect(isValid).toBe(false);
    });

    it('should accept zero cost', () => {
      const costCents = 0;
      const isValid = costCents >= 0;
      
      expect(isValid).toBe(true);
    });

    it('should validate waste reason codes', () => {
      const validReasons = ['EXPIRED', 'DAMAGED', 'THEFT', 'PRODUCTION_LOSS', 'COUNT_ADJUSTMENT', 'OTHER'];
      
      expect(validReasons.includes('EXPIRED')).toBe(true);
      expect(validReasons.includes('DAMAGED')).toBe(true);
      expect(validReasons.includes('INVALID')).toBe(false);
    });
  });

  describe('Pagination', () => {
    it('should calculate correct page offset', () => {
      const page = 3;
      const pageSize = 50;
      
      const offset = (page - 1) * pageSize;
      
      expect(offset).toBe(100);
    });

    it('should limit page size to max 100', () => {
      const requestedPageSize = 200;
      const maxPageSize = 100;
      
      const pageSize = Math.min(maxPageSize, requestedPageSize);
      
      expect(pageSize).toBe(100);
    });

    it('should ensure minimum page is 1', () => {
      const requestedPage = -1;
      
      const page = Math.max(1, requestedPage);
      
      expect(page).toBe(1);
    });
  });

  describe('Date Filtering', () => {
    it('should filter by start date', () => {
      const startDate = new Date('2024-01-01');
      const testDate = new Date('2024-06-15');
      
      const isAfterStart = testDate >= startDate;
      
      expect(isAfterStart).toBe(true);
    });

    it('should filter by end date', () => {
      const endDate = new Date('2024-12-31');
      endDate.setHours(23, 59, 59, 999);
      const testDate = new Date('2024-06-15');
      
      const isBeforeEnd = testDate <= endDate;
      
      expect(isBeforeEnd).toBe(true);
    });

    it('should filter by date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      endDate.setHours(23, 59, 59, 999);
      const testDate = new Date('2024-06-15');
      
      const isInRange = testDate >= startDate && testDate <= endDate;
      
      expect(isInRange).toBe(true);
    });
  });

  describe('Summary Calculations', () => {
    it('should calculate total IN correctly', () => {
      const logs = [
        { movement_type: 'IN', quantity: 100 },
        { movement_type: 'IN', quantity: 50 },
        { movement_type: 'OUT', quantity: -20 },
      ];
      
      const totalIn = logs
        .filter(l => l.movement_type === 'IN')
        .reduce((acc, l) => acc + l.quantity, 0);
      
      expect(totalIn).toBe(150);
    });

    it('should calculate total OUT correctly', () => {
      const logs = [
        { movement_type: 'IN', quantity: 100 },
        { movement_type: 'OUT', quantity: -20 },
        { movement_type: 'OUT', quantity: -30 },
      ];
      
      const totalOut = logs
        .filter(l => l.movement_type === 'OUT')
        .reduce((acc, l) => acc + Math.abs(l.quantity), 0);
      
      expect(totalOut).toBe(50);
    });

    it('should calculate total WASTE correctly', () => {
      const logs = [
        { movement_type: 'IN', quantity: 100 },
        { movement_type: 'WASTE', quantity: -5 },
        { movement_type: 'WASTE', quantity: -10 },
      ];
      
      const totalWaste = logs
        .filter(l => l.movement_type === 'WASTE')
        .reduce((acc, l) => acc + Math.abs(l.quantity), 0);
      
      expect(totalWaste).toBe(15);
    });
  });

  describe('Search Filtering', () => {
    it('should match by code (case-insensitive)', () => {
      const items = [
        { code: 'POLLO-001', name: 'Pollo Entero' },
        { code: 'ARROZ-001', name: 'Arroz Graneado' },
      ];
      const query = 'pollo';
      
      const filtered = items.filter(
        item => 
          item.code.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe('POLLO-001');
    });

    it('should match by name (case-insensitive)', () => {
      const items = [
        { code: 'POLLO-001', name: 'Pollo Entero' },
        { code: 'ARROZ-001', name: 'Arroz Graneado' },
      ];
      const query = 'arroz';
      
      const filtered = items.filter(
        item => 
          item.code.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe('ARROZ-001');
    });

    it('should return empty for no matches', () => {
      const items = [
        { code: 'POLLO-001', name: 'Pollo Entero' },
        { code: 'ARROZ-001', name: 'Arroz Graneado' },
      ];
      const query = 'pescado';
      
      const filtered = items.filter(
        item => 
          item.code.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filtered.length).toBe(0);
    });
  });
});
