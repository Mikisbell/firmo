import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface ElapsedTimerProps {
  createdAt: string; // ISO string
}

export function ElapsedTimer({ createdAt }: ElapsedTimerProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const createdTime = new Date(createdAt).getTime();
      const now = Date.now();
      const diffMs = now - createdTime;
      const diffMins = Math.floor(diffMs / 60000);
      setElapsedMinutes(Math.max(0, diffMins));
    };

    calculateElapsed();
    // Update every 30 seconds to ensure the UI stays relatively fresh
    // without spinning too fast.
    const interval = setInterval(calculateElapsed, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const isWarning = elapsedMinutes >= 30 && elapsedMinutes < 60;
  const isDanger = elapsedMinutes >= 60;

  // Formatting: if < 60 mins -> "XXm", if >= 60 mins -> "Xh YYm"
  const formattedTime =
    elapsedMinutes >= 60
      ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`
      : `${elapsedMinutes}m`;

  return (
    <div
      className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border transition-colors ${
        isDanger
          ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]"
          : isWarning
          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      }`}
      title={`Abierto hace ${elapsedMinutes} minutos`}
    >
      <Clock size={12} className={isDanger ? "animate-bounce" : ""} />
      <span>{formattedTime}</span>
    </div>
  );
}
