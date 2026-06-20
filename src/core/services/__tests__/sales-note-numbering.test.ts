/**
 * Tests de la numeracion de Nota de Venta (serie por terminal + correlativo local).
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
    salesNoteSerie,
    formatSalesNoteNumero,
    parseSalesNoteNumero,
    nextSalesNoteNumero,
} from "../sales-note-numbering";

describe("salesNoteSerie", () => {
    it("deriva serie estable y sanitizada del terminal_id", () => {
        expect(salesNoteSerie("T001")).toBe("NVT001");
        expect(salesNoteSerie("caja-2")).toBe("NVCAJA2");
        expect(salesNoteSerie("")).toBe("NVTERM");
    });

    it("dos terminales distintos producen series distintas (sin colision)", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 12 }),
                fc.string({ minLength: 1, maxLength: 12 }),
                (a, b) => {
                    fc.pre(
                        a.replace(/[^A-Za-z0-9]/g, "").toUpperCase() !==
                            b.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
                    );
                    expect(salesNoteSerie(a)).not.toBe(salesNoteSerie(b));
                },
            ),
        );
    });
});

describe("formatSalesNoteNumero / parseSalesNoteNumero", () => {
    it("formatea a 8 digitos y parsea de vuelta (round-trip)", () => {
        expect(formatSalesNoteNumero(7)).toBe("00000007");
        expect(parseSalesNoteNumero("00000007")).toBe(7);
    });

    it("round-trip para cualquier entero positivo", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 99_999_999 }), (n) => {
                expect(parseSalesNoteNumero(formatSalesNoteNumero(n))).toBe(n);
            }),
        );
    });

    it("parse invalido devuelve 0", () => {
        expect(parseSalesNoteNumero("abc")).toBe(0);
        expect(parseSalesNoteNumero("")).toBe(0);
        expect(parseSalesNoteNumero("-5")).toBe(0);
    });
});

describe("nextSalesNoteNumero", () => {
    it("primera nota es 1", () => {
        expect(nextSalesNoteNumero([])).toBe(1);
    });

    it("toma max+1 con numeros mixtos (number y string)", () => {
        expect(nextSalesNoteNumero([1, "00000003", 2])).toBe(4);
    });

    it("ignora valores no parseables", () => {
        expect(nextSalesNoteNumero(["abc", "00000005", "x"])).toBe(6);
    });

    it("property: el siguiente siempre es mayor que todos los existentes", () => {
        fc.assert(
            fc.property(fc.array(fc.integer({ min: 1, max: 1_000_000 })), (nums) => {
                const next = nextSalesNoteNumero(nums);
                for (const n of nums) expect(next).toBeGreaterThan(n);
            }),
        );
    });
});
