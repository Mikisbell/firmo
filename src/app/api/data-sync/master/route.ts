import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const tenantId = request.headers.get('x-tenant-id') || request.nextUrl.searchParams.get('tenant_id');
    
    if (!tenantId) {
        return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
    }

    try {
        // En un entorno productivo real 2026, aquí leeríamos primero de Upstash Redis.
        // Por simplicidad del blueprint, usamos Node.js Serverless + Neon WebSockets (prisma singleton).

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

        // 2. Cargar Catálogo (Productos)
        const products = await prisma.products.findMany({
            where: { tenant_id: tenantId, is_active: true },
            select: { id: true, name: true, price_cents: true, category: true, station: true, sku: true }
        });

        const masterCatalog = products.map(p => ({
            id: p.id,
            tenant_id: tenantId,
            product_id: p.id,
            name: p.name,
            price_cents: p.price_cents,
            category: p.category,
            station: p.station,
            sku: p.sku,
            tax_rate: 0.18 // Default if schema lacks it
        }));

        // No desconectamos prisma porque estamos usando el singleton global

        return NextResponse.json({ tables: masterTables, catalog: masterCatalog });
    } catch (error) {
        console.error('Edge Bootstrap Error:', error);
        return NextResponse.json({ error: 'Error al hacer bootstrap en el Edge' }, { status: 500 });
    }
}
