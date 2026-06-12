"use client";

import { useCallback } from "react";
import { LogOut, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { ParkLogo } from "@/src/components/icons";

interface GlobalHeaderProps {
  title: string;
  subtitle?: string;
  titleColor?: string;
  borderColor?: string;
  bgGradient?: string;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function GlobalHeader({
  title,
  subtitle,
  titleColor = "text-emerald-400",
  borderColor = "border-emerald-500",
  bgGradient = "from-emerald-950/90 to-zinc-950",
  icon,
  rightContent,
}: GlobalHeaderProps) {
  const router = useRouter();

  const handleExit = useCallback(() => {
    // Clear terminal config and redirect to login
    clearTerminalConfig();
    router.push("/login");
  }, [router]);

  const handleHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <header
      className={`h-20 px-6 bg-gradient-to-r ${bgGradient} backdrop-blur-sm border-b-4 ${borderColor} flex justify-between items-center z-10 sticky top-0 shadow-lg`}
    >
      <div className="flex items-center gap-3">
        <ParkLogo size={40} className={`rounded-xl shadow-lg`} />
        {icon && (
          <div className={`p-2 rounded-xl ${titleColor}/20 border border-current/30`}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            <span className={titleColor}>{title}</span>
          </h1>
          {subtitle && (
            <p className={`${titleColor}/50 text-[10px] uppercase tracking-widest`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {rightContent}

        {/* Home Button */}
        <button
          onClick={handleHome}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700"
          title="Ir al inicio"
        >
          <Home size={18} />
        </button>

        {/* Exit Button */}
        <button
          onClick={handleExit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
