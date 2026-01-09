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
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                            isSelected
                                ? `${cat.color} text-white shadow-lg`
                                : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        }`}
                    >
                        <cat.icon size={16} />
                        <span>{cat.label}</span>
                        {count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                isSelected ? "bg-white/20" : "bg-zinc-700"
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
