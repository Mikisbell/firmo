/**
 * Tests for Role-Based Event Validation
 * 
 * Property-based tests + unit tests para validar permisos por rol
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
    canRoleEmitEvent,
    requiresManagerApproval,
    getAllowedEventsForRole,
    canApproveManagerActions,
    _ROLE_PERMISSIONS,
    _REQUIRES_MANAGER_APPROVAL,
    _SYSTEM_EVENTS,
    type EmployeeRole,
} from "../role-permissions";
import type { EventType } from "@/src/core/domain/events";

// Arbitraries
const roleArb = fc.constantFrom<EmployeeRole>(
    "ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "DRIVER"
);

const eventTypeArb = fc.constantFrom<EventType>(
    "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
    "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
    "ORDER_ITEM_STATUS_CHANGED", "ORDER_ITEM_VOIDED", "ORDER_CANCELLED",
    "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
    "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
    "INVOICE_ISSUED", "INVOICE_VOIDED",
    "CATALOG_VERSION_BUMPED"
);

describe("Role-Based Event Validation", () => {
    describe("canRoleEmitEvent", () => {
        // =====================================================
        // Property 1: ADMIN can emit all events
        // Validates: Role hierarchy - ADMIN has full access
        // =====================================================
        it("Property 1: ADMIN can emit any event type", () => {
            fc.assert(
                fc.property(eventTypeArb, (eventType) => {
                    const result = canRoleEmitEvent("ADMIN", eventType);
                    expect(result.allowed).toBe(true);
                }),
                { numRuns: 100 }
            );
        });

        // =====================================================
        // Property 2: Role permissions are consistent
        // Validates: getAllowedEventsForRole matches canRoleEmitEvent
        // =====================================================
        it("Property 2: getAllowedEventsForRole is consistent with canRoleEmitEvent", () => {
            fc.assert(
                fc.property(roleArb, eventTypeArb, (role, eventType) => {
                    const allowedEvents = getAllowedEventsForRole(role);
                    const canEmit = canRoleEmitEvent(role, eventType);
                    
                    if (allowedEvents.includes(eventType)) {
                        expect(canEmit.allowed).toBe(true);
                    } else if (!_SYSTEM_EVENTS.has(eventType)) {
                        expect(canEmit.allowed).toBe(false);
                    }
                }),
                { numRuns: 100 }
            );
        });

        // =====================================================
        // Property 3: System events don't require role
        // Validates: CATALOG_VERSION_BUMPED can be emitted without role
        // =====================================================
        it("Property 3: System events are allowed without role", () => {
            const systemEvents = Array.from(_SYSTEM_EVENTS);
            
            for (const eventType of systemEvents) {
                const result = canRoleEmitEvent(null, eventType);
                expect(result.allowed).toBe(true);
            }
        });

        // =====================================================
        // Regresion: Nota de Venta (SALES_NOTE_*) emitible por caja/mozo.
        // Bug: faltaban en ROLE_PERMISSIONS -> el sync del ingest rechazaba
        // la pre-cuenta con ROLE_NOT_AUTHORIZED (funcionaba en Dexie local
        // pero no propagaba al servidor).
        // =====================================================
        it("SALES_NOTE_* es emitible por roles de venta (caja, mozo, gerencia)", () => {
            const salesNoteEvents = [
                "SALES_NOTE_ISSUED",
                "SALES_NOTE_CONVERTED",
                "SALES_NOTE_VOIDED",
            ] as const;
            const sellingRoles = [
                "OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CASHIER", "WAITER",
            ] as const;
            for (const role of sellingRoles) {
                for (const evt of salesNoteEvents) {
                    expect(canRoleEmitEvent(role, evt).allowed).toBe(true);
                }
            }
        });

        // =====================================================
        // Property 4: Non-system events require role
        // Validates: Events without role are rejected
        // =====================================================
        it("Property 4: Non-system events require a role", () => {
            fc.assert(
                fc.property(eventTypeArb, (eventType) => {
                    if (_SYSTEM_EVENTS.has(eventType)) return; // Skip system events
                    
                    const result = canRoleEmitEvent(null, eventType);
                    expect(result.allowed).toBe(false);
                    expect(result.error).toBe("ROLE_REQUIRED");
                }),
                { numRuns: 100 }
            );
        });

        // =====================================================
        // Property 5: Invalid roles are rejected
        // Validates: Unknown roles cannot emit events
        // =====================================================
        it("Property 5: Invalid roles are rejected", () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }).filter(s => 
                        !["ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "DRIVER"].includes(s.toUpperCase())
                    ),
                    eventTypeArb,
                    (invalidRole, eventType) => {
                        if (_SYSTEM_EVENTS.has(eventType)) return; // Skip system events
                        
                        const result = canRoleEmitEvent(invalidRole, eventType);
                        expect(result.allowed).toBe(false);
                        expect(result.error).toBe("INVALID_ROLE");
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Role-specific permissions", () => {
        // WAITER cannot emit payment events
        it("WAITER cannot emit CHECK_PAYMENT_ADDED", () => {
            const result = canRoleEmitEvent("WAITER", "CHECK_PAYMENT_ADDED");
            expect(result.allowed).toBe(false);
            expect(result.error).toBe("ROLE_NOT_AUTHORIZED");
        });

        it("WAITER cannot emit CHECK_MARKED_PAID", () => {
            const result = canRoleEmitEvent("WAITER", "CHECK_MARKED_PAID");
            expect(result.allowed).toBe(false);
        });

        it("WAITER cannot emit INVOICE_ISSUED", () => {
            const result = canRoleEmitEvent("WAITER", "INVOICE_ISSUED");
            expect(result.allowed).toBe(false);
        });

        // WAITER can create orders and add items
        it("WAITER can emit ORDER_CREATED", () => {
            const result = canRoleEmitEvent("WAITER", "ORDER_CREATED");
            expect(result.allowed).toBe(true);
        });

        it("WAITER can emit ORDER_ITEM_ADDED", () => {
            const result = canRoleEmitEvent("WAITER", "ORDER_ITEM_ADDED");
            expect(result.allowed).toBe(true);
        });

        // KITCHEN can only change item status
        it("KITCHEN can emit ORDER_ITEM_STATUS_CHANGED", () => {
            const result = canRoleEmitEvent("KITCHEN", "ORDER_ITEM_STATUS_CHANGED");
            expect(result.allowed).toBe(true);
        });

        it("KITCHEN cannot emit ORDER_CREATED", () => {
            const result = canRoleEmitEvent("KITCHEN", "ORDER_CREATED");
            expect(result.allowed).toBe(false);
        });

        it("KITCHEN cannot emit CHECK_PAYMENT_ADDED", () => {
            const result = canRoleEmitEvent("KITCHEN", "CHECK_PAYMENT_ADDED");
            expect(result.allowed).toBe(false);
        });

        // CASHIER can handle payments
        it("CASHIER can emit CHECK_PAYMENT_ADDED", () => {
            const result = canRoleEmitEvent("CASHIER", "CHECK_PAYMENT_ADDED");
            expect(result.allowed).toBe(true);
        });

        it("CASHIER can emit INVOICE_ISSUED", () => {
            const result = canRoleEmitEvent("CASHIER", "INVOICE_ISSUED");
            expect(result.allowed).toBe(true);
        });

        // CASHIER cannot void invoices (requires manager)
        it("CASHIER cannot emit INVOICE_VOIDED", () => {
            const result = canRoleEmitEvent("CASHIER", "INVOICE_VOIDED");
            expect(result.allowed).toBe(false);
        });
    });

    describe("requiresManagerApproval", () => {
        it("ORDER_ITEM_VOIDED requires manager approval", () => {
            expect(requiresManagerApproval("ORDER_ITEM_VOIDED")).toBe(true);
        });

        it("ORDER_CANCELLED requires manager approval", () => {
            expect(requiresManagerApproval("ORDER_CANCELLED")).toBe(true);
        });

        it("INVOICE_VOIDED requires manager approval", () => {
            expect(requiresManagerApproval("INVOICE_VOIDED")).toBe(true);
        });

        it("CASH_ADJUSTED requires manager approval", () => {
            expect(requiresManagerApproval("CASH_ADJUSTED")).toBe(true);
        });

        it("ORDER_CREATED does not require manager approval", () => {
            expect(requiresManagerApproval("ORDER_CREATED")).toBe(false);
        });
    });

    describe("canApproveManagerActions", () => {
        it("ADMIN can approve manager actions", () => {
            expect(canApproveManagerActions("ADMIN")).toBe(true);
        });

        it("MANAGER can approve manager actions", () => {
            expect(canApproveManagerActions("MANAGER")).toBe(true);
        });

        it("CASHIER cannot approve manager actions", () => {
            expect(canApproveManagerActions("CASHIER")).toBe(false);
        });

        it("WAITER cannot approve manager actions", () => {
            expect(canApproveManagerActions("WAITER")).toBe(false);
        });

        it("null role cannot approve manager actions", () => {
            expect(canApproveManagerActions(null)).toBe(false);
        });
    });

    describe("Role case insensitivity", () => {
        it("accepts lowercase roles", () => {
            const result = canRoleEmitEvent("admin", "ORDER_CREATED");
            expect(result.allowed).toBe(true);
        });

        it("accepts mixed case roles", () => {
            const result = canRoleEmitEvent("Admin", "ORDER_CREATED");
            expect(result.allowed).toBe(true);
        });
    });
});
