/**
 * Test Terminal Activation Flow
 * Verifica que el flujo de activación de terminales funciona correctamente
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: 'PASS', message: 'OK' });
    console.log(`✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', message, details: error });
    console.log(`❌ ${name}: ${message}`);
  }
}

async function main() {
  console.log('🧪 Iniciando pruebas de activación de terminal...\n');

  // Test 1: Verificar que el servidor está corriendo
  await test('Servidor disponible', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.status !== 200) {
      throw new Error(`Health check falló: ${response.status}`);
    }
  });

  // Test 2: Obtener código de activación del admin
  let activationCode = '';
  await test('Generar código de activación', async () => {
    // Primero, autenticarse
    const authResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
    });

    if (authResponse.status !== 200) {
      throw new Error(`Auth falló: ${authResponse.status}`);
    }

    const authData = await authResponse.json() as any;
    const token = authResponse.headers.get('set-cookie');
    
    if (!token) {
      throw new Error('No se recibió cookie de autenticación');
    }

    // Obtener terminales
    const terminalsResponse = await fetch(`${BASE_URL}/api/admin/terminals-v2`, {
      headers: {
        'Cookie': token,
      },
    });

    if (terminalsResponse.status !== 200) {
      throw new Error(`Obtener terminales falló: ${terminalsResponse.status}`);
    }

    const terminalsData = await terminalsResponse.json() as any;
    const caja01 = terminalsData.find((t: any) => t.terminal_id === 'CAJA_01');

    if (!caja01) {
      throw new Error('Terminal CAJA_01 no encontrada');
    }

    // Regenerar código
    const codeResponse = await fetch(
      `${BASE_URL}/api/admin/terminals-v2/CAJA_01/regenerate-code`,
      {
        method: 'POST',
        headers: {
          'Cookie': token,
          'Content-Type': 'application/json',
        },
      }
    );

    if (codeResponse.status !== 200) {
      throw new Error(`Regenerar código falló: ${codeResponse.status}`);
    }

    const codeData = await codeResponse.json() as any;
    // El endpoint retorna { code: { code, formatted, expires_at } }
    activationCode = codeData.code?.formatted || codeData.code?.code;

    if (!activationCode) {
      console.log('   Respuesta del servidor:', JSON.stringify(codeData, null, 2));
      throw new Error('No se recibió código de activación');
    }

    console.log(`   Código generado: ${activationCode}`);
  });

  // Test 3: Activar terminal con el código
  await test('Activar terminal con código', async () => {
    if (!activationCode) {
      throw new Error('No hay código de activación disponible');
    }

    const response = await fetch(`${BASE_URL}/api/terminals/activate-simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal_id: 'CAJA_01',
        code: activationCode,
        fingerprint: 'test-fingerprint',
      }),
    });

    if (response.status !== 200) {
      const errorData = await response.json() as any;
      throw new Error(
        `Activación falló: ${response.status} - ${errorData.error || errorData.details}`
      );
    }

    const data = await response.json() as any;
    if (!data.success) {
      throw new Error(`Respuesta no exitosa: ${data.error}`);
    }

    console.log(`   Terminal activada: ${data.terminal.terminal_id}`);
  });

  // Test 4: Verificar que el evento se registró
  await test('Evento de activación registrado', async () => {
    // Autenticarse nuevamente
    const authResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
    });

    const token = authResponse.headers.get('set-cookie');
    if (!token) {
      throw new Error('No se pudo autenticar');
    }

    // Obtener detalles de la terminal
    const response = await fetch(`${BASE_URL}/api/admin/terminals-v2/CAJA_01`, {
      headers: { 'Cookie': token },
    });

    if (response.status !== 200) {
      throw new Error(`Obtener detalles falló: ${response.status}`);
    }

    const data = await response.json() as any;
    if (data.status !== 'active') {
      throw new Error(`Terminal no está activa: ${data.status}`);
    }

    console.log(`   Terminal status: ${data.status}`);
  });

  // Resumen
  console.log('\n📊 Resumen de pruebas:');
  console.log('═'.repeat(50));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.message}`);
  });

  console.log('═'.repeat(50));
  console.log(`Total: ${passed} pasadas, ${failed} fallidas`);

  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
