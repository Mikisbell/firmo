import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/app/api/data-sync/ingest/route.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add `unstable_after`
content = content.replace(
    `import { NextResponse } from "next/server";`,
    `import { NextResponse } from "next/server";\nimport { unstable_after as after } from "next/server";`
);

// 2. Remove markAsProcessed call and replace with ON CONFLICT DO NOTHING
// We find the transaction block
const txPattern = /const dedupResult = await markAsProcessed\(tx, ev\);[\s\S]*?continue;\n\s*\}/m;
content = content.replace(txPattern, `// Deduplicación delegada a ON CONFLICT DO NOTHING más abajo`);

// Now replace the `tx.events.create` with `$executeRaw`
const createPattern = /\/\/ 5\. Insert into events table[\s\S]*?payload: migrated\.payload as any,\n\s*},\n\s*}\);/m;
content = content.replace(createPattern, `// 5. Insert into events table (One-Shot SQL con deduplicación nativa)
                const insertedRows = await tx.$executeRaw\`
                    INSERT INTO events (
                        id, tenant_id, occurred_at, received_at, type, entity_type, 
                        entity_id, actor_id, actor_role_snapshot, terminal_id, 
                        payload_version, payload
                    ) VALUES (
                        \${migrated.event_id}::uuid, 
                        \${migrated.tenant_id}::uuid, 
                        \${new Date(migrated.occurred_at)}, 
                        NOW(), 
                        \${migrated.event_type}, 
                        \${migrated.aggregate_type}, 
                        \${migrated.aggregate_id}::uuid, 
                        \${migrated.actor_id ? migrated.actor_id + '::uuid' : Prisma.sql\`NULL\`}, 
                        \${migrated.actor_role_snapshot || Prisma.sql\`NULL\`}, 
                        \${migrated.terminal_id}, 
                        \${migrated.payload_version}, 
                        \${migrated.payload}::jsonb
                    )
                    ON CONFLICT (id) DO NOTHING
                \`;

                if (insertedRows === 0) {
                    deduped_event_ids.push(migrated.event_id);
                    continue; // Evento duplicado, ignorar
                }`);

// 3. Zero-RTT Projections (Move projectEvent to after())
// We need to remove projectEvent from the transaction
const projectPattern = /\/\/ 6\. Project the event \(apply to projections\)[\s\S]*?\/\/ 6b\. INCREMENT REVISION[\s\S]*?\}\);\n\s*\}/m;
content = content.replace(projectPattern, `// 6. Proyecciones diferidas al background (Zero-RTT)
                // Se ejecutarán en el bloque after()`);

// 4. Outbox optimization (DELETE instead of UPDATE)
const outboxUpdatePattern = /prisma\.event_outbox\.updateMany\(\{[\s\S]*?data: \{ published: true, published_at: new Date\(\) \},\n\s*\}\)/m;
content = content.replace(outboxUpdatePattern, `prisma.event_outbox.deleteMany({
                    where: { event_id: ev.event_id }
                })`);

// 5. Add after() block before returning NextResponse
const returnPattern = /return addCorsHeaders\(NextResponse\.json\(/m;
const backgroundLogic = `
        // EDGE-NATIVE: Zero-RTT Projections y Publish en el Background
        after(async () => {
            const { eventBus } = await import("@/src/core/infra/event-bus");
            for (const ev of acceptedEvents) {
                try {
                    // 1. Proyectar evento
                    const projected = await projectEvent(prisma as any, ev);
                    if (!projected) {
                        logger.warn('Background projection failed', { eventId: ev.event_id });
                    }

                    // 2. Incrementar revisión si es ORDER
                    if (ev.aggregate_type === "ORDER") {
                        await prisma.orders.updateMany({
                            where: { id: ev.aggregate_id },
                            data: { revision: { increment: 1 } }
                        });
                    }

                    // 3. Publicar en EventBus (Claim Check / Stateless)
                    const publishResult = eventBus.publish(tenant_id, ev);
                    if (publishResult instanceof Promise) {
                        await publishResult;
                    }
                    
                    // 4. Eliminar del outbox para evitar Vacuum Bloat
                    await prisma.event_outbox.deleteMany({
                        where: { event_id: ev.event_id }
                    });
                } catch (e) {
                    logger.error('Error en tarea background (Zero-RTT)', e instanceof Error ? e : new Error(String(e)), {
                        eventId: ev.event_id
                    });
                }
            }
        });

        return addCorsHeaders(NextResponse.json(`;

content = content.replace(returnPattern, backgroundLogic);

// Write back
fs.writeFileSync(file, content);
console.log('Refactor applied successfully.');
