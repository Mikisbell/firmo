import { describe, it, expect } from "vitest";
import { applySaleEvent, createOrderFromEvent } from "../sale.reducer";
import type { ParkEvent } from "@/src/core/domain/events";
import { newUUID } from "@/src/core/domain/ids";
import { unsafeCentavos, asOrderId } from "@/src/core/types/shared";

describe("sale.reducer - ORDER_SUBMITTED", () => {
    const tenant_id = newUUID();
    const terminal_id = "TEST_TERMINAL";
    const actor_id = newUUID();
    const order_id = newUUID();
    const correlation_id = order_id;

    function createTestOrder() {
        const orderCreatedEvent: Extract<ParkEvent, { event_type: "ORDER_CREATED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 1,
            occurred_at: new Date().toISOString(),
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_CREATED",
            payload: {
                order_id,
                order_number: 100,
                order_type: "DINE_IN",
                items: [],
                checks: [{
                    check_id: "c1",
                    name: "Principal",
                    mode: "ITEMS",
                    lines: [],
                    subtotal_cents: 0,
                    discount_cents: 0,
                    tip_cents: 0,
                    total_cents: 0,
                    payment: { status: "UNPAID", payments: [] },
                }],
                fulfillment: { table_number: "12" },
            },
        };

        return createOrderFromEvent(orderCreatedEvent);
    }

    function addItemToOrder(sale: ReturnType<typeof createTestOrder>, lineId: string, name: string, station: string, sequence: number) {
        const itemAddedEvent: Extract<ParkEvent, { event_type: "ORDER_ITEM_ADDED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: sequence,
            occurred_at: new Date().toISOString(),
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_ITEM_ADDED",
            payload: {
                order_id,
                line: {
                    line_id: lineId,
                    product_id: `prod_${lineId}`,
                    sku: `sku_${lineId}`,
                    name,
                    qty: 1,
                    unit_price_cents: 1000,
                    station,
                    status: "PENDING",
                    mods: [],
                },
            },
        };

        return applySaleEvent(sale, itemAddedEvent).state!;
    }

    it("should process ORDER_SUBMITTED and mark items as submitted", () => {
        // Arrange: Create order with items
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo Entero", "PARRILLA", 2);
        sale = addItemToOrder(sale, "line2", "Papas Fritas", "COCINA", 3);
        sale = addItemToOrder(sale, "line3", "Gaseosa", "BAR", 4);

        const submittedAt = new Date().toISOString();

        // Act: Submit order to kitchen
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 5,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {
                    PARRILLA: [{
                        line_id: "line1",
                        product_id: "prod_line1",
                        name: "Pollo Entero",
                        qty: 1,
                        mods: [],
                    }],
                    COCINA: [{
                        line_id: "line2",
                        product_id: "prod_line2",
                        name: "Papas Fritas",
                        qty: 1,
                        mods: [],
                    }],
                    BAR: [{
                        line_id: "line3",
                        product_id: "prod_line3",
                        name: "Gaseosa",
                        qty: 1,
                        mods: [],
                    }],
                },
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);

        // Assert
        expect(result.state).not.toBeNull();
        expect(result.state!.lines["line1"].submitted_at).toBe(submittedAt);
        expect(result.state!.lines["line2"].submitted_at).toBe(submittedAt);
        expect(result.state!.lines["line3"].submitted_at).toBe(submittedAt);
        expect(result.warnings).toHaveLength(0);
    });

    it("should keep items with status PENDING after submission", () => {
        // Arrange
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo Entero", "PARRILLA", 2);

        const submittedAt = new Date().toISOString();

        // Act
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 3,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {
                    PARRILLA: [{
                        line_id: "line1",
                        product_id: "prod_line1",
                        name: "Pollo Entero",
                        qty: 1,
                        mods: [],
                    }],
                },
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);

        // Assert: Status should remain PENDING for KDS to pick up
        expect(result.state!.lines["line1"].status).toBe("PENDING");
    });

    it("should be idempotent - replaying same event doesn't change submitted_at", () => {
        // Arrange
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo Entero", "PARRILLA", 2);

        const firstSubmittedAt = "2026-01-19T10:00:00.000Z";
        const secondSubmittedAt = "2026-01-19T10:05:00.000Z";

        const firstEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 3,
            occurred_at: firstSubmittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: firstSubmittedAt,
                items_by_station: {
                    PARRILLA: [{
                        line_id: "line1",
                        product_id: "prod_line1",
                        name: "Pollo Entero",
                        qty: 1,
                        mods: [],
                    }],
                },
            },
        };

        // Act: Apply first event
        sale = applySaleEvent(sale, firstEvent).state!;
        const firstTimestamp = sale.lines["line1"].submitted_at;

        // Apply second event (replay scenario)
        const secondEvent = { ...firstEvent, terminal_sequence: 4, occurred_at: secondSubmittedAt, payload: { ...firstEvent.payload, submitted_at: secondSubmittedAt } };
        sale = applySaleEvent(sale, secondEvent).state!;

        // Assert: Timestamp should not change (idempotency)
        expect(sale.lines["line1"].submitted_at).toBe(firstTimestamp);
    });

    it("should handle multiple stations correctly", () => {
        // Arrange
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo", "PARRILLA", 2);
        sale = addItemToOrder(sale, "line2", "Papas", "COCINA", 3);
        sale = addItemToOrder(sale, "line3", "Ensalada", "FRIOS", 4);
        sale = addItemToOrder(sale, "line4", "Cerveza", "BAR", 5);

        const submittedAt = new Date().toISOString();

        // Act
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 6,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {
                    PARRILLA: [{ line_id: "line1", product_id: "prod_line1", name: "Pollo", qty: 1, mods: [] }],
                    COCINA: [{ line_id: "line2", product_id: "prod_line2", name: "Papas", qty: 1, mods: [] }],
                    FRIOS: [{ line_id: "line3", product_id: "prod_line3", name: "Ensalada", qty: 1, mods: [] }],
                    BAR: [{ line_id: "line4", product_id: "prod_line4", name: "Cerveza", qty: 1, mods: [] }],
                },
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);

        // Assert: All items should be marked as submitted
        expect(result.state!.lines["line1"].submitted_at).toBe(submittedAt);
        expect(result.state!.lines["line2"].submitted_at).toBe(submittedAt);
        expect(result.state!.lines["line3"].submitted_at).toBe(submittedAt);
        expect(result.state!.lines["line4"].submitted_at).toBe(submittedAt);
    });

    it("should handle missing line_id gracefully with warning", () => {
        // Arrange
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo", "PARRILLA", 2);

        const submittedAt = new Date().toISOString();

        // Act: Submit with a line_id that doesn't exist
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 3,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {
                    PARRILLA: [
                        { line_id: "line1", product_id: "prod_line1", name: "Pollo", qty: 1, mods: [] },
                        { line_id: "line_nonexistent", product_id: "prod_x", name: "Ghost Item", qty: 1, mods: [] },
                    ],
                },
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);

        // Assert: Should process valid line and warn about missing one
        expect(result.state!.lines["line1"].submitted_at).toBe(submittedAt);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain("line_nonexistent");
        expect(result.warnings[0]).toContain("not found");
    });

    it("should not crash when items_by_station is empty", () => {
        // Arrange
        const sale = createTestOrder();
        const submittedAt = new Date().toISOString();

        // Act: Submit with empty items_by_station
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 2,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {},
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);

        // Assert: Should not crash, just return unchanged state
        expect(result.state).not.toBeNull();
        expect(result.warnings).toHaveLength(0);
    });

    it("should preserve all item data after submission", () => {
        // Arrange
        let sale = createTestOrder();
        sale = addItemToOrder(sale, "line1", "Pollo Entero", "PARRILLA", 2);

        const originalLine = sale.lines["line1"];
        const submittedAt = new Date().toISOString();

        // Act
        const orderSubmittedEvent: Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }> = {
            event_id: newUUID(),
            tenant_id,
            terminal_id,
            terminal_sequence: 3,
            occurred_at: submittedAt,
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id,
            causation_id: null,
            actor_id,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            event_type: "ORDER_SUBMITTED",
            payload: {
                order_id,
                submitted_at: submittedAt,
                items_by_station: {
                    PARRILLA: [{
                        line_id: "line1",
                        product_id: "prod_line1",
                        name: "Pollo Entero",
                        qty: 1,
                        mods: [],
                    }],
                },
            },
        };

        const result = applySaleEvent(sale, orderSubmittedEvent);
        const updatedLine = result.state!.lines["line1"];

        // Assert: All original data should be preserved
        expect(updatedLine.line_id).toBe(originalLine.line_id);
        expect(updatedLine.product_id).toBe(originalLine.product_id);
        expect(updatedLine.name).toBe(originalLine.name);
        expect(updatedLine.qty).toBe(originalLine.qty);
        expect(updatedLine.unit_price_cents).toBe(originalLine.unit_price_cents);
        expect(updatedLine.line_total_cents).toBe(originalLine.line_total_cents);
        expect(updatedLine.status).toBe(originalLine.status);
        expect(updatedLine.station).toBe(originalLine.station);
        // Only submitted_at should be added
        expect(updatedLine.submitted_at).toBe(submittedAt);
    });
});
