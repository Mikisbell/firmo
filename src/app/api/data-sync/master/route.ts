import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const tenantId = request.headers.get('x-tenant-id') || request.nextUrl.searchParams.get('tenant_id');
    
    if (!tenantId) {
        return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

    try {
        // En un entorno productivo real 2026, aquí leeríamos primero de Upstash Redis.
        // Por simplicidad del blueprint, vamos directo a Neon via WebSockets (Edge).
        const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
        const adapter = new PrismaNeon(pool as any);
        const prisma = new PrismaClient({ adapter });

        // 1. Cargar Mesas
        const tables = await prisma.tables.findMany({
            where: { tenant_id: tenantId, is_active: true },
            orderBy: { number: 'asc' },
            select: {
                id: true,
                number: true,
                display_name: true,
                is_active: true,
                zones: {
                    select: { id: true, code: true, name: true, color: true },
                },
            },
        });

        const masterTables = tables.map(({ zones, ...rest }) => ({
            id: rest.id,
            tenant_id: tenantId,
            number: rest.number,
            display_name: rest.display_name,
            is_active: rest.is_active,
            zone: zones ?? null,
        }));

        // (Aquí podríamos sumar catalog, employees, etc.)

        // Desconectamos para no dejar conexiones WebSocket huérfanas en el Edge
        await prisma.$disconnect();

        return NextResponse.json({ tables: masterTables });
    } catch (error) {
        console.error('Edge Bootstrap Error:', error);
        return NextResponse.json({ error: 'Error al hacer bootstrap en el Edge' }, { status: 500 });
    }
}
