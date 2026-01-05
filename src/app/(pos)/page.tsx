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
import { ShoppingCart, Wifi, WifiOff, CloudOff, Cloud } from "lucide-react";
import { toast, Toaster } from "sonner";
import { getDb } from "@/src/core/db/schema";

// Config hardcoded MVP - TODO: get from context/env
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "term_1";
const ACTOR_ID = "00000000-0000-0000-0000-000000000001";

// Order number counter (MVP - in production this comes from server)
let orderNumberCounter = 1;

export default function POSPage() {
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
    const [shiftModalMode, setShiftModalMode] = useState<"open" | "close">("open");

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

    const handleStartSale = async () => {
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
            // Remove item - for MVP just show toast, full implementation in P1
            toast.info("Eliminar items próximamente");
            return;
        }

        // Update quantity - for MVP just show toast, full implementation needs ITEM_QTY_UPDATED event
        toast.info("Editar cantidad próximamente");
    };

    const openShiftModal = (mode: "open" | "close") => {
        setShiftModalMode(mode);
        setShiftModalOpen(true);
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
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="font-bold text-white text-lg">P</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white">PARK POS</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Shift Status */}
                        <ShiftStatus
                            isOpen={shiftIsOpen}
                            shiftId={shift?.shift_id}
                            expectedCash={shift?.expected_cash_cents ?? 0}
                            onOpenClick={() => openShiftModal("open")}
                            onCloseClick={() => openShiftModal("close")}
                        />

                        {/* Sync Status Badge */}
                        {pendingSync > 0 && (
                            <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-full border ${pendingSync > 10
                                ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30 animate-pulse"
                                : "text-blue-400 bg-blue-500/10 border-blue-500/30"
                                }`}>
                                <CloudOff size={12} />
                                <span>{pendingSync}</span>
                            </div>
                        )}

                        {/* Online/Offline Status */}
                        <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border ${isOnline
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                            : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                            }`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                            <span className="w-px h-3 bg-zinc-700"></span>
                            <span>T:{TERM_ID}</span>
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
