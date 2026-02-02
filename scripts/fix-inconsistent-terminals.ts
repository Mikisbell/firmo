/**
 * Script para corregir terminales inconsistentes (versión simple)
 * Establece fingerprint_hash para terminales activos sin huella digital
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSimpleFingerprint(terminalId: string, salt: string): string {
  const data = `${terminalId}:${salt}:${Date.now()}:${Math.random()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function fixInconsistentTerminals() {
  console.log('🔧 CORRECCIÓN DE TERMINALES INCONSISTENTES\n');
  
  try {
    // Encontrar terminales activos sin fingerprint
    const inconsistentTerminals = await prisma.terminal_devices.findMany({
      where: {
        status: 'active',
        fingerprint_hash: null
      }
    });
    
    console.log(`🔍 Encontrados ${inconsistentTerminals.length} terminales inconsistentes\n`);
    
    for (const terminal of inconsistentTerminals) {
      console.log(`📝 Procesando: ${terminal.terminal_id}`);
      
      // Generar fingerprint de fallback
      const fallbackFingerprint = generateSimpleFingerprint(
        terminal.terminal_id, 
        terminal.fingerprint_salt
      );
      
      // Actualizar terminal
      await prisma.terminal_devices.update({
        where: { id: terminal.id },
        data: {
          fingerprint_hash: fallbackFingerprint,
          updated_at: new Date()
        }
      });
      
      console.log(`  ✅ Terminal corregido exitosamente`);
      console.log(`  🔐 Fingerprint: ${fallbackFingerprint.substring(0, 40)}...\n`);
    }
    
    // Verificar corrección
    const remaining = await prisma.terminal_devices.count({
      where: {
        status: 'active',
        fingerprint_hash: null
      }
    });
    
    console.log(`✅ Corrección completada. Terminales inconsistentes restantes: ${remaining}`);
    
  } catch (error) {
    console.error('❌ Error al corregir terminales:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixInconsistentTerminals();
