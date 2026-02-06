#!/usr/bin/env tsx
/**
 * Verification Script: Code Splitting
 * 
 * This script verifies that Next.js is generating proper route-based chunks
 * and that code splitting is working as expected.
 * 
 * Run: npx tsx scripts/verify-code-splitting.ts
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';

interface ChunkInfo {
  name: string;
  size: number;
  path: string;
}

interface VerificationResult {
  success: boolean;
  totalChunks: number;
  routeChunks: ChunkInfo[];
  vendorChunks: ChunkInfo[];
  commonChunks: ChunkInfo[];
  largestChunk: ChunkInfo | null;
  totalSize: number;
  issues: string[];
}

/**
 * Recursively find all JavaScript chunk files in a directory
 */
async function findChunks(dir: string, chunks: ChunkInfo[] = []): Promise<ChunkInfo[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await findChunks(fullPath, chunks);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const stats = await stat(fullPath);
        chunks.push({
          name: entry.name,
          size: stats.size,
          path: fullPath,
        });
      }
    }
  } catch (error) {
    // Directory might not exist yet (before build)
    console.warn(`Warning: Could not read directory ${dir}`);
  }
  
  return chunks;
}

/**
 * Categorize chunks by type
 */
function categorizeChunks(chunks: ChunkInfo[]): {
  routeChunks: ChunkInfo[];
  vendorChunks: ChunkInfo[];
  commonChunks: ChunkInfo[];
} {
  const routeChunks: ChunkInfo[] = [];
  const vendorChunks: ChunkInfo[] = [];
  const commonChunks: ChunkInfo[] = [];
  
  for (const chunk of chunks) {
    if (chunk.name.includes('vendors') || chunk.name.includes('ui-libs')) {
      vendorChunks.push(chunk);
    } else if (chunk.name.includes('common')) {
      commonChunks.push(chunk);
    } else if (
      chunk.name.includes('admin') ||
      chunk.name.includes('caja') ||
      chunk.name.includes('mozo') ||
      chunk.name.includes('cocina') ||
      chunk.name.includes('bar') ||
      chunk.name.includes('delivery')
    ) {
      routeChunks.push(chunk);
    }
  }
  
  return { routeChunks, vendorChunks, commonChunks };
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Verify code splitting configuration
 */
async function verifyCodeSplitting(): Promise<VerificationResult> {
  const result: VerificationResult = {
    success: true,
    totalChunks: 0,
    routeChunks: [],
    vendorChunks: [],
    commonChunks: [],
    largestChunk: null,
    totalSize: 0,
    issues: [],
  };
  
  console.log('🔍 Verifying code splitting configuration...\n');
  
  // Check if build directory exists
  const buildDir = join(process.cwd(), '.next');
  try {
    await stat(buildDir);
  } catch {
    result.success = false;
    result.issues.push('Build directory (.next) not found. Run "npm run build" first.');
    return result;
  }
  
  // Find all chunks
  const staticDir = join(buildDir, 'static', 'chunks');
  const allChunks = await findChunks(staticDir);
  
  if (allChunks.length === 0) {
    result.success = false;
    result.issues.push('No chunks found. Build may have failed.');
    return result;
  }
  
  // Categorize chunks
  const { routeChunks, vendorChunks, commonChunks } = categorizeChunks(allChunks);
  
  result.totalChunks = allChunks.length;
  result.routeChunks = routeChunks;
  result.vendorChunks = vendorChunks;
  result.commonChunks = commonChunks;
  result.totalSize = allChunks.reduce((sum, chunk) => sum + chunk.size, 0);
  
  // Find largest chunk
  result.largestChunk = allChunks.reduce((largest, chunk) => 
    chunk.size > (largest?.size || 0) ? chunk : largest
  , null as ChunkInfo | null);
  
  // Verify vendor chunks exist
  if (vendorChunks.length === 0) {
    result.issues.push('No vendor chunks found. Vendor code splitting may not be working.');
  }
  
  // Verify route chunks exist
  if (routeChunks.length === 0) {
    result.issues.push('No route-specific chunks found. Route-based code splitting may not be working.');
  }
  
  // Check for chunks exceeding budget (150KB as per requirements)
  const CHUNK_SIZE_LIMIT = 150 * 1024; // 150KB
  const oversizedChunks = allChunks.filter(chunk => chunk.size > CHUNK_SIZE_LIMIT);
  if (oversizedChunks.length > 0) {
    result.issues.push(
      `${oversizedChunks.length} chunk(s) exceed 150KB limit: ${
        oversizedChunks.map(c => `${c.name} (${formatBytes(c.size)})`).join(', ')
      }`
    );
  }
  
  result.success = result.issues.length === 0;
  
  return result;
}

/**
 * Print verification results
 */
function printResults(result: VerificationResult): void {
  console.log('📊 Code Splitting Verification Results\n');
  console.log('═'.repeat(60));
  
  console.log(`\n✓ Total Chunks: ${result.totalChunks}`);
  console.log(`✓ Total Size: ${formatBytes(result.totalSize)}`);
  
  if (result.largestChunk) {
    console.log(`✓ Largest Chunk: ${result.largestChunk.name} (${formatBytes(result.largestChunk.size)})`);
  }
  
  console.log(`\n📦 Chunk Breakdown:`);
  console.log(`  - Route Chunks: ${result.routeChunks.length}`);
  console.log(`  - Vendor Chunks: ${result.vendorChunks.length}`);
  console.log(`  - Common Chunks: ${result.commonChunks.length}`);
  
  if (result.routeChunks.length > 0) {
    console.log(`\n🛣️  Route Chunks (Top 10):`);
    result.routeChunks
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .forEach(chunk => {
        console.log(`  - ${chunk.name}: ${formatBytes(chunk.size)}`);
      });
  }
  
  if (result.vendorChunks.length > 0) {
    console.log(`\n📚 Vendor Chunks:`);
    result.vendorChunks.forEach(chunk => {
      console.log(`  - ${chunk.name}: ${formatBytes(chunk.size)}`);
    });
  }
  
  if (result.commonChunks.length > 0) {
    console.log(`\n🔗 Common Chunks:`);
    result.commonChunks.forEach(chunk => {
      console.log(`  - ${chunk.name}: ${formatBytes(chunk.size)}`);
    });
  }
  
  if (result.issues.length > 0) {
    console.log(`\n⚠️  Issues Found:`);
    result.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
  
  if (result.success) {
    console.log('\n✅ Code splitting is configured correctly!');
  } else {
    console.log('\n❌ Code splitting has issues that need attention.');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await verifyCodeSplitting();
    printResults(result);
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
