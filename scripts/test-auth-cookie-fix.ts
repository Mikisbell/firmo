/**
 * Test Script: Cookie Authentication Fix
 * 
 * Verifica que el fix de autenticación funciona correctamente:
 * 1. Base de datos - Sesiones y tokens
 * 2. Backend - getSessionFromRequest() lee cookies
 * 3. API - Endpoints admin funcionan con cookies
 * 4. Frontend - Campanita de notificaciones funciona
 */

import prisma from '../src/core/db/prisma';
import { authenticate, getSessionFromRequest } from '../src/core/auth/auth.service';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_PIN = '1234';
const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// ============ TEST 1: BASE DE DATOS ============

async function testDatabase() {
  console.log('\n📊 TEST 1: BASE DE DATOS\n');
  
  try {
    // 1.1 Verificar que existe el empleado admin
    const admin = await prisma.employees.findFirst({
      where: {
        tenant_id: TENANT_ID,
        role: 'OWNER',
      },
    });
    
    if (admin) {
      logTest(
        'DB: Empleado OWNER existe',
        true,
        `Encontrado: ${admin.name} (${admin.id})`
      );
    } else {
      logTest(
        'DB: Empleado OWNER existe',
        false,
        'No se encontró empleado OWNER'
      );
      return;
    }
    
    // 1.2 Verificar tabla sessions
    const sessionCount = await prisma.sessions.count({
      where: { tenant_id: TENANT_ID },
    });
    
    logTest(
      'DB: Tabla sessions accesible',
      true,
      `${sessionCount} sesiones encontradas`
    );
    
    // 1.3 Verificar tabla login_attempts
    const attemptsCount = await prisma.login_attempts.count({
      where: { tenant_id: TENANT_ID },
    });
    
    logTest(
      'DB: Tabla login_attempts accesible',
      true,
      `${attemptsCount} intentos de login registrados`
    );
    
  } catch (error) {
    logTest(
      'DB: Conexión',
      false,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============ TEST 2: BACKEND - AUTENTICACIÓN ============

async function testBackendAuth() {
  console.log('\n🔐 TEST 2: BACKEND - AUTENTICACIÓN\n');
  
  try {
    // 2.1 Autenticar con PIN
    const authResult = await authenticate(
      prisma,
      TENANT_ID,
      ADMIN_PIN,
      ['OWNER', 'ADMIN'],
      {
        ip: '127.0.0.1',
        userAgent: 'test-script',
        terminalId: 'test-terminal',
      }
    );
    
    if (!authResult.success) {
      logTest(
        'Backend: Autenticación con PIN',
        false,
        `Error: ${authResult.error}`,
        { errorCode: authResult.errorCode }
      );
      return null;
    }
    
    logTest(
      'Backend: Autenticación con PIN',
      true,
      `Token generado para ${authResult.employee?.name}`,
      {
        employeeId: authResult.employee?.id,
        role: authResult.employee?.role,
        expiresAt: authResult.expiresAt,
      }
    );
    
    return authResult.token;
    
  } catch (error) {
    logTest(
      'Backend: Autenticación',
      false,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

// ============ TEST 3: BACKEND - getSessionFromRequest() ============

async function testGetSessionFromRequest(token: string) {
  console.log('\n🔍 TEST 3: BACKEND - getSessionFromRequest()\n');
  
  try {
    // 3.1 Test con Authorization header
    const requestWithHeader = {
      headers: {
        get: (name: string) => {
          if (name === 'authorization') return `Bearer ${token}`;
          return null;
        },
      },
    };
    
    const sessionFromHeader = await getSessionFromRequest(requestWithHeader, prisma);
    
    if (sessionFromHeader) {
      logTest(
        'getSessionFromRequest: Authorization header',
        true,
        `Sesión válida para ${sessionFromHeader.name}`,
        {
          employeeId: sessionFromHeader.employeeId,
          role: sessionFromHeader.role,
          tenantId: sessionFromHeader.tenantId,
        }
      );
    } else {
      logTest(
        'getSessionFromRequest: Authorization header',
        false,
        'No se pudo obtener sesión desde header'
      );
    }
    
    // 3.2 Test con Cookie (EL FIX CRÍTICO)
    const requestWithCookie = {
      headers: {
        get: () => null, // No Authorization header
      },
      cookies: {
        get: (name: string) => {
          if (name === 'auth_token') return { value: token };
          return undefined;
        },
      },
    };
    
    const sessionFromCookie = await getSessionFromRequest(requestWithCookie, prisma);
    
    if (sessionFromCookie) {
      logTest(
        'getSessionFromRequest: Cookie auth_token ⭐',
        true,
        `Sesión válida para ${sessionFromCookie.name}`,
        {
          employeeId: sessionFromCookie.employeeId,
          role: sessionFromCookie.role,
          tenantId: sessionFromCookie.tenantId,
        }
      );
    } else {
      logTest(
        'getSessionFromRequest: Cookie auth_token ⭐',
        false,
        '❌ CRÍTICO: No se pudo obtener sesión desde cookie'
      );
    }
    
    // 3.3 Test sin token
    const requestWithoutAuth = {
      headers: { get: () => null },
      cookies: { get: () => undefined },
    };
    
    const sessionWithoutAuth = await getSessionFromRequest(requestWithoutAuth, prisma);
    
    logTest(
      'getSessionFromRequest: Sin autenticación',
      sessionWithoutAuth === null,
      sessionWithoutAuth === null ? 'Correctamente retorna null' : 'ERROR: Debería retornar null'
    );
    
  } catch (error) {
    logTest(
      'getSessionFromRequest',
      false,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============ TEST 4: API - ENDPOINTS ============

async function testAPIEndpoints(token: string) {
  console.log('\n🌐 TEST 4: API - ENDPOINTS\n');
  
  try {
    // 4.1 Test GET /api/auth/session con cookie
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        'Cookie': `auth_token=${token}`,
      },
    });
    
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      logTest(
        'API: GET /api/auth/session (con cookie)',
        true,
        `Sesión válida: ${sessionData.employee?.name}`,
        sessionData
      );
    } else {
      logTest(
        'API: GET /api/auth/session (con cookie)',
        false,
        `Status ${sessionResponse.status}: ${sessionResponse.statusText}`
      );
    }
    
    // 4.2 Test GET /api/admin/notifications/status con cookie
    const notificationsResponse = await fetch(`${BASE_URL}/api/admin/notifications/status`, {
      headers: {
        'Cookie': `auth_token=${token}`,
      },
    });
    
    if (notificationsResponse.ok) {
      const notificationsData = await notificationsResponse.json();
      logTest(
        'API: GET /api/admin/notifications/status ⭐',
        true,
        `${notificationsData.employees?.length || 0} empleados encontrados`,
        { employeeCount: notificationsData.employees?.length }
      );
    } else {
      const errorData = await notificationsResponse.json().catch(() => ({}));
      logTest(
        'API: GET /api/admin/notifications/status ⭐',
        false,
        `Status ${notificationsResponse.status}: ${errorData.error || notificationsResponse.statusText}`
      );
    }
    
    // 4.3 Test otros endpoints admin
    const endpoints = [
      '/api/admin/employees',
      '/api/admin/products',
      '/api/admin/stations',
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Cookie': `auth_token=${token}`,
        },
      });
      
      logTest(
        `API: GET ${endpoint}`,
        response.ok,
        response.ok ? `Status ${response.status}` : `Status ${response.status}: ${response.statusText}`
      );
    }
    
  } catch (error) {
    logTest(
      'API: Endpoints',
      false,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============ TEST 5: FRONTEND - SIMULACIÓN ============

async function testFrontendSimulation(token: string) {
  console.log('\n🎨 TEST 5: FRONTEND - SIMULACIÓN\n');
  
  try {
    // Simular fetch desde navegador con credentials: 'include'
    // Esto es lo que hace el frontend
    
    const response = await fetch(`${BASE_URL}/api/admin/notifications/status`, {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${token}`,
      },
      // En navegador real: credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      logTest(
        'Frontend: Fetch con credentials include',
        true,
        'Campanita puede cargar notificaciones',
        {
          employeeCount: data.employees?.length,
          statusCode: response.status,
        }
      );
    } else {
      logTest(
        'Frontend: Fetch con credentials include',
        false,
        `Error ${response.status}: Campanita NO puede cargar notificaciones`
      );
    }
    
  } catch (error) {
    logTest(
      'Frontend: Simulación',
      false,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============ RESUMEN ============

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total: ${total} pruebas`);
  console.log(`✅ Pasadas: ${passed}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📈 Tasa de éxito: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('❌ PRUEBAS FALLIDAS:\n');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  • ${r.name}`);
        console.log(`    ${r.message}\n`);
      });
  }
  
  // Tests críticos
  const criticalTests = [
    'getSessionFromRequest: Cookie auth_token ⭐',
    'API: GET /api/admin/notifications/status ⭐',
  ];
  
  const criticalPassed = results
    .filter(r => criticalTests.includes(r.name))
    .every(r => r.passed);
  
  console.log('\n' + '='.repeat(60));
  if (criticalPassed) {
    console.log('🎉 ÉXITO: Todos los tests críticos pasaron');
    console.log('✅ El fix de autenticación funciona correctamente');
    console.log('✅ La campanita de notificaciones debería funcionar');
  } else {
    console.log('🚨 FALLO: Tests críticos fallaron');
    console.log('❌ El fix de autenticación NO funciona correctamente');
    console.log('❌ La campanita de notificaciones NO funcionará');
  }
  console.log('='.repeat(60) + '\n');
}

// ============ MAIN ============

async function main() {
  console.log('🧪 INICIANDO PRUEBAS DE AUTENTICACIÓN CON COOKIES\n');
  console.log('Objetivo: Verificar que el fix de getSessionFromRequest() funciona\n');
  
  try {
    // Test 1: Base de datos
    await testDatabase();
    
    // Test 2: Backend - Autenticación
    const token = await testBackendAuth();
    
    if (!token) {
      console.log('\n❌ No se pudo obtener token. Abortando pruebas.\n');
      printSummary();
      process.exit(1);
    }
    
    // Test 3: Backend - getSessionFromRequest()
    await testGetSessionFromRequest(token);
    
    // Test 4: API - Endpoints
    await testAPIEndpoints(token);
    
    // Test 5: Frontend - Simulación
    await testFrontendSimulation(token);
    
    // Resumen
    printSummary();
    
    // Exit code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
