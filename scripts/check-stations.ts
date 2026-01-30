import prisma from '../src/core/db/prisma';

async function checkStations() {
  const stations = await prisma.stations.findMany({
    where: { tenant_id: '00000000-0000-0000-0000-000000000001' },
    orderBy: { code: 'asc' }
  });
  
  console.log('\n📊 Estaciones en la base de datos:');
  console.log('Total:', stations.length);
  console.log('\nCódigos:', stations.map(s => s.code).join(', '));
  
  console.log('\n📋 Detalle:');
  stations.forEach(s => {
    console.log(`  - ${s.code}: ${s.name}`);
  });
  
  // Verificar si EMPAQUE existe
  const empaque = stations.find(s => s.code === 'EMPAQUE');
  if (empaque) {
    console.log('\n✅ Estación EMPAQUE encontrada!');
  } else {
    console.log('\n❌ Estación EMPAQUE NO encontrada');
  }
  
  // Verificar terminales
  const terminals = await prisma.terminal_devices.findMany({
    where: { 
      tenant_id: '00000000-0000-0000-0000-000000000001',
      role: 'KDS'
    }
  });
  
  console.log('\n🖥️  Terminales KDS:');
  terminals.forEach(t => {
    console.log(`  - ${t.terminal_id}: ${t.device_name}`);
  });
  
  const empaqueTerminal = terminals.find(t => t.terminal_id === 'SPC_EMPAQUE');
  if (empaqueTerminal) {
    console.log('\n✅ Terminal SPC_EMPAQUE encontrado!');
  } else {
    console.log('\n❌ Terminal SPC_EMPAQUE NO encontrado');
  }
}

checkStations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
