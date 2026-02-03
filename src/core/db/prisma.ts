import { PrismaClient } from '@prisma/client'
import { withRetry } from './retry'

const prismaClientSingleton = () => {
    const client = new PrismaClient()
    
    // Add retry middleware for connection errors
    client.$use(async (params, next) => {
      return withRetry(() => next(params), 3, 100)
    })
    
    return client
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
