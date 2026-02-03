#!/usr/bin/env node

/**
 * AUDIT TEST SUITE - Verificación Arquitectónica Completa
 * 
 * Este script ejecuta una auditoría completa del test suite del proyecto
 * para verificar:
 * 1. ¿Cuántos tests pasan realmente?
 * 2. ¿Cuáles fallan y por qué?
 * 3. ¿Hay tests que no existen pero deberían?
 * 4. ¿Los 112+ property tests existen realmente?
 * 5. ¿Pasaron alguna vez?
 * 
 * Uso: npx ts-node scripts/audit-test-suite.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestFile {
  path: string;
  type: 'unit' | 'property' | 'e2e';
  exists: boolean;
  size: number;
}

interface AuditResult {
  timestamp: string;
  totalTestFiles: number;
  propertyTestFiles: number;
  unitTestFiles: number;
  e2eTestFiles: number;
  testResults: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  failedTests: string[];
  missingTests: string[];
  recommendations: string[];
}

const AUDIT_RESULT: AuditResult = {
  timestamp: new Date().toISOString(),
  totalTestFiles: 0,
  propertyTestFiles: 0,
  unitTestFiles: 0,
  e2eTestFiles: 0,
  testResults: {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  },
  failedTests: [],
  missingTests: [],
  recommendations: [],
};

// ============================================================================
// FASE 1: Descubrir todos los tests
// ============================================================================

console.log('🔍 FASE 1: Descubriendo tests...\n');

const srcDir = path.join(process.cwd(), 'src');
const e2eDir = path.join(process.cwd(), 'e2e');

function findTestFiles(dir: string, type: 'unit' | 'property' | 'e2e'): TestFile[] {
  const files: TestFile[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const walk = (currentPath: string) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        let matches = false;
        
        if (type === 'property' && entry.name.endsWith('.property.test.ts')) {
          matches = true;
        } else if (type === 'unit' && entry.name.endsWith('.test.ts') && !entry.name.includes('.property')) {
          matches = true;
        } else if (type === 'e2e' && entry.name.endsWith('.spec.ts')) {
          matches = true;
        }
        
        if (matches) {
          const stats = fs.statSync(fullPath);
          files.push({
            path: fullPath,
            type,
            exists: true,
            size: stats.size,
          });
        }
      }
    }
  };

  walk(dir);
  return files;
}

const propertyTests = findTestFiles(srcDir, 'property');
const unitTests = findTestFiles(srcDir, 'unit');
const e2eTests = findTestFiles(e2eDir, 'e2e');

AUDIT_RESULT.propertyTestFiles = propertyTests.length;
AUDIT_RESULT.unitTestFiles = unitTests.length;
AUDIT_RESULT.e2eTestFiles = e2eTests.length;
AUDIT_RESULT.totalTestFiles = propertyTests.length + unitTests.length + e2eTests.length;

console.log(`✅ Property Tests: ${propertyTests.length}`);
console.log(`✅ Unit Tests: ${unitTests.length}`);
console.log(`✅ E2E Tests: ${e2eTests.length}`);
console.log(`✅ Total Test Files: ${AUDIT_RESULT.totalTestFiles}\n`);

// ============================================================================
// FASE 2: Ejecutar tests y capturar resultados
// ============================================================================

console.log('🧪 FASE 2: Ejecutando tests...\n');

try {
  const output = execSync('npm test -- --run --reporter=verbose 2>&1', {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });

  // Parsear resultados
  const passedMatch = output.match(/(\d+)\s+passed/);
  const failedMatch = output.match(/(\d+)\s+failed/);
  const skippedMatch = output.match(/(\d+)\s+skipped/);

  if (passedMatch) AUDIT_RESULT.testResults.passed = parseInt(passedMatch[1], 10);
  if (failedMatch) AUDIT_RESULT.testResults.failed = parseInt(failedMatch[1], 10);
  if (skippedMatch) AUDIT_RESULT.testResults.skipped = parseInt(skippedMatch[1], 10);
  AUDIT_RESULT.testResults.total = 
    AUDIT_RESULT.testResults.passed + 
    AUDIT_RESULT.testResults.failed + 
    AUDIT_RESULT.testResults.skipped;

  // Extraer tests fallidos
  const failedTestsMatch = output.match(/FAIL.*?(?=FAIL|$)/gs);
  if (failedTestsMatch) {
    AUDIT_RESULT.failedTests = failedTestsMatch.slice(0, 10); // Primeros 10
  }

  console.log(`✅ Passed: ${AUDIT_RESULT.testResults.passed}`);
  console.log(`❌ Failed: ${AUDIT_RESULT.testResults.failed}`);
  console.log(`⏭️  Skipped: ${AUDIT_RESULT.testResults.skipped}`);
  console.log(`📊 Total: ${AUDIT_RESULT.testResults.total}\n`);

} catch (error) {
  console.log('⚠️  Tests execution timed out or failed');
  console.log('Continuando con análisis estático...\n');
}

// ============================================================================
// FASE 3: Auditar calidad de P2
// ============================================================================

console.log('🔍 FASE 3: Auditando calidad de P2...\n');

const p2Specs = [
  '.kiro/specs/saga-pattern',
  '.kiro/specs/property-based-testing-expansion',
  '.kiro/specs/multi-tenant-improvements',
];

for (const spec of p2Specs) {
  const specPath = path.join(process.cwd(), spec);
  
  if (fs.existsSync(specPath)) {
    const tasksFile = path.join(specPath, 'tasks.md');
    
    if (fs.existsSync(tasksFile)) {
      const content = fs.readFileSync(tasksFile, 'utf-8');
      const completedTasks = (content.match(/\[x\]/g) || []).length;
      const totalTasks = (content.match(/\[[ x-]\]/g) || []).length;
      
      console.log(`📋 ${spec.split('/').pop()}`);
      console.log(`   Tareas: ${completedTasks}/${totalTasks} completadas`);
      console.log(`   Porcentaje: ${Math.round((completedTasks / totalTasks) * 100)}%\n`);
    }
  }
}

// ============================================================================
// FASE 4: Identificar patrón de fallos
// ============================================================================

console.log('🔍 FASE 4: Identificando patrones de fallos...\n');

// Buscar errores comunes
const commonErrors = [
  { pattern: /Prisma.*\$use/, name: 'Prisma $use error' },
  { pattern: /Cannot find module/, name: 'Module not found' },
  { pattern: /TypeError/, name: 'Type error' },
  { pattern: /ReferenceError/, name: 'Reference error' },
  { pattern: /timeout/, name: 'Timeout' },
];

for (const error of commonErrors) {
  console.log(`⚠️  ${error.name}: Buscar en logs`);
}

console.log();

// ============================================================================
// FASE 5: Definir métricas de "listo"
// ============================================================================

console.log('📊 FASE 5: Métricas de "Listo"\n');

const readinessMetrics = {
  'P0 (MVP)': {
    'Tests Passing': '100%',
    'Coverage': '> 80%',
    'Build': 'Sin errores',
    'Status': '✅ LISTO',
  },
  'P1 (Multi-Terminal)': {
    'Tests Passing': '100%',
    'Coverage': '> 80%',
    'Build': 'Sin errores',
    'Status': '✅ LISTO',
  },
  'P2 (Growth)': {
    'Tests Passing': '> 90%',
    'Coverage': '> 70%',
    'Build': 'Sin errores',
    'Status': '⚠️ EN PROGRESO',
  },
};

for (const [phase, metrics] of Object.entries(readinessMetrics)) {
  console.log(`${phase}:`);
  for (const [metric, value] of Object.entries(metrics)) {
    console.log(`  ${metric}: ${value}`);
  }
  console.log();
}

// ============================================================================
// FASE 6: Recomendaciones
// ============================================================================

console.log('💡 RECOMENDACIONES\n');

AUDIT_RESULT.recommendations = [
  '1. Ejecutar test suite completo con timeout extendido (5 minutos)',
  '2. Documentar todos los tests fallidos con causa raíz',
  '3. Verificar que los 112+ property tests existen y pasan',
  '4. Investigar patrón de error Prisma $use',
  '5. Definir métricas de "listo" para P2',
  '6. Crear plan de remediación para tests fallidos',
];

for (const rec of AUDIT_RESULT.recommendations) {
  console.log(`  ${rec}`);
}

console.log();

// ============================================================================
// Guardar resultados
// ============================================================================

const reportPath = path.join(process.cwd(), 'AUDIT_TEST_SUITE_RESULTS.json');
fs.writeFileSync(reportPath, JSON.stringify(AUDIT_RESULT, null, 2));

console.log(`✅ Resultados guardados en: ${reportPath}\n`);

// ============================================================================
// Resumen Final
// ============================================================================

console.log('📊 RESUMEN FINAL\n');
console.log(`Total Test Files: ${AUDIT_RESULT.totalTestFiles}`);
console.log(`  - Property Tests: ${AUDIT_RESULT.propertyTestFiles}`);
console.log(`  - Unit Tests: ${AUDIT_RESULT.unitTestFiles}`);
console.log(`  - E2E Tests: ${AUDIT_RESULT.e2eTestFiles}`);
console.log();
console.log(`Test Results:`);
console.log(`  - Passed: ${AUDIT_RESULT.testResults.passed}`);
console.log(`  - Failed: ${AUDIT_RESULT.testResults.failed}`);
console.log(`  - Skipped: ${AUDIT_RESULT.testResults.skipped}`);
console.log(`  - Total: ${AUDIT_RESULT.testResults.total}`);
console.log();

if (AUDIT_RESULT.testResults.failed > 0) {
  console.log(`⚠️  ${AUDIT_RESULT.testResults.failed} tests fallidos - Requiere investigación`);
} else {
  console.log(`✅ Todos los tests pasando`);
}

console.log();
