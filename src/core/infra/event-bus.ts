import { EventEmitter } from "events";
import { ParkEvent } from "@/src/core/domain/events";

// Global singleton for the pilot (in-memory)
// In production (Vercel/AWS Lambda), this must be replaced by Redis Pub/Sub
class InMemoryEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow multiple SSE clients
    }

    publish(tenantId: string, event: ParkEvent) {
        this.emit(`event:${tenantId}`, event);
    }

    subscribe(tenantId: string, listener: (event: ParkEvent) => void) {
        const channel = `event:${tenantId}`;
        this.on(channel, listener);
        return () => this.off(channel, listener);
    }
}

// Ensure singleton across hot-reloads in dev
const globalForBus = global as unknown as { parkEventBus: InMemoryEventBus };

export const eventBus = globalForBus.parkEventBus || new InMemoryEventBus();

if (process.env.NODE_ENV !== "production") {
    globalForBus.parkEventBus = eventBus;
}
