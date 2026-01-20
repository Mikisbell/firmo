// Script para crear un pedido de prueba con items de cocina y bar

const TEST_ORDER_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "waiter_1";
const ACTOR_ID = "00000000-0000-0000-0000-000000000003";

const INGEST_API_URL = "http://localhost:3000/api/events/ingest";
const API_SECRET = "park_secret_mvp_2025";

function uuid() {
    return crypto.randomUUID();
}

async function createTestOrder() {
    const orderId = uuid();
    const checkId = uuid();
    const correlationId = uuid();
    const now = new Date().toISOString();
    const orderNumber = Math.floor(Math.random() * 900) + 100;
    const baseSeq = Date.now();
    
    const line1Id = uuid();
    const line2Id = uuid();
    const line3Id = uuid();
    const line4Id = uuid();

    const events = [
        {
            event_id: uuid(),
            event_type: "ORDER_CREATED",
            tenant_id: TEST_ORDER_TENANT_ID,
            terminal_id: TERM_ID,
            terminal_sequence: baseSeq,
            actor_id: ACTOR_ID,
            occurred_at: now,
            aggregate_type: "ORDER",
            aggregate_id: orderId,
            correlation_id: correlationId,
            schema_version: 1,
            payload: {
                order_id: orderId,
                order_type: "DINE_IN",
                order_number: orderNumber,
                items: [],
                checks: [{ 
                    check_id: checkId, 
                    lines: [],
                    subtotal_cents: 0,
                    discount_cents: 0,
                    tip_cents: 0,
                    total_cents: 0,
                }],
                fulfillment: {
                    table_number: "M04",
                    guest_count: 4,
                },
            }
        },
        {
            event_id: uuid(),
            event_type: "ORDER_ITEM_ADDED",
            tenant_id: TEST_ORDER_TENANT_ID,
            terminal_id: TERM_ID,
            terminal_sequence: baseSeq + 1,
            actor_id: ACTOR_ID,
            occurred_at: now,
            aggregate_type: "ORDER",
            aggregate_id: orderId,
            correlation_id: correlationId,
            schema_version: 1,
            payload: {
                order_id: orderId,
                line: {
                    line_id: line1Id,
                    product_id: uuid(),
                    sku: "pollo_1_2",
                    name: "1/2 Pollo a la Brasa",
                    qty: 2,
                    unit_price_cents: 3600,
                    station: "PARRILLA",
                    status: "PENDING",
                    mods: [],
                }
            }
        },
        {
            event_id: uuid(),
            event_type: "ORDER_ITEM_ADDED",
            tenant_id: TEST_ORDER_TENANT_ID,
            terminal_id: TERM_ID,
            terminal_sequence: baseSeq + 2,
            actor_id: ACTOR_ID,
            occurred_at: now,
            aggregate_type: "ORDER",
            aggregate_id: orderId,
            correlation_id: correlationId,
            schema_version: 1,
            payload: {
                order_id: orderId,
                line: {
                    line_id: line2Id,
                    product_id: uuid(),
                    sku: "papas_gde",
                    name: "Papas Fritas Grande",
                    qty: 1,
                    unit_price_cents: 1800,
                    station: "COCINA",
                    status: "PENDING",
                    mods: [],
                }
            }
        },
        {
            event_id: uuid(),
            event_type: "ORDER_ITEM_ADDED",
            tenant_id: TEST_ORDER_TENANT_ID,
            terminal_id: TERM_ID,
            terminal_sequence: baseSeq + 3,
            actor_id: ACTOR_ID,
            occurred_at: now,
            aggregate_type: "ORDER",
            aggregate_id: orderId,
            correlation_id: correlationId,
            schema_version: 1,
            payload: {
                order_id: orderId,
                line: {
                    line_id: line3Id,
                    product_id: uuid(),
                    sku: "chicha",
                    name: "Jarra Chicha Morada 1L",
                    qty: 1,
                    unit_price_cents: 1500,
                    station: "BAR",
                    status: "PENDING",
                    mods: [],
                }
            }
        },
        {
            event_id: uuid(),
            event_type: "ORDER_ITEM_ADDED",
            tenant_id: TEST_ORDER_TENANT_ID,
            terminal_id: TERM_ID,
            terminal_sequence: baseSeq + 4,
            actor_id: ACTOR_ID,
            occurred_at: now,
            aggregate_type: "ORDER",
            aggregate_id: orderId,
            correlation_id: correlationId,
            schema_version: 1,
            payload: {
                order_id: orderId,
                line: {
                    line_id: line4Id,
                    product_id: uuid(),
                    sku: "cusquena",
                    name: "Cerveza Cusqueña",
                    qty: 2,
                    unit_price_cents: 1200,
                    station: "BAR",
                    status: "PENDING",
                    mods: [],
                }
            }
        },
    ];

    console.log("🍗 Creando pedido de prueba...\n");
    console.log(`   Order #${orderNumber}`);
    console.log(`   Mesa: M04`);
    console.log(`   Items:`);
    console.log(`     - 2x 1/2 Pollo (PARRILLA)`);
    console.log(`     - 1x Papas Grande (COCINA)`);
    console.log(`     - 1x Chicha Morada (BAR)`);
    console.log(`     - 2x Cusqueña (BAR)\n`);

    const body = {
        tenant_id: TEST_ORDER_TENANT_ID,
        terminal_id: TERM_ID,
        from_terminal_sequence: baseSeq,
        to_terminal_sequence: baseSeq + 4,
        events,
    };

    try {
        const res = await fetch(INGEST_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-api-secret": API_SECRET,
            },
            body: JSON.stringify(body),
        });
        
        const data = await res.json();
        
        if (data.accepted) {
            console.log("✅ Pedido creado exitosamente!");
        } else {
            console.error("❌ Error:", JSON.stringify(data.error, null, 2));
        }
    } catch (e) {
        console.error("❌ Error de conexión:", e);
    }

    console.log("\n📺 Abre estas URLs para ver el pedido:");
    console.log("   - Cocina: http://localhost:3000/cocina");
    console.log("   - Bar:    http://localhost:3000/bar");
}

createTestOrder();
