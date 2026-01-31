/**
 * Test Completo: Backend + Frontend + Base de Datos
 * Prueba el flujo completo de:
 * 1. Rate Limiting
 * 2. CORS
 * 3. Autenticación
 * 4. CRUD de Employees
 * 5. Base de Datos
 */

const FULL_FLOW_API_URL = 'http://localhost:3000';
const FULL_FLOW_ALLOWED_ORIGIN = 'http://localhost:3001';

interface Employee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

async function testFullFlow() {
  console.log('🧪 TEST COMPLETO: Backend + Frontend + Base de Datos');
  console.log('='.repeat(60));
  console.log('');

  let allTestsPassed = true;

  // TEST 1: CORS - Verificar que el origen permitido funciona
  console.log('📋 TEST 1: CORS Configuration');
  try {
    const corsResponse = await fetch(`${FULL_FLOW_API_URL}/api/admin/employees`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FULL_FLOW_ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });

    const allowOrigin = corsResponse.headers.get('Access-Control-Allow-Origin');
    
    if (corsResponse.status === 204 && allowOrigin === FULL_FLOW_ALLOWED_ORIGIN) {
      console.log('   ✅ CORS funciona correctamente');
      console.log(`   - Status: ${corsResponse.status}`);
      console.log(`   - Allow-Origin: ${allowOrigin}`);
    } else {
      console.log('   ❌ CORS no funciona correctamente');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test CORS:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 2: Base de Datos - Listar employees existentes
  console.log('📋 TEST 2: Base de Datos - GET /api/admin/employees');
  try {
    const response = await fetch(`${FULL_FLOW_API_URL}/api/admin/employees`, {
      method: 'GET',
      headers: {
        'Origin': FULL_FLOW_ALLOWED_ORIGIN,
      },
    });

    if (response.ok) {
      const employees: Employee[] = await response.json();
      console.log('   ✅ Conexión a BD exitosa');
      console.log(`   - Employees encontrados: ${employees.length}`);
      console.log(`   - Primeros 3:`);
      employees.slice(0, 3).forEach(emp => {
        console.log(`     * ${emp.name} (${emp.role})`);
      });
    } else {
      console.log(`   ❌ Error al obtener employees: ${response.status}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test BD:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 3: Rate Limiting - Verificar límite de 10 requests
  console.log('📋 TEST 3: Rate Limiting (10 requests/min)');
  try {
    let blockedCount = 0;
    let allowedCount = 0;

    // Hacer 12 requests rápidos
    for (let i = 1; i <= 12; i++) {
      const response = await fetch(`${FULL_FLOW_API_URL}/api/admin/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': FULL_FLOW_ALLOWED_ORIGIN,
        },
        body: JSON.stringify({
          name: `Test Employee ${i}`,
          role: 'WAITER',
          pin: '9999',
        }),
      });

      if (response.status === 429) {
        blockedCount++;
      } else {
        allowedCount++;
      }

      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (allowedCount <= 10 && blockedCount >= 2) {
      console.log('   ✅ Rate limiting funciona correctamente');
      console.log(`   - Requests permitidos: ${allowedCount}`);
      console.log(`   - Requests bloqueados: ${blockedCount}`);
    } else {
      console.log('   ❌ Rate limiting no funciona correctamente');
      console.log(`   - Esperado: máximo 10 permitidos, mínimo 2 bloqueados`);
      console.log(`   - Actual: ${allowedCount} permitidos, ${blockedCount} bloqueados`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test Rate Limiting:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 4: Validación de Datos - Intentar crear employee sin campos requeridos
  console.log('📋 TEST 4: Validación de Datos');
  try {
    // Esperar 60 segundos para que se resetee el rate limit
    console.log('   ⏳ Esperando 60s para reset de rate limit...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    const response = await fetch(`${FULL_FLOW_API_URL}/api/admin/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FULL_FLOW_ALLOWED_ORIGIN,
      },
      body: JSON.stringify({
        // Falta name, role, pin
      }),
    });

    if (response.status === 400 || response.status === 401) {
      const data = await response.json();
      console.log('   ✅ Validación funciona correctamente');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Error: ${data.error}`);
    } else {
      console.log(`   ❌ Validación no funciona: status ${response.status}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test Validación:', error);
    allTestsPassed = false;
  }
  console.log('');

  // TEST 5: Headers de Seguridad
  console.log('📋 TEST 5: Headers de Seguridad');
  try {
    const response = await fetch(`${FULL_FLOW_API_URL}/api/admin/employees`, {
      method: 'GET',
      headers: {
        'Origin': FULL_FLOW_ALLOWED_ORIGIN,
      },
    });

    const allowCredentials = response.headers.get('Access-Control-Allow-Credentials');
    const allowMethods = response.headers.get('Access-Control-Allow-Methods');

    if (allowCredentials === 'true' && allowMethods) {
      console.log('   ✅ Headers de seguridad presentes');
      console.log(`   - Allow-Credentials: ${allowCredentials}`);
      console.log(`   - Allow-Methods: ${allowMethods}`);
    } else {
      console.log('   ❌ Faltan headers de seguridad');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error en test Headers:', error);
    allTestsPassed = false;
  }
  console.log('');

  // RESUMEN FINAL
  console.log('='.repeat(60));
  if (allTestsPassed) {
    console.log('✅ TODOS LOS TESTS PASARON');
    console.log('');
    console.log('Sistema verificado:');
    console.log('  ✅ CORS configurado correctamente');
    console.log('  ✅ Rate Limiting funcionando (10 req/min)');
    console.log('  ✅ Base de Datos conectada');
    console.log('  ✅ Validación de datos activa');
    console.log('  ✅ Headers de seguridad presentes');
    return true;
  } else {
    console.log('❌ ALGUNOS TESTS FALLARON');
    console.log('Revisar logs arriba para detalles');
    return false;
  }
}

// Ejecutar test
testFullFlow()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error fatal en test:', error);
    process.exit(1);
  });
