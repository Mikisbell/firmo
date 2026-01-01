"use client";

import React, { useEffect, useState } from "react";
import CatalogGrid from "./components/CatalogGrid";
import Cart from "./components/Cart";
import { ShiftModal, ShiftStatus } from "./components/ShiftModal";
import { useProjections } from "@/src/core/projections/useProjections";
import { POSActions } from "@/src/core/actions/pos.actions";
import { motion, AnimatePresence } from "framer-motion";
import { recommender } from "@/src/core/ai/recommendations";

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

    // Shift modal state
    const [shiftModalOpen, setShiftModalOpen] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<"open" | "close">("open");

    const shiftIsOpen = shift?.status === "OPEN";

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
        }

        // Add item to order
        await POSActions.addItem(TENANT_ID, TERM_ID, ACTOR_ID, orderId, {
            product_id: product.id,
            sku: product.sku ?? product.id,
            name: product.name,
            unit_price_cents: product.price,
            station: product.station ?? "COCINA",
        });
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
    };

    const handleConfirm = async () => {
        if (!activeSale || !currentOrder) return;

        const total = activeSale.subtotal_cents;
        if (confirm(`¿Confirmar cobro de S/${(total / 100).toFixed(2)}?`)) {
            // 1. Add payment
            await POSActions.addPayment(TENANT_ID, TERM_ID, ACTOR_ID, currentOrder.order_id, currentOrder.check_id, {
                method: "CASH",
                amount_cents: total,
            });

            // 2. Mark check as paid
            await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, currentOrder.order_id, currentOrder.check_id);

            // 3. Issue invoice
            await POSActions.issueInvoice(TENANT_ID, TERM_ID, ACTOR_ID, currentOrder.order_id, currentOrder.check_id, "BOLETA", total);

            // Reset
            setCurrentOrder(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        }
    };

    const openShiftModal = (mode: "open" | "close") => {
        setShiftModalMode(mode);
        setShiftModalOpen(true);
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white relative font-sans">
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

                        {/* Online Status */}
                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                ONLINE
                            </span>
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

            {/* Right: Cart */}
            <div className="w-[400px] xl:w-[450px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-20 flex flex-col">
                <Cart
                    sale={activeSale}
                    onStartSale={handleStartSale}
                    onConfirm={handleConfirm}
                />
            </div>
        </div>
    );
}
