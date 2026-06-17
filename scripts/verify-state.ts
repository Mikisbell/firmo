import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function verifyState() {
  try {
    // 1. Get the last event from the ingest script
    const lastOrderEvent = await prisma.events.findFirst({
      where: {
        tenant_id: TENANT_ID,
        type: 'ORDER_CREATED'
      },
      orderBy: { occurred_at: 'desc' }
    });

    if (!lastOrderEvent) {
      console.log("❌ No ORDER_CREATED event found in the last runs.");
      return;
    }
    console.log("✅ ORDER_CREATED event found:", lastOrderEvent.id);

    // 2. Check if the order was created
    const order = await prisma.orders.findUnique({
      where: { id: lastOrderEvent.entity_id! }
    });

    if (!order) {
      console.log("❌ Order was not created in the projections!");
      return;
    }
    console.log("✅ Order exists with status:", order.order_status, "Revision:", order.revision);

    // 3. Check order_tables mapping
    const orderTables = await prisma.order_tables.findMany({
      where: { order_id: order.id }
    });

    if (orderTables.length === 0) {
      console.log("❌ No order_tables mapping found! The projection failed silently or table didn't exist.");
    } else {
      console.log("✅ order_tables mapping exists:", orderTables.length, "table(s) mapped.");
    }

    // 4. Check if the table status was updated to OCCUPIED
    const tableId = orderTables.length > 0 ? orderTables[0].table_id : null;
    if (tableId) {
      const table = await prisma.tables.findUnique({ where: { id: tableId } });
      console.log("✅ Table status is:", table?.status, "Occupied by order:", table?.current_order_id);
    }

    // 5. Check if event is marked as processed
    const processed = await prisma.processed_events.findUnique({
      where: { event_id: lastOrderEvent.id }
    });
    console.log("✅ Event processed status:", !!processed);

    // 6. Check if it went to event_outbox
    const outbox = await prisma.event_outbox.findFirst({
      where: { event_id: lastOrderEvent.id }
    });
    console.log("✅ Event is in outbox for broadcast:", !!outbox);

  } catch (e) {
    console.error("Verification failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

verifyState();
