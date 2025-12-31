"use client";

import React from "react";
import { formatCents } from "@/src/core/domain/money";
import { motion } from "framer-motion";
import { Coffee, Croissant, Drumstick, Sandwich } from "lucide-react";

type Product = { id: string; name: string; price: number };

const products: Product[] = [
    { id: "p1", name: "Café Americano", price: 2500 },
    { id: "p2", name: "Croissant", price: 3000 },
    { id: "p3", name: "Jugo Naranja", price: 4500 },
    { id: "p4", name: "Sandwich", price: 6000 },
];

const ICONS: Record<string, React.ElementType> = {
    p1: Coffee,
    p2: Croissant,
    p3: Drumstick,
    p4: Sandwich,
};

export default function CatalogGrid({ onAdd, recommendations = [] }: { onAdd: (p: Product) => void, recommendations?: string[] }) {
    // Ordenar: Recomendados primero
    const sortedProducts = [...products].sort((a, b) => {
        const aRec = recommendations.includes(a.id);
        const bRec = recommendations.includes(b.id);
        if (aRec && !bRec) return -1;
        if (!aRec && bRec) return 1;
        return 0;
    });

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProducts.map((p) => {
                const Icon = ICONS[p.id] || Coffee;
                const isRecommended = recommendations.includes(p.id);

                return (
                    <motion.button
                        layout
                        key={p.id}
                        onClick={() => onAdd(p)}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        className={`group relative flex flex-col items-start justify-between p-5 h-40 w-full rounded-2xl border shadow-lg transition-all overflow-hidden text-left ${isRecommended
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

                        <div className={`relative z-10 w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-colors ${isRecommended ? 'bg-indigo-500/20' : 'bg-zinc-800 group-hover:bg-indigo-500/20'
                            }`}>
                            <Icon className={`w-5 h-5 ${isRecommended ? 'text-indigo-300' : 'text-zinc-400 group-hover:text-indigo-400'}`} />
                        </div>

                        <div className="relative z-10 w-full">
                            <h3 className="font-bold text-sm md:text-base text-zinc-100 group-hover:text-white mb-0.5 leading-tight">
                                {p.name}
                            </h3>
                            <span className="font-mono text-lg font-bold text-emerald-400 group-hover:text-emerald-300">
                                ${formatCents(p.price as any)}
                            </span>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
}
