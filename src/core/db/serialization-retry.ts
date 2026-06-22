// src/core/db/serialization-retry.ts
// Reintento de transacciones ante fallos de SERIALIZACIÓN de PostgreSQL.
import { logger } from "@/src/core/observability/structured-logger";

/**
 * Devuelve true si el error es un fallo de serialización/deadlock transitorio
 * de PostgreSQL que amerita reintentar la transacción completa.
 *
 * Cubre: serialization_failure (40001), deadlock_detected (40P01) y el código
 * de Prisma P2034. Dentro de $executeRaw, Prisma propaga el código crudo en el
 * mensaje, por eso también se inspecciona el texto.
 */
export function isSerializationError(e: unknown): boolean {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    return (
        code === "P2034" ||
        /\b40001\b/.test(msg) ||
        /\b40P01\b/.test(msg) ||
        /could not serialize access/i.test(msg) ||
        /deadlock detected/i.test(msg)
    );
}

/**
 * Reintenta `fn` ante fallos de serialización de PostgreSQL.
 *
 * La transacción del ingest corre con isolationLevel RepeatableRead. Cuando
 * varios terminales del MISMO tenant sincronizan a la vez (p.ej. el horno y el
 * mozo simultáneamente), dos transacciones que tocan las mismas filas hacen que
 * Postgres aborte una con 40001/40P01. Es un fallo ESPERADO y TRANSITORIO: la
 * solución canónica es reintentar la transacción completa, NO bajar el
 * aislamiento (eso rompería la consistencia del conflict-detection por revisión).
 *
 * @param fn        Operación a ejecutar (típicamente un prisma.$transaction).
 * @param maxRetries Reintentos máximos tras el primer intento (default 4).
 * @param sleep     Inyectable para tests (default: setTimeout real con jitter).
 */
export async function runWithSerializationRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 4,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (e) {
            if (!isSerializationError(e) || attempt >= maxRetries) {
                throw e;
            }

            // Backoff exponencial con jitter: desincroniza reintentos concurrentes
            // para que no vuelvan a chocar en lock-step (25, 50, 100, 200 ms + jitter).
            const base = 25 * 2 ** attempt;
            const jitter = Math.floor(Math.random() * base);
            await sleep(base + jitter);

            logger.warn("Reintentando transacción por conflicto de serialización", {
                attempt: attempt + 1,
                maxRetries,
            });
        }
    }
}
