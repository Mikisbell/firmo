"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOrder } from "@/src/app/mozo/hooks/useOrder";
import CatalogGrid from "@/src/app/pos/components/CatalogGrid";
import { POSActions } from "@/src/core/actions/pos.actions";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { OrderPanel } from "@/src/components/shared/OrderPanel";
import { ArrowLeft, Clock } from "lucide-react";
import { getStoredTerminalConfig } from "@/src/core/auth/fingerprint";
import { TerminalConfig } from "@/src/core/auth/types";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { transformLinesToPrint } from "@/src/core/printing/utils";

export default function WaiterOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
    const router = useRouter();
    const { tableId } = use(params);

    const [orderId, setOrderId] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [terminalConfig, setTerminalConfig] = useState<TerminalConfig | null>(null);

    // Reactive State
    const activeSale = useOrder(orderId);

    // 0. Load terminal config and redirect if not configured
    useEffect(() => {
        const config = getStoredTerminalConfig();
        if (!config?.terminal_id) {
            toast.error("Terminal no configurado");
            router.replace("/");
            return;
        }
        setTerminalConfig(config);
    }, [router]);

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
        if (!terminalConfig) {
            toast.error("Terminal no configurado");
            return;
        }

        try {
            let targetOrderId = orderId;

            if (!targetOrderId) {
                const res = await POSActions.createOrder(
                    terminalConfig.tenant_id,
                    terminalConfig.terminal_id,
                    terminalConfig.actor_id, // Use actor_id (UUID) instead of terminal_id
                    {
                        order_type: "DINE_IN",
                        order_number: Math.floor(Math.random() * 1000),
                        table_number: tableId
                    }
                );
                targetOrderId = res.order_id;
                setOrderId(targetOrderId);
                toast.info("Pedido creado");
            }

            if (targetOrderId) {
                await POSActions.addItem(
                    terminalConfig.tenant_id,
                    terminalConfig.terminal_id,
                    terminalConfig.actor_id, // Use actor_id (UUID) instead of terminal_id
                    targetOrderId,
                    {
                        product_id: product.id,
                        sku: product.id,
                        name: product.name,
                        unit_price_cents: product.price,
                        station: product.station,
                        qty: 1
                    }
                );
                toast.success(`+1 ${product.name}`);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error al agregar");
        }
    };

    const handleSendToKitchen = async () => {
        if (!orderId || !terminalConfig) {
            toast.error("No hay pedido activo");
            return;
        }

        const items = activeSale ? Object.values(activeSale.lines) : [];
        if (items.length === 0) {
            toast.error("No hay items para enviar");
            return;
        }

        try {
            // Group items by station for the toast message
            const stationCounts: Record<string, number> = {};
            items.forEach(item => {
                const station = item.station || "COCINA";
                stationCounts[station] = (stationCounts[station] || 0) + item.qty;
            });

            await POSActions.submitToKitchen(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                items.map(item => ({
                    line_id: item.line_id,
                    product_id: item.product_id,
                    name: item.name,
                    qty: item.qty,
                    station: item.station,
                    mods: [],
                    notes: undefined,
                }))
            );

            // Build toast message with stations
            const stationList = Object.entries(stationCounts)
                .map(([station, count]) => `${station}: ${count}`)
                .join(", ");
            toast.success(`¡Enviado! ${stationList}`);
        } catch (e) {
            console.error(e);
            toast.error("Error al enviar a cocina");
        }
    };

    const handleCallBill = async () => {
        if (!orderId || !terminalConfig) {
            toast.error("No hay pedido activo");
            return;
        }

        try {
            await POSActions.requestCheck(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                tableId
            );
            toast.info("Caja notificada: Mesa quiere pagar");
        } catch (e) {
            console.error(e);
            toast.error("Error al solicitar cuenta");
        }
    };

    const handlePrintPrecheck = () => {
        if (!activeSale || items.length === 0) {
            toast.error("No hay items para imprimir");
            return;
        }

        const linesToPrint = transformLinesToPrint(items);

        printComponent(
            <TicketTemplate
                tenantName="PARK POS"
                date={new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()}
                orderNumber={activeSale.order_number || 0}
                lines={linesToPrint}
                subtotal={activeSale.subtotal_cents}
                discount={0}
                total={activeSale.subtotal_cents}
                invoiceType="PRE-CUENTA"
            />,
            `Pre-cuenta Mesa ${tableId}`
        );
        toast.success("Pre-cuenta enviada a impresora");
    };

    const handleRemoveItem = async (lineId: string) => {
        if (!orderId || !terminalConfig) return;
        try {
            await POSActions.voidItem(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                lineId,
                "REMOVED"
            );
            toast.success("Item eliminado");
        } catch (_e) {
            toast.error("Error al eliminar");
        }
    };

    const handleIncrement = async (lineId: string) => {
        if (!orderId || !terminalConfig) return;
        const item = activeSale?.lines[lineId];
        if (!item) return;
        
        try {
            await POSActions.updateItemQuantity(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                lineId,
                item.qty,
                item.qty + 1
            );
        } catch (_e) {
            toast.error("Error al incrementar");
        }
    };

    const handleDecrement = async (lineId: string) => {
        if (!orderId || !terminalConfig) return;
        const item = activeSale?.lines[lineId];
        if (!item) return;
        
        try {
            await POSActions.updateItemQuantity(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                lineId,
                item.qty,
                item.qty - 1
            );
            if (item.qty - 1 <= 0) {
                toast.success("Item eliminado");
            }
        } catch (_e) {
            toast.error("Error al decrementar");
        }
    };

    if (initializing || !terminalConfig) {
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
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    onRemove={handleRemoveItem}
                    onSendToKitchen={handleSendToKitchen}
                    onCallBill={handleCallBill}
                    onPrintPrecheck={handlePrintPrecheck}
                />
            </div>
        </div>
    );
}
