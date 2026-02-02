/**
 * Transaction Helper - Centralized transaction management
 * 
 * Provides:
 * - Automatic retry logic for transient failures
 * - Serialization conflict handling (P2034)
 * - Configurable isolation levels
 * - Result pattern integration
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Result, ok, err } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';

export interface TransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  timeout?: number;
}

/**
 * Execute a database operation within a transaction with automatic retry logic
 * 
 * @param prisma - Prisma client instance
 * @param operation - Async function to execute within transaction
 * @param options - Transaction options (retries, isolation level, timeout)
 * @returns Result containing the operation result or error
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<Result<T, Error>> {
  const { maxRetries = 3, isolationLevel, timeout = 10000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await prisma.$transaction(
        operation,
        {
          isolationLevel,
          timeout,
        }
      );

      return ok(result);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // P2034 = Serialization conflict
      const isSerializationConflict = lastError.message.includes('P2034');
      const shouldRetry = attempt < maxRetries && isSerializationConflict;

      if (shouldRetry) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
        pinoLogger.warn(
          { attempt: attempt + 1, maxRetries, backoffMs, error: lastError.message },
          'Transaction serialization conflict, retrying...'
        );
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        pinoLogger.error(
          { attempt: attempt + 1, maxRetries, error: lastError.message },
          'Transaction failed'
        );
        break;
      }
    }
  }

  return err(lastError || new Error('Transaction failed'));
}
