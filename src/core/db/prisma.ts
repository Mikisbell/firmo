import { PrismaClient } from '@prisma/client'
import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
// Solo runtime NODE (Vercel/Supabase). pg NO se usa en Edge/Cloudflare Workers
// (alli regiria la regla de no-TCP de AGENTS.md). El proyecto corre en Node;
// @prisma/adapter-pg ya depende de pg internamente, aca solo lo hacemos explicito
// para poder colgar el handler pool.on('error') y evitar el crash por idle.
import { Pool as PgPool } from 'pg'
import { logger } from '@/src/core/observability/structured-logger'
import { metrics } from '@/src/core/observability/metrics'

/**
 * Slow query threshold in milliseconds
 * Queries taking longer than this will be logged
 */
const SLOW_QUERY_THRESHOLD_MS = 1000

const prismaClientSingleton = () => {
    // Si estamos en desarrollo y falta DATABASE_URL, forzamos dotenv
    if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
        try {
            require('dotenv').config({ path: '.env' });
        } catch (e) {
            console.warn('Could not load dotenv:', e);
        }
    }

    const connectionString = process.env.DATABASE_URL || ''
    
    let baseClient;

    // Ambas ramas usan driver adapters (JS puro): NO requieren el binary del query
    // engine nativo, asi que conectan igual en local y en Vercel serverless (Lambda).
    if (connectionString.includes('neon.tech')) {
        // DB Neon: adaptador Neon sobre WebSocket.
        console.log('PRISMA INIT - Usando adaptador Neon (WebSocket)');
        const pool = new Pool({ connectionString });
        // El Pool de @neondatabase/serverless difiere del tipo que espera PrismaNeon
        // por drift de versiones; cast acotado y documentado (no es un any generico).
        const adapter = new PrismaNeon(pool as unknown as ConstructorParameters<typeof PrismaNeon>[0]);
        baseClient = new PrismaClient({ adapter });
    } else {
        // Supabase / Postgres estandar: adaptador pg (node-postgres) sobre TCP.
        // Conecta al pooler de Supabase y NO depende del binary del engine nativo
        // (que en Vercel serverless fallaba al instante por target de plataforma).
        console.log('PRISMA INIT - Usando adaptador pg para Supabase/Postgres');
        // ssl rejectUnauthorized:false: Supabase EXIGE SSL y su certificado no esta en el
        // trust store por defecto de Node en Vercel; sin esto el handshake TLS cuelga (timeout).
        const pool = new PgPool({ connectionString, ssl: { rejectUnauthorized: false } });
        // CRITICO: el pooler (pgbouncer) corta conexiones idle. Sin este handler, ese error
        // sube como 'uncaughtException' y TUMBA el proceso (dev server / funcion serverless).
        // Lo logueamos y el pool se recupera solo (abre nueva conexion en el siguiente query).
        pool.on('error', (err) => {
            logger.error('Error en el pool de pg (conexion idle cortada, recuperable)', err);
        });
        const adapter = new PrismaPg(pool);
        baseClient = new PrismaClient({ adapter });
    }
    
    // Use Prisma 6 extension API for middleware
    const extendedClient = baseClient.$extends({
        name: 'slow-query-logger',
        query: {
            async $allOperations({ operation, model, args, query }) {
                const startTime = Date.now()
                
                try {
                    // Execute the query
                    const result = await query(args)
                    
                    // Calculate execution time
                    const duration = Date.now() - startTime
                    
                    // Emit metrics for all queries
                    metrics.histogram('database.query.duration', duration, {
                        model: model || 'unknown',
                        action: operation,
                    })
                    
                    // Log slow queries
                    if (duration > SLOW_QUERY_THRESHOLD_MS) {
                        logger.warn('Slow query detected', {
                            model: model,
                            action: operation,
                            duration,
                            args: JSON.stringify(args).substring(0, 200),
                        })
                        
                        // Emit slow query metric
                        metrics.increment('database.query.slow', {
                            model: model || 'unknown',
                            action: operation,
                        })
                    }
                    
                    return result
                } catch (error) {
                    // Log query errors
                    const duration = Date.now() - startTime
                    
                    logger.error('Query failed', error as Error, {
                        model: model,
                        action: operation,
                        duration,
                        args: JSON.stringify(args).substring(0, 200),
                    })
                    
                    // Emit error metric
                    metrics.increment('database.query.error', {
                        model: model || 'unknown',
                        action: operation,
                    })
                    
                    throw error
                }
            }
        }
    })
    
    // Return as PrismaClient type for compatibility
    return extendedClient as unknown as PrismaClient
}

// Eliminamos la caché global en dev por ahora para forzar recarga
const prisma = prismaClientSingleton()

export default prisma
