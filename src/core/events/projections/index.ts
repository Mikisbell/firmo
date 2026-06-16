import { ProjectionHandler } from "./types";
import {
    handleOrderCreated,
    handleOrderItemAdded,
    handleOrderItemQtyChanged,
    handleOrderItemStatusChanged,
    handleOrderSubmitted,
    handleOrderItemVoided,
    handleOrderItemNote,
    handleOrderCancelled
} from "./order-projections";
import {
    handleTableAttachedToOrder,
    handleTableDetachedFromOrder,
    handleOrderTableChanged
} from "./table-projections";
import {
    handleShiftOpened,
    handleCashAdjusted,
    handleShiftClosed
} from "./shift-projections";
import {
    handleInvoiceIssued,
    handleInvoiceVoided,
    handleCreditNoteIssued,
    handleCreditNoteVoided
} from "./invoice-projections";
import {
    handleCheckCreated,
    handleCheckPaymentAdded,
    handleCheckMarkedPaid,
    handleCheckTipSet,
    handleCheckDiscountSet,
    handleRefundIssued
} from "./check-projections";

export const projectionRegistry: Record<string, ProjectionHandler> = {
    // Orders
    ORDER_CREATED: handleOrderCreated,
    ORDER_ITEM_ADDED: handleOrderItemAdded,
    ORDER_ITEM_QTY_CHANGED: handleOrderItemQtyChanged,
    ORDER_ITEM_STATUS_CHANGED: handleOrderItemStatusChanged,
    ORDER_SUBMITTED: handleOrderSubmitted,
    ORDER_ITEM_VOIDED: handleOrderItemVoided,
    ORDER_ITEM_NOTE: handleOrderItemNote,
    ORDER_CANCELLED: handleOrderCancelled,

    // Tables
    TABLE_ATTACHED_TO_ORDER: handleTableAttachedToOrder,
    TABLE_DETACHED_FROM_ORDER: handleTableDetachedFromOrder,
    ORDER_TABLE_CHANGED: handleOrderTableChanged,

    // Shifts & Cash
    SHIFT_OPENED: handleShiftOpened,
    CASH_ADJUSTED: handleCashAdjusted,
    SHIFT_CLOSED: handleShiftClosed,

    // Invoices
    INVOICE_ISSUED: handleInvoiceIssued,
    INVOICE_VOIDED: handleInvoiceVoided,
    CREDIT_NOTE_ISSUED: handleCreditNoteIssued,
    CREDIT_NOTE_VOIDED: handleCreditNoteVoided,

    // Checks & Payments
    CHECK_CREATED: handleCheckCreated,
    CHECK_PAYMENT_ADDED: handleCheckPaymentAdded,
    CHECK_MARKED_PAID: handleCheckMarkedPaid,
    CHECK_TIP_SET: handleCheckTipSet,
    CHECK_DISCOUNT_SET: handleCheckDiscountSet,
    REFUND_ISSUED: handleRefundIssued,
};
