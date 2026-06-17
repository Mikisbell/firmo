import { describe, it, expect } from "vitest";
import { getTableColors } from "./table-theme";

describe("table-theme getTableColors SLA Logic", () => {
    it("should return normal colors when COOKING and SLA is NORMAL", () => {
        const result = getTableColors("COOKING", 5, 15, true, "NORMAL");
        expect(result.label).toBe("5m 🍳");
        expect(result.bg).toContain("bg-orange-950/40");
        expect(result.isAlert).toBe(false);
    });

    it("should return warning colors when COOKING and SLA is SLA_WARNING", () => {
        const result = getTableColors("COOKING", 10, 15, true, "SLA_WARNING");
        expect(result.label).toBe("10m \u26A0\uFE0F");
        expect(result.bg).toContain("bg-yellow-950/60");
        expect(result.isAlert).toBe(false); // Warning is not an alert unless specified
    });

    it("should return critical colors when COOKING and SLA is SLA_CRITICAL", () => {
        const result = getTableColors("COOKING", 15, 15, true, "SLA_CRITICAL");
        expect(result.label).toBe("15m \uD83D\uDEA8");
        expect(result.bg).toContain("bg-red-950/60");
        expect(result.isAlert).toBe(true); // Critical SLA triggers alert
    });

    it("should return OCCUPIED with alert if inactivity threshold passed", () => {
        const result = getTableColors("OCCUPIED", 16, 15, true, "NORMAL");
        expect(result.label).toBe("16m");
        expect(result.isAlert).toBe(true);
    });

    it("should fallback to OCCUPIED theme for unknown states", () => {
        const result = getTableColors("UNKNOWN_STATE" as any, 0, 15, true, "NORMAL");
        expect(result.bg).toContain("bg-violet-950/40");
    });
});
