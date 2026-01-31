/**
 * CSV Service Unit Tests
 * Tests for CSV import/export functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CSVService } from '../csv.service';

describe('CSVService', () => {
  let csvService: CSVService;

  beforeEach(() => {
    csvService = new CSVService();
  });

  describe('parseCSV', () => {
    it('should parse valid CSV with all required fields', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sku: 'POLLO-1/4',
        name: '1/4 de Pollo',
        price: '1500',
        category: 'POLLOS',
        station: 'PARRILLA',
        type: 'SIMPLE',
      });
    });

    it('should detect missing required headers', () => {
      const csv = `sku,name,price
POLLO-1/4,1/4 de Pollo,1500`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Missing required headers');
      expect(rows).toHaveLength(0);
    });

    it('should detect duplicate SKUs', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,SIMPLE
POLLO-1/4,Duplicate,1500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Duplicate SKU');
      expect(rows).toHaveLength(1); // Only first row is valid
    });

    it('should validate required fields', () => {
      const csv = `sku,name,price,category,station,type
,Missing SKU,1500,POLLOS,PARRILLA,SIMPLE
POLLO-1/4,,1500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(2);
      expect(errors[0].error).toContain('SKU is required');
      expect(errors[1].error).toContain('Name is required');
      expect(rows).toHaveLength(0);
    });

    it('should validate price is a positive number', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,invalid,POLLOS,PARRILLA,SIMPLE
POLLO-1/2,1/2 de Pollo,-100,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(2);
      expect(errors[0].error).toContain('Price must be a positive number');
      expect(errors[1].error).toContain('Price must be a positive number');
      expect(rows).toHaveLength(0);
    });

    it('should validate category is valid', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,INVALID,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Invalid category');
      expect(rows).toHaveLength(0);
    });

    it('should validate station is valid', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,INVALID,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Invalid station');
      expect(rows).toHaveLength(0);
    });

    it('should validate type is valid', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,INVALID`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Invalid type');
      expect(rows).toHaveLength(0);
    });

    it('should handle multiple errors in a single row', () => {
      const csv = `sku,name,price,category,station,type
,,-100,INVALID,INVALID,INVALID`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('SKU is required');
      expect(errors[0].error).toContain('Name is required');
      expect(errors[0].error).toContain('Price must be a positive number');
      expect(errors[0].error).toContain('Invalid category');
      expect(errors[0].error).toContain('Invalid station');
      expect(errors[0].error).toContain('Invalid type');
      expect(rows).toHaveLength(0);
    });

    it('should skip invalid rows and continue processing valid ones', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,SIMPLE
,Invalid Row,-100,INVALID,INVALID,INVALID
POLLO-1/2,1/2 de Pollo,2500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(1);
      expect(rows).toHaveLength(2);
      expect(rows[0].sku).toBe('POLLO-1/4');
      expect(rows[1].sku).toBe('POLLO-1/2');
    });

    it('should handle optional short_name field', () => {
      const csv = `sku,name,short_name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1/4 Pollo,1500,POLLOS,PARRILLA,SIMPLE
POLLO-1/2,1/2 de Pollo,,2500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);
      expect(rows[0].short_name).toBe('1/4 Pollo');
      expect(rows[1].short_name).toBe('');
    });

    it('should handle is_active field', () => {
      const csv = `sku,name,price,category,station,type,is_active
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,SIMPLE,true
POLLO-1/2,1/2 de Pollo,2500,POLLOS,PARRILLA,SIMPLE,false`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);
      expect(rows[0].is_active).toBe('true');
      expect(rows[1].is_active).toBe('false');
    });

    it('should skip empty lines', () => {
      const csv = `sku,name,price,category,station,type
POLLO-1/4,1/4 de Pollo,1500,POLLOS,PARRILLA,SIMPLE

POLLO-1/2,1/2 de Pollo,2500,POLLOS,PARRILLA,SIMPLE`;

      const { rows, errors } = csvService.parseCSV(csv);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);
    });
  });

  describe('generateTemplate', () => {
    it('should generate CSV template with headers and example rows', () => {
      const template = csvService.generateTemplate();

      expect(template).toContain('sku,name,short_name,price,category,station,type,is_active');
      expect(template).toContain('POLLO-1/4');
      expect(template).toContain('COMBO-FAM');
      expect(template).toContain('INCA-KOLA-1.5L');
      expect(template).toContain('POLLOS');
      expect(template).toContain('COMBOS');
      expect(template).toContain('BEBIDAS');
      expect(template).toContain('PARRILLA');
      expect(template).toContain('BAR');
    });

    it('should have valid example data', () => {
      const template = csvService.generateTemplate();
      const { rows, errors } = csvService.parseCSV(template);

      expect(errors).toHaveLength(0);
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
