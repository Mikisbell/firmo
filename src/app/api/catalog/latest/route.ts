import { NextResponse } from "next/server";
import prisma from "@/src/core/db/prisma";
import crypto from "crypto";
import { getTenantId } from "@/src/core/config/tenant";
import { logger } from '@/src/core/observability/structured-logger';
import { getCachedData, setCachedData } from '@/src/workers/kv';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Tenant always resolved from server env — never from client query params
const TENANT_ID = getTenantId();

export async function GET() {
    const tenantId = TENANT_ID;
    const cacheKey = `kv_pos_catalog_${tenantId}`;

    try {
        // Try Edge KV first
        const cachedCatalog = await getCachedData<any>(cacheKey);
        if (cachedCatalog) {
            logger.info('POS Catalog retrieved from Edge KV', { operation: 'get_catalog_kv_hit', cacheKey });
            return NextResponse.json(cachedCatalog);
        }
        // Get products from database
        const products = await prisma.products.findMany({
            where: {
                tenant_id: tenantId,
                is_active: true,
            },
            orderBy: [
                { category: "asc" },
                { name: "asc" },
            ],
            take: 500,
        });

        // Get catalog meta
        const meta = await prisma.catalog_meta.findUnique({
            where: { tenant_id: tenantId },
        });

        // Transform to catalog format
        const items = products.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            short_name: p.short_name || p.name.substring(0, 12),
            price_cents: p.price_cents,
            category: p.category,
            station: p.station,
            active: p.is_active,
        }));

        // Calculate checksum
        const checksum = crypto
            .createHash("md5")
            .update(JSON.stringify(items))
            .digest("hex")
            .substring(0, 8);

        // If no products in DB, return demo catalog
        if (items.length === 0) {
            return NextResponse.json(getDemoCatalog());
        }

        // Save to Edge KV (expire in 1 hour)
        const responseData = {
            version: meta?.catalog_version || 1,
            checksum,
            updated_at: meta?.updated_at?.toISOString() || new Date().toISOString(),
            items,
        };

        await setCachedData(cacheKey, responseData, 3600);
        logger.info('POS Catalog retrieved from DB and cached in KV', { operation: 'get_catalog_kv_miss', cacheKey });

        return NextResponse.json(responseData);
    } catch (error) {
        logger.error('Error al obtener catálogo', error instanceof Error ? error : new Error(String(error)));
        // Fallback to demo catalog on error
        return NextResponse.json(getDemoCatalog());
    }
}

// Demo catalog for development/fallback
function getDemoCatalog() {
    return {
        version: 1,
        checksum: "demo1234",
        updated_at: new Date().toISOString(),
        items: [
            { id: "00000001-0001-0001-0001-000000000001", sku: "POLLO-ENT", name: "Pollo a la Brasa Entero", short_name: "Pollo Ent", price_cents: 6800, category: "POLLOS", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000002", sku: "POLLO-MED", name: "1/2 Pollo a la Brasa", short_name: "1/2 Pollo", price_cents: 3600, category: "POLLOS", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000003", sku: "POLLO-CRT", name: "1/4 Pollo a la Brasa", short_name: "1/4 Pollo", price_cents: 2200, category: "POLLOS", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000004", sku: "PAPAS-GRD", name: "Papas Fritas Grande", short_name: "Papas Grd", price_cents: 1800, category: "GUARNICIONES", station: "FREIDORA", active: true },
            { id: "00000001-0001-0001-0001-000000000005", sku: "PAPAS-MED", name: "Papas Fritas Mediana", short_name: "Papas Med", price_cents: 1200, category: "GUARNICIONES", station: "FREIDORA", active: true },
            { id: "00000001-0001-0001-0001-000000000006", sku: "ENSALADA", name: "Ensalada Parrillera", short_name: "Ensalada", price_cents: 1200, category: "GUARNICIONES", station: "FRIO", active: true },
            { id: "00000001-0001-0001-0001-000000000007", sku: "GASEOSA-PEQ", name: "Inca Kola 500ml", short_name: "Inca 500", price_cents: 500, category: "BEBIDAS", station: "BAR", active: true },
            { id: "00000001-0001-0001-0001-000000000008", sku: "GASEOSA-1L", name: "Inca Kola 1.5L", short_name: "Inca 1.5L", price_cents: 1200, category: "BEBIDAS", station: "BAR", active: true },
            { id: "00000001-0001-0001-0001-000000000009", sku: "CHICHA-JAR", name: "Jarra Chicha Morada 1L", short_name: "Jarra Chicha", price_cents: 1500, category: "BEBIDAS", station: "BAR", active: true },
            { id: "00000001-0001-0001-0001-000000000010", sku: "CERVEZA", name: "Cerveza Cusqueña", short_name: "Cerveza", price_cents: 1200, category: "BEBIDAS", station: "BAR", active: true },
            { id: "00000001-0001-0001-0001-000000000011", sku: "ANTICUCHO-3", name: "Anticuchos (3 palitos)", short_name: "Anticucho", price_cents: 2800, category: "PARRILLA", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000012", sku: "CHORIZO", name: "Chorizo a la Parrilla", short_name: "Chorizo", price_cents: 1500, category: "PARRILLA", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000013", sku: "PARRILLA-MIX", name: "Parrillada Mixta", short_name: "Parrilla Mix", price_cents: 5500, category: "PARRILLA", station: "PARRILLA", active: true },
            { id: "00000001-0001-0001-0001-000000000014", sku: "AGUADITO", name: "Aguadito de Pollo", short_name: "Aguadito", price_cents: 1200, category: "EXTRAS", station: "COCINA", active: true },
            { id: "00000001-0001-0001-0001-000000000015", sku: "TEQUENOS", name: "Tequeños de Pollo (6)", short_name: "Tequeños", price_cents: 1800, category: "EXTRAS", station: "FREIDORA", active: true },
            { id: "00000001-0001-0001-0001-000000000016", sku: "PICARONES", name: "Picarones (4 und)", short_name: "Picarones", price_cents: 1000, category: "POSTRES", station: "COCINA", active: true },
            { id: "00000001-0001-0001-0001-000000000017", sku: "ARROZ-CHAUFA", name: "Arroz Chaufa de Pollo", short_name: "Chaufa", price_cents: 2200, category: "EXTRAS", station: "COCINA", active: true },
        ],
    };
}
