import prisma from '../src/core/db/prisma';

async function checkAllStations() {
  const stations = await prisma.stations.findMany({
    orderBy: { code: 'asc' }
  });
  
  console.log('\n📊 TODAS las estaciones en la base de datos:');
  console.log('Total:', stations.length);
  
  console.log('\n📋 Detalle:');
  stations.forEach(s => {
    console.log(`  - ${s.code}: ${s.name} (tenant: ${s.tenant_id})`);
  });
  
  // Verificar si EMPAQUE existe
  const empaque = stations.find(s => s.code === 'EMPAQUE');
  if (empaque) {
    console.log('\n✅ Estación EMPAQUE encontrada!');
    console.log('   Tenant:', empaque.tenant_id);
  } else {
    console.log('\n❌ Estación EMPAQUE NO encontrada');
  }
  
  // Verificar TODOS los terminales
  const terminals = await prisma.terminal_devices.findMany({
    where: { role: 'KDS' }
  });
  
  console.log('\n🖥️  TODOS los Terminales KDS:');
  terminals.forEach(t => {
    console.log(`  - ${t.terminal_id}: ${t.device_name} (tenant: ${t.tenant_id})`);
  });
  
  const empaqueTerminal = terminals.find(t => t.terminal_id === 'SPC_EMPAQUE');
  if (empaqueTerminal) {
    console.log('\n✅ Terminal SPC_EMPAQUE encontrado!');
    console.log('   Tenant:', empaqueTerminal.tenant_id);
  } else {
    console.log('\n❌ Terminal SPC_EMPAQUE NO encontrado');
  }
}

checkAllStations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
