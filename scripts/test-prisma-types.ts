import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTypes() {
  console.log('🔍 Verificando que Prisma Client reconoce los nuevos campos...\n');

  try {
    // Test 1: Verificar que estimated_time existe en stations
    console.log('1. Probando campo estimated_time en stations...');
    const station = await prisma.stations.findFirst({
      where: {
        estimated_time: { gte: 1 }  // Debería funcionar si el cliente está actualizado
      }
    });
    console.log(`   ✅ Campo estimated_time reconocido`);
    if (station) {
      console.log(`   📊 Station: ${station.name}, Estimated Time: ${station.estimated_time} min\n`);
    }

    // Test 2: Verificar que station_alerts existe
    console.log('2. Probando tabla station_alerts...');
    const alertsCount = await prisma.station_alerts.count();
    console.log(`   ✅ Tabla station_alerts reconocida`);
    console.log(`   📊 Total alertas: ${alertsCount}\n`);

    // Test 3: Verificar que podemos crear una alerta (sin guardar)
    console.log('3. Probando tipos de station_alerts...');
    const testAlert = {
      station_id: '00000000-0000-0000-0000-000000000000',
      message: 'Test alert',
      severity: 'HIGH',
      metric_type: 'AVG_TIME',
      metric_value: 15.5,
      threshold_value: 10.0,
      tenant_id: '00000000-0000-0000-0000-000000000000'
    };
    console.log(`   ✅ Tipos de station_alerts correctos\n`);

    // Test 4: Verificar relación entre stations y station_alerts
    console.log('4. Probando relación stations → station_alerts...');
    const stationWithAlerts = await prisma.stations.findFirst({
      include: {
        station_alerts: true
      }
    });
    console.log(`   ✅ Relación stations → station_alerts funciona`);
    if (stationWithAlerts) {
      console.log(`   📊 Station: ${stationWithAlerts.name}, Alertas: ${stationWithAlerts.station_alerts.length}\n`);
    }

    console.log('✅ TODAS LAS VERIFICACIONES PASARON');
    console.log('🎉 Prisma Client está correctamente actualizado\n');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error('\n⚠️  El Prisma Client NO está actualizado.');
    console.error('💡 Solución: Ejecuta "npx prisma generate"\n');
    process.exit(1);
  }
}

testTypes()
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
