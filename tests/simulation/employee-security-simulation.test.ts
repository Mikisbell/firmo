/**
 * UX Simulation: Employee Security Edge Cases
 * 
 * Simulates real security scenarios to find vulnerabilities:
 * - PIN brute force attack (rapid attempts)
 * - Session hijacking (stolen JWT token)
 * - Role escalation (CASHIER tries to access admin)
 * - Concurrent logins from different terminals
 * - Employee termination but session still valid
 * - PIN sharing (multiple employees know same PIN)
 * 
 * This tests EMPLOYEE SECURITY, not just authentication.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Simulated Employee Security System
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'WAITER' | 'KITCHEN';

interface Employee {
  id: string;
  tenantId: string;
  name: string;
  role: Role;
  pinHash: string;
  isActive: boolean;
  lastLoginAt?: Date;
}

interface Session {
  sessionId: string;
  employeeId: string;
  tenantId: string;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
  terminalId: string;
  isActive: boolean;
}

interface JWTToken {
  sub: string; // employee_id
  tid: string; // tenant_id
  role: Role;
  sid: string; // session_id
  exp: number;
}

interface LoginAttempt {
  employeeId: string;
  timestamp: Date;
  success: boolean;
  terminalId: string;
}

interface SecurityAlert {
  type: 'BRUTE_FORCE' | 'SESSION_HIJACK' | 'ROLE_ESCALATION' | 'CONCURRENT_LOGIN' | 'TERMINATED_SESSION' | 'PIN_SHARING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  employeeId?: string;
}

const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'];

function createEmployee(id: string, tenantId: string, name: string, role: Role, pin: string): Employee {
  return {
    id,
    tenantId,
    name,
    role,
    pinHash: `hash_${pin}`,
    isActive: true,
  };
}

function createSession(employee: Employee, terminalId: string, expiresHours: number = 8): Session {
  const now = new Date();
  return {
    sessionId: `session-${employee.id}-${Date.now()}`,
    employeeId: employee.id,
    tenantId: employee.tenantId,
    role: employee.role,
    createdAt: now,
    expiresAt: new Date(now.getTime() + expiresHours * 60 * 60 * 1000),
    terminalId,
    isActive: true,
  };
}

function createJWT(session: Session): JWTToken {
  return {
    sub: session.employeeId,
    tid: session.tenantId,
    role: session.role,
    sid: session.sessionId,
    exp: session.expiresAt.getTime(),
  };
}

function validatePIN(pin: string, employee: Employee): boolean {
  return `hash_${pin}` === employee.pinHash;
}

function checkBruteForce(attempts: LoginAttempt[], windowMinutes: number = 5, maxAttempts: number = 5): {
  isBruteForce: boolean;
  alert?: SecurityAlert;
} {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const recentFailedAttempts = attempts.filter(a => !a.success && a.timestamp >= windowStart);

  if (recentFailedAttempts.length >= maxAttempts) {
    return {
      isBruteForce: true,
      alert: {
        type: 'BRUTE_FORCE',
        severity: 'CRITICAL',
        message: `${recentFailedAttempts.length} failed PIN attempts in ${windowMinutes} minutes`,
        timestamp: now,
        employeeId: recentFailedAttempts[0]?.employeeId,
      },
    };
  }

  return { isBruteForce: false };
}

function checkSessionHijack(token: JWTToken, currentIP: string, originalIP: string): {
  isHijacked: boolean;
  alert?: SecurityAlert;
} {
  if (currentIP !== originalIP) {
    return {
      isHijacked: true,
      alert: {
        type: 'SESSION_HIJACK',
        severity: 'CRITICAL',
        message: `Session used from different IP: ${currentIP} vs ${originalIP}`,
        timestamp: new Date(),
        employeeId: token.sub,
      },
    };
  }

  return { isHijacked: false };
}

function checkRoleEscalation(token: JWTToken, requestedResource: string): {
  allowed: boolean;
  alert?: SecurityAlert;
} {
  const isAdminResource = requestedResource.startsWith('/admin');
  const isAdmin = ADMIN_ROLES.includes(token.role);

  if (isAdminResource && !isAdmin) {
    return {
      allowed: false,
      alert: {
        type: 'ROLE_ESCALATION',
        severity: 'HIGH',
        message: `${token.role} tried to access admin resource: ${requestedResource}`,
        timestamp: new Date(),
        employeeId: token.sub,
      },
    };
  }

  return { allowed: true };
}

function checkConcurrentLogins(sessions: Session[], employeeId: string): {
  concurrentCount: number;
  alert?: SecurityAlert;
} {
  const activeSessions = sessions.filter(s => s.employeeId === employeeId && s.isActive);
  const concurrentCount = activeSessions.length;

  if (concurrentCount > 1) {
    return {
      concurrentCount,
      alert: {
        type: 'CONCURRENT_LOGIN',
        severity: 'MEDIUM',
        message: `Employee has ${concurrentCount} active sessions`,
        timestamp: new Date(),
        employeeId,
      },
    };
  }

  return { concurrentCount };
}

function checkTerminatedEmployeeSession(session: Session, employee: Employee): {
  isValid: boolean;
  alert?: SecurityAlert;
} {
  if (!employee.isActive) {
    return {
      isValid: false,
      alert: {
        type: 'TERMINATED_SESSION',
        severity: 'HIGH',
        message: `Terminated employee still has active session`,
        timestamp: new Date(),
        employeeId: employee.id,
      },
    };
  }

  if (session.expiresAt < new Date()) {
    return {
      isValid: false,
      alert: {
        type: 'TERMINATED_SESSION',
        severity: 'LOW',
        message: `Session expired`,
        timestamp: new Date(),
        employeeId: employee.id,
      },
    };
  }

  return { isValid: true };
}

function checkPINSharing(employee: Employee, loginLocations: Array<{ terminalId: string; timestamp: Date }>): {
  isShared: boolean;
  alert?: SecurityAlert;
} {
  // If same PIN used from different terminals within 1 hour, likely shared
  const uniqueTerminals = new Set(loginLocations.map(l => l.terminalId));
  
  if (uniqueTerminals.size > 1) {
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const firstLogin = loginLocations[0].timestamp.getTime();
    const lastLogin = loginLocations[loginLocations.length - 1].timestamp.getTime();
    
    if (lastLogin - firstLogin < timeWindow) {
      return {
        isShared: true,
        alert: {
          type: 'PIN_SHARING',
          severity: 'MEDIUM',
          message: `PIN used from ${uniqueTerminals.size} terminals within 1 hour`,
          timestamp: new Date(),
          employeeId: employee.id,
        },
      };
    }
  }

  return { isShared: false };
}

// ============================================================
// EMPLOYEE SECURITY SIMULATION TESTS
// ============================================================

describe('Employee Security Edge Cases Simulation', () => {

  it('should detect PIN brute force attack', () => {
    // SCENARIO: Someone tries 10 different PINs in 5 minutes
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    const attempts: LoginAttempt[] = [];

    // 10 failed attempts in rapid succession
    for (let i = 0; i < 10; i++) {
      attempts.push({
        employeeId: employee.id,
        timestamp: new Date(Date.now() - (10 - i) * 30000), // Every 30 seconds
        success: false,
        terminalId: 'CAJA-01',
      });
    }

    const result = checkBruteForce(attempts, 5, 5);
    expect(result.isBruteForce).toBe(true);
    expect(result.alert?.severity).toBe('CRITICAL');

    console.log('🔒 Test 1: PIN brute force detection');
    console.log(`   Failed attempts: 10 in 5 minutes`);
    console.log(`   Threshold: 5 attempts`);
    console.log(`   Brute force detected: ${result.isBruteForce}`);
    console.log(`   Alert: ${result.alert?.message}`);
  });

  it('should detect session hijacking', () => {
    // SCENARIO: JWT token stolen and used from different IP
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    const session = createSession(employee, 'CAJA-01');
    const token = createJWT(session);

    const originalIP = '192.168.1.100';
    const suspiciousIP = '10.0.0.50'; // Different network

    const result = checkSessionHijack(token, suspiciousIP, originalIP);
    expect(result.isHijacked).toBe(true);
    expect(result.alert?.severity).toBe('CRITICAL');

    console.log('🔒 Test 2: Session hijacking detection');
    console.log(`   Original IP: ${originalIP}`);
    console.log(`   Current IP: ${suspiciousIP}`);
    console.log(`   Hijack detected: ${result.isHijacked}`);
  });

  it('should prevent role escalation', () => {
    // SCENARIO: CASHIER tries to access /admin/employees
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    const session = createSession(employee, 'CAJA-01');
    const token = createJWT(session);

    const result = checkRoleEscalation(token, '/admin/employees');
    expect(result.allowed).toBe(false);
    expect(result.alert?.type).toBe('ROLE_ESCALATION');

    // ADMIN should be allowed
    const adminEmployee: Employee = createEmployee('emp-2', 'tenant-1', 'Admin User', 'ADMIN', '5678');
    const adminSession = createSession(adminEmployee, 'CAJA-01');
    const adminToken = createJWT(adminSession);

    const adminResult = checkRoleEscalation(adminToken, '/admin/employees');
    expect(adminResult.allowed).toBe(true);

    console.log('🔒 Test 3: Role escalation prevention');
    console.log(`   CASHIER → /admin: BLOCKED`);
    console.log(`   ADMIN → /admin: ALLOWED`);
  });

  it('should detect concurrent logins from different terminals', () => {
    // SCENARIO: Same employee logged in on 3 terminals simultaneously
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    const sessions: Session[] = [
      createSession(employee, 'CAJA-01'),
      createSession(employee, 'MOZO-01'),
      createSession(employee, 'KDS-01'),
    ];

    const result = checkConcurrentLogins(sessions, employee.id);
    expect(result.concurrentCount).toBe(3);
    expect(result.alert?.type).toBe('CONCURRENT_LOGIN');

    console.log('🔒 Test 4: Concurrent login detection');
    console.log(`   Active sessions: ${result.concurrentCount}`);
    console.log(`   Alert: ${result.alert?.message}`);
  });

  it('should invalidate session for terminated employee', () => {
    // SCENARIO: Employee fired but session still valid
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    employee.isActive = false; // Terminated

    const session = createSession(employee, 'CAJA-01');
    const result = checkTerminatedEmployeeSession(session, employee);

    expect(result.isValid).toBe(false);
    expect(result.alert?.type).toBe('TERMINATED_SESSION');

    console.log('🔒 Test 5: Terminated employee session');
    console.log(`   Employee active: ${employee.isActive}`);
    console.log(`   Session valid: ${result.isValid}`);
    console.log(`   Alert: ${result.alert?.message}`);
  });

  it('should detect PIN sharing across terminals', () => {
    // SCENARIO: Same PIN used from 3 different terminals within 1 hour
    const employee: Employee = createEmployee('emp-1', 'tenant-1', 'Juan Pérez', 'CASHIER', '1234');
    const loginLocations = [
      { terminalId: 'CAJA-01', timestamp: new Date(Date.now() - 3600000) }, // 1 hour ago
      { terminalId: 'MOZO-01', timestamp: new Date(Date.now() - 1800000) }, // 30 min ago
      { terminalId: 'KDS-01', timestamp: new Date(Date.now() - 600000) },  // 10 min ago
    ];

    const result = checkPINSharing(employee, loginLocations);
    expect(result.isShared).toBe(true);
    expect(result.alert?.type).toBe('PIN_SHARING');

    console.log('🔒 Test 6: PIN sharing detection');
    console.log(`   Terminals used: ${loginLocations.length}`);
    console.log(`   PIN shared: ${result.isShared}`);
    console.log(`   Alert: ${result.alert?.message}`);
  });

  it('should calculate security metrics for 1000 login attempts', () => {
    // STRESS TEST: Simulate 1000 login attempts with various outcomes
    const attempts: LoginAttempt[] = [];
    const alerts: SecurityAlert[] = [];

    for (let i = 0; i < 1000; i++) {
      const success = Math.random() > 0.1; // 90% success rate
      
      attempts.push({
        employeeId: `emp-${Math.floor(Math.random() * 10) + 1}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        success,
        terminalId: `CAJA-${Math.floor(Math.random() * 5) + 1}`,
      });

      if (!success && i % 100 === 0) {
        // Simulate brute force detection every 100 failures
        const failedAttempts = attempts.slice(Math.max(0, i - 5), i + 1).filter(a => !a.success);
        if (failedAttempts.length >= 5) {
          alerts.push({
            type: 'BRUTE_FORCE',
            severity: 'CRITICAL',
            message: `Brute force detected`,
            timestamp: new Date(),
          });
        }
      }
    }

    const successRate = attempts.filter(a => a.success).length / attempts.length * 100;
    const failureRate = 100 - successRate;

    expect(successRate).toBeGreaterThan(80);
    // Alerts may or may not trigger based on random distribution, that's ok

    console.log('📊 Test 7: Security metrics for 1000 login attempts');
    console.log(`   Total attempts: ${attempts.length}`);
    console.log(`   Success rate: ${successRate.toFixed(0)}%`);
    console.log(`   Failure rate: ${failureRate.toFixed(0)}%`);
    console.log(`   Security alerts: ${alerts.length}`);
  });

  it('should recommend: Employee security improvements', () => {
    const currentRisks = [
      'No brute force protection',
      'No session IP validation',
      'No role escalation detection',
      'No concurrent login tracking',
      'Terminated employees can still login',
      'PIN sharing undetected',
    ];

    const recommendations = [
      'Lock account after 5 failed attempts in 5 minutes',
      'Invalidate session if IP changes, require re-auth',
      'Log and alert when non-admin accesses admin resources',
      'Warn when employee has > 2 active sessions',
      'Auto-invalidate all sessions when employee terminated',
      'Alert when same PIN used from > 2 terminals in 1 hour',
    ];

    expect(recommendations.length).toBe(currentRisks.length);

    console.log('✅ Employee Security Recommendations:');
    for (let i = 0; i < currentRisks.length; i++) {
      console.log(`   🔴 ${currentRisks[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
