"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatCents } from "@/src/core/domain/money";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Coffee, Beer, Drumstick, UtensilsCrossed, Search, Star, IceCream, Salad } from "lucide-react";
import type { CatalogItem } from "@/src/core/catalog/service";
import { CategoryTabs } from "./CategoryTabs";

// Product type for component
type Product = {
    id: string;
    name: string;
    price: number;
    sku?: string;
    station?: string;
    category?: string;
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ElementType> = {
    POLLOS: Drumstick,
    COMBOS: Star,
    GUARNICIONES: UtensilsCrossed,
    BEBIDAS: Beer,
    EXTRAS: Salad,
    POSTRES: IceCream,
    PARRILLA: Flame,
    default: Coffee,
};

// Station colors
const STATION_COLORS: Record<string, string> = {
    PARRILLA: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    FREIDORA: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    BAR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    FRIO: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    COCINA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    FRIOS: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    POSTRES: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

interface CatalogGridProps {
    onAdd: (p: Product) => void;
    recommendations?: string[];
    shiftOpen?: boolean;
}

export default function CatalogGrid({ onAdd, recommendations = [], shiftOpen = true }: CatalogGridProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("ALL");

    // Fetch catalog on mount
    useEffect(() => {
        async function loadCatalog() {
            try {
                const res = await fetch("/api/catalog/latest");
                if (!res.ok) throw new Error("Failed to load catalog");
                const data = await res.json();

                setProducts(data.items.map((item: CatalogItem) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price_cents,
                    sku: item.sku,
                    station: item.station,
                    category: item.category,
                })));
            } catch (e) {
                setError("Error al cargar catálogo");
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadCatalog();
    }, []);

    // Category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        products.forEach(p => {
            const cat = p.category || "OTROS";
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [products]);

    // Filter and sort products
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Filter by category
        if (selectedCategory !== "ALL") {
            result = result.filter(p => p.category === selectedCategory);
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.sku?.toLowerCase().includes(query)
            );
        }

        // Sort: Recommended first
        result.sort((a, b) => {
            const aRec = recommendations.includes(a.id);
            const bRec = recommendations.includes(b.id);
            if (aRec && !bRec) return -1;
            if (!aRec && bRec) return 1;
            return 0;
        });

        return result;
    }, [products, selectedCategory, searchQuery, recommendations]);

    // Variants for staggered entry
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.03 }
        }
    };

    const itemVariant = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-zinc-500">Cargando catálogo...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Category Tabs */}
            <CategoryTabs
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categoryCounts={categoryCounts}
            />

            {/* Products Grid */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={selectedCategory + searchQuery}
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                >
                    {filteredProducts.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-zinc-500">
                            No se encontraron productos
                        </div>
                    ) : (
                        filteredProducts.map((p) => {
                            const Icon = CATEGORY_ICONS[p.category ?? "default"] || Coffee;
                            const isRecommended = recommendations.includes(p.id);
                            const stationColor = STATION_COLORS[p.station ?? "COCINA"] ?? STATION_COLORS.COCINA;

                            return (
                                <motion.button
                                    layout
                                    variants={itemVariant}
                                    key={p.id}
                                    onClick={() => shiftOpen ? onAdd(p) : alert("Abre un turno para vender")}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!shiftOpen}
                                    className={`group relative flex flex-col items-start justify-between p-4 h-40 w-full rounded-2xl border shadow-lg backdrop-blur-sm transition-all overflow-hidden text-left ${!shiftOpen
                                        ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 grayscale'
                                        : isRecommended
                                            ? 'bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border-indigo-500/40 ring-1 ring-indigo-400/20'
                                            : 'bg-zinc-900/80 border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-800'
                                        }`}
                                >
                                    {isRecommended && (
                                        <div className="absolute top-2 right-2">
                                            <span className="bg-indigo-500 text-white text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full">
                                                🔥
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 w-full">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRecommended ? 'bg-indigo-500/20' : 'bg-zinc-800'}`}>
                                            <Icon className={`w-5 h-5 ${isRecommended ? 'text-indigo-300' : 'text-zinc-400'}`} />
                                        </div>
                                        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${stationColor} uppercase`}>
                                            {p.station}
                                        </span>
                                    </div>

                                    <div className="w-full mt-auto">
                                        <h3 className="font-medium text-sm text-zinc-100 leading-tight line-clamp-2 mb-1">
                                            {p.name}
                                        </h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-[10px] text-zinc-500">PEN</span>
                                            <span className={`font-mono text-xl font-bold ${isRecommended ? 'text-emerald-300' : 'text-emerald-400'}`}>
                                                {formatCents(p.price)}
                                            </span>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

