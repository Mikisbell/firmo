/**
 * Script para probar el endpoint de login en producción
 * Simula exactamente lo que el frontend envía
 */

async function testProductionLogin() {
  console.log('🧪 Testing Production Login API\n');
  console.log('═'.repeat(80));

  const url = 'https://parkperu.vercel.app/api/auth/login';
  
  // Simular lo que el frontend envía
  const payload = {
    tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    terminal_id: 'ADMIN_PANEL',
    pin: '1234',
    fingerprint: {
      hash: 'test-fingerprint-hash-12345678',
      signals: {},
      signalCount: 14,
      timestamp: Date.now(),
    },
    risk_score: 5,
  };

  console.log('\n📤 Request:');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('\n📥 Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Body:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ LOGIN SUCCESSFUL');
    } else {
      console.log('\n❌ LOGIN FAILED');
      console.log('Error:', data.error);
      console.log('Details:', data.details || data.message);
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error);
  }

  console.log('\n' + '═'.repeat(80));
}

testProductionLogin();
