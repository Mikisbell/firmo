/**
 * kv.ts
 * Cloudflare KV wrapper for Edge caching and temporary data.
 * 
 * Provides type-safe wrappers for KV namespace operations.
 * Must be used within an Edge Runtime context (e.g. Next.js API Routes on Edge).
 */

export interface KVStorageContext {
  PARK_POS_KV: any; // Type as KVNamespace in Cloudflare Workers context
}

/**
 * Helper to get the KV namespace from the global context or request context
 * In Next.js Pages router, this would come from the request context.
 * In Next.js App router (Edge), we might use process.env if bound.
 */
export function getKV(): any | null {
  // Try to return the KV binding from the environment
  if (typeof process !== 'undefined' && (process.env as any).PARK_POS_KV) {
    return (process.env as any).PARK_POS_KV;
  }
  
  // Try globalThis if deployed as a native worker
  if ((globalThis as any).PARK_POS_KV) {
    return (globalThis as any).PARK_POS_KV;
  }

  console.warn('PARK_POS_KV namespace not found in environment.');
  return null;
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const kv = getKV();
  if (!kv) return null;

  try {
    const data = await kv.get(key, 'json');
    return data as T;
  } catch (error) {
    console.error(`Failed to get KV for key: ${key}`, error);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T, expirationTtlSeconds: number = 3600): Promise<boolean> {
  const kv = getKV();
  if (!kv) return false;

  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: expirationTtlSeconds });
    return true;
  } catch (error) {
    console.error(`Failed to set KV for key: ${key}`, error);
    return false;
  }
}

export async function invalidateCache(key: string): Promise<boolean> {
  const kv = getKV();
  if (!kv) return false;

  try {
    await kv.delete(key);
    return true;
  } catch (error) {
    console.error(`Failed to delete KV for key: ${key}`, error);
    return false;
  }
}
