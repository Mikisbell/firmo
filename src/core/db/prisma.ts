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

    // Si es entorno local/desarrollo y NO es Neon (ej. Supabase local), usamos cliente nativo
    // Neon Serverless requiere un proxy WebSocket que Supabase no tiene.
    if (process.env.NODE_ENV === 'development' && !connectionString.includes('neon.tech')) {
        console.log('PRISMA INIT - Usando Prisma nativo (TCP) para BD local/Supabase');
        baseClient = new PrismaClient();
    } else {
        console.log('PRISMA INIT - Usando adaptador Neon (WebSocket)');
        const pool = new Pool({ connectionString });
        const adapter = new PrismaNeon(pool as any);
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
