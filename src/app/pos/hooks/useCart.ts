"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Types
// ============================================================================

export interface CartItem {
    id: string;
    productId: string;
    name: string;
    price: number; // cents
    qty: number;
}

export interface Payment {
    method: "CASH" | "CARD" | "YAPE" | "PLIN";
    amount: number; // cents
}

interface CartState {
    // Data
    items: CartItem[];
    payments: Payment[];
    orderNumber: number;

    // Computed (derived in component, but we can have helpers)

    // Actions
    addItem: (product: { id: string; name: string; price: number }) => void;
    removeItem: (itemId: string) => void;
    updateQty: (itemId: string, qty: number) => void;
    clearCart: () => void;
    addPayment: (payment: Payment) => void;
    completeSale: () => Promise<{ success: boolean; orderNumber: number }>;
}

// ============================================================================
// Store
// ============================================================================

export const useCart = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            payments: [],
            orderNumber: 1,

            addItem: (product) => {
                set((state) => {
                    const existing = state.items.find(i => i.productId === product.id);
                    if (existing) {
                        return {
                            items: state.items.map(i =>
                                i.productId === product.id
                                    ? { ...i, qty: i.qty + 1 }
                                    : i
                            ),
                        };
                    }
                    return {
                        items: [
                            ...state.items,
                            {
                                id: uuidv4(),
                                productId: product.id,
                                name: product.name,
                                price: product.price,
                                qty: 1,
                            },
                        ],
                    };
                });
            },

            removeItem: (itemId) => {
                set((state) => ({
                    items: state.items.filter(i => i.id !== itemId),
                }));
            },

            updateQty: (itemId, qty) => {
                set((state) => ({
                    items: qty <= 0
                        ? state.items.filter(i => i.id !== itemId)
                        : state.items.map(i =>
                            i.id === itemId ? { ...i, qty } : i
                        ),
                }));
            },

            clearCart: () => {
                set({ items: [], payments: [] });
            },

            addPayment: (payment) => {
                set((state) => ({
                    payments: [...state.payments, payment],
                }));
            },

            completeSale: async () => {
                const state = get();
                const subtotal = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
                const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);

                if (totalPaid < subtotal) {
                    return { success: false, orderNumber: state.orderNumber };
                }

                try {
                    // Save to backend
                    await fetch("/api/sales", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            orderNumber: state.orderNumber,
                            items: state.items,
                            payments: state.payments,
                            subtotal,
                            total: subtotal,
                            completedAt: new Date().toISOString(),
                        }),
                    });
                } catch (e) {
                    console.error("Error saving sale:", e);
                    // Continue anyway for offline-first
                }

                const completedOrderNumber = state.orderNumber;

                // Reset for next sale
                set({
                    items: [],
                    payments: [],
                    orderNumber: state.orderNumber + 1,
                });

                return { success: true, orderNumber: completedOrderNumber };
            },
        }),
        {
            name: "park-cart",
            partialize: (state) => ({
                items: state.items,
                payments: state.payments,
                orderNumber: state.orderNumber,
            }),
        }
    )
);

// ============================================================================
// Computed Helpers (use in components)
// ============================================================================

export function getCartTotals(items: CartItem[], payments: Payment[]) {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, subtotal - totalPaid);
    const isPaid = remaining <= 0 && subtotal > 0;

    return { subtotal, totalPaid, remaining, isPaid };
}
