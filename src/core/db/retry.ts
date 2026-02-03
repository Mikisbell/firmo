/**
 * Database Retry Logic
 * Handles transient connection failures with exponential backoff
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('Connection timeout') ||
          error.message.includes('Pool exhausted') ||
          (error as any).code === 'ECONNREFUSED' ||
          (error as any).code === 'ETIMEDOUT' ||
          (error as any).code === 'P1001' || // Prisma connection error
          (error as any).code === 'P1002'); // Prisma timeout

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error');
}
