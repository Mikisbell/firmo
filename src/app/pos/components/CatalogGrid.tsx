"use client";

import React, { useMemo, useRef } from "react";
import { formatCents } from "@/src/core/domain/money";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Coffee, Beer, Drumstick, UtensilsCrossed, Search, Star, IceCream, Salad } from "lucide-react";
import type { CatalogItem } from "@/src/core/catalog/service";
import { CategoryTabs } from "./CategoryTabs";
import { useResponsive } from "@/src/hooks/useResponsive";
import { VirtualizedGrid } from "./VirtualizedGrid";
import { useCatalog } from "@/src/hooks/useSWRHooks";

// Threshold for enabling virtualization
const VIRTUALIZATION_THRESHOLD = 50;

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
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState("ALL");
    const { isMobile } = useResponsive();
    const containerRef = useRef<HTMLDivElement>(null);

    // Usar SWR para fetch con deduplicación automática
    const { data, error, isLoading } = useCatalog();

    // Transformar datos del catálogo a formato de productos
    const products = useMemo(() => {
        if (!data?.items) return [];
        return data.items.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price_cents,
            sku: item.sku,
            station: item.station,
            category: item.category,
        }));
    }, [data]);

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-zinc-500">Cargando catálogo...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-400">Error al cargar catálogo</div>
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

            {/* Products Grid - Virtualized for large catalogs */}
            {filteredProducts.length > VIRTUALIZATION_THRESHOLD ? (
                <VirtualizedGrid
                    products={filteredProducts}
                    onAdd={onAdd}
                    recommendations={recommendations}
                    shiftOpen={shiftOpen}
                    isMobile={isMobile}
                />
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        ref={containerRef}
                        key={selectedCategory + searchQuery}
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="catalog-grid-container"
                        style={{ containerType: 'inline-size' }}
                    >
                        <div className="catalog-grid">
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
                                            data-testid={`product-${p.id}`}
                                            onClick={() => shiftOpen ? onAdd(p) : alert("Abre un turno para vender")}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            disabled={!shiftOpen}
                                            className={`
                                                group relative flex flex-col items-start justify-between 
                                                p-3 md:p-4 
                                                min-h-[110px] md:min-h-[140px] lg:min-h-[160px]
                                                w-full rounded-2xl border shadow-xl backdrop-blur-md 
                                                transition-all duration-300 overflow-hidden text-left 
                                                ${!shiftOpen
                                                    ? 'opacity-40 cursor-not-allowed bg-zinc-950/50 border-zinc-900 grayscale'
                                                    : isRecommended
                                                        ? 'bg-gradient-to-br from-park-brand-900/40 to-park-brand-800/20 border-park-brand-500/30 ring-1 ring-park-brand-400/20 hover:border-park-brand-500/60 hover:bg-park-brand-900/50'
                                                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.05] shadow-black/20'
                                                }
                                            `}
                                        >
                                            {isRecommended && (
                                                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2">
                                                    <span className="bg-indigo-500 text-white text-[8px] md:text-[9px] uppercase font-black px-1 md:px-1.5 py-0.5 rounded-full">
                                                        🔥
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 md:gap-2 w-full">
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner ${isRecommended ? 'bg-park-brand-500/20' : 'bg-zinc-800/80 group-hover:bg-zinc-700/80 transition-colors'}`}>
                                                    <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isRecommended ? 'text-park-brand-300' : 'text-zinc-400 group-hover:text-zinc-300'} transition-colors`} />
                                                </div>
                                                {!isMobile && (
                                                    <span className={`text-[8px] md:text-[9px] font-bold tracking-wider px-1 md:px-1.5 py-0.5 rounded border ${stationColor} uppercase`}>
                                                        {p.station}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-full mt-auto">
                                                <h3 className="font-semibold text-xs md:text-sm text-zinc-100 leading-tight line-clamp-2 mb-1 group-hover:text-white transition-colors">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-baseline gap-0.5 md:gap-1">
                                                    <span className="text-[10px] md:text-xs text-zinc-500 font-medium">S/</span>
                                                    <span className={`font-mono text-lg md:text-2xl font-black tracking-tight ${isRecommended ? 'text-park-brand-400' : 'text-emerald-400 group-hover:text-emerald-300'} transition-colors drop-shadow-sm`}>
                                                        {formatCents(p.price)}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Container Query CSS */}
            <style jsx>{`
                .catalog-grid {
                    display: grid;
                    gap: 0.5rem;
                    grid-template-columns: repeat(2, 1fr);
                }
                
                @container (min-width: 400px) {
                    .catalog-grid {
                        gap: 0.75rem;
                        grid-template-columns: repeat(3, 1fr);
                    }
                }
                
                @container (min-width: 600px) {
                    .catalog-grid {
                        grid-template-columns: repeat(4, 1fr);
                    }
                }
                
                @container (min-width: 800px) {
                    .catalog-grid {
                        grid-template-columns: repeat(5, 1fr);
                    }
                }
                
                /* Fallback for browsers without Container Query support */
                @supports not (container-type: inline-size) {
                    .catalog-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    @media (min-width: 640px) {
                        .catalog-grid {
                            grid-template-columns: repeat(3, 1fr);
                        }
                    }
                    
                    @media (min-width: 1024px) {
                        .catalog-grid {
                            grid-template-columns: repeat(4, 1fr);
                        }
                    }
                    
                    @media (min-width: 1280px) {
                        .catalog-grid {
                            grid-template-columns: repeat(5, 1fr);
                        }
                    }
                }
            `}</style>
        </div>
    );
}

