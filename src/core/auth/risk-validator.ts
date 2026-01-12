/**
 * Risk-Based Auth Validator
 * 
 * Calculates risk scores and determines authentication requirements based on
 * device state, fingerprint match, time of day, and other contextual factors.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { logger } from '@/src/core/observability/logger';

// ============ TYPES ============

export type TimeOfDay = 'business' | 'off-hours';

export type AuthRequirement = 
  | 'pin_only'
  | 'pin_plus_manager'
  | 'activation_code_required'
  | 'blocked';

export interface RiskFactors {
  fingerprintMatch: number;      // 0-100 similarity score
  ipKnown: boolean;              // Is IP address recognized?
  timeOfDay: TimeOfDay;          // Business hours vs off-hours
  failedAttempts: number;        // Recent failed login attempts
  daysSinceLastAuth: number;     // Days since last successful auth
  deviceAge: number;             // Days since device was bound
}

export interface RiskAssessment {
  score: number;                 // 0-100 (0=low risk, 100=high risk)
  factors: RiskFactors;
  requiredAuth: AuthRequirement;
  alerts: string[];
  reason: string;
}

// ============ CONSTANTS ============

// Risk score thresholds
const RISK_LOW_THRESHOLD = 30;        // Below this: PIN only
const RISK_MEDIUM_THRESHOLD = 70;     // Below this: PIN + manager
// Above MEDIUM: Activation code required or blocked

// Fingerprint match thresholds (Requirements 4.1, 4.2, 4.3)
const FINGERPRINT_EXCELLENT = 70;     // ≥70%: Known device
const FINGERPRINT_ACCEPTABLE = 30;    // 30-70%: Suspicious
// <30%: Unknown device

// Business hours (6 AM - 11 PM)
const BUSINESS_HOURS_START = 6;
const BUSINESS_HOURS_END = 23;

// Failed attempts threshold
const MAX_FAILED_ATTEMPTS = 3;

// Device age thresholds
const NEW_DEVICE_DAYS = 7;            // Device bound < 7 days ago
const STALE_DEVICE_DAYS = 90;         // Device not used in 90+ days

// ============ RISK CALCULATION ============

/**
 * Calculate risk score based on multiple factors
 * Requirements: 4.4, 4.5
 * 
 * Score calculation:
 * - Fingerprint match: 0-40 points (lower match = higher risk)
 * - IP known: 0-15 points (unknown IP = higher risk)
 * - Time of day: 0-10 points (off-hours = higher risk)
 * - Failed attempts: 0-20 points (more attempts = higher risk)
 * - Days since last auth: 0-10 points (longer = higher risk)
 * - Device age: 0-5 points (very new or very old = higher risk)
 * 
 * Total: 0-100 points
 */
export function calculateRiskScore(factors: RiskFactors): number {
  let score = 0;

  // 1. Fingerprint match (0-40 points)
  // Lower match = higher risk
  const fingerprintRisk = Math.round((100 - factors.fingerprintMatch) * 0.4);
  score += fingerprintRisk;

  // 2. IP known (0-15 points)
  if (!factors.ipKnown) {
    score += 15;
  }

  // 3. Time of day (0-10 points)
  if (factors.timeOfDay === 'off-hours') {
    score += 10;
  }

  // 4. Failed attempts (0-20 points)
  const failedAttemptsRisk = Math.min(factors.failedAttempts * 5, 20);
  score += failedAttemptsRisk;

  // 5. Days since last auth (0-10 points)
  // Risk increases after 7 days
  if (factors.daysSinceLastAuth > 7) {
    const daysRisk = Math.min(Math.floor((factors.daysSinceLastAuth - 7) / 3), 10);
    score += daysRisk;
  }

  // 6. Device age (0-5 points)
  // Very new devices (< 7 days) or stale devices (> 90 days) are riskier
  if (factors.deviceAge < NEW_DEVICE_DAYS) {
    score += 5;
  } else if (factors.deviceAge > STALE_DEVICE_DAYS) {
    score += 3;
  }

  // Ensure score is within bounds
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Determine authentication requirement based on risk score and factors
 * Requirements: 4.1, 4.2, 4.3
 * 
 * Rules:
 * - Fingerprint match ≥70%: PIN only (low risk)
 * - Fingerprint match 30-70%: PIN + manager confirmation (medium risk)
 * - Fingerprint match <30%: Activation code required (high risk)
 * - Failed attempts ≥3: Blocked
 * - Risk score >70: Step-up auth required
 */
export function determineAuthRequirement(
  score: number,
  factors: RiskFactors
): AuthRequirement {
  // Block if too many failed attempts
  if (factors.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return 'blocked';
  }

  // Fingerprint-based decision (Requirements 4.1, 4.2, 4.3)
  if (factors.fingerprintMatch >= FINGERPRINT_EXCELLENT) {
    // Known device with good match
    if (score < RISK_LOW_THRESHOLD) {
      return 'pin_only';
    } else if (score < RISK_MEDIUM_THRESHOLD) {
      return 'pin_plus_manager';
    } else {
      // High risk even with good fingerprint
      return 'activation_code_required';
    }
  } else if (factors.fingerprintMatch >= FINGERPRINT_ACCEPTABLE) {
    // Suspicious device (fingerprint drift)
    if (score < RISK_MEDIUM_THRESHOLD) {
      return 'pin_plus_manager';
    } else {
      return 'activation_code_required';
    }
  } else {
    // Unknown device or poor fingerprint match
    return 'activation_code_required';
  }
}

/**
 * Perform complete risk assessment
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function assessRisk(factors: RiskFactors): RiskAssessment {
  const score = calculateRiskScore(factors);
  const requiredAuth = determineAuthRequirement(score, factors);
  const alerts: string[] = [];
  let reason = '';

  // Generate alerts and reason
  if (factors.fingerprintMatch < FINGERPRINT_ACCEPTABLE) {
    alerts.push('Fingerprint mismatch detected');
    reason = 'Unknown or changed device';
  } else if (factors.fingerprintMatch < FINGERPRINT_EXCELLENT) {
    alerts.push('Fingerprint drift detected');
    reason = 'Device fingerprint has changed';
  }

  if (!factors.ipKnown) {
    alerts.push('Unknown IP address');
  }

  if (factors.timeOfDay === 'off-hours') {
    alerts.push('Login attempt during off-hours');
  }

  if (factors.failedAttempts > 0) {
    alerts.push(`${factors.failedAttempts} recent failed attempts`);
  }

  if (factors.daysSinceLastAuth > 30) {
    alerts.push(`Device not used in ${factors.daysSinceLastAuth} days`);
  }

  if (factors.deviceAge < NEW_DEVICE_DAYS) {
    alerts.push('Newly bound device');
  }

  if (factors.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    reason = 'Too many failed attempts';
  } else if (score >= RISK_MEDIUM_THRESHOLD) {
    reason = reason || 'High risk score';
  } else if (score >= RISK_LOW_THRESHOLD) {
    reason = reason || 'Medium risk score';
  } else {
    reason = reason || 'Low risk';
  }

  logger.info('RISK_ASSESSMENT', 'Risk assessment completed', {
    score,
    requiredAuth,
    fingerprintMatch: factors.fingerprintMatch,
    alertCount: alerts.length,
  });

  return {
    score,
    factors,
    requiredAuth,
    alerts,
    reason,
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Determine time of day category
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END) {
    return 'business';
  }
  return 'off-hours';
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get risk level description
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < RISK_LOW_THRESHOLD) return 'low';
  if (score < RISK_MEDIUM_THRESHOLD) return 'medium';
  if (score < 90) return 'high';
  return 'critical';
}

/**
 * Get auth requirement description
 */
export function getAuthRequirementDescription(requirement: AuthRequirement): string {
  switch (requirement) {
    case 'pin_only':
      return 'PIN de empleado';
    case 'pin_plus_manager':
      return 'PIN de empleado + confirmación de manager';
    case 'activation_code_required':
      return 'Código de activación + PIN + aprobación de manager';
    case 'blocked':
      return 'Acceso bloqueado - contactar administrador';
  }
}
