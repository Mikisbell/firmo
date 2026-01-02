"use client";

import { useState, useEffect } from "react";
import { CatalogGrid } from "./components/CatalogGrid";
import { CartSidebar } from "./components/CartSidebar";
import { useCart, type CartItem } from "./hooks/useCart";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, ShoppingCart } from "lucide-react";

// ============================================================================
// POS Page - Simplified Architecture
// ============================================================================

interface CatalogProduct {
    id: string;
    name: string;
    price: number;
    category?: string;
    sku?: string;
}

export default function POSPage() {
    const { addItem, items } = useCart();
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch catalog on mount
    useEffect(() => {
        async function loadCatalog() {
            try {
                const res = await fetch("/api/catalog/latest");
                const data = await res.json();
                setCatalog(data.items || []);
            } catch (e) {
                console.error("Failed to load catalog:", e);
                // Fallback demo catalog
                setCatalog([
                    { id: "1", name: "Gaseosa Personal", price: 500, category: "bebidas" },
                    { id: "2", name: "Gaseosa Familiar", price: 1000, category: "bebidas" },
                    { id: "3", name: "Agua Mineral", price: 300, category: "bebidas" },
                    { id: "4", name: "Hamburguesa Clásica", price: 1500, category: "comidas" },
                    { id: "5", name: "Papas Fritas", price: 800, category: "comidas" },
                    { id: "6", name: "Hot Dog", price: 700, category: "comidas" },
                ]);
            } finally {
                setLoading(false);
            }
        }
        loadCatalog();
    }, []);

    // Handle adding product to cart
    const handleAddProduct = (product: CatalogProduct) => {
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
        });
        toast.success(`${product.name} agregado`, {
            duration: 1000,
            style: { background: "#10b981", color: "white" }
        });
    };

    // Handle print after sale complete
    const handlePrint = (data: { items: CartItem[]; subtotal: number; total: number; orderNumber: number }) => {
        printComponent(
            <TicketTemplate
                tenantName="PARK POS"
                date={new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()}
                orderNumber={data.orderNumber}
                lines={data.items.map(i => ({
                    name: i.name,
                    qty: i.qty,
                    total: i.price * i.qty
                }))}
                subtotal={data.subtotal}
                discount={0}
                total={data.total}
                invoiceType="BOLETA"
                clientDoc="Cliente General"
            />,
            `Ticket #${data.orderNumber}`
        );

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);

        toast.success("¡Venta completada!", {
            description: "Ticket enviado a impresora 🖨️",
        });
    };

    const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-gray-100">
            <Toaster position="top-center" richColors />

            {/* Success Animation */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", damping: 15 }}
                            className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center"
                        >
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <span className="text-green-600 text-5xl">✓</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">¡Venta Exitosa!</h2>
                            <p className="text-gray-500 mt-2">Listo para el siguiente cliente</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content - Catalog */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="h-16 bg-white border-b flex items-center px-6 justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl shadow-lg">
                            P
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900">PARK POS</h1>
                            <p className="text-xs text-gray-500">Sistema de Ventas</p>
                        </div>
                    </div>

                    {/* Cart Badge (Mobile) */}
                    <div className="md:hidden flex items-center gap-2 bg-indigo-100 px-3 py-2 rounded-lg">
                        <ShoppingCart size={18} className="text-indigo-600" />
                        <span className="font-bold text-indigo-600">{totalItems}</span>
                    </div>
                </header>

                {/* Catalog Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {catalog.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleAddProduct(product)}
                                    className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg border border-gray-100 hover:border-indigo-300 transition-all active:scale-95 flex flex-col items-center text-center group"
                                >
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-full flex items-center justify-center mb-3 group-hover:from-indigo-100 group-hover:to-indigo-200 transition-colors">
                                        <Coffee className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <p className="font-semibold text-gray-900 text-sm leading-tight mb-1">
                                        {product.name}
                                    </p>
                                    <p className="text-indigo-600 font-bold">
                                        S/ {(product.price / 100).toFixed(2)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Cart */}
            <div className="hidden md:block">
                <CartSidebar onPrint={handlePrint} />
            </div>
        </div>
    );
}
