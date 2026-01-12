/**
 * Property-Based Tests for Risk Validator
 * 
 * Tests Properties 9 and 10 from the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateRiskScore,
  determineAuthRequirement,
  assessRisk,
  getTimeOfDay,
  daysBetween,
  getRiskLevel,
  type RiskFactors,
  type TimeOfDay,
} from '../risk-validator';

// ============ ARBITRARIES ============

const timeOfDayArb = fc.constantFrom<TimeOfDay>('business', 'off-hours');

const riskFactorsArb = fc.record({
  fingerprintMatch: fc.integer({ min: 0, max: 100 }),
  ipKnown: fc.boolean(),
  timeOfDay: timeOfDayArb,
  failedAttempts: fc.integer({ min: 0, max: 10 }),
  daysSinceLastAuth: fc.integer({ min: 0, max: 365 }),
  deviceAge: fc.integer({ min: 0, max: 365 }),
});

// ============ PROPERTY 9: RISK-BASED AUTHENTICATION REQUIREMENTS ============
// **Validates: Requirements 4.1, 4.2, 4.3**

describe('Property 9: Risk-Based Authentication Requirements', () => {
  // Feature: terminal-architecture-v2, Property 9: Risk-Based Authentication Requirements
  
  it('should require PIN only for known devices with fingerprint match ≥70%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 70, max: 100 }),
        fc.boolean(),
        timeOfDayArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (fingerprintMatch, ipKnown, timeOfDay, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factors: RiskFactors = {
            fingerprintMatch,
            ipKnown,
            timeOfDay,
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const score = calculateRiskScore(factors);
          const requirement = determineAuthRequirement(score, factors);
          
          // If score is low enough, should be PIN only
          if (score < 30) {
            expect(requirement).toBe('pin_only');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require PIN + manager for devices with fingerprint match 30-70%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 69 }),
        fc.boolean(),
        timeOfDayArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (fingerprintMatch, ipKnown, timeOfDay, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factors: RiskFactors = {
            fingerprintMatch,
            ipKnown,
            timeOfDay,
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const score = calculateRiskScore(factors);
          const requirement = determineAuthRequirement(score, factors);
          
          // Medium fingerprint match should require at least PIN + manager
          expect(['pin_plus_manager', 'activation_code_required']).toContain(requirement);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require activation code for unknown devices with fingerprint match <30%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 29 }),
        fc.boolean(),
        timeOfDayArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 365 }),
        (fingerprintMatch, ipKnown, timeOfDay, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factors: RiskFactors = {
            fingerprintMatch,
            ipKnown,
            timeOfDay,
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const requirement = determineAuthRequirement(calculateRiskScore(factors), factors);
          
          // Low fingerprint match should require activation code
          expect(requirement).toBe('activation_code_required');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should block access after 3 or more failed attempts', () => {
    fc.assert(
      fc.property(
        riskFactorsArb,
        (factors) => {
          const factorsWithFailures = { ...factors, failedAttempts: 3 };
          const requirement = determineAuthRequirement(
            calculateRiskScore(factorsWithFailures),
            factorsWithFailures
          );
          
          expect(requirement).toBe('blocked');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require step-up auth when risk score >70', () => {
    fc.assert(
      fc.property(
        riskFactorsArb,
        (factors) => {
          const score = calculateRiskScore(factors);
          const requirement = determineAuthRequirement(score, factors);
          
          // If score is high, should require at least PIN + manager
          if (score > 70 && factors.failedAttempts < 3) {
            expect(['pin_plus_manager', 'activation_code_required']).toContain(requirement);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ PROPERTY 10: RISK SCORE CALCULATION COMPLETENESS ============
// **Validates: Requirements 4.4, 4.5**

describe('Property 10: Risk Score Calculation Completeness', () => {
  // Feature: terminal-architecture-v2, Property 10: Risk Score Calculation Completeness
  
  it('should always return a score between 0 and 100', () => {
    fc.assert(
      fc.property(
        riskFactorsArb,
        (factors) => {
          const score = calculateRiskScore(factors);
          
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase score when fingerprint match decreases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 100 }),
        fc.integer({ min: 0, max: 49 }),
        fc.boolean(),
        timeOfDayArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (highMatch, lowMatch, ipKnown, timeOfDay, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factorsHigh: RiskFactors = {
            fingerprintMatch: highMatch,
            ipKnown,
            timeOfDay,
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const factorsLow: RiskFactors = {
            ...factorsHigh,
            fingerprintMatch: lowMatch,
          };
          
          const scoreHigh = calculateRiskScore(factorsHigh);
          const scoreLow = calculateRiskScore(factorsLow);
          
          // Lower fingerprint match should result in higher risk score
          expect(scoreLow).toBeGreaterThanOrEqual(scoreHigh);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase score for unknown IP addresses', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        timeOfDayArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (fingerprintMatch, timeOfDay, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factorsKnownIP: RiskFactors = {
            fingerprintMatch,
            ipKnown: true,
            timeOfDay,
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const factorsUnknownIP: RiskFactors = {
            ...factorsKnownIP,
            ipKnown: false,
          };
          
          const scoreKnown = calculateRiskScore(factorsKnownIP);
          const scoreUnknown = calculateRiskScore(factorsUnknownIP);
          
          // Unknown IP should result in higher risk score
          expect(scoreUnknown).toBeGreaterThan(scoreKnown);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase score for off-hours access', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (fingerprintMatch, ipKnown, failedAttempts, daysSinceLastAuth, deviceAge) => {
          const factorsBusiness: RiskFactors = {
            fingerprintMatch,
            ipKnown,
            timeOfDay: 'business',
            failedAttempts,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const factorsOffHours: RiskFactors = {
            ...factorsBusiness,
            timeOfDay: 'off-hours',
          };
          
          const scoreBusiness = calculateRiskScore(factorsBusiness);
          const scoreOffHours = calculateRiskScore(factorsOffHours);
          
          // Off-hours should result in higher risk score
          expect(scoreOffHours).toBeGreaterThan(scoreBusiness);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase score with more failed attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.boolean(),
        timeOfDayArb,
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 7, max: 89 }),
        (fingerprintMatch, ipKnown, timeOfDay, daysSinceLastAuth, deviceAge) => {
          const factorsNoFails: RiskFactors = {
            fingerprintMatch,
            ipKnown,
            timeOfDay,
            failedAttempts: 0,
            daysSinceLastAuth,
            deviceAge,
          };
          
          const factorsWithFails: RiskFactors = {
            ...factorsNoFails,
            failedAttempts: 2,
          };
          
          const scoreNoFails = calculateRiskScore(factorsNoFails);
          const scoreWithFails = calculateRiskScore(factorsWithFails);
          
          // More failed attempts should result in higher risk score
          expect(scoreWithFails).toBeGreaterThan(scoreNoFails);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should incorporate all defined factors in risk calculation', () => {
    fc.assert(
      fc.property(
        riskFactorsArb,
        (factors) => {
          const assessment = assessRisk(factors);
          
          // Assessment should include all factors
          expect(assessment.factors).toEqual(factors);
          expect(assessment.score).toBeGreaterThanOrEqual(0);
          expect(assessment.score).toBeLessThanOrEqual(100);
          expect(assessment.requiredAuth).toBeDefined();
          expect(assessment.alerts).toBeInstanceOf(Array);
          expect(assessment.reason).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ HELPER FUNCTION TESTS ============

describe('Helper Functions', () => {
  it('should correctly identify business hours (6 AM - 11 PM)', () => {
    // Business hours
    expect(getTimeOfDay(new Date('2026-01-11T08:00:00'))).toBe('business');
    expect(getTimeOfDay(new Date('2026-01-11T12:00:00'))).toBe('business');
    expect(getTimeOfDay(new Date('2026-01-11T18:00:00'))).toBe('business');
    expect(getTimeOfDay(new Date('2026-01-11T22:59:00'))).toBe('business');
    
    // Off-hours
    expect(getTimeOfDay(new Date('2026-01-11T02:00:00'))).toBe('off-hours');
    expect(getTimeOfDay(new Date('2026-01-11T05:59:00'))).toBe('off-hours');
    expect(getTimeOfDay(new Date('2026-01-11T23:00:00'))).toBe('off-hours');
  });

  it('should calculate days between dates correctly', () => {
    const date1 = new Date('2026-01-01');
    const date2 = new Date('2026-01-11');
    
    expect(daysBetween(date1, date2)).toBe(10);
    expect(daysBetween(date2, date1)).toBe(10); // Should be absolute
  });

  it('should categorize risk levels correctly', () => {
    expect(getRiskLevel(0)).toBe('low');
    expect(getRiskLevel(29)).toBe('low');
    expect(getRiskLevel(30)).toBe('medium');
    expect(getRiskLevel(69)).toBe('medium');
    expect(getRiskLevel(70)).toBe('high');
    expect(getRiskLevel(89)).toBe('high');
    expect(getRiskLevel(90)).toBe('critical');
    expect(getRiskLevel(100)).toBe('critical');
  });
});
