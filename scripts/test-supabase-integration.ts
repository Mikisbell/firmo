#!/usr/bin/env tsx
/**
 * Pruebas de Integración - Supabase Cloud
 * 
 * Verifica conexión y datos en la base de datos cloud
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testConnection(): Promise<void> {
  console.log('🔌 Test 1: Conexión a Supabase Cloud...\n');
  
  try {
    await prisma.$connect();
    
    // Verificar versión de PostgreSQL
    const version = await prisma.$queryRaw`SELECT version()`;
    
    results.push({
      name: 'Conexión a Supabase',
      status: 'PASS',
      message: 'Conexión exitosa',
      details: version
    });
    
    console.log('✅ Conexión exitosa a Supabase Cloud');
    console.log('📝 Versión:', version);
  } catch (error) {
    results.push({
      name: 'Conexión a Supabase',
      status: 'FAIL',
      message: 'Error de conexión: ' + (error as Error).message,
    });
    
    console.error('❌ Error de conexión:', error);
    throw error;
  }
}

const results: TestResult[] = [];

async function testConnection(): Promise<void> {
  console.log('🔌 Test 1: Conexión a Supabase Cloud...\n');
  
  try {
    await prisma.$connect();
    
    // Verificar versión de PostgreSQL
    const version = await prisma.$queryRaw`SELECT version()`;
    
    results.push({
      name: 'Conexión a Supabase',
      status: 'PASS',
      message: 'Conexión exitosa',
      details: version
    });
    
    console.log('✅ Conexión exitosa a Supabase Cloud');
    console.log('📝 Versión:', version);
  } catch (error) {
    results.push({
      name: 'Conexión a Supabase',
      status: 'FAIL',
      message: 'Error de conexión: ' + (error as Error).message,
    });
    
    console.error('❌ Error de conexión:', error);
    throw error;
  }
}

async function testTables(): Promise<void> {
  console.log('\n📊 Test 2: Verificación de tablas críticas...\n');
  
  const criticalTables = [
    'events',
    'orders',
    'products',
    'promotions',
    'invoices',
    'refunds',
    'invoice_queue',
    'credit_notes',
    'employees',
    'terminals',
    'stations',
    'tenants'
  ];
  
  for (const table of criticalTables) {
    try {
      const count = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${table}"
      `);
      
      const rowCount = (count as any[])[0].count;
      
      results.push({
        name: `Tabla: ${table}`,
        status: rowCount > 0 ? 'PASS' : 'WARN',
        message: `${rowCount} registros encontrados`,
        details: { count: rowCount }
      });
      
      console.log(`${rowCount > 0 ? '✅' : '⚠️'} ${table}: ${rowCount} registros`);
    } catch (error) {
      results.push({
        name: `Tabla: ${table}`,
        status: 'FAIL',
        message: 'Error: ' + (error as Error).message,
      });
      
      console.error(`❌ ${table}: Error -`, (error as Error).message);
    }
  }
}

async function testEvents(): Promise<void> {
  console.log('\n📡 Test 3: Verificación de eventos...\n');
  
  try {
    const eventTypes = await prisma.$queryRaw`
      SELECT DISTINCT type, COUNT(*) as count 
      FROM events 
      GROUP BY type 
      ORDER BY count DESC
    `;
    
    console.log('📊 Tipos de eventos encontrados:');
    (eventTypes as any[]).forEach((e: any) => {
      console.log(`   ${e.type}: ${e.count} eventos`);
    });
    
    // Verificar eventos nuevos implementados
    const newEventTypes = [
      'PROMOTION_APPLIED_TENTATIVE',
      'PROMOTION_VALIDATED_APPLIED',
      'PROMOTION_REMOVED',
      'DELIVERY_ASSIGNED',
      'DELIVERY_STATUS_CHANGED',
      'HANDOFF_STATUS_CHANGED',
      'REFUND_ISSUED',
      'PURCHASE_ORDER_CREATED',
      'GOODS_RECEIVED',
      'INVENTORY_ADJUSTED'
    ];
    
    const existingTypes = (eventTypes as any[]).map((e: any) => e.type);
    
    for (const eventType of newEventTypes) {
      const exists = existingTypes.includes(eventType);
      
      results.push({
        name: `Evento: ${eventType}`,
        status: exists ? 'PASS' : 'WARN',
        message: exists ? 'Eventos encontrados en BD' : 'Sin eventos (nuevo tipo)',
      });
      
      console.log(`${exists ? '✅' : '⚠️'} ${eventType}: ${exists ? 'encontrado' : 'sin datos'}`);
    }
  } catch (error) {
    console.error('❌ Error verificando eventos:', error);
  }
}

async function testTenant(): Promise<void> {
  console.log('\n🏢 Test 4: Verificación de tenant...\n');
  
  const tenantId = process.env.TENANT_ID;
  
  try {
    const tenant = await prisma.$queryRaw`
      SELECT * FROM tenant_settings 
      WHERE tenant_id = ${tenantId}::uuid
    `;
    
    if ((tenant as any[]).length > 0) {
      results.push({
        name: 'Tenant Configuration',
        status: 'PASS',
        message: `Tenant ${tenantId} encontrado`,
        details: (tenant as any[])[0]
      });
      
      console.log('✅ Tenant encontrado:', (tenant as any[])[0].legal_name);
    } else {
      results.push({
        name: 'Tenant Configuration',
        status: 'WARN',
        message: 'Tenant no encontrado en BD',
      });
      
      console.log('⚠️ Tenant no encontrado en base de datos');
    }
  } catch (error) {
    results.push({
      name: 'Tenant Configuration',
      status: 'FAIL',
      message: 'Error: ' + (error as Error).message,
    });
    
    console.error('❌ Error:', error);
  }
}

async function testInvoiceQueue(): Promise<void> {
  console.log('\n📮 Test 5: Verificación de cola de facturas...\n');
  
  try {
    const queueStats = await prisma.$queryRaw`
      SELECT 
        status,
        action,
        COUNT(*) as count
      FROM invoice_queue
      GROUP BY status, action
    `;
    
    if ((queueStats as any[]).length > 0) {
      console.log('📊 Cola de facturas:');
      (queueStats as any[]).forEach((q: any) => {
        console.log(`   ${q.action} - ${q.status}: ${q.count}`);
      });
      
      results.push({
        name: 'Invoice Queue',
        status: 'PASS',
        message: 'Cola configurada correctamente',
        details: queueStats
      });
    } else {
      results.push({
        name: 'Invoice Queue',
        status: 'WARN',
        message: 'Cola vacía (normal para nueva implementación)',
      });
      
      console.log('⚠️ Cola de facturas vacía (normal)');
    }
  } catch (error) {
    console.error('❌ Error verificando cola:', error);
  }
}

async function generateReport(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📋 REPORTE DE PRUEBAS - SUPABASE CLOUD');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`✅ Pasadas: ${passed}`);
  console.log(`⚠️ Advertencias: ${warnings}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📊 Total: ${results.length}\n`);
  
  console.log('-'.repeat(60));
  console.log('DETALLE DE RESULTADOS:');
  console.log('-'.repeat(60) + '\n');
  
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : 
                 result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}`);
    console.log(`   Estado: ${result.status}`);
    console.log(`   Mensaje: ${result.message}`);
    if (result.details) {
      console.log(`   Detalles:`, JSON.stringify(result.details, null, 2).substring(0, 200));
    }
    console.log('');
  });
  
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
  } else if (failed < 3) {
    console.log('⚠️ ALGUNAS PRUEBAS FALLARON - REVISAR DETALLES');
  } else {
    console.log('❌ MÚLTIPLES ERRORES - ACCIÓN REQUERIDA');
  }
  
  console.log('='.repeat(60) + '\n');
}

async function main(): Promise<void> {
  console.log('\n🚀 INICIANDO PRUEBAS DE INTEGRACIÓN - SUPABASE CLOUD\n');
  console.log('Base de datos: aws-1-sa-east-1.pooler.supabase.com');
  console.log('Tenant ID:', process.env.TENANT_ID);
  console.log('');
  
  try {
    await testConnection();
    await testTables();
    await testEvents();
    await testTenant();
    await testInvoiceQueue();
    
    await generateReport();
  } catch (error) {
    console.error('💥 Error crítico:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexión cerrada\n');
  }
}

main();
