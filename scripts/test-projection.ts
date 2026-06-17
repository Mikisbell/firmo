import { PrismaClient } from '@prisma/client';
import { handleOrderCreated } from '@/src/core/events/projections/order-projections';
import { handleShiftOpened } from '@/src/core/events/projections/shift-projections';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERMINAL_ID = 'MOZO_01';
const ACTOR_ID = '00000000-0000-0000-0000-000000000004';

async function main() {
  const orderId = uuidv4();
  const shiftId = uuidv4();

  const event1 = {
      event_id: uuidv4(),
      event_type: 'SHIFT_OPENED',
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      occurred_at: new Date(Date.now() - 3600000).toISOString(),
      aggregate_type: 'SHIFT',
      aggregate_id: orderId,
      schema_version: 1,
      terminal_sequence: 99996,
      correlation_id: uuidv4(),
      actor_id: ACTOR_ID,
      actor_role_snapshot: 'CASHIER',
      payload: {
        shift_id: shiftId,
        terminal_id: TERMINAL_ID,
        cash_opening_cents: 10000,
        opened_by: ACTOR_ID,
      }
    };

    const event2 = {
      event_id: uuidv4(),
      event_type: 'ORDER_CREATED',
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      occurred_at: new Date().toISOString(),
      aggregate_type: 'ORDER',
      aggregate_id: orderId,
      schema_version: 1,
      terminal_sequence: 99995,
      correlation_id: uuidv4(),
      actor_id: ACTOR_ID,
      actor_role_snapshot: 'WAITER',
      payload: {
        order_id: orderId,
        order_number: Math.floor(Math.random() * 10000),
        order_type: 'DINE_IN',
        fulfillment: { table_number: "1" },
        status: 'OPEN',
        items: []
      }
    };

    try {
        await prisma.$transaction(async (tx) => {
            console.log("Running shift opened...");
            await handleShiftOpened(tx as any, event1 as any);
            console.log("Running order created...");
            await handleOrderCreated(tx as any, event2 as any);
        });
        console.log("Success!");
    } catch (e) {
        console.error("Error during transaction:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
