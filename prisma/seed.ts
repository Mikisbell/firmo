import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

const TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function hashPin(pin: string): string {
    return createHash("sha256").update(pin).digest("hex");
}

function uuid(): string {
    return crypto.randomUUID();
}

async function main() {
    console.log("🌱 Seeding database...");

    // 1. TENANT SETTINGS
    await prisma.tenantSettings.upsert({
        where: { tenant_id: TENANT_ID },
        update: {},
        create: {
            tenant_id: TENANT_ID,
            legal_name: "Pollería El Sabrosón S.A.C.",
            ruc: "20123456789",
            address_text: "Av. La Marina 2500, San Miguel, Lima",
            timezone: "America/Lima",
            currency: "PEN",
            receipt_footer_text: "¡Gracias por su preferencia!",
            kds_audio_enabled: true,
            enable_tips: true,
        },
    });

    // 2. EMPLOYEES
    const employees = [
        { id: uuid(), name: "Admin Principal", role: "ADMIN", pin: "1234" },
        { id: uuid(), name: "María García", role: "CASHIER", pin: "1111" },
        { id: uuid(), name: "Carlos López", role: "WAITER", pin: "2222" },
        { id: uuid(), name: "Ana Torres", role: "WAITER", pin: "3333" },
        { id: uuid(), name: "Pedro Ruiz", role: "WAITER", pin: "4444" },
        { id: uuid(), name: "Luis Mendoza", role: "KITCHEN", pin: "5555" },
        { id: uuid(), name: "Rosa Flores", role: "MANAGER", pin: "0000" },
        { id: uuid(), name: "Jorge Díaz", role: "BAR", pin: "6666" },
        { id: uuid(), name: "Carmen Vega", role: "WAITER", pin: "7777" },
        { id: uuid(), name: "Miguel Soto", role: "DELIVERY", pin: "8888" },
    ];

    for (const emp of employees) {
        await prisma.employee.upsert({
            where: { id: emp.id },
            update: {},
            create: {
                id: emp.id,
                tenant_id: TENANT_ID,
                name: emp.name,
                role: emp.role,
                pin_hash: hashPin(emp.pin),
                is_active: true,
            },
        });
    }
    console.log(`✅ ${employees.length} employees`);

    // 3. STATIONS
    const stations = [
        { code: "PARRILLA", name: "Parrilla" },
        { code: "COCINA", name: "Cocina Caliente" },
        { code: "BAR", name: "Bar" },
        { code: "FRIOS", name: "Platos Fríos" },
        { code: "POSTRES", name: "Postres" },
    ];

    for (const st of stations) {
        await prisma.station.upsert({
            where: { tenant_id_code: { tenant_id: TENANT_ID, code: st.code } },
            update: {},
            create: { id: uuid(), tenant_id: TENANT_ID, code: st.code, name: st.name },
        });
    }
    console.log(`✅ ${stations.length} stations`);

    // 4. PRODUCTS (Menú completo de pollería)
    const products = [
        // Pollos
        { sku: "POLLO-ENT", name: "Pollo Entero", price: 5500, category: "POLLOS", station: "PARRILLA" },
        { sku: "POLLO-1/2", name: "1/2 Pollo", price: 2800, category: "POLLOS", station: "PARRILLA" },
        { sku: "POLLO-1/4", name: "1/4 Pollo", price: 1500, category: "POLLOS", station: "PARRILLA" },
        { sku: "POLLO-1/8", name: "1/8 Pollo", price: 800, category: "POLLOS", station: "PARRILLA" },
        // Combos
        { sku: "COMBO-FAM", name: "Combo Familiar", price: 8900, category: "COMBOS", station: "PARRILLA" },
        { sku: "COMBO-PAR", name: "Combo Pareja", price: 4500, category: "COMBOS", station: "PARRILLA" },
        { sku: "COMBO-PER", name: "Combo Personal", price: 2200, category: "COMBOS", station: "PARRILLA" },
        // Guarniciones
        { sku: "PAPAS-GDE", name: "Papas Fritas Grande", price: 1200, category: "GUARNICIONES", station: "COCINA" },
        { sku: "PAPAS-MED", name: "Papas Fritas Mediana", price: 800, category: "GUARNICIONES", station: "COCINA" },
        { sku: "PAPAS-CHI", name: "Papas Fritas Chica", price: 500, category: "GUARNICIONES", station: "COCINA" },
        { sku: "ENSALADA", name: "Ensalada", price: 600, category: "GUARNICIONES", station: "FRIOS" },
        { sku: "ARROZ", name: "Porción de Arroz", price: 400, category: "GUARNICIONES", station: "COCINA" },
        // Bebidas
        { sku: "INCA-1.5L", name: "Inca Kola 1.5L", price: 900, category: "BEBIDAS", station: "BAR" },
        { sku: "INCA-500", name: "Inca Kola 500ml", price: 400, category: "BEBIDAS", station: "BAR" },
        { sku: "COCA-1.5L", name: "Coca Cola 1.5L", price: 900, category: "BEBIDAS", station: "BAR" },
        { sku: "COCA-500", name: "Coca Cola 500ml", price: 400, category: "BEBIDAS", station: "BAR" },
        { sku: "AGUA-500", name: "Agua 500ml", price: 250, category: "BEBIDAS", station: "BAR" },
        { sku: "CHICHA-JR", name: "Chicha Morada Jarra", price: 1200, category: "BEBIDAS", station: "BAR" },
        { sku: "CHICHA-VS", name: "Chicha Morada Vaso", price: 400, category: "BEBIDAS", station: "BAR" },
        // Extras
        { sku: "SALSA-AJI", name: "Ají Extra", price: 100, category: "EXTRAS", station: "FRIOS" },
        { sku: "SALSA-MAY", name: "Mayonesa Extra", price: 100, category: "EXTRAS", station: "FRIOS" },
        { sku: "SALSA-KET", name: "Ketchup Extra", price: 100, category: "EXTRAS", station: "FRIOS" },
        // Postres
        { sku: "TORTA-CHO", name: "Torta de Chocolate", price: 800, category: "POSTRES", station: "POSTRES" },
        { sku: "HELADO", name: "Helado", price: 500, category: "POSTRES", station: "POSTRES" },
    ];

    for (const p of products) {
        await prisma.product.upsert({
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
    console.log(`✅ ${products.length} products`);

    // 5. ZONES & TABLES
    const zones = [
        { code: "SALON", name: "Salón Principal", color: "#4CAF50", tables: 10 },
        { code: "TERRAZA", name: "Terraza", color: "#2196F3", tables: 6 },
        { code: "BAR", name: "Barra", color: "#FF9800", tables: 4 },
        { code: "VIP", name: "Zona VIP", color: "#9C27B0", tables: 3 },
    ];

    const locationId = uuid();
    let tableNum = 1;

    for (const z of zones) {
        const zoneId = uuid();
        await prisma.zone.upsert({
            where: { tenant_id_location_id_code: { tenant_id: TENANT_ID, location_id: locationId, code: z.code } },
            update: {},
            create: {
                id: zoneId,
                tenant_id: TENANT_ID,
                location_id: locationId,
                code: z.code,
                name: z.name,
                color: z.color,
            },
        });

        for (let i = 0; i < z.tables; i++) {
            await prisma.table.upsert({
                where: { tenant_id_location_id_number: { tenant_id: TENANT_ID, location_id: locationId, number: String(tableNum) } },
                update: {},
                create: {
                    id: uuid(),
                    tenant_id: TENANT_ID,
                    location_id: locationId,
                    zone_id: zoneId,
                    number: String(tableNum),
                    capacity: z.code === "VIP" ? 8 : 4,
                    position_x: (i % 5) * 100,
                    position_y: Math.floor(i / 5) * 100,
                },
            });
            tableNum++;
        }
    }
    console.log(`✅ ${zones.length} zones, ${tableNum - 1} tables`);

    // 6. TERMINALS
    const terminals = [
        { terminal_id: "CAJA_01", role: "CASHIER" },
        { terminal_id: "KDS_PARRILLA", role: "KDS" },
        { terminal_id: "KDS_COCINA", role: "KDS" },
        { terminal_id: "KDS_BAR", role: "KDS" },
        { terminal_id: "MOZO_01", role: "WAITER" },
        { terminal_id: "MOZO_02", role: "WAITER" },
        { terminal_id: "MOZO_03", role: "WAITER" },
        { terminal_id: "MOZO_04", role: "WAITER" },
        { terminal_id: "MOZO_05", role: "WAITER" },
    ];

    for (const t of terminals) {
        await prisma.terminal.upsert({
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
    console.log(`✅ ${terminals.length} terminals`);

    // 7. PROMOTIONS
    const promos = [
        { code: "COMBO10", name: "10% en Combos", type: "PERCENT", value: 10 },
        { code: "2X1CHICHA", name: "2x1 Chicha", type: "2X1", value: null },
        { code: "DELIVERY0", name: "Delivery Gratis", type: "DELIVERY_FEE_DISCOUNT", value: 100 },
    ];

    for (const p of promos) {
        await prisma.promotion.upsert({
            where: { id: uuid() },
            update: {},
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                code: p.code,
                name: p.name,
                type: p.type,
                value: p.value,
                rules: {},
                is_active: true,
            },
        });
    }
    console.log(`✅ ${promos.length} promotions`);

    // 8. PRINTERS
    const printers = [
        { name: "Impresora Caja", station_code: "CAJA", connection_type: "USB" },
        { name: "Impresora Parrilla", station_code: "PARRILLA", connection_type: "LAN" },
        { name: "Impresora Cocina", station_code: "COCINA", connection_type: "LAN" },
        { name: "Impresora Bar", station_code: "BAR", connection_type: "LAN" },
    ];

    for (const p of printers) {
        await prisma.printer.upsert({
            where: { id: uuid() },
            update: {},
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                name: p.name,
                station_code: p.station_code,
                connection_type: p.connection_type,
                connection: {},
            },
        });
    }
    console.log(`✅ ${printers.length} printers`);

    // 9. DELIVERY ZONES
    const deliveryZones = [
        { name: "Zona 1 - Cercado", fee: 500, mins: 20 },
        { name: "Zona 2 - San Miguel", fee: 700, mins: 30 },
        { name: "Zona 3 - Magdalena", fee: 900, mins: 40 },
    ];

    for (const dz of deliveryZones) {
        await prisma.deliveryZone.create({
            data: {
                id: uuid(),
                tenant_id: TENANT_ID,
                location_id: locationId,
                name: dz.name,
                delivery_fee: dz.fee,
                estimated_mins: dz.mins,
            },
        });
    }
    console.log(`✅ ${deliveryZones.length} delivery zones`);

    // 10. INVENTORY (Ingredientes básicos)
    const inventory = [
        { code: "POLLO-KG", name: "Pollo (kg)", unit: "KG", stock: 50, min: 10 },
        { code: "PAPA-KG", name: "Papa (kg)", unit: "KG", stock: 100, min: 20 },
        { code: "ACEITE-LT", name: "Aceite (lt)", unit: "LT", stock: 30, min: 10 },
        { code: "SAL-KG", name: "Sal (kg)", unit: "KG", stock: 10, min: 2 },
        { code: "AJI-KG", name: "Ají (kg)", unit: "KG", stock: 5, min: 1 },
    ];

    for (const inv of inventory) {
        await prisma.inventory.upsert({
            where: { tenant_id_code: { tenant_id: TENANT_ID, code: inv.code } },
            update: {},
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                code: inv.code,
                name: inv.name,
                unit: inv.unit,
                stock: inv.stock,
                min_stock: inv.min,
            },
        });
    }
    console.log(`✅ ${inventory.length} inventory items`);

    // 11. TIP CONFIG
    await prisma.tipConfig.upsert({
        where: { tenant_id_location_id: { tenant_id: TENANT_ID, location_id: locationId } },
        update: {},
        create: {
            id: uuid(),
            tenant_id: TENANT_ID,
            location_id: locationId,
            distribution_mode: "INDIVIDUAL",
            include_kitchen: false,
        },
    });
    console.log(`✅ Tip config`);

    // 12. PETTY CASH BALANCE
    await prisma.pettyCashBalance.upsert({
        where: { tenant_id_location_id: { tenant_id: TENANT_ID, location_id: locationId } },
        update: {},
        create: {
            id: uuid(),
            tenant_id: TENANT_ID,
            location_id: locationId,
            current_balance: 20000, // S/200
            max_balance: 50000,
            min_balance: 10000,
        },
    });
    console.log(`✅ Petty cash balance`);

    // 13. CUSTOMERS con direcciones de delivery
    const customers = [
        { phone: "999111222", name: "Juan Pérez", email: "juan@email.com", address: "Jr. Huancayo 456, San Miguel", district: "San Miguel" },
        { phone: "999333444", name: "María Rodríguez", email: "maria@email.com", address: "Av. Brasil 1200, Magdalena", district: "Magdalena" },
        { phone: "999555666", name: "Carlos Gómez", email: "carlos@email.com", address: "Calle Los Pinos 89, San Miguel", district: "San Miguel" },
        { phone: "999777888", name: "Ana Martínez", email: "ana@email.com", address: "Av. La Marina 3500, San Miguel", district: "San Miguel" },
        { phone: "999999000", name: "Pedro Sánchez", email: "pedro@email.com", address: "Jr. Sucre 234, Cercado", district: "Cercado" },
    ];

    for (const c of customers) {
        const customerId = uuid();
        await prisma.customer.upsert({
            where: { tenant_id_phone: { tenant_id: TENANT_ID, phone: c.phone } },
            update: {},
            create: {
                id: customerId,
                tenant_id: TENANT_ID,
                phone: c.phone,
                name: c.name,
                email: c.email,
                total_orders: Math.floor(Math.random() * 20),
                total_spent: Math.floor(Math.random() * 50000),
            },
        });

        // Crear dirección de delivery
        await prisma.deliveryAddress.create({
            data: {
                id: uuid(),
                tenant_id: TENANT_ID,
                customer_id: customerId,
                label: "Casa",
                address_text: c.address,
                district: c.district,
                is_default: true,
            },
        });
    }
    console.log(`✅ ${customers.length} customers with addresses`);

    // 14. DRIVERS
    const drivers = [
        { name: "Miguel Soto", phone: "987654321" },
        { name: "Roberto Díaz", phone: "987654322" },
        { name: "Fernando Castro", phone: "987654323" },
    ];

    for (const d of drivers) {
        await prisma.driver.create({
            data: {
                id: uuid(),
                tenant_id: TENANT_ID,
                name: d.name,
                phone: d.phone,
                is_active: true,
            },
        });
    }
    console.log(`✅ ${drivers.length} drivers`);

    console.log("\n🎉 Seed completed!");
    console.log(`\n📋 Test PINs:`);
    employees.forEach(e => console.log(`   ${e.name}: ${e.pin}`));
    console.log(`\n📱 Test Customers (para delivery):`);
    customers.forEach(c => console.log(`   ${c.name}: ${c.phone}`));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
