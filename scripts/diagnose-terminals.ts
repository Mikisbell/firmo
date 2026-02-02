/**
 * Script para diagnosticar estado de terminales
 * Detecta inconsistencias entre status y fingerprint_hash
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseTerminals() {
  console.log('🔍 DIAGNÓSTICO DE TERMINALES\n');
  
  try {
    // Obtener todos los terminales
    const terminals = await prisma.terminal_devices.findMany({
      include: {
        activation_codes: {
          where: { used: false },
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`📊 Total de terminales encontrados: ${terminals.length}\n`);
    
    // Categorizar terminales
    const inconsistentActive = terminals.filter(t => t.status === 'active' && !t.fingerprint_hash);
    const inconsistentPending = terminals.filter(t => t.status === 'pending' && t.fingerprint_hash);
    const normalActive = terminals.filter(t => t.status === 'active' && t.fingerprint_hash);
    const normalPending = terminals.filter(t => t.status === 'pending' && !t.fingerprint_hash);
    
    console.log('📋 ESTADOS DE TERMINALES:');
    console.log(`  ✅ Activos con fingerprint (normal): ${normalActive.length}`);
    console.log(`  ⏳ Pendientes sin fingerprint (normal): ${normalPending.length}`);
    console.log(`  ⚠️  Activos SIN fingerprint (INCONSISTENTE): ${inconsistentActive.length}`);
    console.log(`  ⚠️  Pendientes CON fingerprint (INCONSISTENTE): ${inconsistentPending.length}\n`);
    
    // Mostrar detalles de terminales inconsistentes
    if (inconsistentActive.length > 0) {
      console.log('🚨 TERMINALES ACTIVOS SIN FINGERPRINT (requieren atención):');
      inconsistentActive.forEach(t => {
        console.log(`  - ${t.terminal_id} (ID: ${t.id})`);
        console.log(`    Role: ${t.role}, Location: ${t.location_id}`);
        console.log(`    Códigos activos disponibles: ${t.activation_codes.length}`);
        if (t.activation_codes.length > 0) {
          console.log(`    Último código: ${t.activation_codes[0].code} (expira: ${t.activation_codes[0].expires_at})`);
        }
        console.log('');
      });
    }
    
    if (inconsistentPending.length > 0) {
      console.log('🚨 TERMINALES PENDIENTES CON FINGERPRINT (requieren atención):');
      inconsistentPending.forEach(t => {
        console.log(`  - ${t.terminal_id} (ID: ${t.id})`);
        console.log(`    fingerprint_hash: ${t.fingerprint_hash?.substring(0, 20)}...`);
        console.log('');
      });
    }
    
    // Verificar CAJA_01 específicamente
    const caja01 = terminals.find(t => t.terminal_id === 'CAJA_01');
    if (caja01) {
      console.log('🎯 DETALLE ESPECÍFICO DE CAJA_01:');
      console.log(`  ID: ${caja01.id}`);
      console.log(`  Status: ${caja01.status}`);
      console.log(`  Fingerprint: ${caja01.fingerprint_hash ? 'Presente' : 'AUSENTE'}`);
      console.log(`  Role: ${caja01.role}`);
      console.log(`  Device Name: ${caja01.device_name}`);
      console.log(`  Location: ${caja01.location_id}`);
      console.log(`  Códigos sin usar: ${caja01.activation_codes.length}`);
      if (caja01.activation_codes.length > 0) {
        const code = caja01.activation_codes[0];
        console.log(`  Código actual: ${code.code}`);
        console.log(`  Expira: ${code.expires_at}`);
        console.log(`  ¿Expirado?: ${new Date() > code.expires_at ? 'SÍ' : 'NO'}`);
      }
    } else {
      console.log('❌ CAJA_01 no existe en la base de datos');
    }
    
  } catch (error) {
    console.error('Error al diagnosticar:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseTerminals();
