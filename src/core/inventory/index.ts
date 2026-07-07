/**
 * FIRMO POS Inventory Module
 *
 * Barrel export for inventory services.
 * Import from '@/src/core/inventory' instead of individual files.
 */

export { deductInventoryForOrder, deductInventoryForOrderItems, reverseDeduction } from './deduction.service';
export type { DeductionIngredient, DeductionAlert, DeductionResult, RecipeIngredient } from './deduction.service';
export { confirmGoodsReceipt, createGoodsReceipt } from './goods-receipt.service';
export type { GoodsReceiptItemInput, ConfirmGoodsReceiptInput, ConfirmGoodsReceiptResult } from './goods-receipt.service';
export { recordWaste, getWasteSummary } from './waste.service';
export type { WasteReasonCode, RecordWasteInput, RecordWasteResult } from './waste.service';
export { logInventoryAudit } from './audit.service';
export type { InventoryAuditAction, AuditLogEntry } from './audit.service';
export * from './stock-types';
