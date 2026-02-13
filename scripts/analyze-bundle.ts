#!/usr/bin/env ts-node

/**
 * Script de Análisis de Bundle
 * 
 * Analiza el tamaño del bundle de Next.js y verifica que lucide-react
 * usa tree-shaking efectivo (< 50KB).
 * 
 * Uso:
 *   npm run build
 *   node scripts/analyze-bundle.ts
 * 
 * @module scripts/analyze-bundle
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BundleStats {
  totalSize: number;
  lucideReactSize: number;
  otherPackagesSize: number;
}

interface ModuleInfo {
  name: string;
  size: number;
}

/**
 * Analiza el tamaño del bundle después del build
 * 
 * @returns Estadísticas del bundle
 * @throws Error si no se encuentra el build
 */
function analyzeBundleSize(): BundleStats {
  console.log('📦 Analizando bundle de Next.js...\n');
  
  // Verificar que existe el directorio .next
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    throw new Error('❌ Directorio .next no encontrado. Ejecuta "npm run build" primero.');
  }
  
  // Buscar archivos de bundle en .next/static/chunks
  const chunksDir = path.join(nextDir, 'static', 'chunks');
  if (!fs.existsSync(chunksDir)) {
    throw new Error('❌ Directorio de chunks no encontrado.');
  }
  
  // Analizar todos los archivos .js en chunks
  const chunkFiles = fs.readdirSync(chunksDir)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(chunksDir, file));
  
  let totalSize = 0;
  let lucideReactSize = 0;
  const lucideModules: ModuleInfo[] = [];
  
  // Analizar cada chunk
  for (const chunkFile of chunkFiles) {
    const stats = fs.statSync(chunkFile);
    const fileSize = stats.size;
    totalSize += fileSize;
    
    // Leer contenido del chunk para buscar lucide-react
    const content = fs.readFileSync(chunkFile, 'utf-8');
    
    // Buscar referencias a lucide-react
    // Los módulos de lucide-react suelen aparecer como:
    // - "lucide-react"
    // - "node_modules/lucide-react"
    // - imports de iconos específicos
    if (content.includes('lucide-react')) {
      // Estimar tamaño de lucide-react en este chunk
      // Método simple: si el chunk contiene lucide-react, contar su tamaño
      const lucideMatches = content.match(/lucide-react/g);
      if (lucideMatches && lucideMatches.length > 0) {
        lucideReactSize += fileSize;
        lucideModules.push({
          name: path.basename(chunkFile),
          size: fileSize,
        });
      }
    }
  }
  
  // También analizar el directorio pages si existe
  const pagesDir = path.join(nextDir, 'static', 'chunks', 'pages');
  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs.readdirSync(pagesDir)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(pagesDir, file));
    
    for (const pageFile of pageFiles) {
      const stats = fs.statSync(pageFile);
      const fileSize = stats.size;
      totalSize += fileSize;
      
      const content = fs.readFileSync(pageFile, 'utf-8');
      if (content.includes('lucide-react')) {
        const lucideMatches = content.match(/lucide-react/g);
        if (lucideMatches && lucideMatches.length > 0) {
          lucideReactSize += fileSize;
          lucideModules.push({
            name: path.basename(pageFile),
            size: fileSize,
          });
        }
      }
    }
  }
  
  return {
    totalSize,
    lucideReactSize,
    otherPackagesSize: totalSize - lucideReactSize,
  };
}

/**
 * Formatea bytes a formato legible (KB, MB)
 * 
 * @param bytes - Número de bytes
 * @returns String formateado
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Busca archivos con barrel imports de lucide-react
 * 
 * @returns Lista de archivos con barrel imports
 */
function findBarrelImports(): string[] {
  console.log('\n🔍 Buscando barrel imports de lucide-react...\n');
  
  try {
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) {
      return [];
    }
    
    const files: string[] = [];
    
    // Buscar recursivamente archivos .ts y .tsx
    function searchDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Ignorar node_modules y .next
          if (entry.name !== 'node_modules' && entry.name !== '.next') {
            searchDirectory(fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          // Leer archivo y buscar barrel imports
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Buscar imports del tipo: import { Icon } from 'lucide-react'
          // En lugar de: import { Icon } from 'lucide-react/dist/esm/icons/icon'
          const barrelImportRegex = /from\s+['"]lucide-react['"]/;
          
          if (barrelImportRegex.test(content)) {
            files.push(fullPath.replace(process.cwd() + path.sep, ''));
          }
        }
      }
    }
    
    searchDirectory(srcDir);
    return files;
  } catch (error) {
    console.warn('⚠️  Error al buscar barrel imports:', error);
    return [];
  }
}

/**
 * Función principal
 */
function main() {
  try {
    // Analizar bundle
    const stats = analyzeBundleSize();
    
    // Mostrar resultados
    console.log('📊 Resultados del Análisis de Bundle:');
    console.log('─────────────────────────────────────────');
    console.log(`Tamaño Total:     ${formatBytes(stats.totalSize)}`);
    console.log(`lucide-react:     ${formatBytes(stats.lucideReactSize)}`);
    console.log(`Otros Paquetes:   ${formatBytes(stats.otherPackagesSize)}`);
    console.log('─────────────────────────────────────────');
    
    // Calcular porcentaje
    const lucidePercent = (stats.lucideReactSize / stats.totalSize * 100).toFixed(2);
    console.log(`\nlucide-react representa el ${lucidePercent}% del bundle total`);
    
    // Verificar límite de 50KB
    const limitKB = 50;
    const limitBytes = limitKB * 1024;
    
    if (stats.lucideReactSize > limitBytes) {
      console.error(`\n❌ FALLO: lucide-react (${formatBytes(stats.lucideReactSize)}) excede el límite de ${limitKB}KB`);
      console.error('\nPosibles causas:');
      console.error('  1. Barrel imports en lugar de named imports');
      console.error('  2. optimizePackageImports no configurado en next.config.js');
      console.error('  3. Imports de iconos no utilizados');
      
      // Buscar barrel imports
      const barrelImports = findBarrelImports();
      if (barrelImports.length > 0) {
        console.error(`\n📁 Archivos con barrel imports encontrados (${barrelImports.length}):`);
        barrelImports.slice(0, 10).forEach(file => {
          console.error(`  - ${file}`);
        });
        if (barrelImports.length > 10) {
          console.error(`  ... y ${barrelImports.length - 10} más`);
        }
        console.error('\n💡 Solución: Reemplazar barrel imports con named imports específicos');
      }
      
      process.exit(1);
    } else {
      console.log(`\n✅ ÉXITO: lucide-react (${formatBytes(stats.lucideReactSize)}) está dentro del límite de ${limitKB}KB`);
      
      // Calcular reducción vs baseline (350KB según auditoría)
      const baselineKB = 350;
      const baselineBytes = baselineKB * 1024;
      const reduction = baselineBytes - stats.lucideReactSize;
      const reductionPercent = (reduction / baselineBytes * 100).toFixed(2);
      
      if (reduction > 0) {
        console.log(`\n🎉 Reducción de ${formatBytes(reduction)} (${reductionPercent}%) vs baseline de ${baselineKB}KB`);
      }
      
      // Buscar barrel imports como advertencia
      const barrelImports = findBarrelImports();
      if (barrelImports.length > 0) {
        console.warn(`\n⚠️  Advertencia: Se encontraron ${barrelImports.length} archivos con barrel imports`);
        console.warn('   Aunque el bundle cumple el límite, considera migrar a named imports para mejor tree-shaking');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error al analizar bundle:', error);
    process.exit(1);
  }
}

// Ejecutar script
main();
