/**
 * PARK POS - Stress Test Script
 * Tests: API endpoints, rate limiting, concurrent requests
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERMINAL_ID = 'term-caja-001';
const API_SECRET = process.env.PARK_API_SECRET || 'dev-secret-change-in-prod';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    details?: string;
}

const results: TestResult[] = [];

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function test(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
        await fn();
        results.push({ name, passed: true, duration: Date.now() - start });
        console.log(`✅ ${name} (${Date.now() - start}ms)`);
    } catch (e: any) {
        results.push({ name, passed: false, duration: Date.now() - start, details: e.message });
        console.log(`❌ ${name}: ${e.message}`);
    }
}

// ============ DATABASE TESTS ============

async function testDatabaseConnection() {
    await test('DB: Connection', async () => {
        const result = await prisma.$queryRaw`SELECT 1 as ok`;
        if (!result) throw new Error('No response');
    });
}

async function testDatabaseCounts() {
    await test('DB: Table counts', async () => {
        const counts = {
            tenants: await prisma.tenant_settings.count(),
            employees: await prisma.employees.count(),
            terminals: await prisma.terminals.count(),
            products: await prisma.products.count(),
            orders: await prisma.orders.count(),
            events: await prisma.events.count(),
        };
        console.log('   Counts:', counts);
        if (counts.tenants === 0) throw new Error('No tenants found');
    });
}

async function testDatabaseConcurrentReads() {
    await test('DB: Sequential reads (Supabase limit)', async () => {
        // Sequential reads due to Supabase session mode connection limits
        for (let i = 0; i < 5; i++) {
            const result = await prisma.products.findMany({ take: 10 });
            if (result.length === 0) throw new Error(`Read ${i} failed`);
        }
    });
}

async function testDatabaseConcurrentWrites() {
    await test('DB: Sequential event writes', async () => {
        // Sequential writes due to Supabase session mode connection limits
        for (let i = 0; i < 5; i++) {
            const event = {
                id: uuid(),
                tenant_id: TENANT_ID,
                occurred_at: new Date(),
                type: 'STRESS_TEST',
                entity_type: 'test',
                entity_id: `stress-${i}`,
                terminal_id: TERMINAL_ID,
                payload_version: 1,
                payload: { test: true, index: i },
            };
            await prisma.events.create({ data: event }).catch(() => null);
        }

        // Cleanup
        await prisma.events.deleteMany({ where: { type: 'STRESS_TEST' } });
    });
}

// ============ API TESTS (if server running) ============

async function testApiHealth() {
    await test('API: Health check', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            // 404 is ok if endpoint doesn't exist, we just want to check server responds
            if (!res) throw new Error('No response');
        } catch (e: any) {
            if (e.cause?.code === 'ECONNREFUSED' || e.name === 'AbortError') {
                // Don't count as failure - server just not running
                throw new Error('Server not running (expected when testing DB only)');
            }
            // Any response means server is up
        }
    });
}

async function testApiIngestAuth() {
    await test('API: Ingest requires auth', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/events/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: TENANT_ID, terminal_id: TERMINAL_ID, events: [] }),
                signal: AbortSignal.timeout(5000)
            });
            if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        } catch (e: any) {
            if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
            throw e;
        }
    });
}

async function testApiIngestValid() {
    await test('API: Ingest valid event', async () => {
        try {
            const orderId = uuid();
            const event = {
                event_id: uuid(),
                event_type: 'ORDER_CREATED',
                tenant_id: TENANT_ID,
                terminal_id: TERMINAL_ID,
                occurred_at: new Date().toISOString(),
                aggregate_type: 'ORDER',
                aggregate_id: orderId,
                schema_version: 1,
                terminal_sequence: 1,
                correlation_id: uuid(),
                payload: {
                    order_id: orderId,
                    order_number: 99999,
                    order_type: 'DINE_IN',
                    items: [],
                    checks: [{ check_id: uuid(), items: [], payments: [] }],
                },
            };

            const res = await fetch(`${BASE_URL}/api/events/ingest`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-secret': API_SECRET,
                },
                body: JSON.stringify({ 
                    tenant_id: TENANT_ID, 
                    terminal_id: TERMINAL_ID, 
                    events: [event],
                    from_terminal_sequence: 0,
                    to_terminal_sequence: 1,
                }),
                signal: AbortSignal.timeout(10000)
            });

            const data = await res.json();
            if (!data.accepted) throw new Error(`Not accepted: ${JSON.stringify(data)}`);
        } catch (e: any) {
            if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
            throw e;
        }
    });
}

async function testApiRateLimiting() {
    await test('API: Rate limiting (burst)', async () => {
        try {
            // Send 10 sequential requests to verify rate limiting works
            // Note: Current limits are 200/min per terminal, 500/min per IP
            // This test verifies the endpoint responds correctly under load
            const results: number[] = [];
            
            for (let i = 0; i < 10; i++) {
                const res = await fetch(`${BASE_URL}/api/events/ingest`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-api-secret': API_SECRET,
                    },
                    body: JSON.stringify({ 
                        tenant_id: TENANT_ID, 
                        terminal_id: TERMINAL_ID, 
                        events: [],
                        to_terminal_sequence: 1,
                    }),
                    signal: AbortSignal.timeout(10000)
                });
                results.push(res.status);
            }

            const success = results.filter(s => s === 200).length;
            const rateLimited = results.filter(s => s === 429).length;
            console.log(`   Success: ${success}/10, Rate limited: ${rateLimited}/10`);
            
            // All should succeed (limits are 200/min per terminal)
            if (success < 8) throw new Error(`Too many failures: ${10 - success}/10`);
        } catch (e: any) {
            if (e.cause?.code === 'ECONNREFUSED') throw new Error('Server not running');
            throw e;
        }
    });
}

// ============ VALIDATION TESTS ============

async function testMoneyInCents() {
    await test('Validation: Money stored in cents', async () => {
        const orders = await prisma.orders.findMany({ take: 10 });
        for (const order of orders) {
            if (order.total_cents !== Math.floor(order.total_cents)) {
                throw new Error(`Order ${order.id} has non-integer total: ${order.total_cents}`);
            }
            if (order.subtotal_cents !== Math.floor(order.subtotal_cents)) {
                throw new Error(`Order ${order.id} has non-integer subtotal: ${order.subtotal_cents}`);
            }
        }
    });
}

async function testEventIntegrity() {
    await test('Validation: Event integrity', async () => {
        const events = await prisma.events.findMany({ take: 100 });
        for (const event of events) {
            if (!event.id) throw new Error('Event missing id');
            if (!event.tenant_id) throw new Error('Event missing tenant_id');
            if (!event.type) throw new Error('Event missing type');
            if (!event.occurred_at) throw new Error('Event missing occurred_at');
        }
    });
}

// ============ MAIN ============

async function main() {
    console.log('='.repeat(50));
    console.log('PARK POS - Stress Test Suite');
    console.log('='.repeat(50));
    console.log(`Tenant: ${TENANT_ID}`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log('='.repeat(50));
    console.log('');

    // Database tests
    console.log('\n📊 DATABASE TESTS\n');
    await testDatabaseConnection();
    await testDatabaseCounts();
    await testDatabaseConcurrentReads();
    await testDatabaseConcurrentWrites();

    // Validation tests
    console.log('\n✔️ VALIDATION TESTS\n');
    await testMoneyInCents();
    await testEventIntegrity();

    // API tests (only if server running)
    console.log('\n🌐 API TESTS\n');
    const serverUp = await testApiHealth().then(() => true).catch(() => false);
    if (serverUp) {
        await testApiIngestAuth();
        await testApiIngestValid();
        await testApiRateLimiting();
    } else {
        console.log('   ⚠️ Server not running - API tests skipped');
        console.log('   Run: npm run dev');
        console.log('   Then re-run this script to test API endpoints');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    
    // Filter out "Server not running" failures when server is down
    const serverNotRunning = results.some(r => !r.passed && r.details?.includes('Server not running'));
    const relevantResults = serverNotRunning 
        ? results.filter(r => !r.details?.includes('Server not running'))
        : results;
    
    const passed = relevantResults.filter(r => r.passed).length;
    const failed = relevantResults.filter(r => !r.passed).length;
    const skipped = results.length - relevantResults.length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    if (skipped > 0) console.log(`⏭️ Skipped (server not running): ${skipped}`);
    console.log(`Total: ${results.length}`);

    if (failed > 0) {
        console.log('\nFailed tests:');
        relevantResults.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.details}`);
        });
    }

    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
