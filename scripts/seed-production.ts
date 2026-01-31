#!/usr/bin/env tsx
/**
 * Production Database Seeding Script
 * 
 * Creates MINIMAL essential data for production:
 * - 1 tenant settings
 * - 1 ADMIN employee (PIN: 1234)
 * - 1 location
 * - 5 basic stations
 * - 10 essential products
 * - 2 zones with 10 tables
 * - 3 terminals (CAJA_01, SPC_HORNO, MOZO_01)
 * 
 * Usage:
 *   # Get DATABASE_URL from Vercel environment variables
 *   # Create .env.production with: DATABASE_URL="postgresql://..."
 *   npx dotenv -e .env.production -- tsx scripts/seed-production.ts
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { DEFAULT_TENANT_ID, DEFAULT_LOCATION_ID } from "../src/core/config/location";
import { DEFAULT_EMPLOYEE_IDS } from "../src/core/config/employees";

const prisma = new PrismaClient();

const TENANT_ID = DEFAULT_TENANT_ID;
const SALT = 'PARK_POS_2026_'; // Must match src/core/auth/pin.ts

function hashPin(pin: string): string {
    return createHash("sha256").update(SALT + pin).digest("hex");
}

function uuid(): string {
    return crypto.randomUUID();
}

async function main() {
    console.log("🌱 Seeding PRODUCTION database with minimal data...");
    console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'}`);
    console.log("");

    // 1. TENANT SETTINGS
    console.log("1️⃣  Creating tenant settings...");
    await prisma.tenant_settings.upsert({
        where: { tenant_id: TENANT_ID },
        update: {},
        create: {
            tenant_id: TENANT_ID,
            legal_name: "PARK POS",
            ruc: "20123456789",
            address_text: "Lima, Perú",
            timezone: "America/Lima",
            currency: "PEN",
            receipt_footer_text: "¡Gracias por su preferencia!",
            kds_audio_enabled: true,
            enable_tips: true,
        },
    });
    console.log("   ✅ Tenant settings created");

    // 2. ADMIN EMPLOYEE (PIN: 1234)
    console.log("\n2️⃣  Creating ADMIN employee...");
    const adminEmployee = {
        id: DEFAULT_EMPLOYEE_IDS.ADMIN,
        name: "Admin Principal",
        role: "ADMIN",
        pin: "1234"
    };

    const existing = await prisma.employees.findFirst({
        where: { tenant_id: TENANT_ID, name: adminEmployee.name }
    });

    if (existing) {
        await prisma.employees.update({
            where: { id: existing.id },
            data: { pin_hash: hashPin(adminEmployee.pin) }
        });
        console.log(`   ✅ Admin employee updated (ID: ${existing.id})`);
    } else {
        await prisma.employees.create({
            data: {
                id: adminEmployee.id,
                tenant_id: TENANT_ID,
                name: adminEmployee.name,
                role: adminEmployee.role,
                pin_hash: hashPin(adminEmployee.pin),
                is_active: true,
            },
        });
        console.log(`   ✅ Admin employee created (ID: ${adminEmployee.id})`);
    }
    console.log(`   🔑 Login PIN: ${adminEmployee.pin}`);

    // 3. LOCATION
    console.log("\n3️⃣  Creating location...");
    const location = await prisma.locations.upsert({
        where: { tenant_id_code: { tenant_id: TENANT_ID, code: "LOCAL-01" } },
        update: {},
        create: {
            id: DEFAULT_LOCATION_ID,
            tenant_id: TENANT_ID,
            code: "LOCAL-01",
            name: "Sucursal Principal",
            address: "Lima, Perú",
            phone: "+51 1 234 5678",
            timezone: "America/Lima",
        },
    });
    console.log(`   ✅ Location created (ID: ${location.id})`);

    // 4. STATIONS
    console.log("\n4️⃣  Creating stations...");
    const stations = [
        { code: "PARRILLA", name: "Parrilla" },
        { code: "COCINA", name: "Cocina" },
        { code: "BAR", name: "Bar" },
        { code: "FRIOS", name: "Fríos" },
        { code: "POSTRES", name: "Postres" },
    ];

    for (const st of stations) {
        await prisma.stations.upsert({
            where: { tenant_id_code: { tenant_id: TENANT_ID, code: st.code } },
            update: {},
            create: { id: uuid(), tenant_id: TENANT_ID, code: st.code, name: st.name },
        });
    }
    console.log(`   ✅ ${stations.length} stations created`);

    // 5. PRODUCTS (Essential menu items)
    console.log("\n5️⃣  Creating products...");
    const products = [
        { sku: "POLLO-ENT", name: "Pollo Entero", price: 5500, category: "POLLOS", station: "PARRILLA" },
        { sku: "POLLO-1/2", name: "1/2 Pollo", price: 2800, category: "POLLOS", station: "PARRILLA" },
        { sku: "POLLO-1/4", name: "1/4 Pollo", price: 1500, category: "POLLOS", station: "PARRILLA" },
        { sku: "PAPAS-GDE", name: "Papas Fritas Grande", price: 1200, category: "GUARNICIONES", station: "COCINA" },
        { sku: "PAPAS-MED", name: "Papas Fritas Mediana", price: 800, category: "GUARNICIONES", station: "COCINA" },
        { sku: "ENSALADA", name: "Ensalada", price: 600, category: "GUARNICIONES", station: "FRIOS" },
        { sku: "INCA-1.5L", name: "Inca Kola 1.5L", price: 900, category: "BEBIDAS", station: "BAR" },
        { sku: "COCA-1.5L", name: "Coca Cola 1.5L", price: 900, category: "BEBIDAS", station: "BAR" },
        { sku: "AGUA-500", name: "Agua 500ml", price: 250, category: "BEBIDAS", station: "BAR" },
        { sku: "CHICHA-JR", name: "Chicha Morada Jarra", price: 1200, category: "BEBIDAS", station: "BAR" },
    ];

    for (const p of products) {
        await prisma.products.upsert({
            where: { tenant_id_sku: { tenant_id: TENANT_ID, sku: p.sku } },
            update: { price_cents: p.price },
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                sku: p.sku,
                name: p.name,
                price_cents: p.price,
                category: p.category,
                station: p.station,
            },
        });
    }
    console.log(`   ✅ ${products.length} products created`);

    // 6. ZONES & TABLES
    console.log("\n6️⃣  Creating zones and tables...");
    const zones = [
        { code: "SALON", name: "Salón Principal", color: "#4CAF50", tables: 6 },
        { code: "TERRAZA", name: "Terraza", color: "#2196F3", tables: 4 },
    ];

    let tableNum = 1;
    for (const z of zones) {
        const zoneId = uuid();
        await prisma.zones.upsert({
            where: { tenant_id_location_id_code: { tenant_id: TENANT_ID, location_id: location.id, code: z.code } },
            update: {},
            create: {
                id: zoneId,
                tenant_id: TENANT_ID,
                location_id: location.id,
                code: z.code,
                name: z.name,
                color: z.color,
            },
        });

        for (let i = 0; i < z.tables; i++) {
            await prisma.tables.upsert({
                where: { tenant_id_location_id_number: { tenant_id: TENANT_ID, location_id: location.id, number: String(tableNum) } },
                update: {},
                create: {
                    id: uuid(),
                    tenant_id: TENANT_ID,
                    location_id: location.id,
                    zone_id: zoneId,
                    number: String(tableNum),
                    capacity: 4,
                    position_x: (i % 3) * 100,
                    position_y: Math.floor(i / 3) * 100,
                },
            });
            tableNum++;
        }
    }
    console.log(`   ✅ ${zones.length} zones, ${tableNum - 1} tables created`);

    // 7. TERMINALS
    console.log("\n7️⃣  Creating terminals...");
    const terminals = [
        { terminal_id: "CAJA_01", role: "CASHIER" },
        { terminal_id: "SPC_HORNO", role: "KDS" },
        { terminal_id: "MOZO_01", role: "WAITER" },
    ];

    for (const t of terminals) {
        await prisma.terminals.upsert({
            where: { tenant_id_terminal_id: { tenant_id: TENANT_ID, terminal_id: t.terminal_id } },
            update: {},
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                terminal_id: t.terminal_id,
                is_allowed: true,
            },
        });
    }
    console.log(`   ✅ ${terminals.length} terminals created`);

    // 8. TERMINAL DEVICES (Active status for immediate use)
    console.log("\n8️⃣  Creating terminal devices...");
    const terminalDevices = [
        { terminal_id: "CAJA_01", role: "CASHIER", status: "active", device_name: "Caja Principal" },
        { terminal_id: "SPC_HORNO", role: "KDS", status: "active", device_name: "Horno/Parrilla" },
        { terminal_id: "MOZO_01", role: "WAITER", status: "active", device_name: "Mesero 1" },
    ];

    for (const td of terminalDevices) {
        const existing = await prisma.terminal_devices.findUnique({
            where: { terminal_id: td.terminal_id }
        });

        if (!existing) {
            const now = new Date();
            await prisma.terminal_devices.create({
                data: {
                    terminal_id: td.terminal_id,
                    tenant_id: TENANT_ID,
                    role: td.role,
                    fingerprint_hash: createHash("sha256").update(`fp_${td.terminal_id}_prod`).digest("hex"),
                    fingerprint_salt: createHash("sha256").update(TENANT_ID).digest("hex").slice(0, 16),
                    status: td.status,
                    bound_at: now,
                    last_seen_at: now,
                    last_fingerprint_check: now,
                    drift_score: 0,
                    location_id: "LOC01",
                    device_name: td.device_name,
                },
            });
        }
    }
    console.log(`   ✅ ${terminalDevices.length} terminal devices created`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ PRODUCTION DATABASE SEEDED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    console.log(`   • Tenant: ${TENANT_ID}`);
    console.log(`   • Location: ${location.id}`);
    console.log(`   • Admin Employee: ${adminEmployee.name}`);
    console.log(`   • Login PIN: ${adminEmployee.pin}`);
    console.log(`   • Products: ${products.length}`);
    console.log(`   • Tables: ${tableNum - 1}`);
    console.log(`   • Terminals: ${terminals.length}`);
    console.log("\n🚀 You can now login to the admin panel with PIN: 1234");
    console.log("");
}

main()
    .catch((e) => {
        console.error("\n❌ Error seeding database:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
