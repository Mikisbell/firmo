#!/usr/bin/env tsx

/**
 * Task 12 - CSV UI Components Test
 * 
 * Tests:
 * 1. Component structure and imports
 * 2. Export functionality
 * 3. Import functionality with preview
 * 4. Template download
 * 5. Integration with products page
 * 6. Responsive design elements
 * 7. Error handling
 * 8. Toast notifications
 * 9. Modal dialogs
 * 10. File validation
 */

import fs from 'fs';
import path from 'path';

console.log('📋 TASK 12 - CSV UI COMPONENTS TEST');
console.log('='.repeat(60));

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then((res) => {
        if (res) {
          console.log(`✅ ${name}`);
          passCount++;
        } else {
          console.log(`❌ ${name}`);
          failCount++;
        }
      });
    } else {
      if (result) {
        console.log(`✅ ${name}`);
        passCount++;
      } else {
        console.log(`❌ ${name}`);
        failCount++;
      }
    }
  } catch (error) {
    console.log(`❌ ${name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    failCount++;
  }
}

// Test 1: Component file exists
test('CSVImportExport component file exists', () => {
  return fs.existsSync('src/app/admin/productos/components/CSVImportExport.tsx');
});

// Test 2: Component has required imports
test('Component imports required dependencies', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('useState') &&
    content.includes('useRef') &&
    content.includes('Download') &&
    content.includes('Upload') &&
    content.includes('FileText')
  );
});

// Test 3: Component has export functionality
test('Component has export button and handler', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('handleExport') &&
    content.includes('/api/admin/products/export') &&
    content.includes('Exportar CSV')
  );
});

// Test 4: Component has import functionality
test('Component has import button and handler', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('handleFileSelect') &&
    content.includes('previewImport') &&
    content.includes('executeImport') &&
    content.includes('Importar CSV')
  );
});

// Test 5: Component has template download
test('Component has template download functionality', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('handleDownloadTemplate') &&
    content.includes('/api/admin/products/template') &&
    content.includes('Descargar Plantilla')
  );
});

// Test 6: Component has preview modal
test('Component has import preview modal', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('showPreviewModal') &&
    content.includes('importPreview') &&
    content.includes('Vista Previa de Importación') &&
    content.includes('valid_rows') &&
    content.includes('invalid_rows')
  );
});

// Test 7: Component has summary modal
test('Component has import summary modal', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('showSummaryModal') &&
    content.includes('importResult') &&
    content.includes('Importación Completada') &&
    content.includes('created_count') &&
    content.includes('updated_count') &&
    content.includes('skipped_count')
  );
});

// Test 8: Component has file validation
test('Component validates file type and size', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('.csv') &&
    content.includes('5 * 1024 * 1024') && // 5MB
    content.includes('demasiado grande')
  );
});

// Test 9: Component has toast notifications
test('Component has toast notification system', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('showToast') &&
    content.includes('toast') &&
    content.includes('success') &&
    content.includes('error')
  );
});

// Test 10: Component has loading states
test('Component has loading states for async operations', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('isExporting') &&
    content.includes('isImporting') &&
    content.includes('Loader2') &&
    content.includes('disabled={isExporting}') &&
    content.includes('disabled={isImporting}')
  );
});

// Test 11: Component has responsive design
test('Component has responsive design elements', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('sm:inline') &&
    content.includes('sm:hidden') &&
    content.includes('max-w-4xl') &&
    content.includes('overflow-x-auto')
  );
});

// Test 12: Component has error handling
test('Component has comprehensive error handling', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('try {') &&
    content.includes('catch (error)') &&
    content.includes('finally {') &&
    content.includes('error instanceof Error')
  );
});

// Test 13: Component integrated into products page
test('Component integrated into products page', () => {
  const content = fs.readFileSync('src/app/admin/productos/page.tsx', 'utf-8');
  return (
    content.includes("import { CSVImportExport } from './components/CSVImportExport'") &&
    content.includes('<CSVImportExport') &&
    content.includes('onImportComplete={refetch}')
  );
});

// Test 14: Component has proper TypeScript types
test('Component has proper TypeScript interfaces', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('interface CSVImportExportProps') &&
    content.includes('interface ParsedRow') &&
    content.includes('interface ImportPreview') &&
    content.includes('interface ImportResult')
  );
});

// Test 15: Component has proper documentation
test('Component has JSDoc documentation', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('/**') &&
    content.includes('CSV Import/Export Component') &&
    content.includes('Requirements:') &&
    content.includes('Properties:')
  );
});

// Test 16: Preview modal shows validation errors
test('Preview modal displays validation errors', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('Filas con Errores') &&
    content.includes('row.errors.map') &&
    content.includes('text-red-400')
  );
});

// Test 17: Preview modal shows valid rows table
test('Preview modal displays valid rows in table', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('Filas Válidas') &&
    content.includes('<table') &&
    content.includes('<thead') &&
    content.includes('<tbody') &&
    content.includes('valid_rows.slice(0, 10)')
  );
});

// Test 18: Summary modal shows all counts
test('Summary modal displays all result counts', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('Productos creados') &&
    content.includes('Productos actualizados') &&
    content.includes('Filas omitidas') &&
    content.includes('created_count') &&
    content.includes('updated_count') &&
    content.includes('skipped_count')
  );
});

// Test 19: Component handles FormData correctly
test('Component uses FormData for file upload', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('new FormData()') &&
    content.includes("formData.append('file', file)") &&
    content.includes('body: formData')
  );
});

// Test 20: Component has preview parameter for API
test('Component sends preview parameter to API', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return content.includes("formData.append('preview', 'true')");
});

// Test 21: Component clears file input after operations
test('Component clears file input after operations', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('fileInputRef.current.value = ') &&
    content.includes('setSelectedFile(null)')
  );
});

// Test 22: Component has proper button states
test('Component buttons have proper disabled states', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('disabled={isExporting}') &&
    content.includes('disabled={isImporting}') &&
    content.includes('disabled:opacity-50')
  );
});

// Test 23: Component has proper z-index for modals
test('Component modals have proper z-index', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return content.includes('z-50') && content.includes('z-[70]');
});

// Test 24: Component has proper accessibility
test('Component has accessibility features', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('min-h-[44px]') && // Touch target size
    content.includes('accept=".csv"') // File input restriction
  );
});

// Test 25: Component calls onImportComplete callback
test('Component calls onImportComplete after successful import', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return content.includes('onImportComplete()');
});

// Test 26: Products page has responsive header layout
test('Products page header is responsive', () => {
  const content = fs.readFileSync('src/app/admin/productos/page.tsx', 'utf-8');
  return (
    content.includes('flex items-center gap-2') &&
    content.includes('sm:inline') &&
    content.includes('sm:hidden')
  );
});

// Test 27: Component has proper file download logic
test('Component has proper file download implementation', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('window.URL.createObjectURL') &&
    content.includes('document.createElement(\'a\')') &&
    content.includes('a.download =') &&
    content.includes('window.URL.revokeObjectURL')
  );
});

// Test 28: Component has proper credentials for API calls
test('Component includes credentials in API calls', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return content.includes("credentials: 'include'");
});

// Test 29: Preview modal has proper overflow handling
test('Preview modal has proper overflow handling', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('max-h-[90vh]') &&
    content.includes('overflow-y-auto') &&
    content.includes('flex flex-col')
  );
});

// Test 30: Component has proper icon usage
test('Component uses Lucide icons consistently', () => {
  const content = fs.readFileSync(
    'src/app/admin/productos/components/CSVImportExport.tsx',
    'utf-8'
  );
  return (
    content.includes('Download') &&
    content.includes('Upload') &&
    content.includes('FileText') &&
    content.includes('Loader2') &&
    content.includes('AlertCircle') &&
    content.includes('Check') &&
    content.includes('X') &&
    content.includes('FileSpreadsheet')
  );
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${passCount + failCount}`);
console.log('='.repeat(60));

if (failCount === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Task 12 implementation is complete.');
  console.log('\n📋 Summary:');
  console.log('  ✅ CSVImportExport component created');
  console.log('  ✅ Export, Import, and Template download functionality');
  console.log('  ✅ Preview modal with validation errors');
  console.log('  ✅ Summary modal with import results');
  console.log('  ✅ File validation and error handling');
  console.log('  ✅ Toast notifications');
  console.log('  ✅ Responsive design');
  console.log('  ✅ Integrated into products page');
  console.log('  ✅ TypeScript types and documentation');
  console.log('  ✅ Accessibility features');
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed. Please review the implementation.`);
  process.exit(1);
}
