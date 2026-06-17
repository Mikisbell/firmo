import { describe, test, expect } from "bun:test";
import { findSequenceGaps } from "../hole-tracker.math";

describe("Hole Tracker Math Engine", () => {
    test("Flujo feliz: Secuencias contiguas sin huecos", () => {
        const cursor = 100n;
        const sequences = [101n, 102n, 103n];
        const gaps = findSequenceGaps(cursor, sequences);
        expect(gaps).toEqual([]);
    });

    test("Hueco simple: Falta una secuencia en el medio", () => {
        const cursor = 100n;
        // Falta el 101
        const sequences = [102n, 103n];
        const gaps = findSequenceGaps(cursor, sequences);
        expect(gaps).toEqual([101n]);
    });

    test("Múltiples faltantes intercalados", () => {
        const cursor = 100n;
        // Faltan el 101, 104 y 105
        const sequences = [102n, 103n, 106n];
        const gaps = findSequenceGaps(cursor, sequences);
        expect(gaps).toEqual([101n, 104n, 105n]);
    });

    test("Hueco al inicio del cursor", () => {
        const cursor = 0n;
        // Faltan 1, 2, 3
        const sequences = [4n, 5n];
        const gaps = findSequenceGaps(cursor, sequences);
        expect(gaps).toEqual([1n, 2n, 3n]);
    });

    test("Protección OOM: Salto masivo (> 1000n) es ignorado", () => {
        const cursor = 100n;
        // Viene el 101 normal, pero luego salta al 1500 (Sequence Cache Discard)
        const sequences = [101n, 1500n];
        const gaps = findSequenceGaps(cursor, sequences);
        // Debería devolver vacío en lugar de intentar meter 1400 elementos en memoria
        expect(gaps).toEqual([]);
    });

    test("Manejo de salto mixto: Hueco normal seguido de salto OOM", () => {
        const cursor = 100n;
        // Falta el 102 (hueco de 1), y luego del 103 salta al 2000 (hueco de >1000)
        const sequences = [101n, 103n, 2000n];
        const gaps = findSequenceGaps(cursor, sequences);
        expect(gaps).toEqual([102n]);
    });
});
