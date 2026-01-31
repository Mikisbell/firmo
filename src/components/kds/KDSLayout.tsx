"use client";

/**
 * KDSLayout - Shared layout component for Kitchen Display System
 * Responsive: 1 col mobile, 2-3 tablet, 4+ desktop
 * 
 * Task 12.1 - Mobile Responsive Spec
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { ReactNode } from "react";
import { Clock, LogOut, Home, LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { Toaster } from "sonner";
import { OrientationHint } from "@/src/components/ui";

export interface KDSLayoutProps {
    // Header
    title: string;
    subtitle: string;
    icon: LucideIcon;
    accentColor: "amber" | "sky" | "red" | "emerald";
    
    // Counters
    pendingCount: number;
    cookingCount: number;
    pendingLabel?: string;
    cookingLabel?: string;
    
    // Time
    currentTime: string;
    
    // Empty state
    emptyIcon: LucideIcon;
    emptyTitle: string;
    emptySubtitle: string;
    
    // Content
    children: ReactNode;
    hasTickets: boolean;
    
    // Optional
    showHomeButton?: boolean;
    showExitButton?: boolean;
}

// Color schemes for different KDS stations
const colorSchemes = {
    amber: {
        gradient: "from-amber-950/70 to-yellow-950/50",
        border: "border-amber-500",
        iconBg: "bg-amber-500/20",
        iconBorder: "border-amber-500/50",
        iconText: "text-amber-400",
        titleText: "text-amber-400",
        subtitleText: "text-amber-300/50",
        counterBg1: "bg-amber-950/50",
        counterBorder1: "border-amber-500/30",
        counterText1: "text-amber-400",
        counterLabel1: "text-amber-300/60",
        counterBg2: "bg-yellow-950/50",
        counterBorder2: "border-yellow-500/30",
        counterText2: "text-yellow-400",
        counterLabel2: "text-yellow-300/60",
        emptyBg: "bg-amber-950/30",
        emptyBorder: "border-amber-500/20",
        emptyIcon: "text-amber-500/30",
        emptyTitle: "text-amber-500/40",
        emptySubtitle: "text-amber-300/30",
        bgGradient: "from-amber-950/30 via-zinc-950 to-zinc-950",
        shadow: "shadow-[0_4px_20px_rgba(245,158,11,0.2)]",
    },
    sky: {
        gradient: "from-sky-950/80 to-blue-950/60",
        border: "border-sky-500",
        iconBg: "bg-sky-500/20",
        iconBorder: "border-sky-500/50",
        iconText: "text-sky-400",
        titleText: "text-sky-400",
        subtitleText: "text-sky-300/50",
        counterBg1: "bg-sky-950/50",
        counterBorder1: "border-sky-500/30",
        counterText1: "text-sky-400",
        counterLabel1: "text-sky-300/60",
        counterBg2: "bg-blue-950/50",
        counterBorder2: "border-blue-500/30",
        counterText2: "text-blue-400",
        counterLabel2: "text-blue-300/60",
        emptyBg: "bg-sky-950/30",
        emptyBorder: "border-sky-500/20",
        emptyIcon: "text-sky-500/30",
        emptyTitle: "text-sky-500/40",
        emptySubtitle: "text-sky-300/30",
        bgGradient: "from-sky-950/40 via-zinc-950 to-zinc-950",
        shadow: "shadow-[0_4px_20px_rgba(14,165,233,0.25)]",
    },
    red: {
        gradient: "from-red-950/70 to-orange-950/50",
        border: "border-red-500",
        iconBg: "bg-red-500/20",
        iconBorder: "border-red-500/50",
        iconText: "text-red-400",
        titleText: "text-red-400",
        subtitleText: "text-red-300/50",
        counterBg1: "bg-red-950/50",
        counterBorder1: "border-red-500/30",
        counterText1: "text-red-400",
        counterLabel1: "text-red-300/60",
        counterBg2: "bg-orange-950/50",
        counterBorder2: "border-orange-500/30",
        counterText2: "text-orange-400",
        counterLabel2: "text-orange-300/60",
        emptyBg: "bg-red-950/30",
        emptyBorder: "border-red-500/20",
        emptyIcon: "text-red-500/30",
        emptyTitle: "text-red-500/40",
        emptySubtitle: "text-red-300/30",
        bgGradient: "from-red-950/30 via-zinc-950 to-zinc-950",
        shadow: "shadow-[0_4px_20px_rgba(239,68,68,0.2)]",
    },
    emerald: {
        gradient: "from-emerald-950/70 to-teal-950/50",
        border: "border-emerald-500",
        iconBg: "bg-emerald-500/20",
        iconBorder: "border-emerald-500/50",
        iconText: "text-emerald-400",
        titleText: "text-emerald-400",
        subtitleText: "text-emerald-300/50",
        counterBg1: "bg-emerald-950/50",
        counterBorder1: "border-emerald-500/30",
        counterText1: "text-emerald-400",
        counterLabel1: "text-emerald-300/60",
        counterBg2: "bg-teal-950/50",
        counterBorder2: "border-teal-500/30",
        counterText2: "text-teal-400",
        counterLabel2: "text-teal-300/60",
        emptyBg: "bg-emerald-950/30",
        emptyBorder: "border-emerald-500/20",
        emptyIcon: "text-emerald-500/30",
        emptyTitle: "text-emerald-500/40",
        emptySubtitle: "text-emerald-300/30",
        bgGradient: "from-emerald-950/30 via-zinc-950 to-zinc-950",
        shadow: "shadow-[0_4px_20px_rgba(16,185,129,0.2)]",
    },
};

export function KDSLayout({
    title,
    subtitle,
    icon: Icon,
    accentColor,
    pendingCount,
    cookingCount,
    pendingLabel = "Pendiente",
    cookingLabel = "Cocinando",
    currentTime,
    emptyIcon: EmptyIcon,
    emptyTitle,
    emptySubtitle,
    children,
    hasTickets,
    showHomeButton = true,
    showExitButton = true,
}: KDSLayoutProps) {
    const router = useRouter();
    const colors = colorSchemes[accentColor];

    const handleExit = () => {
        clearTerminalConfig();
        router.push("/");
    };

    const handleHome = () => {
        router.push("/");
    };

    return (
        <div className={`flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${colors.bgGradient}`}>
            <Toaster position="top-right" theme="dark" />
            
            {/* Orientation hint for KDS - recommend landscape */}
            <OrientationHint 
                recommended="landscape" 
                storageKey={`kds-${accentColor}`}
                showOnce={true}
            />

            {/* Header - Responsive */}
            <header className={`
                min-h-[56px] md:h-20 
                bg-gradient-to-r ${colors.gradient} 
                border-b-2 md:border-b-4 ${colors.border} 
                flex items-center px-3 md:px-6 justify-between 
                ${colors.shadow}
            `}>
                {/* Left: Icon + Title */}
                <div className="flex items-center gap-2 md:gap-4">
                    <div className={`p-2 md:p-3 ${colors.iconBg} rounded-lg md:rounded-xl border md:border-2 ${colors.iconBorder}`}>
                        <Icon className={colors.iconText} size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-3xl font-black tracking-wider">
                            <span className={colors.titleText}>{title}</span>
                        </h1>
                        <p className={`${colors.subtitleText} text-[10px] md:text-xs uppercase tracking-widest hidden sm:block`}>
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* Right: Counters + Time + Actions */}
                <div className="flex items-center gap-2 md:gap-6">
                    {/* Counters - Compact on mobile */}
                    <div className="flex gap-2 md:gap-4">
                        <div className={`text-center px-2 md:px-4 py-1 md:py-2 ${colors.counterBg1} rounded-lg border ${colors.counterBorder1}`}>
                            <div className={`text-lg md:text-2xl font-black ${colors.counterText1}`}>{pendingCount}</div>
                            <div className={`text-[8px] md:text-[10px] uppercase tracking-wider ${colors.counterLabel1} hidden sm:block`}>
                                {pendingLabel}
                            </div>
                        </div>
                        <div className={`text-center px-2 md:px-4 py-1 md:py-2 ${colors.counterBg2} rounded-lg border ${colors.counterBorder2}`}>
                            <div className={`text-lg md:text-2xl font-black ${colors.counterText2}`}>{cookingCount}</div>
                            <div className={`text-[8px] md:text-[10px] uppercase tracking-wider ${colors.counterLabel2} hidden sm:block`}>
                                {cookingLabel}
                            </div>
                        </div>
                    </div>
                    
                    {/* Time - Hidden on very small screens */}
                    <div className="hidden sm:flex items-center gap-2 text-zinc-400 text-sm font-mono bg-zinc-900/80 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-zinc-700">
                        <Clock size={14} className="md:w-4 md:h-4" />
                        <span className="text-base md:text-lg">{currentTime}</span>
                    </div>

                    {/* Home Button */}
                    {showHomeButton && (
                        <button
                            onClick={handleHome}
                            className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700 touch-manipulation"
                            title="Ir al inicio"
                        >
                            <Home size={18} />
                        </button>
                    )}

                    {/* Exit Button - Icon only on mobile */}
                    {showExitButton && (
                        <button
                            onClick={handleExit}
                            className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:gap-2 md:px-4 md:py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30 touch-manipulation"
                            title="Cerrar sesión"
                        >
                            <LogOut size={18} />
                            <span className="hidden md:inline text-sm font-medium">Cerrar sesión</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Board - Responsive Grid */}
            <main className="flex-1 p-3 md:p-6 overflow-auto">
                <AnimatePresence mode="popLayout">
                    {!hasTickets ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className={`p-6 md:p-10 rounded-full ${colors.emptyBg} border-2 ${colors.emptyBorder} mb-4 md:mb-6`}>
                                <EmptyIcon size={60} className={`${colors.emptyIcon} md:w-20 md:h-20`} />
                            </div>
                            <h2 className={`text-xl md:text-3xl font-black uppercase tracking-widest ${colors.emptyTitle}`}>
                                {emptyTitle}
                            </h2>
                            <p className={`${colors.emptySubtitle} mt-2 text-xs md:text-sm uppercase tracking-wider`}>
                                {emptySubtitle}
                            </p>
                        </div>
                    ) : (
                        <div className="
                            grid gap-3 md:gap-5
                            grid-cols-1 
                            sm:grid-cols-2 
                            lg:grid-cols-3 
                            xl:grid-cols-4
                            2xl:grid-cols-5
                            auto-rows-max
                        ">
                            {children}
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default KDSLayout;
