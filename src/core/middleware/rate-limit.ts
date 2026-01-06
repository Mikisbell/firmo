/**
 * Rate Limiting para PARK POS
 * 
 * Protege el servidor de sobrecarga y abuso.
 * Implementación in-memory para MVP (sin Redis/Upstash).
 * 
 * Límites:
 * - Por tenant: 1000 eventos/minuto
 * - Por terminal: 200 eventos/minuto  
 * - Por IP: 500 requests/minuto
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// Almacenamiento in-memory (para MVP sin Redis)
const store = new Map<string, RateLimitEntry>();

// Configuración de límites
const LIMITS = {
    tenant: { max: 1000, windowMs: 60_000 },   // 1000/min
    terminal: { max: 200, windowMs: 60_000 },  // 200/min
    ip: { max: 500, windowMs: 60_000 },        // 500/min
} as const;

// Cleanup periódico (evita memory leak)
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (entry.resetAt < now) {
                store.delete(key);
            }
        }
    }, 60_000); // Cada minuto
}

function checkLimit(key: string, limit: { max: number; windowMs: number }): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
} {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
        // Nueva ventana
        store.set(key, { count: 1, resetAt: now + limit.windowMs });
        return { allowed: true, remaining: limit.max - 1, resetAt: now + limit.windowMs };
    }

    if (entry.count >= limit.max) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: limit.max - entry.count, resetAt: entry.resetAt };
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
    remaining?: {
        tenant: number;
        terminal: number;
        ip: number;
    };
}

/**
 * Verifica rate limits para una request
 */
export function checkRateLimit(
    tenantId: string,
    terminalId: string,
    ip: string
): RateLimitResult {
    startCleanup();

    // Check IP first (más barato, anti-abuse)
    const ipResult = checkLimit(`ip:${ip}`, LIMITS.ip);
    if (!ipResult.allowed) {
        const retryAfter = Math.ceil((ipResult.resetAt - Date.now()) / 1000);
        return { allowed: false, retryAfter };
    }

    // Check tenant
    const tenantResult = checkLimit(`tenant:${tenantId}`, LIMITS.tenant);
    if (!tenantResult.allowed) {
        const retryAfter = Math.ceil((tenantResult.resetAt - Date.now()) / 1000);
        return { allowed: false, retryAfter };
    }

    // Check terminal
    const terminalResult = checkLimit(`terminal:${terminalId}`, LIMITS.terminal);
    if (!terminalResult.allowed) {
        const retryAfter = Math.ceil((terminalResult.resetAt - Date.now()) / 1000);
        return { allowed: false, retryAfter };
    }

    return {
        allowed: true,
        remaining: {
            tenant: tenantResult.remaining,
            terminal: terminalResult.remaining,
            ip: ipResult.remaining,
        },
    };
}

/**
 * Resetea los límites (para testing)
 */
export function resetRateLimits() {
    store.clear();
}

/**
 * Obtiene estadísticas actuales (para monitoring)
 */
export function getRateLimitStats() {
    return {
        entriesCount: store.size,
        entries: Array.from(store.entries()).map(([key, entry]) => ({
            key,
            count: entry.count,
            resetAt: new Date(entry.resetAt).toISOString(),
        })),
    };
}
