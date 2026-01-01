"use client";

import React, { useEffect, useState } from "react";
import { formatCents } from "@/src/core/domain/money";
import { motion } from "framer-motion";
import { Flame, Coffee, Beer, Drumstick, UtensilsCrossed } from "lucide-react";
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
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProducts.map((p) => {
                const Icon = CATEGORY_ICONS[p.category ?? "default"] || Coffee;
                const isRecommended = recommendations.includes(p.id);
                const stationColor = STATION_COLORS[p.station ?? "COCINA"] ?? STATION_COLORS.COCINA;

                return (
                    <motion.button
                        layout
                        key={p.id}
                        onClick={() => shiftOpen ? onAdd(p) : alert("Abre un turno para vender")}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        disabled={!shiftOpen}
                        className={`group relative flex flex-col items-start justify-between p-5 h-40 w-full rounded-2xl border shadow-lg transition-all overflow-hidden text-left ${!shiftOpen
                                ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800'
                                : isRecommended
                                    ? 'bg-indigo-900/30 border-indigo-500/50 ring-2 ring-indigo-500/30'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 hover:shadow-indigo-500/10'
                            }`}
                    >
                        {isRecommended && (
                            <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">
                                Sugerido ✨
                            </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative z-10 flex items-center gap-2 w-full">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isRecommended ? 'bg-indigo-500/20' : 'bg-zinc-800 group-hover:bg-indigo-500/20'
                                }`}>
                                <Icon className={`w-5 h-5 ${isRecommended ? 'text-indigo-300' : 'text-zinc-400 group-hover:text-indigo-400'}`} />
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${stationColor}`}>
                                {p.station}
                            </span>
                        </div>

                        <div className="relative z-10 w-full">
                            <h3 className="font-bold text-sm md:text-base text-zinc-100 group-hover:text-white mb-0.5 leading-tight line-clamp-2">
                                {p.name}
                            </h3>
                            <span className="font-mono text-lg font-bold text-emerald-400 group-hover:text-emerald-300">
                                S/{formatCents(p.price as any)}
                            </span>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
}
