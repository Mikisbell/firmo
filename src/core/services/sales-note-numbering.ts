/**
 * Numeracion de NOTA DE VENTA — serie por terminal + correlativo local (offline-safe).
 *
 * La serie se deriva del terminal_id (unico por tenant), asi DOS terminales nunca
 * comparten serie y sus correlativos locales jamas colisionan. El unique DB
 * (tenant, serie, numero) es la red de seguridad final. Funciones PURAS: no tocan
 * DB ni red, se calculan con los numeros ya conocidos (offline desde Dexie u online
 * desde la proyeccion sales_notes).
 */

/** Serie estable y unica por terminal. Ej: "T001" -> "NVT001". */
export function salesNoteSerie(terminalId: string): string {
    const code = terminalId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return `NV${code || "TERM"}`;
}

/** Numero como string correlativo de 8 digitos. Ej: 7 -> "00000007". */
export function formatSalesNoteNumero(n: number): string {
    return String(Math.max(0, Math.trunc(n))).padStart(8, "0");
}

/** Parsea un numero correlativo ("00000007" -> 7). Devuelve 0 si no es valido. */
export function parseSalesNoteNumero(numero: string): number {
    const n = Number.parseInt(numero, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Siguiente correlativo a partir de los numeros ya emitidos en esa serie. */
export function nextSalesNoteNumero(existingNumeros: Array<number | string>): number {
    let max = 0;
    for (const raw of existingNumeros) {
        const n = typeof raw === "number" ? raw : parseSalesNoteNumero(raw);
        if (n > max) max = n;
    }
    return max + 1;
}
