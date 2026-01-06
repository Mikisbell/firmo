import { NextRequest, NextResponse } from "next/server";
import { eventBus } from "@/src/core/infra/event-bus";
import { ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id") ?? "default_tenant";

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

            // Connect to EventBus
            const onEvent = (event: ParkEvent) => {
                if (closed) return;
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
