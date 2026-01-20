/**
 * Test Rate Limiting en Endpoint Real
 * Prueba que el rate limiting funciona correctamente en /api/admin/employees
 */

const RATE_LIMIT_API_URL = 'http://localhost:3000';
const RATE_LIMIT_ENDPOINT = '/api/admin/employees';

interface RateLimitResponse {
  error?: string;
  retryAfter?: string;
}

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting en', RATE_LIMIT_ENDPOINT);
  console.log('Configuración: 10 requests por minuto (MUTATION)');
  console.log('');

  const results: { attempt: number; status: number; remaining?: string; error?: string }[] = [];

  // Hacer 15 requests rápidos (debería bloquear después de 10)
  for (let i = 1; i <= 15; i++) {
    try {
      const response = await fetch(`${RATE_LIMIT_API_URL}${RATE_LIMIT_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Test Employee ${i}`,
          role: 'WAITER',
          pin: '1234',
        }),
      });

      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      const reset = response.headers.get('X-RateLimit-Reset');
      const retryAfter = response.headers.get('Retry-After');

      if (response.status === 429) {
        const data: RateLimitResponse = await response.json();
        results.push({
          attempt: i,
          status: 429,
          error: data.error,
        });
        console.log(`❌ Request ${i}: BLOQUEADO (429)`);
        console.log(`   Retry-After: ${retryAfter} segundos`);
        console.log(`   Mensaje: ${data.error}`);
      } else {
        results.push({
          attempt: i,
          status: response.status,
          remaining: remaining || 'N/A',
        });
        console.log(`✅ Request ${i}: PERMITIDO (${response.status})`);
        console.log(`   Remaining: ${remaining}/${limit}`);
        console.log(`   Reset: ${reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'N/A'}`);
      }
    } catch (error) {
      console.error(`❌ Request ${i}: ERROR`, error);
      results.push({
        attempt: i,
        status: 0,
        error: String(error),
      });
    }

    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('📊 RESUMEN:');
  const allowed = results.filter(r => r.status !== 429).length;
  const blocked = results.filter(r => r.status === 429).length;
  console.log(`   Permitidos: ${allowed}`);
  console.log(`   Bloqueados: ${blocked}`);
  console.log('');

  // Verificar que funciona correctamente
  if (blocked > 0 && allowed <= 10) {
    console.log('✅ Rate limiting funciona correctamente!');
    console.log('   - Permitió hasta 10 requests');
    console.log('   - Bloqueó los siguientes requests');
    return true;
  } else {
    console.log('❌ Rate limiting NO funciona correctamente');
    console.log(`   - Esperado: máximo 10 permitidos, resto bloqueados`);
    console.log(`   - Actual: ${allowed} permitidos, ${blocked} bloqueados`);
    return false;
  }
}

// Ejecutar test
testRateLimiting()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error en test:', error);
    process.exit(1);
  });
