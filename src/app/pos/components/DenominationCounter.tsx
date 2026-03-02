"use client";

/**
 * DenominationCounter - Cash counting grid by PEN denomination
 *
 * Shows a grid of bills and coins for cashier to input
 * the quantity of each denomination during shift close.
 * Calculates total automatically.
 */

import { useState, useMemo } from "react";
import { PEN_DENOMINATIONS } from "@/src/core/constants/denominations";

interface DenominationCounterProps {
  onChange: (counts: Record<number, number>, totalCents: number) => void;
}

export function DenominationCounter({ onChange }: DenominationCounterProps) {
  const [counts, setCounts] = useState<Record<number, number>>({});

  const totalCents = useMemo(() => {
    let sum = 0;
    for (const denom of PEN_DENOMINATIONS) {
      sum += denom.faceCents * (counts[denom.faceCents] || 0);
    }
    return sum;
  }, [counts]);

  const handleChange = (faceCents: number, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    const next = { ...counts, [faceCents]: qty };
    setCounts(next);

    let sum = 0;
    for (const denom of PEN_DENOMINATIONS) {
      sum += denom.faceCents * (next[denom.faceCents] || 0);
    }
    onChange(next, sum);
  };

  const bills = PEN_DENOMINATIONS.filter(d => d.type === "bill");
  const coins = PEN_DENOMINATIONS.filter(d => d.type === "coin");

  return (
    <div className="space-y-3" data-testid="denomination-counter">
      {/* Bills */}
      <div data-testid="denomination-bills-section">
        <div className="text-xs text-zinc-500 uppercase font-medium mb-1.5">Billetes</div>
        <div className="space-y-1.5">
          {bills.map(d => {
            const qty = counts[d.faceCents] || 0;
            const subtotal = d.faceCents * qty;
            return (
              <div key={d.faceCents} className="flex items-center gap-2">
                <span className="w-16 text-sm text-zinc-300 font-medium">{d.label}</span>
                <span className="text-zinc-600 text-xs">×</span>
                <input
                  type="number"
                  min="0"
                  value={qty || ""}
                  onChange={e => handleChange(d.faceCents, e.target.value)}
                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="0"
                  data-testid={`denom-input-${d.faceCents}`}
                />
                <span className="text-zinc-600 text-xs">=</span>
                <span className="w-20 text-right text-sm font-mono text-zinc-400" data-testid={`denom-subtotal-${d.faceCents}`}>
                  {subtotal > 0 ? `S/ ${(subtotal / 100).toFixed(2)}` : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coins */}
      <div data-testid="denomination-coins-section">
        <div className="text-xs text-zinc-500 uppercase font-medium mb-1.5">Monedas</div>
        <div className="space-y-1.5">
          {coins.map(d => {
            const qty = counts[d.faceCents] || 0;
            const subtotal = d.faceCents * qty;
            return (
              <div key={d.faceCents} className="flex items-center gap-2">
                <span className="w-16 text-sm text-zinc-300 font-medium">{d.label}</span>
                <span className="text-zinc-600 text-xs">×</span>
                <input
                  type="number"
                  min="0"
                  value={qty || ""}
                  onChange={e => handleChange(d.faceCents, e.target.value)}
                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="0"
                  data-testid={`denom-input-${d.faceCents}`}
                />
                <span className="text-zinc-600 text-xs">=</span>
                <span className="w-20 text-right text-sm font-mono text-zinc-400" data-testid={`denom-subtotal-${d.faceCents}`}>
                  {subtotal > 0 ? `S/ ${(subtotal / 100).toFixed(2)}` : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-zinc-700 pt-2 flex justify-between items-center">
        <span className="text-sm font-semibold text-white">Total Contado</span>
        <span className="text-lg font-bold font-mono text-emerald-400" data-testid="denomination-total">
          S/ {(totalCents / 100).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
