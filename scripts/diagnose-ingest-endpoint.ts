/**
 * Script de diagnóstico para endpoint /api/events/ingest
 * 
 * Ejecuta un request simple y muestra el error exacto
 */

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Mismo que tests E2E
const API_SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const TERMINAL_ID = 'CAJA_01';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateOrderNumber() {
  return Math.floor(Math.random() * 900000) + 100000;
}

async function testIngestEndpoint() {
  console.log('🔍 Diagnóstico de endpoint /api/events/ingest\n');
  
  const eventId = uuid();
  const orderId = uuid();
  const orderNumber = generateOrderNumber();
  
  const event = {
    event_id: eventId,
    event_type: 'ORDER_CREATED',
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    occurred_at: new Date().toISOString(),
    aggregate_type: 'ORDER',
    aggregate_id: orderId,
    schema_version: 1,
    terminal_sequence: 1,
    correlation_id: uuid(),
    payload: {
      order_id: orderId,
      order_number: orderNumber,
      order_type: 'DINE_IN',
      items: [],
      checks: [{ 
        check_id: uuid(), 
        lines: [], 
        payment: { status: 'UNPAID', payments: [] },
        total_cents: 0 
      }],
    },
  };

  const body = {
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    events: [event],
    from_terminal_sequence: 0,
    to_terminal_sequence: 1,
  };

  console.log('📤 Enviando request...');
  console.log('URL: http://localhost:3000/api/events/ingest');
  console.log('Headers:', {
    'Content-Type': 'application/json',
    'x-api-secret': API_SECRET.substring(0, 10) + '...',
  });
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await fetch('http://localhost:3000/api/events/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': API_SECRET,
      },
      body: JSON.stringify(body),
    });

    console.log('📥 Respuesta recibida:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    console.log('');

    const data = await response.json();
    console.log('Body:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Request exitoso');
    } else {
      console.log('❌ Request fallido');
      console.log('');
      console.log('🔍 Análisis del error:');
      
      if (data.error) {
        console.log('Error Code:', data.error.error_code);
        console.log('Severity:', data.error.severity);
        console.log('Message:', data.error.message);
        console.log('User Action:', data.error.user_action);
        console.log('Retryable:', data.error.retryable);
        
        if (data.error.context) {
          console.log('Context:', JSON.stringify(data.error.context, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('❌ Error al ejecutar request:', error);
  }
}

// Ejecutar diagnóstico
testIngestEndpoint().catch(console.error);
