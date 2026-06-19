"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOrder } from "@/src/app/mozo/hooks/useOrder";
import { useWaiterContext } from "../../context/WaiterContext";
import CatalogGrid from "@/src/app/pos/components/CatalogGrid";
import { POSActions } from "@/src/core/actions/pos.actions";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { OrderPanel } from "@/src/components/shared/OrderPanel";
import { ArrowLeft, Clock, X } from "lucide-react";
import { getStoredTerminalConfig } from "@/src/core/auth/fingerprint";
import { TerminalConfig } from "@/src/core/auth/types";
import { getDevTerminalConfig, resolveDevStation } from "@/src/core/config/dev-identity";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { transformLinesToPrint } from "@/src/core/printing/utils";
import { useResponsive } from "@/src/hooks/useResponsive";
import { BottomSheet } from "@/src/components/ui/BottomSheet";
import { OrderFAB } from "@/src/components/ui/FAB";

// ─── State types for modals ───────────────────────────────────────────────────

interface NoteDialog {
    lineId: string;
    current: string;
}

export default function WaiterOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
    const router = useRouter();
    const { tableId } = use(params);
    const { isMobile } = useResponsive();

    const [orderId, setOrderId] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [terminalConfig, setTerminalConfig] = useState<TerminalConfig | null>(null);
    const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);

    // Feature 1: Note dialog
    const [noteDialog, setNoteDialog] = useState<NoteDialog | null>(null);
    const noteInputRef = useRef<HTMLInputElement>(null);

    // Feature 2: Transfer table modal
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [availableTables, setAvailableTables] = useState<string[]>([]);

    // Feature 3: Split bill modal
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [splitAssignment, setSplitAssignment] = useState<Record<string, 1 | 2>>({});

    // Feature 4: Join tables modal
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCandidates, setJoinCandidates] = useState<string[]>([]);

    // Reactive State
    const activeSale = useOrder(orderId);

    // 0. Load terminal config and redirect if not configured
    useEffect(() => {
        const config = getStoredTerminalConfig();

        // In development/testing, use default config if not configured
        if (!config?.terminal_id) {
            const isDev = process.env.NODE_ENV === 'development';
            const isE2E = typeof window !== 'undefined' && localStorage.getItem('e2e_mode') === 'true';

            if (isDev || isE2E) {
                // Identidad de dev desde la AUTORIDAD UNICA (dev-identity), coherente con el seed.
                // Respeta la estacion del launcher /dev; por defecto MOZO (vista de mesa del mozo).
                const rawStation = typeof window !== 'undefined'
                    ? (localStorage.getItem('dev_station') ?? localStorage.getItem('dev_role'))
                    : null;
                const defaultConfig = getDevTerminalConfig(rawStation ? resolveDevStation(rawStation) : 'MOZO');
                setTerminalConfig(defaultConfig);
                return;
            }

            toast.error("Terminal no configurado");
            router.replace("/");
            return;
        }
        setTerminalConfig(config);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 1. Resolve existing order for this table using global context
    const { tableState } = useWaiterContext();
    const contextOrderId = tableState[tableId]?.orderId || null;

    useEffect(() => {
        setOrderId(contextOrderId);
        setInitializing(false);
    }, [contextOrderId]);

    // Close modals on Escape key
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setNoteDialog(null);
                setShowTransferModal(false);
                setShowSplitModal(false);
                setShowJoinModal(false);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focus note input when dialog opens
    useEffect(() => {
        if (noteDialog) {
            setTimeout(() => noteInputRef.current?.focus(), 50);
        }
    }, [noteDialog]);

    // ─── Item actions ────────────────────────────────────────────────────────

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
                    terminalConfig.actor_id,
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
                    terminalConfig.actor_id,
                    targetOrderId,
                    {
                        product_id: product.id,
                        sku: product.sku ?? product.id,
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

    // Feature 5: Only send PENDING items to kitchen (second round)
    const handleSendToKitchen = async () => {
        if (!orderId || !terminalConfig) {
            toast.error("No hay pedido activo");
            return;
        }

        const allItems = activeSale ? Object.values(activeSale.lines) : [];
        const items = allItems.filter(item => item.status === 'PENDING');

        if (items.length === 0) {
            toast.info("No hay items nuevos para enviar");
            return;
        }

        try {
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
                    notes: item.notes,
                }))
            );

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

    // ─── Feature 1: Item note ─────────────────────────────────────────────────

    const handleAddNote = useCallback((lineId: string) => {
        const currentNote = activeSale?.lines[lineId]?.notes ?? "";
        setNoteDialog({ lineId, current: currentNote });
    }, [activeSale]);

    const handleSaveNote = async (lineId: string, note: string) => {
        if (!orderId || !terminalConfig) return;
        try {
            await POSActions.addItemNote(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                lineId,
                note.trim()
            );
            setNoteDialog(null);
            toast.success("Nota guardada");
        } catch (_e) {
            toast.error("Error al guardar nota");
        }
    };

    // ─── Feature 2: Transfer table ────────────────────────────────────────────

    const handleOpenTransfer = useCallback(async () => {
        try {
            const events = await db.events
                .where("aggregate_type")
                .equals("ORDER")
                .toArray() as ParkEvent[];

            // Build map of occupied tables from open orders
            const occupiedTables = new Set<string>();
            const ordersMap = new Map<string, { table: string }>();

            events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);
            for (const ev of events) {
                if (ev.event_type === "ORDER_CREATED") {
                    const p = ev.payload as any;
                    if (p.fulfillment?.table_number) {
                        ordersMap.set(p.order_id, { table: p.fulfillment.table_number });
                    }
                } else if (ev.event_type === "ORDER_TABLE_CHANGED") {
                    const p = ev.payload as any;
                    const existing = ordersMap.get(p.order_id);
                    if (existing) ordersMap.set(p.order_id, { table: p.to_table });
                } else if (ev.event_type === "ORDER_CANCELLED" || (ev.event_type as any) === "ORDER_CLOSED") {
                    const p = ev.payload as any;
                    ordersMap.delete(p.order_id);
                }
            }

            for (const ord of ordersMap.values()) {
                occupiedTables.add(ord.table);
            }

            // Generate candidate tables (1-20 by convention, excluding current and occupied)
            const candidates: string[] = [];
            for (let i = 1; i <= 20; i++) {
                const t = String(i);
                if (t !== tableId && !occupiedTables.has(t)) {
                    candidates.push(t);
                }
            }

            setAvailableTables(candidates);
            setShowTransferModal(true);
        } catch (e) {
            console.error(e);
            toast.error("Error al buscar mesas disponibles");
        }
    }, [tableId]);

    const handleTransfer = async (toTable: string) => {
        if (!orderId || !terminalConfig) return;
        try {
            await POSActions.transferTable(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                tableId,
                toTable
            );
            setShowTransferModal(false);
            toast.success(`Mesa transferida a Mesa ${toTable}`);
            router.replace(`/mozo/mesa/${toTable}`);
        } catch (_e) {
            toast.error("Error al transferir mesa");
        }
    };

    // ─── Feature 4: Join Tables ───────────────────────────────────────────────

    const handleOpenJoin = useCallback(async () => {
        try {
            const events = await db.events
                .where("aggregate_type")
                .equals("ORDER")
                .toArray() as ParkEvent[];

            const occupiedTables = new Set<string>();
            const ordersMap = new Map<string, { table: string }>();

            events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);
            for (const ev of events) {
                if (ev.event_type === "ORDER_CREATED") {
                    const p = ev.payload as any;
                    if (p.fulfillment?.table_number) {
                        ordersMap.set(p.order_id, { table: p.fulfillment.table_number });
                    }
                } else if (ev.event_type === "ORDER_TABLE_CHANGED") {
                    const p = ev.payload as any;
                    const existing = ordersMap.get(p.order_id);
                    if (existing) ordersMap.set(p.order_id, { table: p.to_table });
                } else if (ev.event_type === "TABLE_ATTACHED_TO_ORDER") {
                    const p = ev.payload as any;
                    occupiedTables.add(p.attached_table_id);
                } else if (ev.event_type === "ORDER_CANCELLED" || (ev.event_type as any) === "ORDER_CLOSED") {
                    const p = ev.payload as any;
                    ordersMap.delete(p.order_id);
                }
            }

            for (const ord of ordersMap.values()) {
                occupiedTables.add(ord.table);
            }

            // Generate candidate tables (1-20 by convention, excluding current and occupied)
            const candidates: string[] = [];
            for (let i = 1; i <= 20; i++) {
                const t = String(i);
                if (t !== tableId && !occupiedTables.has(t)) {
                    candidates.push(t);
                }
            }

            setJoinCandidates(candidates);
            setShowJoinModal(true);
        } catch (e) {
            console.error(e);
            toast.error("Error al buscar mesas disponibles");
        }
    }, [tableId]);

    const handleJoinTables = async (tableToJoin: string) => {
        if (!orderId || !terminalConfig) return;
        try {
            await POSActions.attachTable(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                tableId,
                tableToJoin
            );
            setShowJoinModal(false);
            toast.success(`Mesa ${tableToJoin} unida a la orden actual`);
        } catch (_e) {
            toast.error("Error al unir mesas");
        }
    };

    // ─── Feature 3: Split bill ────────────────────────────────────────────────

    const handleOpenSplit = useCallback(() => {
        if (!activeSale) return;
        const initial: Record<string, 1 | 2> = {};
        for (const lineId of Object.keys(activeSale.lines)) {
            initial[lineId] = 1;
        }
        setSplitAssignment(initial);
        setShowSplitModal(true);
    }, [activeSale]);

    const handleConfirmSplit = async () => {
        if (!orderId || !terminalConfig || !activeSale) return;

        const check1Id = activeSale.checks[0]?.check_id;
        if (!check1Id) {
            toast.error("No hay cuenta base para dividir");
            return;
        }

        const itemsForCheck2 = Object.entries(splitAssignment)
            .filter(([, account]) => account === 2)
            .map(([lineId]) => {
                const line = activeSale.lines[lineId];
                return { line_id: lineId, qty: line?.qty ?? 1 };
            });

        if (itemsForCheck2.length === 0) {
            toast.info("No hay items asignados a la Cuenta 2");
            return;
        }

        try {
            const check2Id = await POSActions.createCheck(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                "Cuenta 2"
            );

            await POSActions.moveCheckItems(
                terminalConfig.tenant_id,
                terminalConfig.terminal_id,
                terminalConfig.actor_id,
                orderId,
                check1Id,
                check2Id,
                itemsForCheck2
            );

            setShowSplitModal(false);
            toast.success(`Cuenta dividida: ${itemsForCheck2.length} items en Cuenta 2`);
        } catch (_e) {
            toast.error("Error al dividir la cuenta");
        }
    };

    // ─── Render guards ────────────────────────────────────────────────────────

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
    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

    // Map SaleLine to LineItemData (include notes and status)
    const lineItems = items.map(item => ({
        line_id: item.line_id,
        name: item.name,
        qty: item.qty,
        unit_price_cents: item.unit_price_cents,
        line_total_cents: item.line_total_cents,
        notes: item.notes,
        status: item.status,
    }));

    // Split bill: compute subtotals by account
    const splitSubtotals = { 1: 0, 2: 0 };
    if (showSplitModal && activeSale) {
        for (const [lineId, account] of Object.entries(splitAssignment)) {
            const line = activeSale.lines[lineId];
            if (line) {
                splitSubtotals[account] += line.line_total_cents;
            }
        }
    }

    // Order panel content (shared between sidebar and bottom sheet)
    const orderPanelContent = (
        <OrderPanel
            mode="waiter"
            items={lineItems}
            subtotalCents={activeSale?.subtotal_cents ?? 0}
            orderNumber={activeSale?.order_number}
            tableId={tableId}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemoveItem}
            onAddNote={handleAddNote}
            onSendToKitchen={handleSendToKitchen}
            onCallBill={handleCallBill}
            onPrintPrecheck={handlePrintPrecheck}
            onTransferTable={orderId ? handleOpenTransfer : undefined}
            onSplitBill={orderId && items.length > 1 ? handleOpenSplit : undefined}
            compact={isMobile}
        />
    );

    return (
        <div className="h-screen flex flex-col bg-park-black text-white overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-zinc-800/50 flex items-center justify-between px-3 md:px-4 bg-zinc-900/50 backdrop-blur-xl shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center flex-1">
                    <h1 className="text-base md:text-lg font-bold text-white">Mesa {tableId}</h1>
                    <span className="text-[10px] md:text-xs text-zinc-500">
                        {orderId ? `Pedido #${activeSale?.order_number ?? "..."}` : "Nueva Cuenta"}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-zinc-500 text-[10px] md:text-xs min-w-[44px] justify-end">
                    <Clock size={12} />
                    <span className="hidden sm:inline">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Catalog */}
                <main className={`flex-1 overflow-y-auto p-3 md:p-4 ${isMobile ? 'pb-24' : ''}`}>
                    <CatalogGrid onAdd={handleAddItem} shiftOpen={true} />
                </main>

                {/* Order Panel - Sidebar on desktop only */}
                {!isMobile && (
                    <aside className="w-80 lg:w-96 border-l border-zinc-800/50 flex flex-col">
                        {orderPanelContent}
                    </aside>
                )}
            </div>

            {/* Mobile: FAB to open order sheet */}
            {isMobile && (
                <OrderFAB
                    itemCount={itemCount}
                    totalCents={activeSale?.subtotal_cents ?? 0}
                    onClick={() => setIsOrderSheetOpen(true)}
                />
            )}

            {/* Mobile: Bottom Sheet for order */}
            {isMobile && (
                <BottomSheet
                    isOpen={isOrderSheetOpen}
                    onClose={() => setIsOrderSheetOpen(false)}
                    snapPoints={['collapsed', 'half', 'full']}
                    defaultSnap="half"
                    header={
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-white">Pedido Mesa {tableId}</h2>
                                <p className="text-xs text-zinc-400">{itemCount} items</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-emerald-400">
                                    S/ {((activeSale?.subtotal_cents ?? 0) / 100).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    }
                >
                    <div className="p-4">
                        {orderPanelContent}
                    </div>
                </BottomSheet>
            )}

            {/* ── Feature 1: Note Dialog ──────────────────────────────────────── */}
            {noteDialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Agregar nota al item"
                    onClick={(e) => { if (e.target === e.currentTarget) setNoteDialog(null); }}
                >
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white text-lg">Nota del item</h3>
                            <button
                                onClick={() => setNoteDialog(null)}
                                className="p-1 text-zinc-500 hover:text-white transition-colors"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">
                            Instrucción especial para cocina (ej: &quot;sin cebolla&quot;, &quot;bien cocido&quot;)
                        </p>
                        <input
                            ref={noteInputRef}
                            type="text"
                            value={noteDialog.current}
                            onChange={(e) => setNoteDialog({ ...noteDialog, current: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveNote(noteDialog.lineId, noteDialog.current);
                            }}
                            maxLength={200}
                            placeholder="Ej: sin cebolla, bien cocido..."
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-park-brand-500 text-sm"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setNoteDialog(null)}
                                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleSaveNote(noteDialog.lineId, noteDialog.current)}
                                className="flex-1 py-3 bg-park-brand-500 hover:bg-park-brand-600 rounded-xl font-bold text-sm transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Feature 2: Transfer Table Modal ────────────────────────────── */}
            {showTransferModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Transferir mesa"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowTransferModal(false); }}
                >
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white text-lg">Transferir Mesa</h3>
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="p-1 text-zinc-500 hover:text-white transition-colors"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500 mb-4">
                            Mover el pedido de <strong className="text-white">Mesa {tableId}</strong> a otra mesa libre
                        </p>
                        {availableTables.length === 0 ? (
                            <p className="text-center text-zinc-500 py-6 text-sm">No hay mesas libres disponibles</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                                {availableTables.map(table => (
                                    <button
                                        key={table}
                                        onClick={() => handleTransfer(table)}
                                        className="py-3 bg-zinc-800 hover:bg-emerald-700 active:bg-emerald-600 rounded-xl font-bold text-sm transition-colors border border-zinc-700 hover:border-emerald-500"
                                    >
                                        {table}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setShowTransferModal(false)}
                            className="w-full mt-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Feature 3: Split Bill Modal ─────────────────────────────────── */}
            {showSplitModal && activeSale && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Dividir cuenta"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSplitModal(false); }}
                >
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white text-lg">Dividir Cuenta</h3>
                            <button
                                onClick={() => setShowSplitModal(false)}
                                className="p-1 text-zinc-500 hover:text-white transition-colors"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Subtotals */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {([1, 2] as const).map(account => (
                                <div key={account} className={`p-3 rounded-xl border ${account === 1 ? 'border-blue-500/40 bg-blue-500/10' : 'border-purple-500/40 bg-purple-500/10'}`}>
                                    <p className="text-xs text-zinc-400">Cuenta {account}</p>
                                    <p className={`text-lg font-bold ${account === 1 ? 'text-blue-400' : 'text-purple-400'}`}>
                                        S/ {(splitSubtotals[account] / 100).toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Items assignment */}
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {Object.values(activeSale.lines).map(line => {
                                const assignment = splitAssignment[line.line_id] ?? 1;
                                return (
                                    <div key={line.line_id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50">
                                        <div className="flex-1 min-w-0 mr-3">
                                            <p className="text-sm font-medium truncate">{line.name}</p>
                                            <p className="text-xs text-zinc-500">×{line.qty} · S/ {(line.line_total_cents / 100).toFixed(2)}</p>
                                        </div>
                                        <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs font-bold shrink-0">
                                            <button
                                                onClick={() => setSplitAssignment(prev => ({ ...prev, [line.line_id]: 1 }))}
                                                className={`px-3 py-2 transition-colors ${assignment === 1 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                            >
                                                C1
                                            </button>
                                            <button
                                                onClick={() => setSplitAssignment(prev => ({ ...prev, [line.line_id]: 2 }))}
                                                className={`px-3 py-2 transition-colors ${assignment === 2 ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                            >
                                                C2
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSplitModal(false)}
                                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmSplit}
                                className="flex-1 py-3 bg-park-brand-500 hover:bg-park-brand-600 rounded-xl font-bold text-sm transition-colors"
                            >
                                Confirmar división
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Join Tables */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="font-bold text-lg text-white">Unir Mesa</h2>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-full text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {joinCandidates.length === 0 ? (
                                <p className="text-zinc-500 text-center py-8">No hay mesas libres para unir</p>
                            ) : (
                                <div className="grid grid-cols-4 gap-3">
                                    {joinCandidates.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => handleJoinTables(t)}
                                            className="h-14 bg-zinc-800 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center transition-colors"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
