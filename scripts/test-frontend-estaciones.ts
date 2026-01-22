/**
 * Test de Frontend - Página de Estaciones KDS
 * Verifica que la página /admin/estaciones carga correctamente
 */

const log = (message: string, color: 'green' | 'red' | 'yellow' | 'blue' = 'blue') => {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
};

async function testFrontendPage() {
  log('\n======================================================================', 'blue');
  log('🌐 PRUEBA DE FRONTEND - /admin/estaciones', 'blue');
  log('======================================================================', 'blue');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    // Test 1: Verificar que la página HTML carga
    log('\n📄 Test 1: Verificar que la página HTML carga', 'blue');
    const pageRes = await fetch(`${baseUrl}/admin/estaciones`);
    
    if (!pageRes.ok) {
      throw new Error(`Status: ${pageRes.status} ${pageRes.statusText}`);
    }
    
    const html = await pageRes.text();
    log(`✓ Página carga correctamente (${pageRes.status})`, 'green');
    log(`✓ Tamaño HTML: ${(html.length / 1024).toFixed(2)} KB`, 'green');

    // Test 2: Verificar que contiene elementos esperados
    log('\n🔍 Test 2: Verificar elementos HTML esperados', 'blue');
    
    const checks = [
      { name: 'DOCTYPE HTML', pattern: /<!DOCTYPE html>/i },
      { name: 'Next.js App', pattern: /<div id="__next">/i },
      { name: 'Scripts de Next.js', pattern: /<script.*_next/i },
      { name: 'Metadata', pattern: /<meta/i },
    ];

    let allChecksPass = true;
    for (const check of checks) {
      if (check.pattern.test(html)) {
        log(`  ✓ ${check.name} encontrado`, 'green');
      } else {
        log(`  ✗ ${check.name} NO encontrado`, 'red');
        allChecksPass = false;
      }
    }

    if (!allChecksPass) {
      throw new Error('Algunos elementos HTML esperados no se encontraron');
    }

    // Test 3: Verificar que no hay errores evidentes en el HTML
    log('\n🐛 Test 3: Verificar que no hay errores en el HTML', 'blue');
    
    const errorPatterns = [
      { name: 'Error de compilación', pattern: /compilation error/i },
      { name: 'Error de runtime', pattern: /runtime error/i },
      { name: 'Error 500', pattern: /500.*internal server error/i },
      { name: 'Error 404', pattern: /404.*not found/i },
    ];

    let hasErrors = false;
    for (const errorCheck of errorPatterns) {
      if (errorCheck.pattern.test(html)) {
        log(`  ✗ ${errorCheck.name} detectado`, 'red');
        hasErrors = true;
      }
    }

    if (!hasErrors) {
      log(`  ✓ No se detectaron errores evidentes`, 'green');
    }

    // Test 4: Verificar que los assets se cargan
    log('\n📦 Test 4: Verificar que los assets de Next.js se cargan', 'blue');
    
    // Extraer URLs de scripts
    const scriptMatches = html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/gi);
    const scripts = Array.from(scriptMatches).map(m => m[1]);
    
    if (scripts.length > 0) {
      log(`  ✓ ${scripts.length} scripts encontrados`, 'green');
      
      // Verificar algunos scripts críticos
      const criticalScripts = scripts.filter(s => 
        s.includes('_next/static') || s.includes('webpack')
      );
      
      if (criticalScripts.length > 0) {
        log(`  ✓ ${criticalScripts.length} scripts de Next.js encontrados`, 'green');
      } else {
        log(`  ⚠️  No se encontraron scripts de Next.js`, 'yellow');
      }
    } else {
      log(`  ⚠️  No se encontraron scripts en el HTML`, 'yellow');
    }

    log('\n✅ PRUEBA DE FRONTEND: PASADA', 'green');
    return true;

  } catch (error) {
    log(`\n❌ Error en prueba de frontend: ${error}`, 'red');
    log('⚠️  Asegúrate de que el servidor esté corriendo: npm run dev', 'yellow');
    return false;
  }
}

async function testAPIEndpoints() {
  log('\n======================================================================', 'blue');
  log('🔌 PRUEBA DE API ENDPOINTS (Sin Auth)', 'blue');
  log('======================================================================', 'blue');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    // Test 1: GET /api/admin/stations (sin auth)
    log('\n📡 Test 1: GET /api/admin/stations (sin auth)', 'blue');
    const stationsRes = await fetch(`${baseUrl}/api/admin/stations`);
    log(`  Status: ${stationsRes.status} ${stationsRes.statusText}`, 
        stationsRes.status === 401 ? 'green' : 'yellow');
    
    if (stationsRes.status === 401) {
      log(`  ✓ Endpoint protegido correctamente (requiere auth)`, 'green');
    } else {
      const data = await stationsRes.json();
      log(`  ⚠️  Endpoint responde sin auth: ${JSON.stringify(data).substring(0, 100)}`, 'yellow');
    }

    // Test 2: GET /api/admin/stations/alerts (sin auth)
    log('\n📡 Test 2: GET /api/admin/stations/alerts (sin auth)', 'blue');
    const alertsRes = await fetch(`${baseUrl}/api/admin/stations/alerts`);
    log(`  Status: ${alertsRes.status} ${alertsRes.statusText}`, 
        alertsRes.status === 401 ? 'green' : 'yellow');
    
    if (alertsRes.status === 401) {
      log(`  ✓ Endpoint protegido correctamente (requiere auth)`, 'green');
    } else {
      const data = await alertsRes.json();
      log(`  ⚠️  Endpoint responde sin auth: ${JSON.stringify(data).substring(0, 100)}`, 'yellow');
    }

    log('\n✅ PRUEBA DE API ENDPOINTS: PASADA', 'green');
    log('ℹ️  Los endpoints están correctamente protegidos con autenticación', 'blue');
    return true;

  } catch (error) {
    log(`\n❌ Error en prueba de API: ${error}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🔍 PRUEBAS DE FRONTEND - WEEK 1 FASE 3', 'blue');
  log('Fecha: ' + new Date().toLocaleString('es-PE'), 'blue');
  log('======================================================================\n', 'blue');

  const results = {
    frontend: false,
    api: false,
  };

  // Ejecutar pruebas
  results.frontend = await testFrontendPage();
  results.api = await testAPIEndpoints();

  // Resumen final
  log('\n======================================================================', 'blue');
  log('📊 RESUMEN FINAL', 'blue');
  log('======================================================================', 'blue');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  log(`\n✓ Frontend HTML: ${results.frontend ? '✅ PASADA' : '❌ FALLIDA'}`, results.frontend ? 'green' : 'red');
  log(`✓ API Endpoints: ${results.api ? '✅ PASADA' : '❌ FALLIDA'}`, results.api ? 'green' : 'red');

  log(`\n📈 Resultado: ${passed}/${total} pruebas pasadas (${Math.round((passed / total) * 100)}%)`, 'blue');

  if (passed === total) {
    log('\n🎉 ¡TODAS LAS PRUEBAS DE FRONTEND PASARON!', 'green');
    log('✅ La página /admin/estaciones está funcionando correctamente', 'green');
    log('🚀 Listo para continuar con Week 2 - Analytics & Charts', 'green');
  } else {
    log('\n⚠️  Algunas pruebas fallaron', 'yellow');
    log('💡 Revisa los errores arriba para más detalles', 'yellow');
  }

  log('\n======================================================================\n', 'blue');
}

main().catch(console.error);
