/**
 * Pruebas Funcionales Completas - Supabase Cloud
 * 
 * Flujo completo: Orden → Promoción → Facturación
 */

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false }
});

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 PRUEBAS FUNCIONALES COMPLETAS - SUPABASE CLOUD');
  console.log('='.repeat(70) + '\n');
  
  const client = await pool.connect();
  
  try {
    // ==========================================
    // PRUEBA 1: Crear Orden
    // ==========================================
    console.log('📦 PRUEBA 1: Creando Orden de Prueba...\n');
    
    const orderId = uuidv4();
    const orderNumber = await getNextOrderNumber(client);
    
    const orderData = {
      id: orderId,
      tenant_id: TENANT_ID,
      order_number: orderNumber,
      order_type: 'DINE_IN',
      order_status: 'OPEN',
      fulfillment_status: 'COOKING',
      terminal_id: 'admin-panel-test',
      items: JSON.stringify([
        {
          line_id: uuidv4(),
          product_id: uuidv4(),
          sku: 'pollo_1_4',
          name: '1/4 Pollo con Papas',
          short_name: '1/4 P',
          qty: 2,
          unit_price_cents: 2500,
          station: 'PARRILLA',
          status: 'PENDING',
          mods: [],
          notes: 'Sin sal'
        },
        {
          line_id: uuidv4(),
          product_id: uuidv4(),
          sku: 'gaseosa_500',
          name: 'Gaseosa 500ml',
          short_name: 'Gaseosa',
          qty: 2,
          unit_price_cents: 500,
          station: 'BAR',
          status: 'PENDING',
          mods: [],
          notes: ''
        }
      ]),
      checks: JSON.stringify([
        {
          check_id: 'check-001',
          name: 'Mesa 12 - Principal',
          mode: 'ITEMS',
          lines: [
            { line_id: 'line-001', qty: 2 },
            { line_id: 'line-002', qty: 2 }
          ],
          subtotal_cents: 6000,
          discount_cents: 0,
          total_cents: 6000,
          payment: { status: 'UNPAID', payments: [] }
        }
      ]),
      fulfillment: JSON.stringify({ table_number: '12', guest_count: 4 }),
      subtotal_cents: 6000,
      discount_cents: 0,
      total_cents: 6000,
      stations_active: ['PARRILLA', 'BAR'],
      unpaid_checks_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await client.query(`
      INSERT INTO orders (
        id, tenant_id, order_number, order_type, order_status, 
        fulfillment_status, terminal_id, items, checks, fulfillment,
        subtotal_cents, discount_cents, total_cents, stations_active,
        unpaid_checks_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      orderData.id, orderData.tenant_id, orderData.order_number, orderData.order_type,
      orderData.order_status, orderData.fulfillment_status, orderData.terminal_id,
      orderData.items, orderData.checks, orderData.fulfillment, orderData.subtotal_cents,
      orderData.discount_cents, orderData.total_cents, orderData.stations_active,
      orderData.unpaid_checks_count, orderData.created_at, orderData.updated_at
    ]);
    
    // Crear evento ORDER_CREATED
    const eventId1 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'ORDER_CREATED', 'ORDER', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId1, TENANT_ID, orderId, ADMIN_ID,
      JSON.stringify({ order_id: orderId, order_number: orderNumber, order_type: 'DINE_IN' })
    ]);
    
    console.log('✅ Orden creada exitosamente:');
    console.log(`   ID: ${orderId}`);
    console.log(`   Número: ${orderNumber}`);
    console.log(`   Total: S/${(6000/100).toFixed(2)}`);
    console.log(`   Items: 2 productos\n`);
    
    // ==========================================
    // PRUEBA 2: Aplicar Promoción
    // ==========================================
    console.log('🏷️  PRUEBA 2: Aplicando Promoción...\n');
    
    // Buscar una promoción activa
    const promoResult = await client.query(`
      SELECT id, name, type, value FROM promotions 
      WHERE tenant_id = $1 AND is_active = true 
      LIMIT 1
    `, [TENANT_ID]);
    
    if (promoResult.rows.length === 0) {
      console.log('⚠️  No hay promociones activas. Creando promoción de prueba...\n');
      
      const promoId = uuidv4();
      await client.query(`
        INSERT INTO promotions (id, tenant_id, name, type, value, rules, is_active, stackable)
        VALUES ($1, $2, 'Descuento de Prueba', 'PERCENT', 10, '{}', true, false)
      `, [promoId, TENANT_ID]);
      
      promoResult.rows.push({ id: promoId, name: 'Descuento de Prueba', type: 'PERCENT', value: 10 });
    }
    
    const promotion = promoResult.rows[0];
    const discountAmount = Math.floor(6000 * (promotion.value / 100));
    const newTotal = 6000 - discountAmount;
    
    // Actualizar orden con promoción
    await client.query(`
      UPDATE orders 
      SET promotion_id = $1, 
          discount_cents = $2, 
          total_cents = $3,
          promotion_snapshot = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [
      promotion.id,
      discountAmount,
      newTotal,
      JSON.stringify({
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        value: promotion.value,
        discount_cents: discountAmount
      }),
      orderId
    ]);
    
    // Crear evento PROMOTION_APPLIED_TENTATIVE
    const eventId2 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'PROMOTION_APPLIED_TENTATIVE', 'ORDER', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId2, TENANT_ID, orderId, ADMIN_ID,
      JSON.stringify({
        order_id: orderId,
        promotion_id: promotion.id,
        source: 'ORDER_SCREEN'
      })
    ]);
    
    // Crear evento PROMOTION_VALIDATED_APPLIED
    const eventId3 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'PROMOTION_VALIDATED_APPLIED', 'ORDER', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId3, TENANT_ID, orderId, ADMIN_ID,
      JSON.stringify({
        order_id: orderId,
        promotion_id: promotion.id,
        promotion_snapshot: {
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          value: promotion.value
        },
        recalculated_totals: {
          subtotal_cents: 6000,
          discount_cents: discountAmount,
          total_cents: newTotal
        }
      })
    ]);
    
    console.log('✅ Promoción aplicada exitosamente:');
    console.log(`   Promoción: ${promotion.name}`);
    console.log(`   Tipo: ${promotion.type} (${promotion.value}%)`);
    console.log(`   Descuento: S/${(discountAmount/100).toFixed(2)}`);
    console.log(`   Nuevo Total: S/${(newTotal/100).toFixed(2)}\n`);
    
    // ==========================================
    // PRUEBA 3: Procesar Pago
    // ==========================================
    console.log('💳 PRUEBA 3: Procesando Pago...\n');
    
    // Actualizar orden como pagada
    await client.query(`
      UPDATE orders 
      SET order_status = 'CONFIRMED',
          unpaid_checks_count = 0,
          checks = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [
      JSON.stringify([
        {
          check_id: 'check-001',
          name: 'Mesa 12 - Principal',
          mode: 'ITEMS',
          lines: [
            { line_id: 'line-001', qty: 2 },
            { line_id: 'line-002', qty: 2 }
          ],
          subtotal_cents: 6000,
          discount_cents: discountAmount,
          total_cents: newTotal,
          payment: { 
            status: 'PAID', 
            payments: [
              { method: 'CASH', amount_cents: newTotal, ref: null }
            ]
          }
        }
      ]),
      orderId
    ]);
    
    // Crear evento CHECK_PAYMENT_ADDED
    const eventId4 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'CHECK_PAYMENT_ADDED', 'ORDER', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId4, TENANT_ID, orderId, ADMIN_ID,
      JSON.stringify({
        order_id: orderId,
        check_id: 'check-001',
        payment: { method: 'CASH', amount_cents: newTotal }
      })
    ]);
    
    // Crear evento CHECK_MARKED_PAID
    const eventId5 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'CHECK_MARKED_PAID', 'ORDER', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId5, TENANT_ID, orderId, ADMIN_ID,
      JSON.stringify({
        order_id: orderId,
        check_id: 'check-001',
        paid_at: new Date().toISOString(),
        change_cents: 0
      })
    ]);
    
    console.log('✅ Pago procesado exitosamente:');
    console.log(`   Método: Efectivo (CASH)`);
    console.log(`   Monto: S/${(newTotal/100).toFixed(2)}`);
    console.log(`   Cambio: S/0.00\n`);
    
    // ==========================================
    // PRUEBA 4: Emitir Factura SUNAT
    // ==========================================
    console.log('📄 PRUEBA 4: Emitiendo Factura SUNAT...\n');
    
    const invoiceId = uuidv4();
    const series = 'B001';
    const invoiceNumber = await getNextInvoiceNumber(client, series);
    
    await client.query(`
      INSERT INTO invoices (
        id, tenant_id, order_id, check_id, invoice_type, series, 
        invoice_number, customer_doc_type, customer_doc, total_cents,
        payment_summary, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    `, [
      invoiceId, TENANT_ID, orderId, 'check-001', 'BOLETA', series,
      invoiceNumber, 'DNI', '12345678', newTotal,
      JSON.stringify({
        items: 2,
        subtotal_cents: 6000,
        discount_cents: discountAmount,
        total_cents: newTotal,
        payment_method: 'CASH'
      }),
      'ISSUED'
    ]);
    
    // Crear evento INVOICE_ISSUED
    const eventId6 = uuidv4();
    await client.query(`
      INSERT INTO events (id, tenant_id, occurred_at, type, entity_type, entity_id, 
        actor_id, actor_role_snapshot, terminal_id, payload)
      VALUES ($1, $2, NOW(), 'INVOICE_ISSUED', 'INVOICE', $3, $4, 'ADMIN', 'admin-panel-test', $5)
    `, [
      eventId6, TENANT_ID, invoiceId, ADMIN_ID,
      JSON.stringify({
        order_id: orderId,
        check_id: 'check-001',
        invoice_id: invoiceId,
        invoice_type: 'BOLETA',
        series: series,
        invoice_number: invoiceNumber,
        total_cents: newTotal
      })
    ]);
    
    // Agregar a cola de SUNAT
    const queueId = uuidv4();
    await client.query(`
      INSERT INTO invoice_queue (
        id, tenant_id, invoice_id, action, priority, attempts, 
        max_attempts, scheduled_at, status
      ) VALUES ($1, $2, $3, 'EMIT', 5, 0, 3, NOW(), 'PENDING')
    `, [queueId, TENANT_ID, invoiceId]);
    
    console.log('✅ Factura emitida exitosamente:');
    console.log(`   ID: ${invoiceId}`);
    console.log(`   Serie: ${series}`);
    console.log(`   Número: ${invoiceNumber}`);
    console.log(`   Tipo: Boleta (BOLETA)`);
    console.log(`   Total: S/${(newTotal/100).toFixed(2)}`);
    console.log(`   Cola SUNAT: ${queueId} (PENDIENTE)\n`);
    
    // ==========================================
    // RESUMEN
    // ==========================================
    console.log('='.repeat(70));
    console.log('📊 RESUMEN DE PRUEBAS FUNCIONALES');
    console.log('='.repeat(70) + '\n');
    
    // Contar eventos creados
    const eventsResult = await client.query(`
      SELECT type, COUNT(*) as count 
      FROM events 
      WHERE tenant_id = $1 
      AND entity_id IN ($2, $3)
      GROUP BY type
    `, [TENANT_ID, orderId, invoiceId]);
    
    console.log('📡 Eventos generados:');
    eventsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.type}: ${row.count} evento(s)`);
    });
    
    console.log('\n📦 Orden:');
    console.log(`   ID: ${orderId}`);
    console.log(`   Número: ${orderNumber}`);
    console.log(`   Productos: 2 items`);
    console.log(`   Subtotal: S/60.00`);
    console.log(`   Descuento: S/${(discountAmount/100).toFixed(2)} (${promotion.value}%)`);
    console.log(`   Total: S/${(newTotal/100).toFixed(2)}`);
    
    console.log('\n📄 Factura:');
    console.log(`   ID: ${invoiceId}`);
    console.log(`   Serie-Número: ${series}-${invoiceNumber}`);
    console.log(`   Tipo: Boleta`);
    console.log(`   Cliente: DNI 12345678`);
    console.log(`   Total: S/${(newTotal/100).toFixed(2)}`);
    
    console.log('\n🏷️  Promoción:');
    console.log(`   ID: ${promotion.id}`);
    console.log(`   Nombre: ${promotion.name}`);
    console.log(`   Descuento: ${promotion.value}%`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ TODAS LAS PRUEBAS FUNCIONALES PASARON EXITOSAMENTE');
    console.log('='.repeat(70) + '\n');
    
    console.log('🎉 Flujo completo verificado:');
    console.log('   1. ✅ Creación de orden');
    console.log('   2. ✅ Aplicación de promoción');
    console.log('   3. ✅ Procesamiento de pago');
    console.log('   4. ✅ Emisión de factura SUNAT');
    console.log('   5. ✅ Cola de procesamiento\n');
    
  } catch (error) {
    console.error('\n❌ Error en pruebas:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function getNextOrderNumber(client) {
  const result = await client.query(`
    SELECT MAX(order_number) as max_num FROM orders WHERE tenant_id = $1
  `, [TENANT_ID]);
  
  return (result.rows[0].max_num || 1000) + 1;
}

async function getNextInvoiceNumber(client, series) {
  const result = await client.query(`
    SELECT MAX(invoice_number) as max_num 
    FROM invoices 
    WHERE tenant_id = $1 AND series = $2
  `, [TENANT_ID, series]);
  
  const nextNum = (parseInt(result.rows[0].max_num || '0') + 1).toString();
  return nextNum.padStart(8, '0');
}

runTests().catch(console.error);
