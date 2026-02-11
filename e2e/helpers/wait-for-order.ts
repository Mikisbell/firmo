/**
 * Helper para esperar a que una orden aparezca en la base de datos
 * 
 * Este helper es necesario porque en Playwright E2E tests, el EventBus in-memory
 * NO funciona correctamente debido a que Next.js development mode puede usar
 * múltiples instancias del servidor.
 * 
 * En vez de depender de SSE, este helper hace polling directo a la base de datos
 * para verificar que el evento fue procesado correctamente.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OrderInfo {
    id: string;
    order_number: number;
    order_type: string;
    items: any[];
}

/**
 * Espera a que una orden aparezca en PostgreSQL
 * 
 * @param orderId - ID de la orden a buscar
 * @param timeout - Tiempo máximo de espera en ms (default: 10000)
 * @param interval - Intervalo entre intentos en ms (default: 500)
 * @returns Información de la orden
 * @throws Error si la orden no aparece después del timeout
 */
export async function waitForOrderInDatabase(
    orderId: string,
    timeout = 10000,
    interval = 500
): Promise<OrderInfo> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        try {
            const order = await prisma.orders.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    order_number: true,
                    order_type: true,
                    items: true,
                },
            });
            
            if (order) {
                return order as OrderInfo;
            }
        } catch (e) {
            // Ignorar errores de conexión, seguir intentando
            console.warn(`[waitForOrder] Error querying database:`, e);
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Order ${orderId} not found in database after ${timeout}ms`);
}

/**
 * Espera a que múltiples órdenes aparezcan en PostgreSQL
 * 
 * @param orderIds - Array de IDs de órdenes a buscar
 * @param timeout - Tiempo máximo de espera en ms (default: 15000)
 * @returns Array de información de órdenes
 */
export async function waitForMultipleOrders(
    orderIds: string[],
    timeout = 15000
): Promise<OrderInfo[]> {
    const start = Date.now();
    const foundOrders: OrderInfo[] = [];
    const remainingIds = new Set(orderIds);
    
    while (Date.now() - start < timeout && remainingIds.size > 0) {
        for (const orderId of Array.from(remainingIds)) {
            try {
                const order = await prisma.orders.findUnique({
                    where: { id: orderId },
                    select: {
                        id: true,
                        order_number: true,
                        order_type: true,
                        items: true,
                    },
                });
                
                if (order) {
                    foundOrders.push(order as OrderInfo);
                    remainingIds.delete(orderId);
                }
            } catch (e) {
                console.warn(`[waitForMultipleOrders] Error querying order ${orderId}:`, e);
            }
        }
        
        if (remainingIds.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    if (remainingIds.size > 0) {
        throw new Error(
            `${remainingIds.size} orders not found after ${timeout}ms: ${Array.from(remainingIds).join(', ')}`
        );
    }
    
    return foundOrders;
}

/**
 * Cleanup: Cierra la conexión de Prisma
 * Llamar al final de los tests
 */
export async function cleanupPrisma() {
    await prisma.$disconnect();
}
