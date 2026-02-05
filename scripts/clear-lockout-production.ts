/**
 * Script para limpiar lockouts en producción
 * Uso: npx tsx scripts/clear-lockout-production.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearLockout() {
  console.log('🔓 Limpiando lockouts en producción...\n');

  try {
    // Limpiar intentos fallidos recientes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await prisma.login_attempts.deleteMany({
      where: {
        success: false,
        attempted_at: { gte: fiveMinutesAgo }
      }
    });

    console.log(`✅ Limpiados ${result.count} intentos fallidos recientes`);

    // Verificar estado actual
    const remaining = await prisma.login_attempts.count({
      where: {
        success: false,
        attempted_at: { gte: fiveMinutesAgo }
      }
    });
    
    console.log(`📊 Intentos fallidos restantes (últimos 5 min): ${remaining}`);

    if (remaining === 0) {
      console.log('\n✅ Lockout eliminado - puedes intentar login ahora');
    } else {
      console.log('\n⚠️ Aún hay intentos fallidos recientes');
    }

  } catch (error) {
    console.error('❌ Error limpiando lockout:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearLockout()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
