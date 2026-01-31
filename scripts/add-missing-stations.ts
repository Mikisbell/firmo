import prisma from '../src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = '00000000-0000-0000-0000-000000000096';

async function addMissingStations() {
  console.log('🌱 Agregando estaciones faltantes...\n');
  
  // 1. Agregar estación HORNO
  const hornoExists = await prisma.stations.findFirst({
    where: { tenant_id: TENANT_ID, code: 'HORNO' }
  });
  
  if (!hornoExists) {
    await prisma.stations.create({
      data: {
        id: uuidv4(),
        tenant_id: TENANT_ID,
        code: 'HORNO',
        name: 'Horno',
        is_active: true,
        estimated_time: 15,
      }
    });
    console.log('✅ Estación HORNO creada');
  } else {
    console.log('⏭️  Estación HORNO ya existe');
  }
  
  // 2. Agregar estación EMPAQUE
  const empaqueExists = await prisma.stations.findFirst({
    where: { tenant_id: TENANT_ID, code: 'EMPAQUE' }
  });
  
  if (!empaqueExists) {
    await prisma.stations.create({
      data: {
        id: uuidv4(),
        tenant_id: TENANT_ID,
        code: 'EMPAQUE',
        name: 'Empaque y Delivery',
        is_active: true,
        estimated_time: 5,
      }
    });
    console.log('✅ Estación EMPAQUE creada');
  } else {
    console.log('⏭️  Estación EMPAQUE ya existe');
  }
  
  // 3. Agregar terminal SPC_EMPAQUE
  const empaqueTerminalExists = await prisma.terminal_devices.findFirst({
    where: { tenant_id: TENANT_ID, terminal_id: 'SPC_EMPAQUE' }
  });
  
  if (!empaqueTerminalExists) {
    await prisma.terminal_devices.create({
      data: {
        id: uuidv4(),
        tenant_id: TENANT_ID,
        terminal_id: 'SPC_EMPAQUE',
        device_name: 'Empaque y Delivery',
        role: 'KDS',
        status: 'active',
        location_id: LOCATION_ID,
        fingerprint_salt: uuidv4(),
      }
    });
    console.log('✅ Terminal SPC_EMPAQUE creado');
  } else {
    console.log('⏭️  Terminal SPC_EMPAQUE ya existe');
  }
  
  // 4. Agregar terminal SPC_BAR si no existe
  const barTerminalExists = await prisma.terminal_devices.findFirst({
    where: { tenant_id: TENANT_ID, terminal_id: 'SPC_BAR' }
  });
  
  if (!barTerminalExists) {
    await prisma.terminal_devices.create({
      data: {
        id: uuidv4(),
        tenant_id: TENANT_ID,
        terminal_id: 'SPC_BAR',
        device_name: 'Bar',
        role: 'BAR',
        status: 'active',
        location_id: LOCATION_ID,
        fingerprint_salt: uuidv4(),
      }
    });
    console.log('✅ Terminal SPC_BAR creado');
  } else {
    console.log('⏭️  Terminal SPC_BAR ya existe');
  }
  
  // 5. Agregar impresora para EMPAQUE
  const empaquePrinterExists = await prisma.printers.findFirst({
    where: { tenant_id: TENANT_ID, station_code: 'EMPAQUE' }
  });
  
  if (!empaquePrinterExists) {
    await prisma.printers.create({
      data: {
        id: uuidv4(),
        tenant_id: TENANT_ID,
        name: 'Impresora Empaque',
        station_code: 'EMPAQUE',
        connection_type: 'LAN',
        connection: { ip: '192.168.1.10', port: 9100 },
        is_active: true,
      }
    });
    console.log('✅ Impresora EMPAQUE creada');
  } else {
    console.log('⏭️  Impresora EMPAQUE ya existe');
  }
  
  console.log('\n✅ Proceso completado!');
  
  // Verificar resultado
  const stations = await prisma.stations.findMany({
    where: { tenant_id: TENANT_ID },
    orderBy: { code: 'asc' }
  });
  
  console.log('\n📊 Estaciones actuales:');
  stations.forEach(s => console.log(`  - ${s.code}: ${s.name}`));
  
  const terminals = await prisma.terminal_devices.findMany({
    where: { tenant_id: TENANT_ID, role: 'KDS' }
  });
  
  console.log('\n🖥️  Terminales KDS:');
  terminals.forEach(t => console.log(`  - ${t.terminal_id}: ${t.device_name}`));
}

addMissingStations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
