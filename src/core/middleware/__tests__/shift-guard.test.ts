/**
 * Shift Guard Middleware Tests
 *
 * Tests that POS operations require an OPEN shift.
 * - 403 when no open shift
 * - 400 when no terminal_id header
 * - 200 with shift info when shift is open
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before imports
const mockFindFirst = vi.fn();
vi.mock("@/src/core/db/prisma", () => ({
    default: {
        shifts: {
            findFirst: (...args: unknown[]) => mockFindFirst(...args),
        },
    },
}));

// Mock POS auth
const mockRequirePosAuth = vi.fn();
vi.mock("@/src/core/middleware/pos-auth", () => ({
    requirePosAuth: (...args: unknown[]) => mockRequirePosAuth(...args),
}));

import { requireOpenShift } from "../shift-guard";
import { NextRequest } from "next/server";

function makeRequest(terminalId?: string): NextRequest {
    const headers = new Headers();
    if (terminalId) {
        headers.set("x-terminal-id", terminalId);
    }
    return new NextRequest("http://localhost/api/pos/test", {
        method: "POST",
        headers,
    });
}

describe("requireOpenShift", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns unauthorized if POS auth fails", async () => {
        const mockResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        mockRequirePosAuth.mockResolvedValue({
            authorized: false,
            response: mockResponse,
        });

        const result = await requireOpenShift(makeRequest("T001"));

        expect(result.authorized).toBe(false);
        if (!result.authorized) {
            expect(result.response.status).toBe(401);
        }
    });

    it("returns 400 if terminal_id is missing", async () => {
        mockRequirePosAuth.mockResolvedValue({
            authorized: true,
            user: {
                id: "user-1",
                role: "CASHIER",
                name: "Test",
                tenantId: "tenant-1",
                sessionId: "session-1",
                terminalId: undefined,
            },
        });

        const result = await requireOpenShift(makeRequest());

        expect(result.authorized).toBe(false);
        if (!result.authorized) {
            expect(result.response.status).toBe(400);
            const body = await result.response.json();
            expect(body.error).toBe("TERMINAL_ID_REQUIRED");
        }
    });

    it("returns 403 NO_OPEN_SHIFT if no shift is open", async () => {
        mockRequirePosAuth.mockResolvedValue({
            authorized: true,
            user: {
                id: "user-1",
                role: "CASHIER",
                name: "Test",
                tenantId: "tenant-1",
                sessionId: "session-1",
                terminalId: "T001",
            },
        });

        mockFindFirst.mockResolvedValue(null);

        const result = await requireOpenShift(makeRequest("T001"));

        expect(result.authorized).toBe(false);
        if (!result.authorized) {
            expect(result.response.status).toBe(403);
            const body = await result.response.json();
            expect(body.error).toBe("NO_OPEN_SHIFT");
            expect(body.terminal_id).toBe("T001");
        }
    });

    it("returns authorized with shiftId when shift is open", async () => {
        mockRequirePosAuth.mockResolvedValue({
            authorized: true,
            user: {
                id: "user-1",
                role: "CASHIER",
                name: "Test",
                tenantId: "tenant-1",
                sessionId: "session-1",
                terminalId: "T001",
            },
        });

        mockFindFirst.mockResolvedValue({ id: "shift-abc-123" });

        const result = await requireOpenShift(makeRequest("T001"));

        expect(result.authorized).toBe(true);
        if (result.authorized) {
            expect(result.user.shiftId).toBe("shift-abc-123");
            expect(result.user.terminalId).toBe("T001");
            expect(result.user.tenantId).toBe("tenant-1");
        }
    });

    it("queries shifts with correct tenant_id, terminal_id, and status", async () => {
        mockRequirePosAuth.mockResolvedValue({
            authorized: true,
            user: {
                id: "user-1",
                role: "CASHIER",
                name: "Test",
                tenantId: "tenant-xyz",
                sessionId: "session-1",
                terminalId: "T005",
            },
        });

        mockFindFirst.mockResolvedValue({ id: "shift-999" });

        await requireOpenShift(makeRequest("T005"));

        expect(mockFindFirst).toHaveBeenCalledWith({
            where: {
                tenant_id: "tenant-xyz",
                terminal_id: "T005",
                status: "OPEN",
            },
            select: { id: true },
            orderBy: { opened_at: "desc" },
        });
    });
});
