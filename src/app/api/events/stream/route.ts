import { NextRequest, NextResponse } from "next/server";
import { eventBus } from "@/src/core/infra/event-bus";
import type { ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE Endpoint for Event Streaming with Tenant Isolation
 * 
 * **Requirement 11.2:** WHEN events are streamed via SSE, THE System SHALL 
 * filter events by tenant_id
 * 
 * Validates:
 * - tenant_id is provided in query parameters
 * - Only events for the specified tenant are streamed
 * - Cross-tenant events are filtered out
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");

    // Validate tenant_id is provided
    if (!tenantId) {
        return NextResponse.json(
            { error: "Missing tenant_id parameter" },
            { status: 400 }
        );
    }

    // Validate tenant_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
        return NextResponse.json(
            { error: "Invalid tenant_id format" },
            { status: 400 }
        );
    }

    // Use standard ReadableStream with direct controller access
    let closed = false;

    const stream = new ReadableStream({
        start(controller) {
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
            const onEvent = (event: ParkEvent) => {
                if (closed) return;
                
                // **Requirement 11.2:** Filter events by tenant_id
                // Only stream events that belong to the authenticated tenant
                if (event.tenant_id !== tenantId) {
                    console.warn(
                        `[SSE] Filtering cross-tenant event: event.tenant_id=${event.tenant_id}, stream.tenant_id=${tenantId}`
                    );
                    return; // Skip cross-tenant events
                }

                try {
                    send(JSON.stringify(event));
                } catch (err) {
                    console.error("SSE Error", err);
                    closed = true;
                }
            };
            const unsubscribe = eventBus.subscribe(tenantId, onEvent);

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
            (controller as any)._cleanup = () => {
                closed = true;
                clearInterval(keepAlive);
                unsubscribe();
                console.log("[SSE] Client disconnected, cleaned up");
            };
        },
        cancel(controller) {
            closed = true;
            if ((controller as any)?._cleanup) {
                (controller as any)._cleanup();
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
