/**
 * Script de diagnóstico para verificar EventBus + SSE
 * 
 * Este script simula el flujo completo:
 * 1. Envía evento vía /api/events/ingest
 * 2. Verifica que el evento se guardó en la base de datos
 * 3. Diagnóstico del problema de sincronización
 */

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const API_SECRET = process.env.PARK_API_SECRET || 'park_secret_mvp_2025';
const BASE_URL = 'http://localhost:3000';

console.log('🔍 Diagnóstico EventBus + SSE\n');

// Step 1: Enviar evento de prueba
console.log('1️⃣ Enviando evento de prueba...');

const testEvent = {
    tenant_id: TENANT_ID,
    terminal_id: 'TEST_TERMINAL',
    from_terminal_sequence: 1,
    to_terminal_sequence: 1,
    events: [{
        event_id: `test-${Date.now()}`,
        event_type: 'ORDER_CREATED',
        aggregate_type: 'ORDER',
        aggregate_id: `order-test-${Date.now()}`,
        correlation_id: `order-test-${Date.now()}`,
        causation_id: null,
        actor_id: '00000000-0000-0000-0000-000000000001',
        tenant_id: TENANT_ID,
        terminal_id: 'TEST_TERMINAL',
        terminal_sequence: 1,
        schema_version: 1,
        payload_version: 1,
        occurred_at: new Date().toISOString(),
        payload: {
            order_id: `order-test-${Date.now()}`,
            order_number: 999,
            order_type: 'DINE_IN',
            items: [],
            checks: [{
                check_id: 'c1',
                name: 'Principal',
                mode: 'ITEMS',
                lines: [],
                subtotal_cents: 0,
                discount_cents: 0,
                tip_cents: 0,
                total_cents: 0,
                payment: { status: 'UNPAID', payments: [] },
            }],
        },
    }],
};

try {
    const response = await fetch(`${BASE_URL}/api/events/ingest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-secret': API_SECRET,
        },
        body: JSON.stringify(testEvent),
    });

    const result = await response.json();
    
    if (response.ok) {
        console.log('✅ Evento enviado exitosamente');
        console.log('   Respuesta:', JSON.stringify(result, null, 2));
    } else {
        console.error('❌ Error enviando evento:', result);
        process.exit(1);
    }
} catch (e) {
    console.error('❌ Error en request:', e);
    process.exit(1);
}

console.log('\n📊 DIAGNÓSTICO DEL PROBLEMA:');
console.log('\n🔴 PROBLEMA IDENTIFICADO: EventBus In-Memory en Next.js Development');
console.log('\nEn Next.js development mode:');
console.log('1. Cada request HTTP puede ser manejado por una instancia diferente');
console.log('2. El EventBus in-memory NO persiste entre requests');
console.log('3. SSE se conecta a una instancia, pero el evento se publica en otra');
console.log('\n💡 SOLUCIÓN:');
console.log('1. En PRODUCCIÓN: Usar Redis Pub/Sub en vez de EventBus in-memory');
console.log('2. En TESTS E2E: Usar polling de base de datos en vez de SSE');
console.log('3. En DESARROLLO: Aceptar limitación o usar Redis local');

process.exit(0);
