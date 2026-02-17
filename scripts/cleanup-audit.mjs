#!/usr/bin/env node
/**
 * Script de auditoría para Fase 4: Limpieza
 * Identifica documentos obsoletos, duplicados y fragmentados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Resultados
const results = {
  obsoletos: [],
  duplicados: [],
  fragmentados: [],
  sinMetadata: [],
  nombresIncorrectos: []
};

// Función para leer archivos recursivamente
function readDirRecursive(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules, .next, .git
      if (!['node_modules', '.next', '.git', 'backup'].includes(file)) {
        readDirRecursive(filePath, fileList);
      }
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Función para detectar documentos obsoletos
function detectObsoletos(files) {
  const keywords = ['deprecated', 'obsoleto', 'old', 'legacy', 'archived'];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8').toLowerCase();
    const fileName = path.basename(file).toLowerCase();
    
    // Buscar keywords en nombre o contenido
    const hasKeyword = keywords.some(kw => 
      fileName.includes(kw) || content.includes(kw)
    );
    
    if (hasKeyword) {
      results.obsoletos.push({
        file: path.relative(rootDir, file),
        reason: 'Contiene keywords de obsoleto'
      });
    }
  });
}

// Función para detectar duplicados (nombres similares)
function detectDuplicados(files) {
  const fileNames = {};
  
  files.forEach(file => {
    const baseName = path.basename(file, '.md').toLowerCase();
    const normalizedName = baseName
      .replace(/[-_]/g, '')
      .replace(/\d+/g, ''); // Remover números
    
    if (!fileNames[normalizedName]) {
      fileNames[normalizedName] = [];
    }
    fileNames[normalizedName].push(file);
  });
  
  // Encontrar grupos con más de 1 archivo
  Object.entries(fileNames).forEach(([name, files]) => {
    if (files.length > 1) {
      results.duplicados.push({
        name,
        files: files.map(f => path.relative(rootDir, f)),
        count: files.length
      });
    }
  });
}

// Función para detectar documentos sin metadata
function detectSinMetadata(files) {
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    // Verificar si tiene front matter YAML
    const hasFrontMatter = lines[0] === '---' && lines.slice(1).some(l => l === '---');
    
    // Verificar si tiene metadata básica (Fecha, Estado, etc.)
    const hasBasicMetadata = content.includes('**Fecha:**') || 
                            content.includes('**Estado:**') ||
                            content.includes('**Última actualización:**');
    
    if (!hasFrontMatter && !hasBasicMetadata) {
      results.sinMetadata.push(path.relative(rootDir, file));
    }
  });
}

// Función para detectar nombres incorrectos
function detectNombresIncorrectos(files) {
  const conventions = {
    specs: /^[a-z0-9-]+$/,  // kebab-case
    docs: /^[A-Z_]+\.md$/   // UPPER_CASE.md
  };
  
  files.forEach(file => {
    const fileName = path.basename(file, '.md');
    const relativePath = path.relative(rootDir, file);
    
    // Verificar convenciones según ubicación
    if (relativePath.includes('.kiro/specs/')) {
      // Specs deben usar kebab-case
      if (!conventions.specs.test(fileName) && fileName !== 'README') {
        results.nombresIncorrectos.push({
          file: relativePath,
          reason: 'Debe usar kebab-case',
          suggestion: fileName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        });
      }
    }
  });
}

// Ejecutar auditoría
console.log('🔍 Iniciando auditoría de limpieza...\n');

const allFiles = readDirRecursive(rootDir);
console.log(`📄 Total de archivos .md encontrados: ${allFiles.length}\n`);

console.log('1️⃣ Detectando documentos obsoletos...');
detectObsoletos(allFiles);
console.log(`   ✅ Encontrados: ${results.obsoletos.length}\n`);

console.log('2️⃣ Detectando duplicados...');
detectDuplicados(allFiles);
console.log(`   ✅ Encontrados: ${results.duplicados.length} grupos\n`);

console.log('3️⃣ Detectando documentos sin metadata...');
detectSinMetadata(allFiles);
console.log(`   ✅ Encontrados: ${results.sinMetadata.length}\n`);

console.log('4️⃣ Detectando nombres incorrectos...');
detectNombresIncorrectos(allFiles);
console.log(`   ✅ Encontrados: ${results.nombresIncorrectos.length}\n`);

// Guardar resultados
const outputPath = path.join(rootDir, '.kiro/specs/auditoria-documentacion-profesional/FASE4_LIMPIEZA_AUDIT.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

console.log(`\n✅ Auditoría completada. Resultados guardados en:`);
console.log(`   ${path.relative(rootDir, outputPath)}\n`);

// Resumen
console.log('📊 RESUMEN:');
console.log(`   • Obsoletos: ${results.obsoletos.length}`);
console.log(`   • Duplicados: ${results.duplicados.length} grupos`);
console.log(`   • Sin metadata: ${results.sinMetadata.length}`);
console.log(`   • Nombres incorrectos: ${results.nombresIncorrectos.length}`);
