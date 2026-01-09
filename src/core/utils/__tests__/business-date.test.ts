/**
 * Property-Based Tests for Business Date Calculation
 * 
 * Property 2: Business Date Calculation
 * - Events before 6 AM belong to the previous business day
 * - Events at or after 6 AM belong to the current calendar day
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getBusinessDate, toZonedTime } from '../business-date';

const TIMEZONE = 'America/Lima';
const CUTOFF_HOUR = 6;

describe('Business Date Calculation - Property Tests', () => {
  
  // Property 2.1: Events before 6 AM belong to previous day
  it('should assign events before 6 AM to the previous business day', () => {
    fc.assert(
      fc.property(
        // Generate dates with hours 0-5 (before cutoff)
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        fc.integer({ min: 0, max: CUTOFF_HOUR - 1 }), // 0-5 AM
        fc.integer({ min: 0, max: 59 }), // minutes
        (baseDate: Date, hour: number, minute: number) => {
          // Skip invalid dates
          if (isNaN(baseDate.getTime())) return true;
          
          // Create a date at the specified hour in Lima timezone
          const testDate = new Date(baseDate);
          testDate.setHours(hour, minute, 0, 0);
          
          // Skip if resulting date is invalid
          if (isNaN(testDate.getTime())) return true;
          
          // Convert to Lima time to understand what we're testing
          const limaTime = toZonedTime(testDate, TIMEZONE);
          
          // Skip if Lima time is invalid
          if (isNaN(limaTime.getTime())) return true;
          
          const limaHour = limaTime.getHours();
          
          // Only test if the Lima hour is actually before cutoff
          if (limaHour >= CUTOFF_HOUR) return true; // Skip this case
          
          const businessDate = getBusinessDate(testDate, TIMEZONE);
          const [year, month, day] = businessDate.split('-').map(Number);
          
          // The business date should be the previous calendar day
          const expectedDate = new Date(limaTime);
          expectedDate.setDate(expectedDate.getDate() - 1);
          
          const expectedYear = expectedDate.getFullYear();
          const expectedMonth = expectedDate.getMonth() + 1;
          const expectedDay = expectedDate.getDate();
          
          return year === expectedYear && month === expectedMonth && day === expectedDay;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 2.2: Events at or after 6 AM belong to current day
  it('should assign events at or after 6 AM to the current business day', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        fc.integer({ min: CUTOFF_HOUR, max: 23 }), // 6-23 (6 AM to 11 PM)
        fc.integer({ min: 0, max: 59 }),
        (baseDate: Date, hour: number, minute: number) => {
          // Skip invalid dates
          if (isNaN(baseDate.getTime())) return true;
          
          const testDate = new Date(baseDate);
          testDate.setHours(hour, minute, 0, 0);
          
          // Skip if resulting date is invalid
          if (isNaN(testDate.getTime())) return true;
          
          const limaTime = toZonedTime(testDate, TIMEZONE);
          const limaHour = limaTime.getHours();
          
          // Only test if the Lima hour is actually at or after cutoff
          if (limaHour < CUTOFF_HOUR) return true; // Skip this case
          
          const businessDate = getBusinessDate(testDate, TIMEZONE);
          const [year, month, day] = businessDate.split('-').map(Number);
          
          // The business date should be the same calendar day
          const expectedYear = limaTime.getFullYear();
          const expectedMonth = limaTime.getMonth() + 1;
          const expectedDay = limaTime.getDate();
          
          return year === expectedYear && month === expectedMonth && day === expectedDay;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 2.3: Business date format is always YYYY-MM-DD
  it('should always return a valid YYYY-MM-DD format', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (date: Date) => {
          // Skip invalid dates
          if (isNaN(date.getTime())) return true;
          
          const businessDate = getBusinessDate(date, TIMEZONE);
          const regex = /^\d{4}-\d{2}-\d{2}$/;
          return regex.test(businessDate);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 2.4: Business date is deterministic
  it('should return the same business date for the same input', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (date: Date) => {
          // Skip invalid dates
          if (isNaN(date.getTime())) return true;
          
          const result1 = getBusinessDate(date, TIMEZONE);
          const result2 = getBusinessDate(date, TIMEZONE);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 2.5: Boundary test - exactly at 6 AM belongs to current day
  it('should assign events exactly at 6:00 AM to the current day', () => {
    // Test specific boundary cases
    const testCases = [
      new Date('2025-01-15T11:00:00Z'), // 6 AM Lima (UTC-5)
      new Date('2025-06-15T11:00:00Z'), // 6 AM Lima (UTC-5)
      new Date('2025-12-25T11:00:00Z'), // 6 AM Lima (UTC-5)
    ];

    for (const testDate of testCases) {
      const limaTime = toZonedTime(testDate, TIMEZONE);
      const businessDate = getBusinessDate(testDate, TIMEZONE);
      const [, , day] = businessDate.split('-').map(Number);
      
      // At exactly 6 AM, should be current day
      expect(day).toBe(limaTime.getDate());
    }
  });

  // Property 2.6: 5:59 AM belongs to previous day, 6:00 AM belongs to current day
  it('should correctly handle the cutoff boundary', () => {
    // 5:59 AM Lima = 10:59 UTC (UTC-5)
    const beforeCutoff = new Date('2025-01-15T10:59:00Z');
    // 6:00 AM Lima = 11:00 UTC (UTC-5)
    const atCutoff = new Date('2025-01-15T11:00:00Z');

    const businessDateBefore = getBusinessDate(beforeCutoff, TIMEZONE);
    const businessDateAt = getBusinessDate(atCutoff, TIMEZONE);

    // 5:59 AM should be previous day (Jan 14)
    expect(businessDateBefore).toBe('2025-01-14');
    // 6:00 AM should be current day (Jan 15)
    expect(businessDateAt).toBe('2025-01-15');
  });
});
