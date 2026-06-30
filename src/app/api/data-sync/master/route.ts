import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    // SECURITY (auditoría 2026-06-29): el tenant se deriva del JWT, NUNCA del query/header.
    // Antes tomaba x-tenant-id/tenant_id del cliente sin auth -> enumeración cross-tenant de
    // datos maestros (mesas, catálogo, settings) con solo conocer un UUID. El POS llama esto
    // ya autenticado (cookie auth_token same-origin), así que validar NO rompe el bootstrap.
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) {
        return authResult.response;
    }
    const tenantId = authResult.user.tenantId;

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
                capacity: true,
                shape: true,
                status: true,
                zone_id: true,
                position_x: true,
                position_y: true,
                width: true,
                height: true,
                rotation: true,
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
            capacity: rest.capacity,
            shape: rest.shape,
            status: rest.status,
            zone_id: rest.zone_id,
            position_x: rest.position_x,
            position_y: rest.position_y,
            width: rest.width,
            height: rest.height,
            rotation: rest.rotation,
            zone: zones ?? null,
        }));

        // 2. Cargar Catálogo (Productos)
        const products = await prisma.products.findMany({
            where: { tenant_id: tenantId, is_active: true },
            select: { id: true, name: true, price_cents: true, category: true, station: true, sku: true, is_special_sla: true }
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
            tax_rate: 0.18, // Default if schema lacks it
            is_special_sla: p.is_special_sla ?? false
        }));

        // 3. Cargar Configuraciones de Tenant (Settings)
        const settings = await prisma.tenant_settings.findUnique({
            where: { tenant_id: tenantId }
        });

        // Si no existen configuraciones (caso raro), enviamos un objeto default seguro.
        const masterSettings = settings ? {
            tenant_id: settings.tenant_id,
            table_inactivity_threshold_min: (settings as any).table_inactivity_threshold_min ?? 15,
            sla_normal_min: (settings as any).sla_normal_min ?? 10,
            sla_special_min: (settings as any).sla_special_min ?? 20,
        } : {
            tenant_id: tenantId,
            table_inactivity_threshold_min: 15,
            sla_normal_min: 10,
            sla_special_min: 20,
        };

        // No desconectamos prisma porque estamos usando el singleton global

        return NextResponse.json({ 
            tables: masterTables, 
            catalog: masterCatalog, 
            settings: masterSettings 
        });
    } catch (error) {
        console.error('Edge Bootstrap Error:', error);
        return NextResponse.json({ error: 'Error al hacer bootstrap en el Edge' }, { status: 500 });
    }
}
