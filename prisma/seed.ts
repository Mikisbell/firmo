import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

const TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SALT = 'PARK_POS_2026_'; // Must match src/core/auth/pin.ts

// UUIDs fijos para employees - DEBEN coincidir con src/core/config/terminal.ts
const EMPLOYEE_IDS = {
    ADMIN: "00000000-0000-0000-0000-000000000001",
    CASHIER_MARIA: "00000000-0000-0000-0000-000000000002",
    WAITER_CARLOS: "00000000-0000-0000-0000-000000000003",
    KITCHEN_LUIS: "00000000-0000-0000-0000-000000000004",
    PARRILLA_PEDRO: "00000000-0000-0000-0000-000000000005",
    BAR_JORGE: "00000000-0000-0000-0000-000000000006",
    MANAGER_ROSA: "00000000-0000-0000-0000-000000000007",
    WAITER_ANA: "00000000-0000-0000-0000-000000000008",
    WAITER_CARMEN: "00000000-0000-0000-0000-000000000009",
    DELIVERY_MIGUEL: "00000000-0000-0000-0000-000000000010",
};

function hashPin(pin: string): string {
    return createHash("sha256").update(SALT + pin).digest("hex");
}

function uuid(): string {
    return crypto.randomUUID();
}

async function main() {
    console.log("🌱 Seeding database...");

    // 1. TENANT SETTINGS
    await prisma.tenant_settings.upsert({
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

    // 2. EMPLOYEES (con UUIDs fijos para coincidir con terminal.ts)
    const employees = [
        { id: EMPLOYEE_IDS.ADMIN, name: "Admin Principal", role: "ADMIN", pin: "1234" },
        { id: EMPLOYEE_IDS.CASHIER_MARIA, name: "María García", role: "CASHIER", pin: "1111" },
        { id: EMPLOYEE_IDS.WAITER_CARLOS, name: "Carlos López", role: "WAITER", pin: "2222" },
        { id: EMPLOYEE_IDS.WAITER_ANA, name: "Ana Torres", role: "WAITER", pin: "3333" },
        { id: EMPLOYEE_IDS.PARRILLA_PEDRO, name: "Pedro Ruiz", role: "KITCHEN", pin: "4444" },
        { id: EMPLOYEE_IDS.KITCHEN_LUIS, name: "Luis Mendoza", role: "KITCHEN", pin: "5555" },
        { id: EMPLOYEE_IDS.MANAGER_ROSA, name: "Rosa Flores", role: "MANAGER", pin: "0000" },
        { id: EMPLOYEE_IDS.BAR_JORGE, name: "Jorge Díaz", role: "BAR", pin: "6666" },
        { id: EMPLOYEE_IDS.WAITER_CARMEN, name: "Carmen Vega", role: "WAITER", pin: "7777" },
        { id: EMPLOYEE_IDS.DELIVERY_MIGUEL, name: "Miguel Soto", role: "DELIVERY", pin: "8888" },
    ];

    for (const emp of employees) {
        // First try to find existing employee by name
        const existing = await prisma.employees.findFirst({
            where: { tenant_id: TENANT_ID, name: emp.name }
        });
        
        if (existing) {
            // Update pin_hash to ensure it matches current SALT
            await prisma.employees.update({
                where: { id: existing.id },
                data: { pin_hash: hashPin(emp.pin) }
            });
        } else {
            await prisma.employees.create({
                data: {
                    id: emp.id,
                    tenant_id: TENANT_ID,
                    name: emp.name,
                    role: emp.role,
                    pin_hash: hashPin(emp.pin),
                    is_active: true,
                },
            });
        }
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
        await prisma.stations.upsert({
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
    console.log(`✅ ${products.length} products`);

    // 5. ZONES & TABLES
    const zones = [
        { code: "SALON", name: "Salón Principal", color: "#4CAF50", tables: 10 },
        { code: "TERRAZA", name: "Terraza", color: "#2196F3", tables: 6 },
        { code: "BAR", name: "Barra", color: "#FF9800", tables: 4 },
        { code: "VIP", name: "Zona VIP", color: "#9C27B0", tables: 3 },
    ];

    const locationId = uuid();
    
    // Create default location first
    await prisma.locations.upsert({
        where: { tenant_id_code: { tenant_id: TENANT_ID, code: "LOCAL-01" } },
        update: {},
        create: {
            id: locationId,
            tenant_id: TENANT_ID,
            code: "LOCAL-01",
            name: "Sucursal Principal",
            address: "Av. Principal 123",
            phone: "+51 1 234 5678",
            timezone: "America/Lima",
        },
    });
    console.log(`✅ 1 location`);
    
    let tableNum = 1;

    for (const z of zones) {
        const zoneId = uuid();
        await prisma.zones.upsert({
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
            await prisma.tables.upsert({
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
        { terminal_id: "SPC_HORNO", role: "KDS" },
        { terminal_id: "SPC_COCINA", role: "KDS" },
        { terminal_id: "SPC_BAR", role: "KDS" },
        { terminal_id: "MOZO_01", role: "WAITER" },
        { terminal_id: "MOZO_02", role: "WAITER" },
        { terminal_id: "MOZO_03", role: "WAITER" },
        { terminal_id: "MOZO_04", role: "WAITER" },
        { terminal_id: "MOZO_05", role: "WAITER" },
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
    console.log(`✅ ${terminals.length} terminals`);

    // 7. PROMOTIONS
    const promos = [
        { code: "COMBO10", name: "10% en Combos", type: "PERCENT", value: 10 },
        { code: "2X1CHICHA", name: "2x1 Chicha", type: "2X1", value: null },
        { code: "DELIVERY0", name: "Delivery Gratis", type: "DELIVERY_FEE_DISCOUNT", value: 100 },
    ];

    for (const p of promos) {
        await prisma.promotions.upsert({
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
        await prisma.printers.upsert({
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
        await prisma.delivery_zones.create({
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

    // 10. INVENTORY (Ingredientes básicos con FEFO)
    const today = new Date();
    const daysFromNow = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    
    const inventory = [
        { code: "POLLO-KG", name: "Pollo (kg)", unit: "KG", stock: 50, min: 10, cost: 1200, expiry: daysFromNow(3), lot: "LOT-POLLO-001" },
        { code: "PAPA-KG", name: "Papa (kg)", unit: "KG", stock: 100, min: 20, cost: 200, expiry: daysFromNow(14), lot: "LOT-PAPA-001" },
        { code: "ACEITE-LT", name: "Aceite (lt)", unit: "LT", stock: 30, min: 10, cost: 800, expiry: null, lot: null }, // No perecedero
        { code: "SAL-KG", name: "Sal (kg)", unit: "KG", stock: 10, min: 2, cost: 150, expiry: null, lot: null }, // No perecedero
        { code: "AJI-KG", name: "Ají (kg)", unit: "KG", stock: 5, min: 1, cost: 500, expiry: daysFromNow(1), lot: "LOT-AJI-001" }, // Vence mañana
        { code: "MAYONESA-KG", name: "Mayonesa (kg)", unit: "KG", stock: 8, min: 3, cost: 600, expiry: daysFromNow(0), lot: "LOT-MAYO-001" }, // Vence hoy
        { code: "KETCHUP-KG", name: "Ketchup (kg)", unit: "KG", stock: 6, min: 2, cost: 450, expiry: daysFromNow(-1), lot: "LOT-KETCH-001" }, // Ya venció
        { code: "MOSTAZA-KG", name: "Mostaza (kg)", unit: "KG", stock: 4, min: 1, cost: 400, expiry: daysFromNow(7), lot: "LOT-MOST-001" }, // Vence en 7 días
    ];

    for (const inv of inventory) {
        await prisma.inventory.upsert({
            where: { tenant_id_code: { tenant_id: TENANT_ID, code: inv.code } },
            update: {
                expiry_date: inv.expiry,
                lot_number: inv.lot,
                cost_cents: inv.cost,
            },
            create: {
                id: uuid(),
                tenant_id: TENANT_ID,
                code: inv.code,
                name: inv.name,
                unit: inv.unit,
                stock: inv.stock,
                min_stock: inv.min,
                cost_cents: inv.cost,
                expiry_date: inv.expiry,
                lot_number: inv.lot,
            },
        });
    }
    console.log(`✅ ${inventory.length} inventory items (con FEFO)`);

    // 11. TIP CONFIG
    await prisma.tip_config.upsert({
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
    await prisma.petty_cash_balance.upsert({
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
        // Primero buscar si existe
        let customer = await prisma.customers.findUnique({
            where: { tenant_id_phone: { tenant_id: TENANT_ID, phone: c.phone } },
        });

        if (!customer) {
            // Crear nuevo customer
            customer = await prisma.customers.create({
                data: {
                    id: uuid(),
                    tenant_id: TENANT_ID,
                    phone: c.phone,
                    name: c.name,
                    email: c.email,
                    total_orders: Math.floor(Math.random() * 20),
                    total_spent: Math.floor(Math.random() * 50000),
                },
            });
        }

        // Verificar si ya tiene dirección
        const existingAddress = await prisma.delivery_addresses.findFirst({
            where: { tenant_id: TENANT_ID, customer_id: customer.id },
        });

        if (!existingAddress) {
            // Crear dirección de delivery solo si no existe
            await prisma.delivery_addresses.create({
                data: {
                    id: uuid(),
                    tenant_id: TENANT_ID,
                    customer_id: customer.id,
                    label: "Casa",
                    address_text: c.address,
                    district: c.district,
                    is_default: true,
                },
            });
        }
    }
    console.log(`✅ ${customers.length} customers with addresses`);

    // 14. DRIVERS
    const drivers = [
        { name: "Miguel Soto", phone: "987654321" },
        { name: "Roberto Díaz", phone: "987654322" },
        { name: "Fernando Castro", phone: "987654323" },
    ];

    for (const d of drivers) {
        // Verificar si ya existe por nombre
        const existing = await prisma.drivers.findFirst({
            where: { tenant_id: TENANT_ID, name: d.name },
        });

        if (!existing) {
            await prisma.drivers.create({
                data: {
                    id: uuid(),
                    tenant_id: TENANT_ID,
                    name: d.name,
                    phone: d.phone,
                    is_active: true,
                },
            });
        }
    }
    console.log(`✅ ${drivers.length} drivers`);

    // ========================================================================
    // INVENTORY MODULE - Schema Completeness (Task 11.3)
    // ========================================================================

    // 15. SUPPLIER
    const supplierId = uuid();
    const existingSupplier = await prisma.suppliers.findFirst({
        where: { tenant_id: TENANT_ID, name: "Avícola San Fernando" }
    });

    if (!existingSupplier) {
        await prisma.suppliers.create({
            data: {
                id: supplierId,
                tenant_id: TENANT_ID,
                name: "Avícola San Fernando",
                ruc: "20100154308",
                contact_name: "José Ramírez",
                phone: "01-6196000",
                email: "ventas@sanfernando.com.pe",
                address: "Av. República de Panamá 4295, Surquillo",
                payment_terms: 15,
                min_order_cents: 50000, // S/500
                delivery_days: ["LUNES", "MIERCOLES", "VIERNES"],
                lead_time_days: 1,
                is_active: true,
            },
        });
        console.log(`✅ 1 supplier (Avícola San Fernando)`);
    } else {
        console.log(`✅ Supplier already exists`);
    }

    const supplier = existingSupplier || await prisma.suppliers.findFirst({
        where: { tenant_id: TENANT_ID, name: "Avícola San Fernando" }
    });

    // 16. SUPPLIER PRODUCTS
    if (supplier) {
        const supplierProducts = [
            { inventory_code: "POLLO-KG", supplier_sku: "SF-POLLO-001", unit_cost_cents: 1200, min_order_qty: 10 },
            { inventory_code: "PAPA-KG", supplier_sku: "SF-PAPA-001", unit_cost_cents: 200, min_order_qty: 50 },
        ];

        for (const sp of supplierProducts) {
            const existing = await prisma.supplier_products.findUnique({
                where: {
                    tenant_id_supplier_id_inventory_code: {
                        tenant_id: TENANT_ID,
                        supplier_id: supplier.id,
                        inventory_code: sp.inventory_code
                    }
                }
            });

            if (!existing) {
                await prisma.supplier_products.create({
                    data: {
                        id: uuid(),
                        tenant_id: TENANT_ID,
                        supplier_id: supplier.id,
                        inventory_code: sp.inventory_code,
                        supplier_sku: sp.supplier_sku,
                        unit_cost_cents: sp.unit_cost_cents,
                        min_order_qty: sp.min_order_qty,
                        lead_time_days: 1,
                        is_active: true,
                    },
                });
            }
        }
        console.log(`✅ ${supplierProducts.length} supplier products`);

        // 17. PURCHASE ORDER (Example)
        const existingPO = await prisma.purchase_orders.findFirst({
            where: { tenant_id: TENANT_ID, order_number: 1 }
        });

        if (!existingPO && supplier) {
            const poId = uuid();
            await prisma.purchase_orders.create({
                data: {
                    id: poId,
                    tenant_id: TENANT_ID,
                    location_id: locationId,
                    supplier_id: supplier.id,
                    order_number: 1,
                    status: "RECEIVED",
                    subtotal_cents: 22000,
                    tax_cents: 3960,
                    total_cents: 25960,
                    expected_delivery_date: new Date(),
                    notes: "Pedido inicial de prueba",
                    created_by: EMPLOYEE_IDS.ADMIN,
                    purchase_order_items: {
                        create: [
                            {
                                id: uuid(),
                                inventory_code: "POLLO-KG",
                                quantity_ordered: 10,
                                unit: "KG",
                                unit_cost_cents: 1200,
                                total_cents: 12000,
                            },
                            {
                                id: uuid(),
                                inventory_code: "PAPA-KG",
                                quantity_ordered: 50,
                                unit: "KG",
                                unit_cost_cents: 200,
                                total_cents: 10000,
                            },
                        ],
                    },
                },
            });
            console.log(`✅ 1 purchase order (PO-001)`);

            // 18. GOODS RECEIPT (Example)
            const grId = uuid();
            await prisma.goods_receipts.create({
                data: {
                    id: grId,
                    tenant_id: TENANT_ID,
                    location_id: locationId,
                    purchase_order_id: poId,
                    receipt_number: "GR-001",
                    status: "CONFIRMED",
                    received_by: EMPLOYEE_IDS.ADMIN,
                    received_at: new Date(),
                    notes: "Recepción completa",
                    goods_receipt_items: {
                        create: [
                            {
                                id: uuid(),
                                inventory_code: "POLLO-KG",
                                quantity_ordered: 10,
                                quantity_received: 10,
                                quantity_rejected: 0,
                                unit_cost_cents: 1200,
                                lot_number: "LOT-2026-001",
                                expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
                            },
                            {
                                id: uuid(),
                                inventory_code: "PAPA-KG",
                                quantity_ordered: 50,
                                quantity_received: 48,
                                quantity_rejected: 2,
                                rejection_reason: "Papas dañadas",
                                unit_cost_cents: 200,
                            },
                        ],
                    },
                },
            });
            console.log(`✅ 1 goods receipt (GR-001)`);
        }
    }

    // 19. RECIPES (Para deducción automática de inventario)
    const products_for_recipes = await prisma.products.findMany({
        where: { tenant_id: TENANT_ID, sku: { in: ["POLLO-ENT", "POLLO-1/2", "POLLO-1/4", "PAPAS-GDE", "PAPAS-MED"] } },
        select: { id: true, sku: true }
    });

    const recipeData: Record<string, Array<{ inventory_code: string; quantity: number; unit: string }>> = {
        "POLLO-ENT": [
            { inventory_code: "POLLO-KG", quantity: 1.5, unit: "KG" },
            { inventory_code: "SAL-KG", quantity: 0.02, unit: "KG" },
            { inventory_code: "AJI-KG", quantity: 0.05, unit: "KG" },
        ],
        "POLLO-1/2": [
            { inventory_code: "POLLO-KG", quantity: 0.75, unit: "KG" },
            { inventory_code: "SAL-KG", quantity: 0.01, unit: "KG" },
            { inventory_code: "AJI-KG", quantity: 0.025, unit: "KG" },
        ],
        "POLLO-1/4": [
            { inventory_code: "POLLO-KG", quantity: 0.375, unit: "KG" },
            { inventory_code: "SAL-KG", quantity: 0.005, unit: "KG" },
            { inventory_code: "AJI-KG", quantity: 0.0125, unit: "KG" },
        ],
        "PAPAS-GDE": [
            { inventory_code: "PAPA-KG", quantity: 0.5, unit: "KG" },
            { inventory_code: "ACEITE-LT", quantity: 0.1, unit: "LT" },
            { inventory_code: "SAL-KG", quantity: 0.005, unit: "KG" },
        ],
        "PAPAS-MED": [
            { inventory_code: "PAPA-KG", quantity: 0.3, unit: "KG" },
            { inventory_code: "ACEITE-LT", quantity: 0.06, unit: "LT" },
            { inventory_code: "SAL-KG", quantity: 0.003, unit: "KG" },
        ],
    };

    let recipesCreated = 0;
    for (const product of products_for_recipes) {
        const ingredients = recipeData[product.sku];
        if (ingredients) {
            const existing = await prisma.recipes.findUnique({
                where: { tenant_id_product_id: { tenant_id: TENANT_ID, product_id: product.id } }
            });

            if (!existing) {
                await prisma.recipes.create({
                    data: {
                        id: uuid(),
                        tenant_id: TENANT_ID,
                        product_id: product.id,
                        ingredients: ingredients,
                        yield_qty: 1,
                        is_active: true,
                    },
                });
                recipesCreated++;
            }
        }
    }
    console.log(`✅ ${recipesCreated} recipes created`);

    // Update inventory with location_id
    await prisma.inventory.updateMany({
        where: { tenant_id: TENANT_ID, location_id: null },
        data: { location_id: locationId }
    });
    console.log(`✅ Inventory location_id updated`);

    // ========================================================================
    // TERMINAL ARCHITECTURE v2 - Device Binding & Security
    // ========================================================================

    // 20. TERMINAL DEVICES (con diferentes estados para testing)
    const terminalDevices = [
        { terminal_id: "CAJA_01", role: "CASHIER", status: "active", device_name: "Caja Principal", location_id: "LOC01" },
        { terminal_id: "SPC_HORNO", role: "KDS", status: "active", device_name: "Horno/Parrilla", location_id: "LOC01" },
        { terminal_id: "SPC_COCINA", role: "KDS", status: "active", device_name: "Cocina", location_id: "LOC01" },
        { terminal_id: "SPC_BAR", role: "BAR", status: "active", device_name: "Bar", location_id: "LOC01" },
        { terminal_id: "MOZO_01", role: "WAITER", status: "active", device_name: "Mesero 1", location_id: "LOC01" },
        { terminal_id: "MOZO_02", role: "WAITER", status: "active", device_name: "Mesero 2", location_id: "LOC01" },
        { terminal_id: "MOZO_03", role: "WAITER", status: "pending", device_name: "Mesero 3", location_id: "LOC01" }, // Pending activation
        { terminal_id: "MOZO_04", role: "WAITER", status: "disabled", device_name: "Mesero 4", location_id: "LOC01" }, // Disabled
        { terminal_id: "MOZO_05", role: "WAITER", status: "pending", device_name: "Mesero 5", location_id: "LOC01" }, // Pending activation
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
                    fingerprint_hash: td.status === "active" ? createHash("sha256").update(`fp_${td.terminal_id}_test`).digest("hex") : null,
                    fingerprint_salt: createHash("sha256").update(TENANT_ID).digest("hex").slice(0, 16),
                    status: td.status,
                    bound_at: td.status === "active" ? now : null,
                    last_seen_at: now,
                    last_fingerprint_check: now,
                    drift_score: 0,
                    location_id: td.location_id,
                    device_name: td.device_name,
                },
            });
        }
    }
    console.log(`✅ ${terminalDevices.length} terminal devices (v2)`);

    // 21. ACTIVATION CODES (para terminales pending)
    const pendingTerminals = terminalDevices.filter(t => t.status === "pending");
    for (const pt of pendingTerminals) {
        const existing = await prisma.activation_codes.findFirst({
            where: { terminal_id: pt.terminal_id, used: false }
        });

        if (!existing) {
            // Generate 6-digit code
            const code = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            await prisma.activation_codes.create({
                data: {
                    terminal_id: pt.terminal_id,
                    code: code,
                    expires_at: expiresAt,
                    attempts: 0,
                    used: false,
                    created_by: EMPLOYEE_IDS.ADMIN,
                },
            });
        }
    }
    console.log(`✅ ${pendingTerminals.length} activation codes`);

    // 22. AUTH EVENTS (sample events for audit log)
    const authEventTypes = [
        { terminal_id: "CAJA_01", event_type: "login_success", employee_id: EMPLOYEE_IDS.CASHIER_MARIA, risk_score: 10, fingerprint_match: 95 },
        { terminal_id: "CAJA_01", event_type: "logout", employee_id: EMPLOYEE_IDS.CASHIER_MARIA, risk_score: null, fingerprint_match: null },
        { terminal_id: "MOZO_01", event_type: "login_success", employee_id: EMPLOYEE_IDS.WAITER_CARLOS, risk_score: 15, fingerprint_match: 92 },
        { terminal_id: "MOZO_02", event_type: "login_failed", employee_id: null, risk_score: 75, fingerprint_match: 30 },
        { terminal_id: "SPC_HORNO", event_type: "device_activated", employee_id: null, risk_score: 0, fingerprint_match: 100 },
    ];

    // Only create if no auth events exist
    const existingAuthEvents = await prisma.auth_events.count({ where: { tenant_id: TENANT_ID } });
    if (existingAuthEvents === 0) {
        for (const ae of authEventTypes) {
            await prisma.auth_events.create({
                data: {
                    tenant_id: TENANT_ID,
                    terminal_id: ae.terminal_id,
                    employee_id: ae.employee_id,
                    event_type: ae.event_type,
                    risk_score: ae.risk_score,
                    fingerprint_match: ae.fingerprint_match,
                    ip_address: "192.168.1.100",
                    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                    metadata: {},
                },
            });
        }
        console.log(`✅ ${authEventTypes.length} auth events (sample)`);
    }

    // 23. SECURITY ALERTS (sample alerts)
    const securityAlerts = [
        { terminal_id: "MOZO_02", alert_type: "fingerprint_mismatch", severity: "high", message: "Fingerprint mismatch detected - possible device change" },
        { terminal_id: "MOZO_04", alert_type: "terminal_disabled", severity: "medium", message: "Terminal disabled by admin" },
    ];

    const existingAlerts = await prisma.security_alerts.count({ where: { tenant_id: TENANT_ID } });
    if (existingAlerts === 0) {
        for (const sa of securityAlerts) {
            await prisma.security_alerts.create({
                data: {
                    tenant_id: TENANT_ID,
                    terminal_id: sa.terminal_id,
                    alert_type: sa.alert_type,
                    severity: sa.severity,
                    message: sa.message,
                    acknowledged: false,
                },
            });
        }
        console.log(`✅ ${securityAlerts.length} security alerts (sample)`);
    }

    console.log("\n🎉 Seed completed!");
    console.log(`\n📋 Test PINs:`);
    employees.forEach(e => console.log(`   ${e.name}: ${e.pin}`));
    console.log(`\n📱 Test Customers (para delivery):`);
    customers.forEach(c => console.log(`   ${c.name}: ${c.phone}`));
    console.log(`\n📦 Inventory Module:`);
    console.log(`   - Supplier: Avícola San Fernando`);
    console.log(`   - PO-001: 10kg Pollo + 50kg Papa`);
    console.log(`   - GR-001: Recepción completa (2kg papa rechazada)`);
    console.log(`   - Recipes: Pollo entero, 1/2, 1/4, Papas grande/mediana`);
    console.log(`\n🔐 Terminal Architecture v2:`);
    console.log(`   - Active terminals: CAJA_01, SPC_HORNO, SPC_COCINA, SPC_BAR, MOZO_01, MOZO_02`);
    console.log(`   - Pending activation: MOZO_03, MOZO_05 (check activation_codes table)`);
    console.log(`   - Disabled: MOZO_04`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
