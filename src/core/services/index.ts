/**
 * Services Index - Business Logic Layer
 * 
 * Central export for all domain services.
 * Services implement the business logic and orchestration layer.
 */

export { OrderService, orderService } from './order.service';
export type { CreateOrderInput, OrderResult } from './order.service';

export { PromotionService, promotionService } from './promotion.service';
export type { ApplyPromotionInput, ValidationResult } from './promotion.service';

export {
  InvoiceService,
  invoiceService,
} from './invoice.service';
export type {
  EmitInvoiceInput,
  VoidInvoiceInput,
  GenerateCreditNoteInput,
  InvoiceResult,
  CreditNoteResult,
  SunatStatusResult,
  PaymentSummary,
  InvoiceType,
  InvoiceStatus,
  SunatStatus,
} from './invoice.service';

export {
  PaymentService,
  paymentService,
} from './payment.service';
export type {
  ProcessPaymentInput,
  PaymentResult,
  VoidPaymentInput,
  VoidPaymentResult,
  PaymentMethodConfig,
} from './payment.service';

// Future services to implement:
// export { InventoryService } from './inventory.service';
// export { DeliveryService } from './delivery.service';

export {
  InventoryService,
  inventoryService,
} from './inventory.service';
export type {
  StockInfo,
  DeductionItem,
  DeductionResult,
  AdjustmentInput,
  AdjustmentResult,
  ReceiptItem,
  ReceiptInput,
  ReceiptResult,
  WasteInput,
  WasteResult,
  StockAlert,
  InventoryFilters,
} from './inventory.service';

export {
  DeliveryService,
} from './delivery.service';
export type {
  DeliveryStatus,
  GeoCoordinates,
  DeliveryAddress,
  CreateDeliveryInput,
  DeliveryResult,
  ETAResult,
  OptimizedRoute,
  LocationTrack,
} from './delivery.service';
