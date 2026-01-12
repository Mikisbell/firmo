// scripts/check-terminal-v2.ts
// Verificar que las tablas de Terminal Architecture v2 existen

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando tablas de Terminal Architecture v2...\n');

  try {
    // Check terminal_devices
    const terminalDevicesCount = await prisma.terminal_devices.count();
    console.log(`✅ terminal_devices: ${terminalDevicesCount} registros`);

    // Check activation_codes
    const activationCodesCount = await prisma.activation_codes.count();
    console.log(`✅ activation_codes: ${activationCodesCount} registros`);

    // Check auth_events
    const authEventsCount = await prisma.auth_events.count();
    console.log(`✅ auth_events: ${authEventsCount} registros`);

    // Check security_alerts
    const securityAlertsCount = await prisma.security_alerts.count();
    console.log(`✅ security_alerts: ${securityAlertsCount} registros`);

    console.log('\n🎉 Todas las tablas de Terminal Architecture v2 están disponibles!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
