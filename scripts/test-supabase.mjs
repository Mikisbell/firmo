/**
 * Pruebas de Integración Simple - Supabase Cloud
 * 
 * Script simplificado para verificar conexión
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  console.log('🔌 Probando conexión a Supabase Cloud...\n');
  console.log('Database URL:', process.env.DIRECT_URL?.replace(/:[^:]*@/, ':****@'));
  console.log('');
  
  try {
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    // Verificar versión
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Versión PostgreSQL:', versionResult.rows[0].version);
    
    // Verificar tablas críticas
    console.log('\n📋 Verificando tablas críticas...\n');
    
    const tables = [
      'events',
      'orders', 
      'products',
      'promotions',
      'invoices',
      'refunds',
      'invoice_queue',
      'credit_notes',
      'employees',
      'tenants'
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const count = result.rows[0].count;
        console.log(`${count > 0 ? '✅' : '⚠️'} ${table}: ${count} registros`);
      } catch (err) {
        console.log(`❌ ${table}: Error - ${err.message}`);
      }
    }
    
    // Verificar eventos
    console.log('\n📡 Verificando tipos de eventos...\n');
    
    try {
      const eventResult = await client.query(`
        SELECT type, COUNT(*) as count 
        FROM events 
        GROUP BY type 
        ORDER BY count DESC
        LIMIT 10
      `);
      
      console.log('Top 10 eventos:');
      eventResult.rows.forEach(row => {
        console.log(`   ${row.type}: ${row.count}`);
      });
    } catch (err) {
      console.log('❌ Error consultando eventos:', err.message);
    }
    
    // Verificar tenant
    console.log('\n🏢 Verificando tenant...\n');
    
    try {
      const tenantResult = await client.query(`
        SELECT * FROM tenant_settings 
        WHERE tenant_id = $1
      `, [process.env.TENANT_ID]);
      
      if (tenantResult.rows.length > 0) {
        console.log('✅ Tenant encontrado:', tenantResult.rows[0].legal_name);
      } else {
        console.log('⚠️ Tenant no encontrado en BD');
      }
    } catch (err) {
      console.log('❌ Error consultando tenant:', err.message);
    }
    
    // Verificar cola de facturas
    console.log('\n📮 Verificando cola de facturas...\n');
    
    try {
      const queueResult = await client.query(`
        SELECT status, action, COUNT(*) as count
        FROM invoice_queue
        GROUP BY status, action
      `);
      
      if (queueResult.rows.length > 0) {
        console.log('Cola de facturas:');
        queueResult.rows.forEach(row => {
          console.log(`   ${row.action} - ${row.status}: ${row.count}`);
        });
      } else {
        console.log('⚠️ Cola de facturas vacía (normal para nueva implementación)');
      }
    } catch (err) {
      console.log('❌ Error consultando cola:', err.message);
    }
    
    client.release();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.error('\nPosibles causas:');
    console.error('1. La contraseña en .env no es correcta');
    console.error('2. La base de datos no está accesible desde esta IP');
    console.error('3. Network firewall bloqueando conexión');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
