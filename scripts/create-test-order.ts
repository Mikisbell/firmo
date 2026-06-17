import { v4 as uuidv4 } from 'uuid';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERMINAL_ID = 'MOZO_01';
const API_SECRET = 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const ACTOR_ID = '00000000-0000-0000-0000-000000000004';

async function main() {
  const orderId = uuidv4();
  const shiftId = uuidv4();
  const TABLE_NUMBER = "1";
  
  const events = [
    {
      event_id: uuidv4(),
      event_type: 'SHIFT_OPENED',
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      occurred_at: new Date(Date.now() - 3600000).toISOString(),
      aggregate_type: 'SHIFT',
      aggregate_id: orderId,
      schema_version: 1,
      terminal_sequence: Math.floor(Date.now() / 1000) % 1000000,
      correlation_id: uuidv4(),
      actor_id: ACTOR_ID,
      actor_role_snapshot: 'CASHIER',
      payload: {
        shift_id: shiftId,
        terminal_id: TERMINAL_ID,
        cash_opening_cents: 10000,
        opened_by: ACTOR_ID,
      }
    },
    {
      event_id: uuidv4(),
      event_type: 'ORDER_CREATED',
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      occurred_at: new Date().toISOString(),
      aggregate_type: 'ORDER',
      aggregate_id: orderId,
      schema_version: 1,
      terminal_sequence: (Math.floor(Date.now() / 1000) % 1000000) + 1,
      correlation_id: uuidv4(),
      actor_id: ACTOR_ID,
      actor_role_snapshot: 'WAITER',
      payload: {
        order_id: orderId,
        order_number: Math.floor(Math.random() * 10000),
        order_type: 'DINE_IN',
        fulfillment: {
          table_number: "1",
        },
        status: 'OPEN',
        opened_at: new Date().toISOString(),
        items: [
          {
            line_id: uuidv4(),
            product_id: 'prod-001',
            sku: 'SLA-01',
            name: 'Producto Especial SLA',
            qty: 1,
            unit_price_cents: 2500,
            total_cents: 2500,
            notes: 'SLA',
            station: 'COCINA'
          }
        ],
        checks: [{ 
          check_id: uuidv4(), 
          lines: [{
            line_id: uuidv4(),
            product_id: 'prod-001',
            sku: 'SLA-01',
            name: 'Producto Especial SLA',
            qty: 1,
            unit_price_cents: 2500,
            total_cents: 2500,
            notes: 'SLA',
            station: 'COCINA'
          }],
          payment: { status: 'UNPAID', payments: [] },
          total_cents: 2500,
        }],
      }
    }
  ];

  const res = await fetch('http://localhost:3000/api/data-sync/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': API_SECRET,
    },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      events: events,
      from_terminal_sequence: Math.floor(Date.now() / 1000) % 1000000,
      to_terminal_sequence: (Math.floor(Date.now() / 1000) % 1000000) + 1,
    }),
  });

  const text = await res.text();
  console.log('Ingest Result:', text);
}

main().catch(console.error);
