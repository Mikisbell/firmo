/**
 * Integration Tests: Reservation API Routes
 *
 * Tests request/response shapes by calling the route handlers directly
 * with mocked service layer. Validates:
 * - HTTP status codes (201, 400, 404, 409, 429)
 * - Auth validation on admin routes
 * - Correct error messages
 * - Public routes have no auth requirement
 *
 * Covers scenarios: S1-S3, S10-S13, S14-S16, S17-S24
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock reservation service
const mockResolveTenantBySlug = vi.fn();
const mockCreateReservation = vi.fn();
const mockGetAvailableSlots = vi.fn();
const mockGetReservationByCode = vi.fn();
const mockCancelByCustomer = vi.fn();
const mockGetReservationsByDate = vi.fn();
const mockPerformAction = vi.fn();
const mockGetReservationById = vi.fn();

vi.mock("@/src/core/reservations/reservation.service", () => ({
    resolveTenantBySlug: (...args: any[]) => mockResolveTenantBySlug(...args),
    createReservation: (...args: any[]) => mockCreateReservation(...args),
    getAvailableSlots: (...args: any[]) => mockGetAvailableSlots(...args),
    getReservationByCode: (...args: any[]) => mockGetReservationByCode(...args),
    cancelByCustomer: (...args: any[]) => mockCancelByCustomer(...args),
    getReservationsByDate: (...args: any[]) => mockGetReservationsByDate(...args),
    performAction: (...args: any[]) => mockPerformAction(...args),
    getReservationById: (...args: any[]) => mockGetReservationById(...args),
}));

vi.mock("@/src/core/db/prisma", () => ({
    default: {},
}));

vi.mock("@/src/core/observability/structured-logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock admin auth
const mockRequireAdminAuth = vi.fn();
vi.mock("@/src/core/middleware/admin-auth", () => ({
    requireAdminAuth: (...args: any[]) => mockRequireAdminAuth(...args),
}));

// ============================================================================
// Import Route Handlers (AFTER mocks are set up)
// ============================================================================

import {
    POST as publicPost,
    GET as publicGet,
} from "@/src/app/api/reservations/[tenantSlug]/route";
import { GET as publicGetByCode } from "@/src/app/api/reservations/[tenantSlug]/[code]/route";
import { GET as adminGetList } from "@/src/app/api/admin/reservations/route";
import {
    PATCH as adminPatch,
    GET as adminGetById,
} from "@/src/app/api/admin/reservations/[id]/route";

// ============================================================================
// Helpers
// ============================================================================

let requestCounter = 0;

function createRequest(
    url: string,
    method: string = "GET",
    body?: Record<string, unknown>,
    headers?: Record<string, string>,
): NextRequest {
    // Use a unique IP per request to avoid rate limit interference between tests
    requestCounter++;
    const uniqueIp = `10.${Math.floor(requestCounter / 256) % 256}.${requestCounter % 256}.${Math.floor(requestCounter / 65536) % 256}`;
    const reqHeaders: Record<string, string> = {
        "content-type": "application/json",
        "x-forwarded-for": uniqueIp,
        ...(headers || {}),
    };
    return new NextRequest(new URL(url, "http://localhost:3000"), {
        method,
        headers: reqHeaders,
        ...(body ? { body: JSON.stringify(body) } : {}),
    } as unknown as import("next/dist/server/web/spec-extension/request").RequestInit);
}

const TENANT_ID = "tenant-test-001";
const LOCATION_ID = "location-test-001";
const TENANT_INFO = { id: TENANT_ID, name: "Polleria Don Pepe", locationId: LOCATION_ID };

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();

    // Default tenant resolution succeeds
    mockResolveTenantBySlug.mockResolvedValue({
        success: true,
        data: TENANT_INFO,
    });

    // Default admin auth succeeds
    mockRequireAdminAuth.mockResolvedValue({
        authorized: true,
        user: { id: "admin-001", tenantId: TENANT_ID, role: "ADMIN" },
    });
});

// ============================================================================
// Public: POST /api/reservations/[tenantSlug] — Create Reservation
// ============================================================================

describe("POST /api/reservations/[tenantSlug]", () => {
    const validBody = {
        customer_name: "Maria Lopez",
        customer_phone: "987654321",
        date: "2026-03-15",
        time: "19:00",
        party_size: 4,
    };

    it("returns 201 on successful creation", async () => {
        mockCreateReservation.mockResolvedValue({
            success: true,
            data: {
                id: "res-1",
                confirmation_code: "R4K7M2",
                status: "PENDING",
                date: "2026-03-15",
                time: "19:00",
                party_size: 4,
            },
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe",
            "POST",
            validBody,
        );
        const response = await publicPost(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(201);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.confirmation_code).toBe("R4K7M2");
        expect(json.data.status).toBe("PENDING");
        expect(json.data.restaurant_name).toBe("Polleria Don Pepe");
    });

    it("returns 400 on validation error (missing required fields)", async () => {
        const request = createRequest(
            "/api/reservations/polleria-don-pepe",
            "POST",
            { customer_name: "A" }, // Missing fields + name too short
        );
        const response = await publicPost(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.success).toBe(false);
    });

    it("returns 404 on unknown tenant slug", async () => {
        const { NotFoundError } = await import("@/src/core/result");
        mockResolveTenantBySlug.mockResolvedValue({
            success: false,
            error: new NotFoundError("Restaurante", "no-existe"),
        });

        const request = createRequest(
            "/api/reservations/no-existe",
            "POST",
            validBody,
        );
        const response = await publicPost(request, {
            params: Promise.resolve({ tenantSlug: "no-existe" }),
        });

        expect(response.status).toBe(404);
        const json = await response.json();
        expect(json.error).toBe("Restaurante no encontrado");
    });

    it("returns 409 on no availability (conflict)", async () => {
        const { ConflictError } = await import("@/src/core/result");
        mockCreateReservation.mockResolvedValue({
            success: false,
            error: new ConflictError("No hay mesas disponibles para ese horario", "availability"),
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe",
            "POST",
            validBody,
        );
        const response = await publicPost(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(409);
        const json = await response.json();
        expect(json.error).toContain("mesas disponibles");
    });

    it("returns 400 on business rule validation error", async () => {
        const { ValidationError } = await import("@/src/core/result");
        mockCreateReservation.mockResolvedValue({
            success: false,
            error: new ValidationError("No se puede reservar en un horario pasado", "business_rules"),
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe",
            "POST",
            validBody,
        );
        const response = await publicPost(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(400);
    });
});

// ============================================================================
// Public: GET /api/reservations/[tenantSlug]?date&party_size — Availability
// ============================================================================

describe("GET /api/reservations/[tenantSlug] (availability)", () => {
    it("returns 200 with available slots", async () => {
        mockGetAvailableSlots.mockResolvedValue({
            success: true,
            data: [
                { time: "11:00", available: true },
                { time: "11:30", available: true },
                { time: "12:00", available: false },
            ],
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe?date=2026-03-15&party_size=4",
        );
        const response = await publicGet(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.restaurant_name).toBe("Polleria Don Pepe");
        expect(json.data.slots).toHaveLength(3);
    });

    it("returns 400 when query params are invalid", async () => {
        const request = createRequest(
            "/api/reservations/polleria-don-pepe?date=invalid&party_size=abc",
        );
        const response = await publicGet(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe" }),
        });

        expect(response.status).toBe(400);
    });
});

// ============================================================================
// Public: GET /api/reservations/[tenantSlug]/[code] — Query by Code
// ============================================================================

describe("GET /api/reservations/[tenantSlug]/[code]", () => {
    it("returns 200 with public reservation data", async () => {
        mockGetReservationByCode.mockResolvedValue({
            success: true,
            data: {
                confirmation_code: "R4K7M2",
                status: "PENDING",
                date: "2026-03-15",
                time: "19:00",
                party_size: 4,
                customer_name: "Maria Lopez",
                special_requests: null,
                restaurant_name: "Polleria Don Pepe",
            },
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe/R4K7M2",
        );
        const response = await publicGetByCode(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe", code: "R4K7M2" }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.confirmation_code).toBe("R4K7M2");
        // Verify no sensitive data
        expect(json.data.tenant_id).toBeUndefined();
        expect(json.data.table_id).toBeUndefined();
    });

    it("returns 404 for non-existent code", async () => {
        const { NotFoundError } = await import("@/src/core/result");
        mockGetReservationByCode.mockResolvedValue({
            success: false,
            error: new NotFoundError("Reserva", "XXXXXX"),
        });

        const request = createRequest(
            "/api/reservations/polleria-don-pepe/XXXXXX",
        );
        const response = await publicGetByCode(request, {
            params: Promise.resolve({ tenantSlug: "polleria-don-pepe", code: "XXXXXX" }),
        });

        expect(response.status).toBe(404);
    });
});

// ============================================================================
// Admin: GET /api/admin/reservations — List Reservations
// ============================================================================

describe("GET /api/admin/reservations", () => {
    it("returns 200 with reservations and summary when authenticated", async () => {
        mockGetReservationsByDate.mockResolvedValue({
            success: true,
            data: {
                reservations: [
                    {
                        id: "res-1",
                        customer_name: "Maria",
                        time: "19:00",
                        status: "PENDING",
                        party_size: 4,
                    },
                ],
                summary: {
                    total: 1,
                    pending: 1,
                    confirmed: 0,
                    cancelled: 0,
                    no_show: 0,
                    arrived: 0,
                    seated: 0,
                    rejected: 0,
                    completed: 0,
                },
            },
        });

        const request = createRequest("/api/admin/reservations?date=2026-03-15");
        const response = await adminGetList(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.reservations).toHaveLength(1);
        expect(json.data.summary.total).toBe(1);
    });

    it("returns 401 when not authenticated", async () => {
        mockRequireAdminAuth.mockResolvedValue({
            authorized: false,
            response: new Response(
                JSON.stringify({ success: false, error: "No autorizado" }),
                { status: 401 },
            ),
        });

        const request = createRequest("/api/admin/reservations?date=2026-03-15");
        const response = await adminGetList(request);

        expect(response.status).toBe(401);
    });

    it("returns 400 for invalid query parameters", async () => {
        const request = createRequest("/api/admin/reservations?status=INVALID_STATUS");
        const response = await adminGetList(request);

        expect(response.status).toBe(400);
    });
});

// ============================================================================
// Admin: PATCH /api/admin/reservations/[id] — Action on Reservation
// ============================================================================

describe("PATCH /api/admin/reservations/[id]", () => {
    const RESERVATION_UUID = "550e8400-e29b-41d4-a716-446655440000";

    it("returns 200 on valid action (confirm)", async () => {
        mockPerformAction.mockResolvedValue({
            success: true,
            data: {
                id: RESERVATION_UUID,
                status: "CONFIRMED",
                customer_name: "Maria",
            },
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
            "PATCH",
            { action: "confirm" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.status).toBe("CONFIRMED");
    });

    it("returns 409 on invalid state transition", async () => {
        const { ConflictError } = await import("@/src/core/result");
        mockPerformAction.mockResolvedValue({
            success: false,
            error: new ConflictError("No se puede cambiar de CANCELLED a CONFIRMED", "status"),
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
            "PATCH",
            { action: "confirm" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(409);
        const json = await response.json();
        expect(json.error).toContain("CANCELLED");
    });

    it("returns 404 for non-existent reservation", async () => {
        const { NotFoundError } = await import("@/src/core/result");
        mockPerformAction.mockResolvedValue({
            success: false,
            error: new NotFoundError("Reserva", RESERVATION_UUID),
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
            "PATCH",
            { action: "confirm" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(404);
    });

    it("returns 401 when not authenticated", async () => {
        mockRequireAdminAuth.mockResolvedValue({
            authorized: false,
            response: new Response(
                JSON.stringify({ success: false, error: "No autorizado" }),
                { status: 401 },
            ),
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
            "PATCH",
            { action: "confirm" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(401);
    });

    it("returns 400 on invalid action body", async () => {
        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
            "PATCH",
            { action: "invalid_action" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(400);
    });

    it("returns 404 for non-UUID id", async () => {
        const request = createRequest(
            "/api/admin/reservations/not-a-uuid",
            "PATCH",
            { action: "confirm" },
        );
        const response = await adminPatch(request, {
            params: Promise.resolve({ id: "not-a-uuid" }),
        });

        expect(response.status).toBe(404);
    });
});

// ============================================================================
// Admin: GET /api/admin/reservations/[id] — Get Single Reservation
// ============================================================================

describe("GET /api/admin/reservations/[id]", () => {
    const RESERVATION_UUID = "550e8400-e29b-41d4-a716-446655440000";

    it("returns 200 with full reservation data for authenticated admin", async () => {
        mockGetReservationById.mockResolvedValue({
            success: true,
            data: {
                id: RESERVATION_UUID,
                customer_name: "Maria Lopez",
                status: "PENDING",
                table_id: "table-123",
                internal_notes: "VIP",
            },
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
        );
        const response = await adminGetById(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.id).toBe(RESERVATION_UUID);
    });

    it("returns 404 for non-existent reservation", async () => {
        const { NotFoundError } = await import("@/src/core/result");
        mockGetReservationById.mockResolvedValue({
            success: false,
            error: new NotFoundError("Reserva", RESERVATION_UUID),
        });

        const request = createRequest(
            `/api/admin/reservations/${RESERVATION_UUID}`,
        );
        const response = await adminGetById(request, {
            params: Promise.resolve({ id: RESERVATION_UUID }),
        });

        expect(response.status).toBe(404);
    });
});
