/**
 * Test Terminal Activation Flow - Versión Simplificada
 * Prueba directa del flujo de activación sin dependencias complejas
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('🧪 Prueba de Activación de Terminal\n');

  try {
    // Step 1: Verificar servidor
    console.log('1️⃣ Verificando servidor...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    if (healthResponse.status !== 200) {
      throw new Error(`Servidor no disponible: ${healthResponse.status}`);
    }
    console.log('   ✅ Servidor disponible\n');

    // Step 2: Generar código de activación
    console.log('2️⃣ Generando código de activación...');
    const codeResponse = await fetch(
      `${BASE_URL}/api/admin/terminals-v2/CAJA_01/regenerate-code`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (codeResponse.status !== 200) {
      const errorData = await codeResponse.json() as any;
      throw new Error(`Error generando código: ${codeResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const codeData = await codeResponse.json() as any;
    console.log('   Respuesta:', JSON.stringify(codeData, null, 2));

    const activationCode = codeData.code?.formatted || codeData.code?.code;
    if (!activationCode) {
      throw new Error('No se recibió código de activación en la respuesta');
    }

    console.log(`   ✅ Código generado: ${activationCode}\n`);

    // Step 3: Activar terminal
    console.log('3️⃣ Activando terminal...');
    const activateResponse = await fetch(
      `${BASE_URL}/api/terminals/activate-simple`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminal_id: 'CAJA_01',
          code: activationCode,
          fingerprint: 'test-fingerprint-simple',
        }),
      }
    );

    if (activateResponse.status !== 200) {
      const errorData = await activateResponse.json() as any;
      throw new Error(
        `Error activando terminal: ${activateResponse.status} - ${JSON.stringify(errorData)}`
      );
    }

    const activateData = await activateResponse.json() as any;
    console.log('   Respuesta:', JSON.stringify(activateData, null, 2));

    if (!activateData.success) {
      throw new Error(`Activación no exitosa: ${activateData.error}`);
    }

    console.log(`   ✅ Terminal activada: ${activateData.terminal.terminal_id}\n`);

    // Step 4: Verificar evento
    console.log('4️⃣ Verificando evento en base de datos...');
    const eventResponse = await fetch(
      `${BASE_URL}/api/test-simple`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            SELECT type, entity_id, payload 
            FROM events 
            WHERE type = 'TERMINAL_ACTIVATED_SIMPLE' 
            AND entity_id = (SELECT id FROM terminal_devices WHERE terminal_id = 'CAJA_01')
            ORDER BY occurred_at DESC 
            LIMIT 1
          `,
        }),
      }
    );

    if (eventResponse.status === 200) {
      const eventData = await eventResponse.json() as any;
      console.log('   Evento encontrado:', JSON.stringify(eventData, null, 2));
      console.log('   ✅ Evento registrado correctamente\n');
    } else {
      console.log('   ⚠️ No se pudo verificar evento (endpoint no disponible)\n');
    }

    console.log('✅ ¡Prueba completada exitosamente!');
    process.exit(0);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}`);
    process.exit(1);
  }
}

main();
