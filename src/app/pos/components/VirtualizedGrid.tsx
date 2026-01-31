"use client";

/**
 * VirtualizedGrid Component
 * Virtualized grid for large product catalogs (50+ items)
 * Uses react-window v2 for efficient rendering
 * 
 * Task 7.3 - Mobile Responsive Spec
 * Requirements: 4.7, 9.2
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Grid, CellComponentProps } from "react-window";
import { formatCents } from "@/src/core/domain/money";
import { motion } from "framer-motion";
import { Flame, Coffee, Beer, Drumstick, UtensilsCrossed, Star, IceCream, Salad } from "lucide-react";

// Product type
export type Product = {
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

// Grid configuration based on container width
const getGridConfig = (containerWidth: number) => {
    if (containerWidth >= 800) return { columns: 5, itemWidth: containerWidth / 5 - 12 };
    if (containerWidth >= 600) return { columns: 4, itemWidth: containerWidth / 4 - 10 };
    if (containerWidth >= 400) return { columns: 3, itemWidth: containerWidth / 3 - 8 };
    return { columns: 2, itemWidth: containerWidth / 2 - 6 };
};

// Item heights
const ITEM_HEIGHT_MOBILE = 120;
const ITEM_HEIGHT_DESKTOP = 160;
const GAP = 8;

interface VirtualizedGridProps {
    products: Product[];
    onAdd: (p: Product) => void;
    recommendations?: string[];
    shiftOpen?: boolean;
    isMobile?: boolean;
}

// Cell props for react-window v2
interface CellProps {
    products: Product[];
    columns: number;
    onAdd: (p: Product) => void;
    recommendations: string[];
    shiftOpen: boolean;
    isMobile: boolean;
}

// Cell component for virtualized grid
function ProductCell({ 
    columnIndex, 
    rowIndex, 
    style,
    products,
    columns,
    onAdd,
    recommendations,
    shiftOpen,
    isMobile,
}: CellComponentProps<CellProps>) {
    const index = rowIndex * columns + columnIndex;
    
    if (index >= products.length) {
        return <div style={style} />;
    }
    
    const product = products[index];
    const Icon = CATEGORY_ICONS[product.category ?? "default"] || Coffee;
    const isRecommended = recommendations.includes(product.id);
    const stationColor = STATION_COLORS[product.station ?? "COCINA"] ?? STATION_COLORS.COCINA;

    return (
        <div style={{ ...style, padding: GAP / 2 }}>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => shiftOpen ? onAdd(product) : alert("Abre un turno para vender")}
                disabled={!shiftOpen}
                className={`
                    group relative flex flex-col items-start justify-between 
                    p-3 md:p-4 
                    h-full w-full
                    rounded-xl md:rounded-2xl border shadow-lg backdrop-blur-sm 
                    transition-all overflow-hidden text-left 
                    ${!shiftOpen
                        ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 grayscale'
                        : isRecommended
                            ? 'bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border-indigo-500/40 ring-1 ring-indigo-400/20'
                            : 'bg-zinc-900/80 border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-800 active:bg-zinc-700'
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
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${isRecommended ? 'bg-indigo-500/20' : 'bg-zinc-800'}`}>
                        <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isRecommended ? 'text-indigo-300' : 'text-zinc-400'}`} />
                    </div>
                    {!isMobile && (
                        <span className={`text-[8px] md:text-[9px] font-bold tracking-wider px-1 md:px-1.5 py-0.5 rounded border ${stationColor} uppercase`}>
                            {product.station}
                        </span>
                    )}
                </div>

                <div className="w-full mt-auto">
                    <h3 className="font-medium text-xs md:text-sm text-zinc-100 leading-tight line-clamp-2 mb-0.5 md:mb-1">
                        {product.name}
                    </h3>
                    <div className="flex items-baseline gap-0.5 md:gap-1">
                        <span className="text-[8px] md:text-[10px] text-zinc-500">S/</span>
                        <span className={`font-mono text-base md:text-xl font-bold ${isRecommended ? 'text-emerald-300' : 'text-emerald-400'}`}>
                            {formatCents(product.price)}
                        </span>
                    </div>
                </div>
            </motion.button>
        </div>
    );
}

export function VirtualizedGrid({
    products,
    onAdd,
    recommendations = [],
    shiftOpen = true,
    isMobile = false,
}: VirtualizedGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(400);

    // Observe container size
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                // Use available height or default
                const availableHeight = window.innerHeight - entry.target.getBoundingClientRect().top - 100;
                setContainerHeight(Math.max(300, availableHeight));
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Calculate grid configuration
    const { columns, itemWidth } = useMemo(() => 
        getGridConfig(containerWidth), [containerWidth]
    );

    const itemHeight = isMobile ? ITEM_HEIGHT_MOBILE : ITEM_HEIGHT_DESKTOP;
    const rowCount = Math.ceil(products.length / columns);

    // Cell props
    const cellProps: CellProps = useMemo(() => ({
        products,
        columns,
        onAdd,
        recommendations,
        shiftOpen,
        isMobile,
    }), [products, columns, onAdd, recommendations, shiftOpen, isMobile]);

    if (products.length === 0) {
        return (
            <div className="text-center py-12 text-zinc-500">
                No se encontraron productos
            </div>
        );
    }

    if (containerWidth === 0) {
        return (
            <div ref={containerRef} className="w-full h-64 animate-pulse bg-zinc-800/20 rounded-xl" />
        );
    }

    return (
        <div ref={containerRef} className="w-full">
            <Grid
                columnCount={columns}
                columnWidth={itemWidth + GAP}
                rowCount={rowCount}
                rowHeight={itemHeight + GAP}
                defaultHeight={containerHeight}
                defaultWidth={containerWidth}
                cellComponent={ProductCell}
                cellProps={cellProps}
                className="scrollbar-hide"
                style={{ overflowX: 'hidden' }}
            />
            
            {/* Virtualization indicator */}
            <div className="text-center text-xs text-zinc-600 mt-2">
                {products.length} productos (virtualizado)
            </div>
        </div>
    );
}

export default VirtualizedGrid;
