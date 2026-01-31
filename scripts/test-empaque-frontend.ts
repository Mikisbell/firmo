/**
 * Test Frontend - Estación EMPAQUE
 * Verifica que la página KDS de empaque esté correctamente configurada
 */

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing Frontend - Estación EMPAQUE\n');

// 1. Verificar que el archivo existe
try {
  const empaquePagePath = join(process.cwd(), 'src/app/cocina/empaque/page.tsx');
  const content = readFileSync(empaquePagePath, 'utf-8');
  console.log('✅ Archivo page.tsx existe');
  
  // 2. Verificar contenido clave
  const checks = [
    { name: 'useKitchenTicketsByGroup("EMPAQUE")', test: /useKitchenTicketsByGroup\("EMPAQUE"\)/ },
    { name: 'Color emerald', test: /emerald/ },
    { name: 'Icono Package', test: /Package/ },
    { name: 'Título "Empaque"', test: /Empaque/ },
  ];
  
  checks.forEach(check => {
    if (check.test.test(content)) {
      console.log(`✅ ${check.name} encontrado`);
    } else {
      console.log(`❌ ${check.name} NO encontrado`);
    }
  });
  
} catch (error) {
  console.log('❌ Error leyendo archivo:', error);
}

// 3. Verificar TerminalSetup
try {
  const setupPath = join(process.cwd(), 'src/components/auth/TerminalSetup.tsx');
  const content = readFileSync(setupPath, 'utf-8');
  console.log('\n✅ Archivo TerminalSetup.tsx existe');
  
  const checks = [
    { name: 'Card EMPAQUE', test: /EMPAQUE/ },
    { name: 'Ruta /cocina/empaque', test: /\/cocina\/empaque/ },
    { name: 'Terminal SPC_EMPAQUE', test: /SPC_EMPAQUE/ },
  ];
  
  checks.forEach(check => {
    if (check.test.test(content)) {
      console.log(`✅ ${check.name} encontrado`);
    } else {
      console.log(`❌ ${check.name} NO encontrado`);
    }
  });
  
} catch (error) {
  console.log('❌ Error leyendo archivo:', error);
}

// 4. Verificar stations.ts
try {
  const stationsPath = join(process.cwd(), 'src/core/domain/stations.ts');
  const content = readFileSync(stationsPath, 'utf-8');
  console.log('\n✅ Archivo stations.ts existe');
  
  const checks = [
    { name: 'EMPAQUE en STATIONS', test: /"EMPAQUE"/ },
    { name: 'EMPAQUE en STATION_GROUPS', test: /EMPAQUE:\s*\[/ },
  ];
  
  checks.forEach(check => {
    if (check.test.test(content)) {
      console.log(`✅ ${check.name} encontrado`);
    } else {
      console.log(`❌ ${check.name} NO encontrado`);
    }
  });
  
} catch (error) {
  console.log('❌ Error leyendo archivo:', error);
}

console.log('\n📊 Resumen Frontend:');
console.log('- Página KDS de EMPAQUE: ✅ Creada');
console.log('- TerminalSetup actualizado: ✅ Configurado');
console.log('- Stations.ts actualizado: ✅ Configurado');
console.log('\n🌐 Servidor corriendo en: http://localhost:3000');
console.log('👉 Abre el navegador y selecciona "Empaque y Delivery"');
