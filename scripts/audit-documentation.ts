/**
 * Script de Auditoría de Documentación PARK POS
 * 
 * Escanea todos los specs y documentación para generar un inventario completo
 * con categorización por fase, tipo y estado.
 */

import * as fs from 'fs';
import * as path from 'path';

interface DocumentMetadata {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
  type: 'requirements' | 'design' | 'tasks' | 'implementation' | 'analysis' | 'summary' | 'fix' | 'other';
}

interface SpecInventory {
  name: string;
  path: string;
  phase: 'P0' | 'P1' | 'P2' | 'P3' | 'unknown';
  status: 'completado' | 'en-progreso' | 'planificado';
  documents: DocumentMetadata[];
  totalDocuments: number;
  hasRequirements: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
}

interface AuditResult {
  totalSpecs: number;
  totalDocuments: number;
  specsByPhase: Record<string, number>;
  specsByStatus: Record<string, number>;
  documentsByType: Record<string, number>;
  specs: SpecInventory[];
  docsInventory: {
    vision: string[];
    architecture: string[];
    features: string[];
    operations: string[];
    improvements: string[];
    deployment: string[];
    adr: string[];
  };
}

/**
 * Determinar el tipo de documento basado en su nombre
 */
function getDocumentType(filename: string): DocumentMetadata['type'] {
  const lower = filename.toLowerCase();
  
  if (lower === 'requirements.md') return 'requirements';
  if (lower === 'design.md') return 'design';
  if (lower === 'tasks.md') return 'tasks';
  if (lower.includes('implementation') || lower.includes('complete')) return 'implementation';
  if (lower.includes('analisis') || lower.includes('analysis') || lower.includes('audit')) return 'analysis';
  if (lower.includes('resumen') || lower.includes('summary')) return 'summary';
  if (lower.includes('fix')) return 'fix';
  
  return 'other';
}

/**
 * Determinar la fase del spec basado en su nombre y contenido
 */
function determinePhase(specName: string): SpecInventory['phase'] {
  // P0 - MVP
  const p0Specs = [
    'admin-panel',
    'admin-panel-crud',
    'admin-panel-location-fix',
    'event-sourcing-critical-fixes',
    'schema-completeness',
    'kds-order-submission-fix',
    'waiter-module'
  ];
  
  // P1 - Multi-Terminal
  const p1Specs = [
    'conflict-resolution',
    'event-schema-versioning',
    'branded-types-migration',
    'security-multi-factor',
    'system-consolidation-phase1',
    'playwright-e2e-improvements',
    'playwright-e2e-optimization',
    'playwright-e2e-fixes-feb-2026'
  ];
  
  // P2 - Growth
  const p2Specs = [
    'premium-dashboard',
    'delivery-module',
    'delivery-2026-modernization',
    'react-cache-optimization',
    'multi-tenant-improvements',
    'saga-pattern',
    'property-based-testing-expansion',
    'inventory-ui',
    'products-p1-improvements',
    'performance-optimization-vercel-best-practices',
    'realtime-eventbus-supabase'
  ];
  
  // P3 - Enterprise
  const p3Specs = [
    'enterprise-upgrade',
    'terminal-architecture-v2',
    'database-integrity',
    'frontend-cleanup',
    'mobile-responsive',
    'flujos-faltantes',
    'admin-panel-ux-improvements'
  ];
  
  if (p0Specs.includes(specName)) return 'P0';
  if (p1Specs.includes(specName)) return 'P1';
  if (p2Specs.includes(specName)) return 'P2';
  if (p3Specs.includes(specName)) return 'P3';
  
  return 'unknown';
}

/**
 * Determinar el estado del spec basado en sus documentos
 */
function determineStatus(documents: DocumentMetadata[]): SpecInventory['status'] {
  const hasComplete = documents.some(d => 
    d.name.toLowerCase().includes('complete') || 
    d.name.toLowerCase().includes('completada')
  );
  
  const hasImplementation = documents.some(d => d.type === 'implementation');
  
  if (hasComplete || hasImplementation) return 'completado';
  if (documents.length > 3) return 'en-progreso';
  
  return 'planificado';
}

/**
 * Escanear un directorio de spec
 */
function scanSpec(specPath: string, specName: string): SpecInventory {
  const documents: DocumentMetadata[] = [];
  
  try {
    const files = fs.readdirSync(specPath);
    
    for (const file of files) {
      const filePath = path.join(specPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && file.endsWith('.md')) {
        documents.push({
          path: filePath,
          name: file,
          size: stats.size,
          lastModified: stats.mtime,
          type: getDocumentType(file)
        });
      }
    }
  } catch (error) {
    console.error(`Error escaneando spec ${specName}:`, error);
  }
  
  const phase = determinePhase(specName);
  const status = determineStatus(documents);
  
  return {
    name: specName,
    path: specPath,
    phase,
    status,
    documents,
    totalDocuments: documents.length,
    hasRequirements: documents.some(d => d.type === 'requirements'),
    hasDesign: documents.some(d => d.type === 'design'),
    hasTasks: documents.some(d => d.type === 'tasks')
  };
}

/**
 * Escanear directorio de documentación
 */
function scanDocsDirectory(dirPath: string): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isFile() && item.endsWith('.md')) {
        files.push(item);
      }
    }
  } catch (error) {
    console.error(`Error escaneando directorio ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * Ejecutar auditoría completa
 */
async function auditDocumentation(): Promise<AuditResult> {
  console.log('🔍 Iniciando auditoría de documentación...\n');
  
  const specsDir = '.kiro/specs';
  const specs: SpecInventory[] = [];
  
  // Escanear todos los specs
  const specDirs = fs.readdirSync(specsDir);
  
  for (const specName of specDirs) {
    const specPath = path.join(specsDir, specName);
    const stats = fs.statSync(specPath);
    
    if (stats.isDirectory()) {
      console.log(`  Escaneando spec: ${specName}`);
      const spec = scanSpec(specPath, specName);
      specs.push(spec);
    }
  }
  
  // Escanear documentación principal
  console.log('\n📚 Escaneando documentación principal...');
  const docsInventory = {
    vision: scanDocsDirectory('docs/01-vision'),
    architecture: scanDocsDirectory('docs/02-architecture'),
    features: scanDocsDirectory('docs/03-features'),
    operations: scanDocsDirectory('docs/04-operations'),
    improvements: scanDocsDirectory('docs/05-improvements'),
    deployment: scanDocsDirectory('docs/06-deployment'),
    adr: scanDocsDirectory('docs/adr')
  };
  
  // Calcular métricas
  const totalDocuments = specs.reduce((sum, spec) => sum + spec.totalDocuments, 0);
  
  const specsByPhase = specs.reduce((acc, spec) => {
    acc[spec.phase] = (acc[spec.phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const specsByStatus = specs.reduce((acc, spec) => {
    acc[spec.status] = (acc[spec.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const documentsByType = specs.flatMap(s => s.documents).reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalSpecs: specs.length,
    totalDocuments,
    specsByPhase,
    specsByStatus,
    documentsByType,
    specs,
    docsInventory
  };
}

/**
 * Generar reporte en Markdown
 */
function generateReport(result: AuditResult): string {
  let report = `# 📊 Inventario Completo de Documentación PARK POS\n\n`;
  report += `**Fecha de auditoría:** ${new Date().toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}\n\n`;
  report += `---\n\n`;
  
  // Resumen ejecutivo
  report += `## 📈 Resumen Ejecutivo\n\n`;
  report += `| Métrica | Cantidad |\n`;
  report += `|---------|----------|\n`;
  report += `| Total de Specs | ${result.totalSpecs} |\n`;
  report += `| Total de Documentos | ${result.totalDocuments} |\n`;
  report += `| Specs P0 (MVP) | ${result.specsByPhase.P0 || 0} |\n`;
  report += `| Specs P1 (Multi-Terminal) | ${result.specsByPhase.P1 || 0} |\n`;
  report += `| Specs P2 (Growth) | ${result.specsByPhase.P2 || 0} |\n`;
  report += `| Specs P3 (Enterprise) | ${result.specsByPhase.P3 || 0} |\n`;
  report += `| Specs Completados | ${result.specsByStatus.completado || 0} |\n`;
  report += `| Specs En Progreso | ${result.specsByStatus['en-progreso'] || 0} |\n`;
  report += `| Specs Planificados | ${result.specsByStatus.planificado || 0} |\n\n`;
  
  // Documentos por tipo
  report += `## 📄 Documentos por Tipo\n\n`;
  report += `| Tipo | Cantidad |\n`;
  report += `|------|----------|\n`;
  for (const [type, count] of Object.entries(result.documentsByType)) {
    report += `| ${type} | ${count} |\n`;
  }
  report += `\n`;
  
  // Specs por fase
  report += `## 🗂️ Specs por Fase\n\n`;
  
  for (const phase of ['P0', 'P1', 'P2', 'P3']) {
    const phaseSpecs = result.specs.filter(s => s.phase === phase);
    if (phaseSpecs.length === 0) continue;
    
    const phaseName = {
      P0: 'MVP',
      P1: 'Multi-Terminal',
      P2: 'Growth',
      P3: 'Enterprise'
    }[phase];
    
    report += `### ${phase} - ${phaseName} (${phaseSpecs.length} specs)\n\n`;
    
    for (const spec of phaseSpecs) {
      const statusIcon = {
        completado: '✅',
        'en-progreso': '🟡',
        planificado: '⬜'
      }[spec.status];
      
      report += `#### ${statusIcon} ${spec.name}\n\n`;
      report += `- **Estado:** ${spec.status}\n`;
      report += `- **Documentos:** ${spec.totalDocuments}\n`;
      report += `- **Requirements:** ${spec.hasRequirements ? '✅' : '❌'}\n`;
      report += `- **Design:** ${spec.hasDesign ? '✅' : '❌'}\n`;
      report += `- **Tasks:** ${spec.hasTasks ? '✅' : '❌'}\n`;
      report += `- **Ubicación:** \`${spec.path}\`\n\n`;
      
      if (spec.documents.length > 0) {
        report += `**Documentos:**\n`;
        for (const doc of spec.documents.sort((a, b) => a.name.localeCompare(b.name))) {
          report += `- \`${doc.name}\` (${(doc.size / 1024).toFixed(1)} KB)\n`;
        }
        report += `\n`;
      }
    }
  }
  
  // Documentación principal
  report += `## 📚 Documentación Principal\n\n`;
  
  const sections = [
    { key: 'vision', name: 'Visión', path: 'docs/01-vision/' },
    { key: 'architecture', name: 'Arquitectura', path: 'docs/02-architecture/' },
    { key: 'features', name: 'Features', path: 'docs/03-features/' },
    { key: 'operations', name: 'Operaciones', path: 'docs/04-operations/' },
    { key: 'improvements', name: 'Mejoras', path: 'docs/05-improvements/' },
    { key: 'deployment', name: 'Despliegue', path: 'docs/06-deployment/' },
    { key: 'adr', name: 'ADRs', path: 'docs/adr/' }
  ];
  
  for (const section of sections) {
    const docs = result.docsInventory[section.key as keyof typeof result.docsInventory];
    report += `### ${section.name} (${docs.length} documentos)\n\n`;
    report += `**Ubicación:** \`${section.path}\`\n\n`;
    
    if (docs.length > 0) {
      for (const doc of docs.sort()) {
        report += `- \`${doc}\`\n`;
      }
      report += `\n`;
    }
  }
  
  report += `---\n\n`;
  report += `**Generado por:** Script de Auditoría de Documentación\n`;
  report += `**Versión:** 1.0.0\n`;
  
  return report;
}

/**
 * Main
 */
async function main() {
  try {
    const result = await auditDocumentation();
    const report = generateReport(result);
    
    // Guardar reporte
    const outputPath = '.kiro/specs/auditoria-documentacion-profesional/INVENTARIO_SPECS.md';
    fs.writeFileSync(outputPath, report, 'utf-8');
    
    console.log(`\n✅ Auditoría completada exitosamente!`);
    console.log(`📄 Reporte guardado en: ${outputPath}`);
    console.log(`\n📊 Resumen:`);
    console.log(`   - Total de specs: ${result.totalSpecs}`);
    console.log(`   - Total de documentos: ${result.totalDocuments}`);
    console.log(`   - Specs completados: ${result.specsByStatus.completado || 0}`);
    console.log(`   - Specs en progreso: ${result.specsByStatus['en-progreso'] || 0}`);
    console.log(`   - Specs planificados: ${result.specsByStatus.planificado || 0}`);
  } catch (error) {
    console.error('❌ Error durante la auditoría:', error);
    process.exit(1);
  }
}

main();
