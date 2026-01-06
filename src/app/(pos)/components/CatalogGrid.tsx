"use client";

import React, { useEffect, useState } from "react";
import { formatCents } from "@/src/core/domain/money";
import { motion } from "framer-motion";
import { Flame, Coffee, Beer, Drumstick, UtensilsCrossed, Search } from "lucide-react";
import type { CatalogItem } from "@/src/core/catalog/service";

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
    pollos: Drumstick,
    parrilla: Flame,
    bebidas: Beer,
    acompañamientos: UtensilsCrossed,
    default: Coffee,
};

// Station colors
const STATION_COLORS: Record<string, string> = {
    PARRILLA: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    FREIDORA: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    BAR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    FRIO: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    COCINA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
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

    // Sort: Recommended first
    const sortedProducts = [...products].sort((a, b) => {
        const aRec = recommendations.includes(a.id);
        const bRec = recommendations.includes(b.id);
        if (aRec && !bRec) return -1;
        if (!aRec && bRec) return 1;
        return 0;
    });

    // FR-004: Filter by search query
    const filteredProducts = searchQuery.trim()
        ? sortedProducts.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : sortedProducts;

    // Variants for staggered entry
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
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
            {/* FR-004: Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
                {filteredProducts.map((p) => {
                    const Icon = CATEGORY_ICONS[p.category ?? "default"] || Coffee;
                    const isRecommended = recommendations.includes(p.id);
                    const stationColor = STATION_COLORS[p.station ?? "COCINA"] ?? STATION_COLORS.COCINA;

                    return (
                        <motion.button
                            layout
                            variants={itemVariant}
                            key={p.id}
                            onClick={() => shiftOpen ? onAdd(p) : alert("Abre un turno para vender")}
                            whileHover={{ scale: 1.02, y: -4, rotate: shiftOpen ? [-0.5, 0.5, 0] : 0 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={!shiftOpen}
                            className={`group relative flex flex-col items-start justify-between p-6 h-48 w-full rounded-3xl border shadow-xl backdrop-blur-sm transition-all overflow-hidden text-left ${!shiftOpen
                                ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 grayscale'
                                : isRecommended
                                    ? 'bg-gradient-to-br from-[#1e1b4b] to-[#312e81] border-indigo-500/30 ring-1 ring-indigo-400/20'
                                    : 'bg-zinc-900/60 border-zinc-800/60 hover:border-indigo-500/30 hover:bg-zinc-800/80 hover:shadow-indigo-500/10'
                                }`}
                        >
                            {isRecommended && (
                                <div className="absolute top-0 right-0 p-3">
                                    <span className="bg-indigo-500 text-white text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded-full shadow-lg shadow-indigo-500/20">
                                        Top 🔥
                                    </span>
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative z-10 flex items-center gap-3 w-full mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${isRecommended
                                    ? 'bg-indigo-500/20 shadow-indigo-500/10'
                                    : 'bg-zinc-800 group-hover:bg-zinc-700'
                                    }`}>
                                    <Icon className={`w-6 h-6 ${isRecommended ? 'text-indigo-300' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                                </div>
                                <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border ${stationColor} uppercase`}>
                                    {p.station}
                                </span>
                            </div>

                            <div className="relative z-10 w-full space-y-1">
                                <h3 className={`font-medium text-lg text-zinc-100 group-hover:text-white leading-tight line-clamp-2 ${isRecommended ? 'text-indigo-50' : ''}`}>
                                    {p.name}
                                </h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xs text-zinc-500 font-medium">PEN</span>
                                    <span className={`font-mono text-2xl font-bold tracking-tight ${isRecommended
                                        ? 'text-emerald-300'
                                        : 'text-zinc-400 group-hover:text-emerald-400 transition-colors'
                                        }`}>
                                        {formatCents(p.price as any)}
                                    </span>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </motion.div>
        </div>
    );
}

