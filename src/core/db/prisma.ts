import { PrismaClient } from '@prisma/client'
import { logger } from '@/src/core/observability/structured-logger'
import { metrics } from '@/src/core/observability/metrics'

/**
 * Slow query threshold in milliseconds
 * Queries taking longer than this will be logged
 */
const SLOW_QUERY_THRESHOLD_MS = 1000

/**
 * Create Prisma client with slow query logging middleware
 */
const prismaClientSingleton = () => {
    const client = new PrismaClient()
    
    // Add middleware for query timing and slow query logging
    // Only if $use is available (not available in some test environments)
    if (typeof client.$use === 'function') {
        client.$use(async (params, next) => {
            const startTime = Date.now()
            
            try {
                // Execute the query
                const result = await next(params)
                
                // Calculate execution time
                const duration = Date.now() - startTime
                
                // Emit metrics for all queries
                metrics.histogram('database.query.duration', duration, {
                    model: params.model || 'unknown',
                    action: params.action,
                })
                
                // Log slow queries
                if (duration > SLOW_QUERY_THRESHOLD_MS) {
                    logger.warn('Slow query detected', {
                        model: params.model,
                        action: params.action,
                        duration,
                        args: JSON.stringify(params.args),
                    })
                    
                    // Emit slow query metric
                    metrics.increment('database.query.slow', {
                        model: params.model || 'unknown',
                        action: params.action,
                    })
                }
                
                return result
            } catch (error) {
                // Log query errors
                const duration = Date.now() - startTime
                
                logger.error('Query failed', error as Error, {
                    model: params.model,
                    action: params.action,
                    duration,
                    args: JSON.stringify(params.args),
                })
                
                // Emit error metric
                metrics.increment('database.query.error', {
                    model: params.model || 'unknown',
                    action: params.action,
                })
                
                throw error
            }
        })
    }
    
    return client
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
