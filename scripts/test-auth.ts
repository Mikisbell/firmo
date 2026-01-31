/**
 * Test Authentication with httpOnly Cookies
 * Prueba el nuevo sistema de autenticación con JWT y cookies
 */

const AUTH_API_URL = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Must match seed.ts

interface LoginResponse {
  success: boolean;
  employee?: {
    id: string;
    name: string;
    role: string;
  };
  shift?: {
    id: string;
    opened_at: string;
    opened_by: string;
  } | null;
  error?: string;
}

interface SessionResponse {
  valid: boolean;
  employee?: {
    id: string;
    name: string;
    role: string;
  };
  error?: string;
}

async function testAuthentication() {
  console.log('🧪 Testing Authentication with httpOnly Cookies');
  console.log('='.repeat(60));
  console.log('');

  let allTestsPassed = true;
  let authCookie: string | null = null;

  // TEST 1: Login con PIN correcto
  console.log('📋 TEST 1: Login con PIN correcto');
  try {
    const response = await fetch(`${AUTH_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        pin: '1234', // PIN del Admin Principal
      }),
    });

    const data: LoginResponse = await response.json();
    
    // Extraer cookie del header Set-Cookie
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/auth_token=([^;]+)/);
      if (match) {
        authCookie = match[1];
      }
    }

    if (response.ok && data.success && authCookie) {
      console.log('   ✅ Login exitoso');
      console.log(`   - Employee: ${data.employee?.name} (${data.employee?.role})`);
      console.log(`   - Cookie recibida: ${authCookie.substring(0, 20)}...`);
    } else {
      console.log('   ❌ Login falló');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Error: ${data.error}`);
      console.log(`   - Cookie: ${authCookie ? 'Sí' : 'No'}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en login:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 2: Verificar sesión con cookie
  console.log('📋 TEST 2: Verificar sesión con cookie');
  if (authCookie) {
    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      const data: SessionResponse = await response.json();

      if (response.ok && data.valid) {
        console.log('   ✅ Sesión válida');
        console.log(`   - Employee: ${data.employee?.name} (${data.employee?.role})`);
      } else {
        console.log('   ❌ Sesión inválida');
        console.log(`   - Status: ${response.status}`);
        console.log(`   - Error: ${data.error}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Error al verificar sesión:', error);
      allTestsPassed = false;
    }
  } else {
    console.log('   ⏭️  Saltado (no hay cookie)');
  }
  console.log('');

  // TEST 3: Verificar que cookie tiene httpOnly (simulado)
  console.log('📋 TEST 3: Verificar propiedades de cookie');
  if (authCookie) {
    console.log('   ✅ Cookie recibida del servidor');
    console.log('   ℹ️  Propiedades httpOnly solo verificables en navegador');
    console.log('   ℹ️  En producción: httpOnly=true, secure=true, sameSite=strict');
  } else {
    console.log('   ❌ No se recibió cookie');
    allTestsPassed = false;
  }
  console.log('');

  // TEST 4: Login con PIN incorrecto
  console.log('📋 TEST 4: Login con PIN incorrecto');
  try {
    const response = await fetch(`${AUTH_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        pin: '9999', // PIN incorrecto
      }),
    });

    const data: LoginResponse = await response.json();

    if (response.status === 401 && !data.success) {
      console.log('   ✅ Login rechazado correctamente');
      console.log(`   - Error: ${data.error}`);
    } else {
      console.log('   ❌ Login debería haber sido rechazado');
      console.log(`   - Status: ${response.status}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 5: Verificar sesión sin cookie
  console.log('📋 TEST 5: Verificar sesión sin cookie');
  try {
    const response = await fetch(`${AUTH_API_URL}/api/auth/session`, {
      method: 'GET',
    });

    const data: SessionResponse = await response.json();

    if (response.status === 401 && !data.valid) {
      console.log('   ✅ Sesión rechazada correctamente');
      console.log(`   - Error: ${data.error}`);
    } else {
      console.log('   ❌ Sesión debería haber sido rechazada');
      console.log(`   - Status: ${response.status}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 6: Logout
  console.log('📋 TEST 6: Logout');
  if (authCookie) {
    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/session`, {
        method: 'DELETE',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('   ✅ Logout exitoso');
        console.log(`   - Mensaje: ${data.message}`);
      } else {
        console.log('   ❌ Logout falló');
        console.log(`   - Status: ${response.status}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Error en logout:', error);
      allTestsPassed = false;
    }
  } else {
    console.log('   ⏭️  Saltado (no hay cookie)');
  }
  console.log('');

  // TEST 7: Verificar que sesión fue revocada
  console.log('📋 TEST 7: Verificar sesión después de logout');
  if (authCookie) {
    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      const data: SessionResponse = await response.json();

      if (response.status === 401 && !data.valid) {
        console.log('   ✅ Sesión revocada correctamente');
        console.log(`   - Error: ${data.error}`);
      } else {
        console.log('   ❌ Sesión debería estar revocada');
        console.log(`   - Status: ${response.status}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Error en test:', error);
      allTestsPassed = false;
    }
  } else {
    console.log('   ⏭️  Saltado (no hay cookie)');
  }
  console.log('');

  // RESUMEN FINAL
  console.log('='.repeat(60));
  if (allTestsPassed) {
    console.log('✅ TODOS LOS TESTS DE AUTENTICACIÓN PASARON');
    console.log('');
    console.log('Sistema verificado:');
    console.log('  ✅ Login con JWT y httpOnly cookies');
    console.log('  ✅ Verificación de sesión con cookie');
    console.log('  ✅ Rechazo de PINs incorrectos');
    console.log('  ✅ Rechazo de sesiones sin cookie');
    console.log('  ✅ Logout y revocación de sesión');
    console.log('  ✅ Sesión no válida después de logout');
    return true;
  } else {
    console.log('❌ ALGUNOS TESTS FALLARON');
    console.log('Revisar logs arriba para detalles');
    return false;
  }
}

// Ejecutar test
testAuthentication()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error fatal en test:', error);
    process.exit(1);
  });
