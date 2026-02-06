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
    const baseClient = new PrismaClient()
    
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

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
