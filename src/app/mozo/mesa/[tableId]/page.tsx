"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOrder } from "@/src/app/mozo/hooks/useOrder";
import CatalogGrid from "@/src/app/(pos)/components/CatalogGrid";
import { POSActions } from "@/src/core/actions/pos.actions";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { OrderPanel } from "@/src/components/shared/OrderPanel";
import { ArrowLeft, Clock } from "lucide-react";

// MVP Constants
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERMINAL_ID = "waiter_1";
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";

export default function WaiterOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
    const router = useRouter();
    const { tableId } = use(params);

    const [orderId, setOrderId] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);

    // Reactive State
    const activeSale = useOrder(orderId);

    // 1. Resolve existing order for this table
    useEffect(() => {
        async function resolveOrder() {
            try {
                const events = await db.events
                    .where("aggregate_type")
                    .equals("ORDER")
                    .toArray() as ParkEvent[];

                const openOrders = new Map<string, { id: string, table: string, status: string }>();

                events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);
                for (const ev of events) {
                    if (ev.event_type === "ORDER_CREATED") {
                        const p = ev.payload as any;
                        openOrders.set(p.order_id, {
                            id: p.order_id,
                            table: p.fulfillment?.table_number,
                            status: p.order_status || "OPEN"
                        });
                    } else if (ev.event_type === "ORDER_CANCELLED" || (ev.event_type as any) === "ORDER_CLOSED") {
                        const p = ev.payload as any;
                        openOrders.delete(p.order_id);
                    }
                }

                let match = null;
                for (const ord of openOrders.values()) {
                    if (ord.table === tableId && ord.status !== "DONE") {
                        match = ord.id;
                        break;
                    }
                }

                if (match) {
                    setOrderId(match);
                }
            } catch (e) {
                console.error("Error resolving order", e);
            } finally {
                setInitializing(false);
            }
        }
        resolveOrder();
    }, [tableId]);

    const handleAddItem = async (product: any) => {
        try {
            let targetOrderId = orderId;

            if (!targetOrderId) {
                const res = await POSActions.createOrder(TENANT_ID, TERMINAL_ID, ACTOR_ID, {
                    order_type: "DINE_IN",
                    order_number: Math.floor(Math.random() * 1000),
                    table_number: tableId
                });
                targetOrderId = res.order_id;
                setOrderId(targetOrderId);
                toast.info("Pedido creado");
            }

            if (targetOrderId) {
                await POSActions.addItem(TENANT_ID, TERMINAL_ID, ACTOR_ID, targetOrderId, {
                    product_id: product.id,
                    sku: product.id,
                    name: product.name,
                    unit_price_cents: product.price,
                    station: product.station,
                    qty: 1
                });
                toast.success(`+1 ${product.name}`);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error al agregar");
        }
    };

    const handleSendToKitchen = () => {
        toast.success("¡Pedido enviado a cocina!");
        // TODO: Emit ORDER_SUBMITTED event
    };

    const handleCallBill = () => {
        toast.info("Caja notificada: Mesa quiere pagar");
        // TODO: Emit BILL_REQUESTED event
    };

    const handlePrintPrecheck = () => {
        toast.info("Enviando pre-cuenta...");
        // TODO: Print precheck
    };

    const handleRemoveItem = async (lineId: string) => {
        if (!orderId) return;
        try {
            await POSActions.voidItem(TENANT_ID, TERMINAL_ID, ACTOR_ID, orderId, lineId, "REMOVED");
            toast.success("Item eliminado");
        } catch (_e) {
            toast.error("Error al eliminar");
        }
    };

    if (initializing) {
        return (
            <div className="h-screen flex items-center justify-center bg-park-black">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-park-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500">Cargando mesa...</p>
                </div>
            </div>
        );
    }

    const items = activeSale ? Object.values(activeSale.lines) : [];

    return (
        <div className="h-screen flex flex-col bg-park-black text-white overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-zinc-800/50 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-xl shrink-0">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold text-white">Mesa {tableId}</h1>
                    <span className="text-xs text-zinc-500">
                        {orderId ? `Pedido #${activeSale?.order_number ?? "..."}` : "Nueva Cuenta"}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-zinc-500 text-xs">
                    <Clock size={12} />
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </header>

            {/* Main Content: Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Catalog */}
                <main className="flex-1 overflow-y-auto p-4">
                    <CatalogGrid onAdd={handleAddItem} shiftOpen={true} />
                </main>

                {/* RIGHT: Order Panel (SHARED COMPONENT) */}
                <OrderPanel
                    mode="waiter"
                    items={items}
                    subtotalCents={activeSale?.subtotal_cents ?? 0}
                    orderNumber={activeSale?.order_number}
                    tableId={tableId}
                    onRemove={handleRemoveItem}
                    onSendToKitchen={handleSendToKitchen}
                    onCallBill={handleCallBill}
                    onPrintPrecheck={handlePrintPrecheck}
                />
            </div>
        </div>
    );
}
