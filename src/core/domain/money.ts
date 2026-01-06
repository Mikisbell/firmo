// src/core/domain/money.ts

// Marca nominal (para legibilidad). Sigue siendo number en runtime.
export type Cents = number & { readonly __brand: "Cents" };

export function cents(n: number): Cents {
    if (!Number.isInteger(n)) throw new Error(`Cents must be integer, got ${n}`);
    return n as Cents;
}

export function add(a: Cents, b: Cents): Cents {
    return cents((a as number) + (b as number));
}

export function sub(a: Cents, b: Cents): Cents {
    return cents((a as number) - (b as number));
}

export function mul(a: Cents, qty: number): Cents {
    if (!Number.isInteger(qty) || qty < 0) throw new Error(`qty must be non-negative int, got ${qty}`);
    return cents((a as number) * qty);
}

/**
 * Convierte "12.34" → 1234 (cents). Evita float acumulado.
 * Acepta "," o "." como separador decimal.
 */
export function parseMoneyToCents(input: string): Cents {
    const s = input.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid money: "${input}"`);
    const [i, d = ""] = s.split(".");
    const dec = (d + "00").slice(0, 2);
    return cents(parseInt(i, 10) * 100 + parseInt(dec, 10));
}

// Accept number | Cents for flexibility in UI components
export function formatCents(c: number | Cents): string {
    const n = c as number;
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    const i = Math.floor(abs / 100);
    const d = String(abs % 100).padStart(2, "0");
    return `${sign}${i}.${d}`;
}

