// scripts/cleanup-and-indices.ts
// Limpia datos huérfanos y crea índices de performance
// Ejecutar con: npx ts-node scripts/cleanup-and-indices.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Iniciando limpieza de datos huérfanos...\n");

    // ============================================================================
    // PASO 1: Diagnóstico
    // ============================================================================
    console.log("📊 Diagnóstico de datos huérfanos:");

    const orphanedAddresses = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM delivery_addresses da
        WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = da.customer_id)
    `;
    console.log(`   - delivery_addresses huérfanas: ${orphanedAddresses[0]?.count || 0}`);

    const orphanedCouponsCustomer = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM coupons cp
        WHERE cp.customer_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = cp.customer_id)
    `;
    console.log(`   - coupons sin customer: ${orphanedCouponsCustomer[0]?.count || 0}`);

    const orphanedInvoices = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM invoices i
        WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = i.order_id)
    `;
    console.log(`   - invoices sin order: ${orphanedInvoices[0]?.count || 0}`);

    const orphanedShifts = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM shifts s
        WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = s.opened_by)
    `;
    console.log(`   - shifts sin opener: ${orphanedShifts[0]?.count || 0}`);

    // ============================================================================
    // PASO 2: Limpieza
    // ============================================================================
    console.log("\n🗑️  Limpiando datos huérfanos...");

    // 2.1 Eliminar delivery_addresses huérfanas
    const deletedAddresses = await prisma.$executeRaw`
        DELETE FROM delivery_addresses da
        WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = da.customer_id)
    `;
    console.log(`   ✓ Eliminadas ${deletedAddresses} delivery_addresses huérfanas`);

    // 2.2 Limpiar coupons con customer_id inválido
    const cleanedCouponsCustomer = await prisma.$executeRaw`
        UPDATE coupons SET customer_id = NULL
        WHERE customer_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = coupons.customer_id)
    `;
    console.log(`   ✓ Limpiados ${cleanedCouponsCustomer} coupons con customer inválido`);

    // 2.3 Limpiar coupons con promotion_id inválido
    const cleanedCouponsPromo = await prisma.$executeRaw`
        UPDATE coupons SET promotion_id = NULL
        WHERE promotion_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = coupons.promotion_id)
    `;
    console.log(`   ✓ Limpiados ${cleanedCouponsPromo} coupons con promotion inválida`);

    // 2.4 Eliminar invoices huérfanas
    const deletedInvoices = await prisma.$executeRaw`
        DELETE FROM invoices i
        WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = i.order_id)
    `;
    console.log(`   ✓ Eliminadas ${deletedInvoices} invoices huérfanas`);

    // 2.5 Limpiar orders con promotion_id inválido
    const cleanedOrders = await prisma.$executeRaw`
        UPDATE orders SET promotion_id = NULL
        WHERE promotion_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = orders.promotion_id)
    `;
    console.log(`   ✓ Limpiadas ${cleanedOrders} orders con promotion inválida`);

    // 2.6 Eliminar shifts huérfanos
    const deletedShifts = await prisma.$executeRaw`
        DELETE FROM shifts s
        WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = s.opened_by)
    `;
    console.log(`   ✓ Eliminados ${deletedShifts} shifts huérfanos`);

    // ============================================================================
    // PASO 3: Crear índices
    // ============================================================================
    console.log("\n📇 Creando índices de performance...");

    // EVENTS
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_events_replay ON events (tenant_id, entity_id, occurred_at ASC)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_events_by_type ON events (tenant_id, type, occurred_at DESC)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_events_by_terminal ON events (terminal_id, occurred_at DESC)`;
    console.log("   ✓ Índices de events creados");

    // SHIFTS
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_shifts_terminal_status ON shifts (tenant_id, terminal_id, status)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_shifts_history ON shifts (tenant_id, opened_at DESC)`;
    console.log("   ✓ Índices de shifts creados");

    // ORDERS
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (tenant_id, order_number)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_orders_terminal ON orders (tenant_id, terminal_id, created_at DESC)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON orders (tenant_id, fulfillment_status)`;
    console.log("   ✓ Índices de orders creados");

    // PRODUCTS
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_products_station ON products (tenant_id, station, is_active)`;
    console.log("   ✓ Índice de products creado");

    // EVENT_OUTBOX
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_outbox_pending ON event_outbox (published, created_at) WHERE published = false`;
    console.log("   ✓ Índice de event_outbox creado");

    // PROCESSED_EVENTS
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_processed_cleanup ON processed_events (tenant_id, processed_at)`;
    console.log("   ✓ Índice de processed_events creado");

    // GIN INDEX para JSONB
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON orders USING GIN (items jsonb_path_ops)`;
    console.log("   ✓ Índice GIN para items JSON creado");

    // PARTIAL INDEX para órdenes activas
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_orders_active ON orders (tenant_id, created_at DESC) WHERE order_status IN ('OPEN', 'IN_PROGRESS')`;
    console.log("   ✓ Índice parcial para órdenes activas creado");

    // ============================================================================
    // PASO 4: Agregar columnas opcionales
    // ============================================================================
    console.log("\n📝 Agregando columnas opcionales...");

    try {
        await prisma.$executeRaw`ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS event_type VARCHAR(100)`;
        await prisma.$executeRaw`ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS aggregate_id UUID`;
        await prisma.$executeRaw`ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 5`;
        await prisma.$executeRaw`ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS next_retry TIMESTAMPTZ`;
        console.log("   ✓ Columnas de event_outbox agregadas");
    } catch (e) {
        console.log("   ⚠ Columnas de event_outbox ya existen o error:", (e as Error).message);
    }

    try {
        await prisma.$executeRaw`ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100)`;
        await prisma.$executeRaw`ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS aggregate_id UUID`;
        await prisma.$executeRaw`ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS processor VARCHAR(50)`;
        console.log("   ✓ Columnas de processed_events agregadas");
    } catch (e) {
        console.log("   ⚠ Columnas de processed_events ya existen o error:", (e as Error).message);
    }

    try {
        await prisma.$executeRaw`ALTER TABLE terminal_number_ranges ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ DEFAULT NOW()`;
        await prisma.$executeRaw`ALTER TABLE terminal_number_ranges ADD COLUMN IF NOT EXISTS exhausted_at TIMESTAMPTZ`;
        console.log("   ✓ Columnas de terminal_number_ranges agregadas");
    } catch (e) {
        console.log("   ⚠ Columnas de terminal_number_ranges ya existen o error:", (e as Error).message);
    }

    // ============================================================================
    // VERIFICACIÓN FINAL
    // ============================================================================
    console.log("\n✅ Migración completada exitosamente!");

    // Mostrar conteo de índices
    const indexCount = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
    `;
    console.log(`\n📊 Total de índices personalizados: ${indexCount[0]?.count || 0}`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
