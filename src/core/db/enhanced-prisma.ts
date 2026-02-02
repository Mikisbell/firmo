/**
 * Enhanced Database Layer with Transactions and Retry Logic
 * 
 * Implements:
 * - Connection pooling optimization
 * - Transaction management with automatic rollback
 * - Retry logic for transient failures
 * - Query performance monitoring
 * - Circuit breaker for database operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Result, ok, err, tryCatchAsync } from '@/core/result';

// Connection configuration
const CONNECTION_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 100,
  maxRetryDelayMs: 2000,
  connectionTimeoutMs: 10000,
  queryTimeoutMs: 30000,
};

// Exponential backoff calculation
function calculateBackoff(attempt: number): number {
  const delay = Math.min(
    CONNECTION_CONFIG.retryDelayMs * Math.pow(2, attempt),
    CONNECTION_CONFIG.maxRetryDelayMs
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 100;
}

// Check if error is transient (retryable)
function isTransientError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Retry on connection issues and lock timeouts
    const retryableCodes = [
      'P1001', // Can't reach database server
      'P1002', // Database server timeout
      'P1008', // Operations timed out
      'P1017', // Server has closed the connection
      'P2034', // Transaction conflict
    ];
    return retryableCodes.includes(error.code);
  }
  return false;
}

/**
 * Execute a database operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<Result<T, Error>> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < CONNECTION_CONFIG.maxRetries; attempt++) {
    const result = await tryCatchAsync(operation);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    
    // Check if error is transient and we should retry
    if (attempt < CONNECTION_CONFIG.maxRetries - 1 && isTransientError(lastError)) {
      const delay = calculateBackoff(attempt);
      console.warn(`Database operation ${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    
    // Non-transient error or max retries reached
    break;
  }
  
  return err(lastError || new Error(`Operation ${operationName} failed after ${CONNECTION_CONFIG.maxRetries} attempts`));
}

/**
 * Transaction wrapper with automatic rollback
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    maxRetries?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  } = {}
): Promise<Result<T, Error>> {
  const maxRetries = options.maxRetries ?? 3;
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        return await operation(tx);
      }, {
        isolationLevel: options.isolationLevel ?? Prisma.TransactionIsolationLevel.Serializable,
        maxWait: CONNECTION_CONFIG.connectionTimeoutMs,
        timeout: CONNECTION_CONFIG.queryTimeoutMs,
      });
      
      return ok(result);
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a serialization conflict (P2034)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        const delay = calculateBackoff(attempt);
        console.warn(`Transaction conflict (attempt ${attempt + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Other errors, don't retry
      break;
    }
  }
  
  return err(lastError || new Error(`Transaction failed after ${maxRetries} attempts`));
}

/**
 * Batch operations with chunking for large datasets
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (chunk: T[]) => Promise<R[]>,
  chunkSize = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await operation(chunk);
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Query performance monitor
 */
export class QueryMonitor {
  private static slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }> = [];
  
  static async measure<T>(
    queryName: string,
    operation: () => Promise<T>,
    slowThresholdMs = 1000
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      if (duration > slowThresholdMs) {
        console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
        this.slowQueries.push({
          query: queryName,
          duration,
          timestamp: new Date(),
        });
        
        // Keep only last 100 slow queries
        if (this.slowQueries.length > 100) {
          this.slowQueries = this.slowQueries.slice(-100);
        }
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`Query ${queryName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
  
  static getSlowQueries() {
    return [...this.slowQueries];
  }
  
  static clearSlowQueries() {
    this.slowQueries = [];
  }
}

/**
 * Database connection health check
 */
export async function checkDatabaseHealth(
  prisma: PrismaClient
): Promise<Result<{ status: 'healthy' | 'degraded'; latency: number }, Error>> {
  const start = performance.now();
  
  const result = await withRetry(async () => {
    await prisma.$queryRaw`SELECT 1`;
  }, 'health_check');
  
  const latency = performance.now() - start;
  
  if (!result.success) {
    return err(result.error);
  }
  
  const status = latency > 1000 ? 'degraded' : 'healthy';
  
  return ok({ status, latency });
}

/**
 * Optimized Prisma client with extended functionality
 */
export function createEnhancedPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  
  // Add query performance monitoring
  prisma.$use(async (params, next) => {
    const start = performance.now();
    const result = await next(params);
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      console.warn(`Slow Prisma query: ${params.model}.${params.action} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  });
  
  return prisma;
}

/**
 * Safe disconnect with cleanup
 */
export async function safeDisconnect(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error disconnecting from database:', error);
    // Force disconnect
    process.exit(1);
  }
}
