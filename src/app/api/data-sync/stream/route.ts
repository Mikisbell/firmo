import { NextRequest, NextResponse } from "next/server";
import { eventBus } from "@/src/core/infra/event-bus";
import type { ParkEvent } from "@/src/core/domain/events";
import { requirePosAuth } from "@/src/core/middleware/pos-auth";
import { logger } from '@/src/core/observability/structured-logger';

// @deprecated FASE 3 (issue #4): endpoint SSE legacy, en paralelo al realtime de Supabase.
// Retirar tras validar el realtime con trafico real. No corre en Cloudflare Workers (runtime nodejs).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rastreo de conexiones SSE por tenant (process-local — correcto porque SSE está ligado al proceso)
const tenantConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_TENANT = 10;

/**
 * Endpoint SSE para streaming de eventos con aislamiento por tenant
 *
 * **Requisito 11.2:** CUANDO se transmiten eventos via SSE, EL Sistema DEBE
 * filtrar eventos por tenant_id
 *
 * Seguridad: JWT obligatorio, tenant_id del JWT, máx 10 conexiones por tenant
 */
export async function GET(req: NextRequest) {
    // Validar autenticación
    const authResult = await requirePosAuth(req);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;

    // Limitar conexiones por tenant
    const currentCount = tenantConnections.get(tenantId) || 0;
    if (currentCount >= MAX_CONNECTIONS_PER_TENANT) {
        return NextResponse.json(
            { error: "Demasiadas conexiones SSE para este tenant", limit: MAX_CONNECTIONS_PER_TENANT },
            { status: 429 }
        );
    }
    tenantConnections.set(tenantId, currentCount + 1);

    // ReadableStream estándar con acceso directo al controller
    let closed = false;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            const send = (data: string) => {
                if (closed) return; // Don't send if closed
                try {
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch {
                    // Controller closed, ignore silently
                    closed = true;
                }
            };

            // Send initial connection immediately
            send(JSON.stringify({ type: "CONNECTED", tenantId }));

            // Connect to EventBus with tenant-scoped filtering
            // Soporta tanto subscribe síncrono (InMemory) como asíncrono (Supabase)
            const onEvent = (event: ParkEvent) => {
                if (closed) return;
                
                // **Requirement 11.2:** Filter events by tenant_id
                // Only stream events that belong to the authenticated tenant
                if (event.tenant_id !== tenantId) {
                    logger.warn('Evento cross-tenant filtrado en SSE', {
                        eventTenantId: event.tenant_id,
                        streamTenantId: tenantId,
                    });
                    return; // Skip cross-tenant events
                }

                try {
                    send(JSON.stringify(event));
                } catch (err) {
                    logger.error('Error en transmisión SSE', err instanceof Error ? err : new Error(String(err)), {
                        tenantId,
                    });
                    closed = true;
                }
            };
            
            // Manejar subscribe asíncrono (Supabase) o síncrono (InMemory)
            const subscribeResult = eventBus.subscribe(tenantId, onEvent);
            const unsubscribe = subscribeResult instanceof Promise 
                ? await subscribeResult 
                : subscribeResult;

            // Keep-alive every 15 seconds
            const keepAlive = setInterval(() => {
                if (closed) {
                    clearInterval(keepAlive);
                    return;
                }
                try {
                    controller.enqueue(encoder.encode(": keep-alive\n\n"));
                } catch {
                    closed = true;
                    clearInterval(keepAlive);
                    unsubscribe();
                }
            }, 15000);

            // Store cleanup for cancel
            (controller as any)._cleanup = async () => {
                closed = true;
                clearInterval(keepAlive);
                // Manejar unsubscribe asíncrono si es necesario
                if (typeof unsubscribe === 'function') {
                    const unsubResult = unsubscribe() as void | Promise<void>;
                    if (unsubResult && typeof (unsubResult as any).then === 'function') {
                        await (unsubResult as Promise<void>);
                    }
                }
            };
        },
        async cancel(controller) {
            closed = true;
            // Decrementar contador de conexiones
            const count = tenantConnections.get(tenantId) || 1;
            if (count <= 1) {
                tenantConnections.delete(tenantId);
            } else {
                tenantConnections.set(tenantId, count - 1);
            }
            if ((controller as any)?._cleanup) {
                await (controller as any)._cleanup();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
