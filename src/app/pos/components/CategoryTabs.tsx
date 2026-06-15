"use client";

import { motion } from "framer-motion";
import { 
    Drumstick, Beer, UtensilsCrossed, 
    IceCream, Salad, Star, Grid3X3
} from "lucide-react";

const CATEGORIES = [
    { id: "ALL", label: "Todo", icon: Grid3X3, color: "bg-zinc-600" },
    { id: "POLLOS", label: "Pollos", icon: Drumstick, color: "bg-orange-500" },
    { id: "COMBOS", label: "Combos", icon: Star, color: "bg-yellow-500" },
    { id: "GUARNICIONES", label: "Guarniciones", icon: UtensilsCrossed, color: "bg-emerald-500" },
    { id: "BEBIDAS", label: "Bebidas", icon: Beer, color: "bg-blue-500" },
    { id: "EXTRAS", label: "Extras", icon: Salad, color: "bg-lime-500" },
    { id: "POSTRES", label: "Postres", icon: IceCream, color: "bg-pink-500" },
];

interface CategoryTabsProps {
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    categoryCounts?: Record<string, number>;
}

export function CategoryTabs({ selectedCategory, onSelectCategory, categoryCounts = {} }: CategoryTabsProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat.id;
                const count = cat.id === "ALL" 
                    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
                    : categoryCounts[cat.id] || 0;

                return (
                    <motion.button
                        key={cat.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectCategory(cat.id)}
                        className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold whitespace-nowrap transition-all border-b-4 ${
                            isSelected
                                ? `${cat.color} text-white border-black/20 shadow-md`
                                : "bg-zinc-800 text-zinc-400 border-zinc-950 hover:bg-zinc-700 hover:text-white hover:border-zinc-900"
                        }`}
                    >
                        <cat.icon size={20} />
                        <span className="tracking-wide uppercase">{cat.label}</span>
                        {count > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded font-black ${
                                isSelected ? "bg-black/30 text-white" : "bg-zinc-900 text-zinc-500"
                            }`}>
                                {count}
                            </span>
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}

export { CATEGORIES };
