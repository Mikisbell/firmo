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
                                                p-4 
                                                min-h-[140px] lg:min-h-[150px]
                                                w-full rounded-xl border-b-4 shadow-md 
                                                transition-all duration-150 overflow-hidden text-left active:translate-y-1 active:border-b-0
                                                ${!shiftOpen
                                                    ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-950 grayscale'
                                                    : p.category === 'POLLOS' || p.category === 'PARRILLA' ? 'bg-orange-600 border-orange-800 hover:bg-orange-500 text-white'
                                                    : p.category === 'BEBIDAS' ? 'bg-blue-600 border-blue-800 hover:bg-blue-500 text-white'
                                                    : p.category === 'GUARNICIONES' ? 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500 text-white'
                                                    : p.category === 'POSTRES' ? 'bg-pink-600 border-pink-800 hover:bg-pink-500 text-white'
                                                    : p.category === 'EXTRAS' ? 'bg-lime-600 border-lime-800 hover:bg-lime-500 text-white'
                                                    : p.category === 'COMBOS' ? 'bg-yellow-500 border-yellow-700 hover:bg-yellow-400 text-park-black'
                                                    : 'bg-zinc-800 border-zinc-950 hover:bg-zinc-700 text-white'
                                                }
                                                ${isRecommended ? 'ring-2 ring-white ring-offset-2 ring-offset-park-black' : ''}
                                            `}
                                        >
                                            {isRecommended && (
                                                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2">
                                                    <span className="bg-indigo-500 text-white text-[8px] md:text-[9px] uppercase font-black px-1 md:px-1.5 py-0.5 rounded-full">
                                                        🔥
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 w-full">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-inner bg-black/20`}>
                                                    <Icon className={`w-5 h-5 text-current opacity-80`} />
                                                </div>
                                                {!isMobile && (
                                                    <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded bg-black/30 text-white/90 uppercase ml-auto`}>
                                                        {p.station}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-full mt-auto">
                                                <h3 className="font-bold text-sm md:text-base leading-tight line-clamp-2 mb-2 text-current drop-shadow-md">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-baseline gap-1 bg-black/20 px-2 py-1 rounded-md inline-flex">
                                                    <span className="text-xs font-bold text-current opacity-80">S/</span>
                                                    <span className={`font-mono text-lg md:text-xl font-black tracking-tight text-current drop-shadow-sm`}>
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

