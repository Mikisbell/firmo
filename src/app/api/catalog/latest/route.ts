import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo catalog data - In production, this would come from database
const DEMO_CATALOG = {
    version: 1,
    checksum: "abc123",
    updated_at: new Date().toISOString(),
    items: [
        {
            id: "prod_001",
            sku: "POLLO-ENT",
            name: "Pollo a la Brasa Entero",
            short_name: "Pollo Ent",
            price_cents: 6500, // S/65.00
            category: "pollos",
            station: "PARRILLA",
            active: true,
        },
        {
            id: "prod_002",
            sku: "POLLO-MED",
            name: "1/2 Pollo a la Brasa",
            short_name: "1/2 Pollo",
            price_cents: 3500,
            category: "pollos",
            station: "PARRILLA",
            active: true,
        },
        {
            id: "prod_003",
            sku: "POLLO-CRT",
            name: "1/4 Pollo a la Brasa",
            short_name: "1/4 Pollo",
            price_cents: 2000,
            category: "pollos",
            station: "PARRILLA",
            active: true,
        },
        {
            id: "prod_004",
            sku: "PAPAS-GRD",
            name: "Papas Fritas Grande",
            short_name: "Papas Grd",
            price_cents: 1500,
            category: "acompañamientos",
            station: "FREIDORA",
            active: true,
        },
        {
            id: "prod_005",
            sku: "PAPAS-MED",
            name: "Papas Fritas Mediana",
            short_name: "Papas Med",
            price_cents: 1000,
            category: "acompañamientos",
            station: "FREIDORA",
            active: true,
        },
        {
            id: "prod_006",
            sku: "ENSALADA",
            name: "Ensalada",
            short_name: "Ensalada",
            price_cents: 800,
            category: "acompañamientos",
            station: "FRIO",
            active: true,
        },
        {
            id: "prod_007",
            sku: "GASEOSA-PEQ",
            name: "Gaseosa Personal",
            short_name: "Gaseosa",
            price_cents: 500,
            category: "bebidas",
            station: "BAR",
            active: true,
        },
        {
            id: "prod_008",
            sku: "GASEOSA-1L",
            name: "Gaseosa 1L",
            short_name: "Gaseosa 1L",
            price_cents: 1000,
            category: "bebidas",
            station: "BAR",
            active: true,
        },
        {
            id: "prod_009",
            sku: "CHICHA-1L",
            name: "Chicha Morada 1L",
            short_name: "Chicha 1L",
            price_cents: 800,
            category: "bebidas",
            station: "BAR",
            active: true,
        },
        {
            id: "prod_010",
            sku: "CERVEZA",
            name: "Cerveza Cusqueña",
            short_name: "Cerveza",
            price_cents: 1200,
            category: "bebidas",
            station: "BAR",
            active: true,
        },
        {
            id: "prod_011",
            sku: "ANTICUCHO-3",
            name: "Anticuchos (3 palitos)",
            short_name: "Anticucho",
            price_cents: 2500,
            category: "parrilla",
            station: "PARRILLA",
            active: true,
        },
        {
            id: "prod_012",
            sku: "CHORIZO",
            name: "Chorizo a la Parrilla",
            short_name: "Chorizo",
            price_cents: 1500,
            category: "parrilla",
            station: "PARRILLA",
            active: true,
        },
    ],
};

export async function GET() {
    // In production: query database for active catalog
    return NextResponse.json(DEMO_CATALOG);
}
