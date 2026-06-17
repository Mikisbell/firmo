// table-theme.ts
export type TableStatus = "FREE" | "AVAILABLE" | "OCCUPIED" | "COOKING" | "BILL_REQUESTED" | "UNAVAILABLE" | "PAID";

// Thresholds are now dynamic and passed from the DB

export interface TableColors {
    bg: string;
    border: string;
    shadow: string;
    gradient: string;
    icon: string;
    light: string; // The glowing dot
    text: string;
    label: string;
    isAlert: boolean;
}

export function getTableColors(
    status: TableStatus, 
    elapsedMinutes: number = 0, 
    inactivityThresholdMin: number = 15, 
    isDark: boolean = true,
    slaStatus: "NORMAL" | "SLA_WARNING" | "SLA_CRITICAL" = "NORMAL"
): TableColors {
    const c = (d: string, l: string) => isDark ? d : l;
    const isAlert = (status === "OCCUPIED" && elapsedMinutes >= inactivityThresholdMin) || slaStatus === "SLA_CRITICAL";
    
    // Status -> [bg, border, shadow, gradient, icon, light, text, label]
    const themes: Record<string, [string, string, string, string, string, string, string, string]> = {
        UNAVAILABLE: [
            c("bg-zinc-900/60", "bg-zinc-200/60"),
            c("border-zinc-800", "border-zinc-300"),
            "shadow-none",
            "from-transparent to-transparent",
            c("bg-zinc-800 text-zinc-600", "bg-zinc-300 text-zinc-500"),
            "bg-zinc-600",
            c("text-zinc-500", "text-zinc-600"),
            "Inactiva"
        ],
        FREE: [
            c("bg-emerald-950/40 backdrop-blur-md", "bg-emerald-50 backdrop-blur-md"),
            c("border-emerald-500/30 border-t-emerald-400/50", "border-emerald-200 border-t-emerald-300"),
            c("shadow-[0_8px_32px_rgba(16,185,129,0.15)]", "shadow-[0_8px_32px_rgba(16,185,129,0.1)]"),
            c("from-emerald-500/10 via-emerald-500/5 to-transparent", "from-emerald-100 via-transparent to-transparent"),
            c("bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30", "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200"),
            c("bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]", "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"),
            c("text-emerald-400", "text-emerald-700"),
            "Disponible"
        ],
        BILL_REQUESTED: [
            c("bg-amber-950/50 backdrop-blur-md", "bg-amber-50 backdrop-blur-md"),
            c("border-amber-500/50 border-t-amber-400/70", "border-amber-300 border-t-amber-400"),
            c("shadow-[0_8px_32px_rgba(245,158,11,0.25)]", "shadow-[0_8px_32px_rgba(245,158,11,0.2)]"),
            c("from-amber-500/20 via-orange-500/5 to-transparent", "from-amber-200 via-transparent to-transparent"),
            c("bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50", "bg-amber-200 text-amber-700 ring-1 ring-amber-300"),
            c("bg-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.9)] animate-pulse", "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.7)] animate-pulse"),
            c("text-amber-400", "text-amber-700"),
            "PIDE CUENTA"
        ],
        // ALERT theme removed, handled by isAlert overlay in PremiumTable
        // SLA states for COOKING
        COOKING_NORMAL: [
            c("bg-orange-950/40 backdrop-blur-md", "bg-orange-50 backdrop-blur-md"),
            c("border-orange-500/40 border-t-orange-400/60", "border-orange-300 border-t-orange-400"),
            c("shadow-[0_8px_32px_rgba(249,115,22,0.2)]", "shadow-[0_8px_32px_rgba(249,115,22,0.15)]"),
            c("from-orange-500/15 via-amber-500/5 to-transparent", "from-orange-100 via-transparent to-transparent"),
            c("bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40", "bg-orange-200 text-orange-700 ring-1 ring-orange-300"),
            c("bg-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.8)] animate-pulse", "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)] animate-pulse"),
            c("text-orange-400", "text-orange-700"),
            `${elapsedMinutes}m 🍳`
        ],
        COOKING_WARNING: [
            c("bg-yellow-950/60 backdrop-blur-md", "bg-yellow-50 backdrop-blur-md"),
            c("border-yellow-500/60 border-t-yellow-400/80", "border-yellow-400 border-t-yellow-500"),
            c("shadow-[0_8px_32px_rgba(234,179,8,0.3)]", "shadow-[0_8px_32px_rgba(234,179,8,0.25)]"),
            c("from-yellow-500/25 via-yellow-500/10 to-transparent", "from-yellow-200 via-transparent to-transparent"),
            c("bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-500/60", "bg-yellow-200 text-yellow-700 ring-1 ring-yellow-400"),
            c("bg-yellow-500 shadow-[0_0_16px_rgba(234,179,8,0.9)] animate-pulse", "bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.8)] animate-pulse"),
            c("text-yellow-400", "text-yellow-700"),
            `${elapsedMinutes}m ⚠️`
        ],
        COOKING_CRITICAL: [
            c("bg-red-950/60 backdrop-blur-md", "bg-red-50 backdrop-blur-md"),
            c("border-red-500/60 border-t-red-400/80", "border-red-400 border-t-red-500"),
            c("shadow-[0_8px_32px_rgba(239,68,68,0.35)]", "shadow-[0_8px_32px_rgba(239,68,68,0.3)]"),
            c("from-red-500/30 via-red-500/10 to-transparent", "from-red-200 via-transparent to-transparent"),
            c("bg-red-500/30 text-red-400 ring-1 ring-red-500/60", "bg-red-200 text-red-700 ring-1 ring-red-400"),
            c("bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] animate-pulse", "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)] animate-pulse"),
            c("text-red-400", "text-red-700"),
            `${elapsedMinutes}m 🚨`
        ],
        OCCUPIED: [
            c("bg-violet-950/40 backdrop-blur-md", "bg-violet-50 backdrop-blur-md"),
            c("border-violet-500/40 border-t-violet-400/60", "border-violet-300 border-t-violet-400"),
            c("shadow-[0_8px_32px_rgba(139,92,246,0.2)]", "shadow-[0_8px_32px_rgba(139,92,246,0.15)]"),
            c("from-violet-500/15 via-purple-500/5 to-transparent", "from-violet-100 via-transparent to-transparent"),
            c("bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40", "bg-violet-200 text-violet-700 ring-1 ring-violet-300"),
            c("bg-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.8)]", "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]"),
            c("text-violet-400", "text-violet-700"),
            `${elapsedMinutes}m`
        ]
    };
    
    // Resolve key
    let key: string = status === "AVAILABLE" ? "FREE" : status;
    
    if (status === "COOKING") {
        if (slaStatus === "SLA_CRITICAL") key = "COOKING_CRITICAL";
        else if (slaStatus === "SLA_WARNING") key = "COOKING_WARNING";
        else key = "COOKING_NORMAL";
    }

    const t = themes[key] || themes.OCCUPIED;
    return { 
        bg: t[0], 
        border: t[1], 
        shadow: t[2], 
        gradient: t[3], 
        icon: t[4], 
        light: t[5], 
        text: t[6], 
        label: t[7],
        isAlert 
    };
}
