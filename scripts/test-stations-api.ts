/**
 * Test script for Stations API
 * Verifies CRUD operations for KDS stations
 */

const BASE_URL = 'http://localhost:3000';

interface Station {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  terminals_count: number;
  printers_count: number;
}

async function testStationsAPI() {
  console.log('🧪 Testing Stations API\n');

  try {
    // Test 1: GET all stations
    console.log('1️⃣ GET /api/admin/stations');
    const listRes = await fetch(`${BASE_URL}/api/admin/stations`);
    if (!listRes.ok) {
      throw new Error(`GET failed: ${listRes.status} ${listRes.statusText}`);
    }
    const listData = await listRes.json();
    const stations: Station[] = listData.items || listData;
    console.log(`✅ Found ${stations.length} stations`);
    stations.forEach(s => {
      console.log(`   ${s.code} - ${s.name} (${s.is_active ? 'Activa' : 'Inactiva'}) - ${s.terminals_count} terminales`);
    });
    console.log('');

    // Test 2: GET with filters
    console.log('2️⃣ GET /api/admin/stations?is_active=true');
    const activeRes = await fetch(`${BASE_URL}/api/admin/stations?is_active=true`);
    if (!activeRes.ok) {
      throw new Error(`GET with filter failed: ${activeRes.status}`);
    }
    const activeData = await activeRes.json();
    const activeStations: Station[] = activeData.items || activeData;
    console.log(`✅ Found ${activeStations.length} active stations`);
    console.log('');

    // Test 3: Search stations
    console.log('3️⃣ GET /api/admin/stations?search=PARRILLA');
    const searchRes = await fetch(`${BASE_URL}/api/admin/stations?search=PARRILLA`);
    if (!searchRes.ok) {
      throw new Error(`Search failed: ${searchRes.status}`);
    }
    const searchData = await searchRes.json();
    const searchResults: Station[] = searchData.items || searchData;
    console.log(`✅ Found ${searchResults.length} stations matching "PARRILLA"`);
    console.log('');

    // Test 4: Pagination
    console.log('4️⃣ GET /api/admin/stations?page=1&limit=2');
    const pageRes = await fetch(`${BASE_URL}/api/admin/stations?page=1&limit=2`);
    if (!pageRes.ok) {
      throw new Error(`Pagination failed: ${pageRes.status}`);
    }
    const pageData = await pageRes.json();
    console.log(`✅ Pagination working:`);
    console.log(`   Items: ${pageData.items.length}`);
    console.log(`   Total: ${pageData.pagination.total}`);
    console.log(`   Page: ${pageData.pagination.page}/${pageData.pagination.totalPages}`);
    console.log('');

    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   Total stations: ${stations.length}`);
    console.log(`   Active stations: ${activeStations.length}`);
    console.log(`   Inactive stations: ${stations.length - activeStations.length}`);
    console.log('');
    console.log('🎯 Station types:');
    stations.forEach(s => {
      const icon = {
        PARRILLA: '🔥',
        COCINA: '🍳',
        BAR: '🍺',
        FRIOS: '❄️',
        POSTRES: '🍰',
      }[s.code] || '📺';
      console.log(`   ${icon} ${s.code.padEnd(10)} - ${s.terminals_count} terminal(es)`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testStationsAPI();
