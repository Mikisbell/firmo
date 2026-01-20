import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERIFY_API_URL = "http://localhost:3000/api/events/ingest";
const API_SECRET = "park_secret_mvp_2025";

async function verify() {
    console.log("🔍 Verifying Phase P1: Backend Ingest & Projections");

    // 1. Check DB Connection
    try {
        const countBefore = await prisma.events.count();
        console.log(`✅ DB Connected. Events count: ${countBefore}`);

        // 2. Prepare Test Event
        const tenantId = "00000000-0000-0000-0000-111111111111"; // Valid UUID
        const testEvent = {
            event_id: crypto.randomUUID(),
            event_type: "ORDER_CREATED",
            aggregate_type: "ORDER",
            aggregate_id: crypto.randomUUID(),
            tenant_id: tenantId,
            terminal_id: "verifier_script",
            terminal_sequence: Date.now(),
            correlation_id: crypto.randomUUID(), // Added
            occurred_at: new Date().toISOString(),
            actor_id: "00000000-0000-0000-0000-000000000000",
            schema_version: 1,
            payload: {
                order_id: crypto.randomUUID(),
                order_number: 9999,
                order_type: "DINE_IN",
                items: [],
                checks: []
            }
        };

        // 3. Send to API
        console.log("🚀 Sending POST /api/events/ingest...");
        const res = await fetch(VERIFY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-secret": API_SECRET
            },
            body: JSON.stringify({
                tenant_id: tenantId,
                terminal_id: testEvent.terminal_id,
                from_terminal_sequence: 0, // Added
                to_terminal_sequence: testEvent.terminal_sequence,
                events: [testEvent]
            })
        });

        if (!res.ok) {
            throw new Error(`API returned ${res.status}: ${await res.text()}`);
        }

        const json = await res.json();
        console.log("✅ API Response:", json);
        if (!json.accepted) throw new Error("API did not accept the event");

        // 4. Verify DB persistence
        const countAfter = await prisma.events.count();
        console.log(`📊 Events count after: ${countAfter}`);

        if (countAfter > countBefore) {
            console.log("✅ Event persisted in DB successfully.");
        } else {
            throw new Error("❌ DB count did not increase!");
        }

        // 5. Verify Projection (Order Created)
        const order = await prisma.orders.findUnique({
            where: { id: testEvent.payload.order_id }
        });

        if (order) {
            console.log("✅ Projection verified: Order found in 'orders' table.");
        } else {
            throw new Error("❌ Projection failed: Order not found in DB.");
        }

        console.log("🎉 VERIFICATION PASSED!");

    } catch (e) {
        console.error("❌ VERIFICATION FAILED:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
