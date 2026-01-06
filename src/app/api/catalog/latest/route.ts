import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id") || "00000000-0000-0000-0000-000000000001";

    try {
        // Get products from database
        const products = await prisma.product.findMany({
            where: {
                tenant_id: tenantId,
                is_active: true,
            },
            orderBy: [
                { category: "asc" },
                { name: "asc" },
            ],
        });

        // Get catalog meta
        const meta = await prisma.catalogMeta.findUnique({
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

        return NextResponse.json({
            version: meta?.catalog_version || 1,
            checksum,
            updated_at: meta?.updated_at?.toISOString() || new Date().toISOString(),
            items,
        });
    } catch (error) {
        console.error("[catalog/latest] Error:", error);
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
            { id: "prod_001", sku: "POLLO-ENT", name: "Pollo a la Brasa Entero", short_name: "Pollo Ent", price_cents: 6800, category: "pollos", station: "PARRILLA", active: true },
            { id: "prod_002", sku: "POLLO-MED", name: "1/2 Pollo a la Brasa", short_name: "1/2 Pollo", price_cents: 3600, category: "pollos", station: "PARRILLA", active: true },
            { id: "prod_003", sku: "POLLO-CRT", name: "1/4 Pollo a la Brasa", short_name: "1/4 Pollo", price_cents: 2200, category: "pollos", station: "PARRILLA", active: true },
            { id: "prod_004", sku: "PAPAS-GRD", name: "Papas Fritas Grande", short_name: "Papas Grd", price_cents: 1800, category: "acompañamientos", station: "FREIDORA", active: true },
            { id: "prod_005", sku: "PAPAS-MED", name: "Papas Fritas Mediana", short_name: "Papas Med", price_cents: 1200, category: "acompañamientos", station: "FREIDORA", active: true },
            { id: "prod_006", sku: "ENSALADA", name: "Ensalada Parrillera", short_name: "Ensalada", price_cents: 1200, category: "acompañamientos", station: "FRIO", active: true },
            { id: "prod_007", sku: "GASEOSA-PEQ", name: "Inca Kola 500ml", short_name: "Inca 500", price_cents: 500, category: "bebidas", station: "BAR", active: true },
            { id: "prod_008", sku: "GASEOSA-1L", name: "Inca Kola 1.5L", short_name: "Inca 1.5L", price_cents: 1200, category: "bebidas", station: "BAR", active: true },
            { id: "prod_009", sku: "CHICHA-JAR", name: "Jarra Chicha Morada 1L", short_name: "Jarra Chicha", price_cents: 1500, category: "bebidas", station: "BAR", active: true },
            { id: "prod_010", sku: "CERVEZA", name: "Cerveza Cusqueña", short_name: "Cerveza", price_cents: 1200, category: "bebidas", station: "BAR", active: true },
            { id: "prod_011", sku: "ANTICUCHO-3", name: "Anticuchos (3 palitos)", short_name: "Anticucho", price_cents: 2800, category: "parrilla", station: "PARRILLA", active: true },
            { id: "prod_012", sku: "CHORIZO", name: "Chorizo a la Parrilla", short_name: "Chorizo", price_cents: 1500, category: "parrilla", station: "PARRILLA", active: true },
            { id: "prod_013", sku: "PARRILLA-MIX", name: "Parrillada Mixta", short_name: "Parrilla Mix", price_cents: 5500, category: "parrilla", station: "PARRILLA", active: true },
            { id: "prod_014", sku: "AGUADITO", name: "Aguadito de Pollo", short_name: "Aguadito", price_cents: 1200, category: "entradas", station: "COCINA", active: true },
            { id: "prod_015", sku: "TEQUENOS", name: "Tequeños de Pollo (6)", short_name: "Tequeños", price_cents: 1800, category: "entradas", station: "FREIDORA", active: true },
            { id: "prod_016", sku: "PICARONES", name: "Picarones (4 und)", short_name: "Picarones", price_cents: 1000, category: "postres", station: "COCINA", active: true },
            { id: "prod_017", sku: "ARROZ-CHAUFA", name: "Arroz Chaufa de Pollo", short_name: "Chaufa", price_cents: 2200, category: "platos", station: "COCINA", active: true },
        ],
    };
}
