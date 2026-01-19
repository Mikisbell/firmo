/**
 * Check zones and tables in database
 */

import prisma from '../src/core/db/prisma';

async function main() {
  try {
    console.log('Checking zones...');
    const zones = await prisma.zones.findMany();
    console.log(`✓ Found ${zones.length} zones`);
    
    console.log('\nChecking tables...');
    const tables = await prisma.tables.findMany({
      include: {
        zones: true,
      },
    });
    console.log(`✓ Found ${tables.length} tables`);
    
    console.log('\nSample data:');
    console.log('Zones:', zones.slice(0, 2));
    console.log('Tables:', tables.slice(0, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
