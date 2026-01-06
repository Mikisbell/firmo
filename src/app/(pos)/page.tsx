"use client";

import React, { useEffect, useState } from "react";
import CatalogGrid from "./components/CatalogGrid";
import { CheckDetail } from "./components/CheckDetail";
import { ShiftModal, ShiftStatus } from "./components/ShiftModal";
import { useProjections } from "@/src/core/projections/useProjections";
import { POSActions } from "@/src/core/actions/pos.actions";
import { motion, AnimatePresence } from "framer-motion";
import { recommender } from "@/src/core/ai/recommendations";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { ShoppingCart, Wifi, WifiOff, CloudOff, Cloud, Undo2, LogOut, User } from "lucide-react";
import { toast, Toaster } from "sonner";
import { getDb } from "@/src/core/db/schema";
import { useAuth } from "@/src/components/auth";

// Order number counter (MVP - in production this comes from server)
let orderNumberCounter = 1;

export default function POSPage() {
    // Auth context - provides tenant, terminal, and employee info
    const { terminal, session, logout } = useAuth();
    
    // Derive IDs from auth session
    const TENANT_ID = terminal?.tenant_id ?? "";
    const TERM_ID = terminal?.terminal_id ?? "";
    const ACTOR_ID = session?.employee_id ?? "";
    
    const projections = useProjections();
    const activeSale = projections?.activeSale ?? null;
    const shift = projections?.shift ?? null;

    const [showSuccess, setShowSuccess] = useState(false);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [currentOrder, setCurrentOrder] = useState<{ order_id: string; check_id: string } | null>(null);
    const [selectedCheckId, setSelectedCheckId] = useState<string>("c1");
    const [isOnline, setIsOnline] = useState(true);
    const [pendingSync, setPendingSync] = useState(0);

    // Shift modal state
    const [shiftModalOpen, setShiftModalOpen] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<"open" | "close" | "movements">("open");

    const shiftIsOpen = shift?.status === "OPEN";

    // Online/Offline detection
    useEffect(() => {
        const updateOnlineStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);
        updateOnlineStatus();
        return () => {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
        };
    }, []);

    // Sync status polling
    useEffect(() => {
        const checkPendingSync = async () => {
            const db = getDb();
            if (!db) return;
            const count = await db.events.where("synced").equals(0).count();
            setPendingSync(count);
        };
        checkPendingSync();
        const interval = setInterval(checkPendingSync, 5000);
        return () => clearInterval(interval);
    }, []);

    // Train AI model on load
    useEffect(() => {
        recommender.train().catch(console.error);
    }, []);

    // Update recommendations when cart changes
    useEffect(() => {
        if (activeSale && Object.keys(activeSale.lines).length > 0) {
            const currentIds = Object.values(activeSale.lines).map(l => l.product_id);
            const preds = recommender.predict(currentIds);
            setRecommendations(preds.map(p => p.id));
        } else {
            setRecommendations([]);
        }
    }, [activeSale]);

    // Get active check
    const activeCheck = activeSale?.checks.find(c => c.check_id === selectedCheckId) ?? activeSale?.checks[0] ?? null;

    const handleAdd = async (product: { id: string; name: string; price: number; sku?: string; station?: string }) => {
        if (!shiftIsOpen) {
            setShiftModalMode("open");
            setShiftModalOpen(true);
            return;
        }

        let orderId = currentOrder?.order_id;

        // If no active order, create one
        if (!orderId || !activeSale || activeSale.status !== "OPEN") {
            const result = await POSActions.createOrder(TENANT_ID, TERM_ID, ACTOR_ID, {
                order_type: "DINE_IN",
                order_number: orderNumberCounter++,
            });
            orderId = result.order_id;
            setCurrentOrder(result);
            setSelectedCheckId(result.check_id);
        }

        // Add item to order
        await POSActions.addItem(TENANT_ID, TERM_ID, ACTOR_ID, orderId, {
            product_id: product.id,
            sku: product.sku ?? product.id,
            name: product.name,
            unit_price_cents: product.price,
            station: product.station ?? "COCINA",
        });

        toast.success(`${product.name} agregado`, { duration: 1000 });
    };

    const _handleStartSale = async () => {
        if (!shiftIsOpen) {
            setShiftModalMode("open");
            setShiftModalOpen(true);
            return;
        }

        const result = await POSActions.createOrder(TENANT_ID, TERM_ID, ACTOR_ID, {
            order_type: "DINE_IN",
            order_number: orderNumberCounter++,
        });
        setCurrentOrder(result);
        setSelectedCheckId(result.check_id);
    };

    const handlePayment = async (method: "CASH" | "CARD" | "YAPE" | "PLIN", amountCents: number) => {
        if (!shiftIsOpen) {
            toast.error("Turno cerrado. Abre un turno para cobrar.");
            setShiftModalMode("open");
            setShiftModalOpen(true);
            return;
        }
        if (!activeSale || !activeCheck) return;

        await POSActions.addPayment(TENANT_ID, TERM_ID, ACTOR_ID, activeSale.order_id, activeCheck.check_id, {
            method,
            amount_cents: amountCents,
        });

        // Check if this payment completes the check
        const newPaidTotal = activeCheck.payment.payments.reduce((sum, p) => sum + p.amount_cents, 0) + amountCents;
        if (newPaidTotal >= activeCheck.total_cents) {
            await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, activeSale.order_id, activeCheck.check_id);
            toast.success("Pago registrado ✓");
        }
    };

    const handleInvoice = async (type: "BOLETA" | "FACTURA") => {
        if (!shiftIsOpen) {
            toast.error("Turno cerrado. Abre un turno para facturar.");
            setShiftModalMode("open");
            setShiftModalOpen(true);
            return;
        }
        if (!activeSale || !activeCheck) return;

        await POSActions.issueInvoice(TENANT_ID, TERM_ID, ACTOR_ID, activeSale.order_id, activeCheck.check_id, type, activeCheck.total_cents);

        // Print ticket
        const linesToPrint = activeCheck.lines.map(l => {
            const item = activeSale.lines[l.line_id];
            return {
                name: item?.name || "Unknown",
                qty: l.qty,
                total: (item?.unit_price_cents || 0) * l.qty
            };
        });

        printComponent(
            <TicketTemplate
                tenantName="PARK POS"
                date={new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()}
                orderNumber={activeSale.order_number}
                lines={linesToPrint}
                subtotal={activeCheck.subtotal_cents}
                discount={activeCheck.discount_cents}
                total={activeCheck.total_cents}
                invoiceType={type}
                clientDoc="Cliente General"
            />,
            `${type} #${activeSale.order_number}`
        );

        toast.success(`¡${type} emitida!`);

        // Check if all checks are invoiced
        const allChecksPaid = activeSale.checks.every(c => {
            const paidCents = c.payment.payments.reduce((sum, p) => sum + p.amount_cents, 0);
            return paidCents >= c.total_cents;
        });

        if (allChecksPaid) {
            // Reset for new sale
            setCurrentOrder(null);
            setSelectedCheckId("c1");
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        }
    };

    const handleUpdateQty = async (lineId: string, newQty: number) => {
        if (!activeSale || !activeCheck) return;

        if (newQty <= 0) {
            // Void item using FR-005 UNDO functionality
            await POSActions.voidItem(TENANT_ID, TERM_ID, ACTOR_ID, activeSale.order_id, lineId, "REMOVED");
            toast.success("Item eliminado");
            return;
        }

        // Update quantity - for MVP just show toast, full implementation needs ITEM_QTY_UPDATED event
        toast.info("Editar cantidad próximamente");
    };

    // FR-005: UNDO last action - voids the most recent item
    const handleUndo = async () => {
        if (!activeSale || !activeCheck || activeCheck.payment.status === "PAID") return;

        // Get the last line from the check that's not voided
        const lastLine = [...activeCheck.lines].reverse()[0];
        if (!lastLine) {
            toast.info("No hay items para deshacer");
            return;
        }

        await POSActions.voidItem(TENANT_ID, TERM_ID, ACTOR_ID, activeSale.order_id, lastLine.line_id, "UNDO");
        toast.success("UNDO: Último item eliminado", { icon: "↩️" });
    };

    const openShiftModal = (mode: "open" | "close" | "movements") => {
        setShiftModalMode(mode);
        setShiftModalOpen(true);
    };

    const handleAdjustCash = async (deltaCents: number, reason: string) => {
        if (!shift?.shift_id) return;
        await POSActions.adjustCash(TENANT_ID, TERM_ID, ACTOR_ID, shift.shift_id, deltaCents, reason);
        toast.success(deltaCents > 0 ? "Ingreso registrado" : "Salida registrada");
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white relative font-sans">
            <Toaster position="top-center" richColors />

            {/* Shift Modal */}
            <ShiftModal
                isOpen={shiftModalOpen}
                mode={shiftModalMode}
                tenantId={TENANT_ID}
                terminalId={TERM_ID}
                actorId={ACTOR_ID}
                currentShiftId={shift?.shift_id}
                expectedCash={shift?.expected_cash_cents ?? 0}
                onClose={() => setShiftModalOpen(false)}
                onSuccess={() => { }}
                onAdjustCash={handleAdjustCash}
            />

            {/* Success Animation */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", damping: 15 }}
                            className="bg-zinc-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-zinc-800"
                        >
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <span className="text-emerald-500 text-5xl">✓</span>
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">Venta Exitosa</h2>
                            <p className="text-zinc-400 mt-2">Ticket procesado correctamente</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Left: Catalog */}
            <div className="flex-1 flex flex-col relative z-0">
                <header className="h-16 px-6 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-900 flex justify-between items-center z-10 sticky top-0">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo.svg"
                            alt="PARK POS"
                            className="w-8 h-8 rounded-lg shadow-lg"
                        />
                        <h1 className="text-xl font-bold tracking-tight text-white">PARK POS</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Employee Info & Logout */}
                        {session && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                                <User size={14} className="text-zinc-400" />
                                <span className="text-sm text-zinc-300">{session.employee_name}</span>
                                <button
                                    onClick={logout}
                                    className="ml-2 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                                    title="Cerrar sesión"
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>
                        )}

                        {/* Shift Status */}
                        <ShiftStatus
                            isOpen={shiftIsOpen}
                            shiftId={shift?.shift_id}
                            expectedCash={shift?.expected_cash_cents ?? 0}
                            openedAt={shift?.opened_at}
                            employeeName={session?.employee_name ?? "Sin sesión"}
                            onOpenClick={() => openShiftModal("open")}
                            onCloseClick={() => openShiftModal("close")}
                            onMovementsClick={() => openShiftModal("movements")}
                        />

                        {/* UNDO Button - FR-005 */}
                        {activeSale && activeCheck && activeCheck.payment.status !== "PAID" && (
                            <button
                                onClick={handleUndo}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-sm font-medium border border-zinc-700"
                                title="Deshacer último item (UNDO)"
                            >
                                <Undo2 size={16} />
                                <span>UNDO</span>
                            </button>
                        )}

                        {/* Sync Status Badge */}
                        <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-full border transition-colors ${pendingSync > 0
                            ? (pendingSync > 10 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30 animate-pulse" : "text-blue-400 bg-blue-500/10 border-blue-500/30")
                            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                            }`}>
                            {pendingSync > 0 ? <CloudOff size={12} /> : <Cloud size={12} />}
                            <span>{pendingSync > 0 ? pendingSync : "SYNCED"}</span>
                        </div>

                        {/* Online/Offline Status */}
                        <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border ${isOnline
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                            : "text-red-400 bg-red-500/10 border-red-500/30"
                            }`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                            <span className="w-px h-3 bg-zinc-700"></span>
                            <span>T:{terminal?.terminal_id?.slice(-4) ?? "---"}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <CatalogGrid
                        onAdd={handleAdd}
                        recommendations={recommendations}
                        shiftOpen={shiftIsOpen}
                    />
                </main>
            </div>

            {/* Right: Check Detail (or Empty State) */}
            <div className="w-[420px] xl:w-[480px] bg-white shadow-2xl z-20 flex flex-col">
                {activeSale && activeCheck ? (
                    <CheckDetail
                        check={activeCheck}
                        order={activeSale}
                        tenantId={TENANT_ID}
                        terminalId={TERM_ID}
                        actorId={ACTOR_ID}
                        onBack={() => {
                            setCurrentOrder(null);
                            setSelectedCheckId("c1");
                        }}
                        onPayment={handlePayment}
                        onInvoice={handleInvoice}
                        onUpdateQty={handleUpdateQty}
                        checks={activeSale.checks}
                        selectedCheckId={selectedCheckId}
                        onSelectCheck={setSelectedCheckId}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-900">
                        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <ShoppingCart className="text-zinc-600 w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Punto de Venta</h3>
                        <p className="text-zinc-500 text-sm mb-8 max-w-[200px]">
                            {shiftIsOpen
                                ? "Selecciona un producto del catálogo"
                                : "Abre un turno para comenzar a vender"}
                        </p>
                        {!shiftIsOpen && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openShiftModal("open")}
                                className="w-full max-w-[200px] px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all"
                            >
                                Abrir Turno
                            </motion.button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
