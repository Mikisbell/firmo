import { PrismaClient } from '@prisma/client'
import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
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

    // El adaptador Neon (WebSocket) SOLO aplica si la DB es realmente Neon (neon.tech).
    // Para Supabase / Postgres estandar en runtime Node usamos el cliente nativo (TCP),
    // que conecta sin el proxy WebSocket que exige Neon Serverless (el adaptador se
    // colgaba al conectar contra Supabase en Node). Edge ya no aplica: el ingest es nodejs.
    if (connectionString.includes('neon.tech')) {
        console.log('PRISMA INIT - Usando adaptador Neon (WebSocket)');
        const pool = new Pool({ connectionString });
        // El Pool de @neondatabase/serverless difiere del tipo que espera PrismaNeon
        // por drift de versiones; cast acotado y documentado (no es un any generico).
        const adapter = new PrismaNeon(pool as unknown as ConstructorParameters<typeof PrismaNeon>[0]);
        baseClient = new PrismaClient({ adapter });
    } else {
        console.log('PRISMA INIT - Usando Prisma nativo (TCP) para Supabase/Postgres');
        baseClient = new PrismaClient();
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
