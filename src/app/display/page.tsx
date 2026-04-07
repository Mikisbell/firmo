/**
 * Customer Display Page
 *
 * Shows current order on a customer-facing second monitor.
 * Public page (no auth) — receives data via BroadcastChannel or localStorage fallback.
 *
 * Usage: Open /display on a second screen connected to the POS terminal.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { ShoppingBag, CheckCircle2, UtensilsCrossed } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DisplayStatus = "idle" | "ordering" | "paying" | "done";

export interface DisplayItem {
  name: string;
  qty: number;
  price: number; // cents
}

export interface CustomerDisplayData {
  items: DisplayItem[];
  total: number; // cents
  status: DisplayStatus;
  orderNumber?: number;
  tenantName?: string;
}

const CHANNEL_NAME = "park-customer-display";
const LS_KEY = "park_customer_display";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSoles(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const i = Math.floor(abs / 100);
  const d = String(abs % 100).padStart(2, "0");
  return `${sign}S/ ${i}.${d}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerDisplayPage() {
  const [data, setData] = useState<CustomerDisplayData>({
    items: [],
    total: 0,
    status: "idle",
  });

  const channelRef = useRef<BroadcastChannel | null>(null);

  // Listen for updates via BroadcastChannel (primary) and localStorage (fallback)
  useEffect(() => {
    // BroadcastChannel — instant cross-tab communication
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event: MessageEvent<CustomerDisplayData>) => {
        setData(event.data);
      };
      channelRef.current = bc;
    }

    // localStorage fallback — poll every 500ms for browsers without BroadcastChannel
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CustomerDisplayData;
          setData(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }, 500);

    // Hydrate initial state from localStorage
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      // Ignore
    }

    return () => {
      channelRef.current?.close();
      clearInterval(interval);
    };
  }, []);

  // ── DONE state — thank you screen ──
  if (data.status === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex flex-col items-center justify-center text-white px-8">
        <CheckCircle2 className="w-28 h-28 text-emerald-300 mb-8 animate-bounce" />
        <h1 className="text-5xl md:text-6xl font-black mb-4 text-center">
          Gracias por su compra!
        </h1>
        {data.orderNumber && (
          <p className="text-2xl md:text-3xl text-emerald-200 font-semibold">
            Orden #{data.orderNumber}
          </p>
        )}
        <p className="text-emerald-300/70 text-lg mt-6">
          {data.tenantName || "PARK POS"}
        </p>
      </div>
    );
  }

  // ── IDLE state — welcome screen ──
  if (data.status === "idle" || data.items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-neutral-900 flex flex-col items-center justify-center text-white px-8">
        <UtensilsCrossed className="w-24 h-24 text-zinc-500 mb-6" />
        <h1 className="text-4xl md:text-5xl font-black text-zinc-300 mb-2 text-center">
          {data.tenantName || "Bienvenido"}
        </h1>
        <p className="text-zinc-500 text-lg">Su orden aparecera aqui</p>
      </div>
    );
  }

  // ── ORDERING / PAYING state — show items ──
  const isPaying = data.status === "paying";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-neutral-900 flex flex-col text-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-zinc-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ShoppingBag className="w-8 h-8 text-indigo-400" />
          <h1 className="text-2xl font-bold text-zinc-200">
            {data.tenantName || "PARK POS"}
          </h1>
        </div>
        {data.orderNumber && (
          <span className="text-xl font-mono text-zinc-400">
            Orden #{data.orderNumber}
          </span>
        )}
      </header>

      {/* Items list */}
      <div className="flex-1 px-8 py-6 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="text-zinc-500 text-sm uppercase tracking-wider border-b border-zinc-700/50">
              <th className="text-left pb-3 font-medium">Producto</th>
              <th className="text-center pb-3 font-medium w-20">Cant.</th>
              <th className="text-right pb-3 font-medium w-36">Precio</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr
                key={`${item.name}-${idx}`}
                className="border-b border-zinc-800/50 text-lg"
              >
                <td className="py-4 text-white font-medium">{item.name}</td>
                <td className="py-4 text-center text-zinc-400 font-mono">
                  {item.qty}
                </td>
                <td className="py-4 text-right text-zinc-300 font-mono">
                  {formatSoles(item.price * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer — Total */}
      <footer
        className={`px-8 py-6 border-t-2 ${
          isPaying
            ? "border-amber-500 bg-amber-950/30"
            : "border-indigo-500 bg-indigo-950/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xl text-zinc-400 font-medium">
            {isPaying ? "Por pagar" : "Total"}
          </span>
          <span
            className={`text-4xl md:text-5xl font-black ${
              isPaying ? "text-amber-400" : "text-white"
            }`}
          >
            {formatSoles(data.total)}
          </span>
        </div>
        {isPaying && (
          <p className="text-amber-400/70 text-sm mt-2 text-right">
            Procesando pago...
          </p>
        )}
      </footer>
    </div>
  );
}
