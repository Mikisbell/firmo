/**
 * Test Upstash Redis Connection
 * 
 * Verifica que la conexión a Upstash Redis funciona correctamente
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('❌ Error: UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN no configurados');
  process.exit(1);
}

console.log('🔍 Probando conexión a Upstash Redis...');
console.log(`📍 URL: ${REDIS_URL}`);

async function testRedis() {
  try {
    // Test 1: PING
    console.log('\n1️⃣  Test PING...');
    const pingResponse = await fetch(`${REDIS_URL}/ping`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
      },
    });
    
    if (!pingResponse.ok) {
      throw new Error(`PING failed: ${pingResponse.status}`);
    }
    
    const pingData = await pingResponse.json();
    console.log('✅ PING exitoso:', pingData);

    // Test 2: SET
    console.log('\n2️⃣  Test SET...');
    const setResponse = await fetch(`${REDIS_URL}/set/test-key/test-value`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
      },
    });
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.status}`);
    }
    
    const setData = await setResponse.json();
    console.log('✅ SET exitoso:', setData);

    // Test 3: GET
    console.log('\n3️⃣  Test GET...');
    const getResponse = await fetch(`${REDIS_URL}/get/test-key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
      },
    });
    
    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.status}`);
    }
    
    const getData = await getResponse.json();
    console.log('✅ GET exitoso:', getData);

    // Test 4: DEL
    console.log('\n4️⃣  Test DEL...');
    const delResponse = await fetch(`${REDIS_URL}/del/test-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
      },
    });
    
    if (!delResponse.ok) {
      throw new Error(`DEL failed: ${delResponse.status}`);
    }
    
    const delData = await delResponse.json();
    console.log('✅ DEL exitoso:', delData);

    // Test 5: INCR
    console.log('\n5️⃣  Test INCR...');
    const incrResponse = await fetch(`${REDIS_URL}/incr/counter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
      },
    });
    
    if (!incrResponse.ok) {
      throw new Error(`INCR failed: ${incrResponse.status}`);
    }
    
    const incrData = await incrResponse.json();
    console.log('✅ INCR exitoso:', incrData);

    console.log('\n✅ ¡Todos los tests pasaron! Redis está funcionando correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testRedis();
