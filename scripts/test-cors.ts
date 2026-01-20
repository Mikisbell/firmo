/**
 * Test CORS Configuration
 * Prueba que CORS funciona correctamente con diferentes orígenes
 */

const CORS_API_URL = 'http://localhost:3000';
const CORS_ENDPOINT = '/api/auth/login';

interface TestResult {
  origin: string;
  method: string;
  status: number;
  allowed: boolean;
  headers: Record<string, string>;
  error?: string;
}

async function testCorsWithOrigin(origin: string, shouldAllow: boolean): Promise<TestResult> {
  try {
    // 1. Preflight request (OPTIONS)
    console.log(`\n🔍 Testing origin: ${origin}`);
    console.log(`   Expected: ${shouldAllow ? 'ALLOWED' : 'BLOCKED'}`);
    
    const preflightResponse = await fetch(`${CORS_API_URL}${CORS_ENDPOINT}`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const allowOrigin = preflightResponse.headers.get('Access-Control-Allow-Origin');
    const allowMethods = preflightResponse.headers.get('Access-Control-Allow-Methods');
    const allowHeaders = preflightResponse.headers.get('Access-Control-Allow-Headers');
    const allowCredentials = preflightResponse.headers.get('Access-Control-Allow-Credentials');
    const maxAge = preflightResponse.headers.get('Access-Control-Max-Age');

    console.log(`   Preflight Status: ${preflightResponse.status}`);
    console.log(`   Allow-Origin: ${allowOrigin}`);
    console.log(`   Allow-Methods: ${allowMethods}`);
    console.log(`   Allow-Credentials: ${allowCredentials}`);
    console.log(`   Max-Age: ${maxAge}`);

    const result: TestResult = {
      origin,
      method: 'OPTIONS',
      status: preflightResponse.status,
      allowed: preflightResponse.status === 204 && !!allowOrigin,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin || '',
        'Access-Control-Allow-Methods': allowMethods || '',
        'Access-Control-Allow-Headers': allowHeaders || '',
        'Access-Control-Allow-Credentials': allowCredentials || '',
        'Access-Control-Max-Age': maxAge || '',
      },
    };

    // Verificar resultado
    if (shouldAllow && result.allowed) {
      console.log(`   ✅ CORRECTO: Origen permitido`);
    } else if (!shouldAllow && !result.allowed) {
      console.log(`   ✅ CORRECTO: Origen bloqueado`);
    } else if (shouldAllow && !result.allowed) {
      console.log(`   ❌ ERROR: Debería estar permitido pero fue bloqueado`);
    } else {
      console.log(`   ❌ ERROR: Debería estar bloqueado pero fue permitido`);
    }

    return result;
  } catch (error) {
    console.error(`   ❌ ERROR en request:`, error);
    return {
      origin,
      method: 'OPTIONS',
      status: 0,
      allowed: false,
      headers: {},
      error: String(error),
    };
  }
}

async function testCors() {
  console.log('🧪 Testing CORS Configuration');
  console.log('Endpoint:', CORS_ENDPOINT);
  console.log('');

  // Leer orígenes permitidos del .env
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  console.log('📋 Orígenes permitidos en .env:');
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log('');

  const results: TestResult[] = [];

  // Test 1: Origen permitido (localhost:3001)
  results.push(await testCorsWithOrigin('http://localhost:3001', true));

  // Test 2: Origen permitido (localhost:3000)
  results.push(await testCorsWithOrigin('http://localhost:3000', true));

  // Test 3: Origen NO permitido
  results.push(await testCorsWithOrigin('http://malicious-site.com', false));

  // Test 4: Origen NO permitido (otro puerto)
  results.push(await testCorsWithOrigin('http://localhost:4000', false));

  console.log('\n');
  console.log('📊 RESUMEN:');
  const passed = results.filter(r => {
    const shouldAllow = allowedOrigins.includes(r.origin);
    return shouldAllow === r.allowed;
  }).length;
  const failed = results.length - passed;

  console.log(`   Tests pasados: ${passed}/${results.length}`);
  console.log(`   Tests fallados: ${failed}/${results.length}`);
  console.log('');

  // Verificar headers críticos
  const firstAllowed = results.find(r => r.allowed);
  if (firstAllowed) {
    console.log('✅ Headers CORS verificados:');
    console.log(`   - Access-Control-Allow-Origin: ${firstAllowed.headers['Access-Control-Allow-Origin']}`);
    console.log(`   - Access-Control-Allow-Methods: ${firstAllowed.headers['Access-Control-Allow-Methods']}`);
    console.log(`   - Access-Control-Allow-Credentials: ${firstAllowed.headers['Access-Control-Allow-Credentials']}`);
    console.log(`   - Access-Control-Max-Age: ${firstAllowed.headers['Access-Control-Max-Age']}`);
  }

  console.log('');

  if (failed === 0) {
    console.log('✅ CORS funciona correctamente!');
    return true;
  } else {
    console.log('❌ CORS tiene problemas');
    return false;
  }
}

// Ejecutar test
testCors()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error en test:', error);
    process.exit(1);
  });
