/**
 * Services Index - Business Logic Layer
 * 
 * Central export for all domain services.
 * Services implement the business logic and orchestration layer.
 */

export { OrderService, orderService, CreateOrderInput, OrderResult } from './order.service';
export { PromotionService, promotionService, ApplyPromotionInput, ValidationResult } from './promotion.service';
export {
  InvoiceService,
  invoiceService,
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
  ProcessPaymentInput,
  PaymentResult,
  VoidPaymentInput,
  VoidPaymentResult,
  SplitPaymentInput,
  SplitPaymentEntry,
  SplitPaymentResult,
  PaymentMethodConfig,
  ChangeCalculation,
} from './payment.service';

// Future services to implement:
// export { InventoryService } from './inventory.service';
// export { DeliveryService } from './delivery.service';

export {
  InventoryService,
  inventoryService,
  GetStockInput,
  StockResult,
  DeductStockInput,
  DeductStockItem,
  AdjustStockInput,
  ReceiveStockInput,
  ReceiveStockItem,
  RecordWasteInput,
  StockAlertResult,
  AlertSeverity,
  StockStatus,
} from './inventory.service';

export {
  DeliveryService,
  deliveryService,
  CreateDeliveryInput,
  AddressInput,
  DeliveryResult,
  AssignDriverInput,
  AssignDriverResult,
  UpdateDeliveryStatusInput,
  DeliveryStatusUpdateResult,
  LocationInput,
  LocationUpdateResult,
  ETAResult,
  RouteOptimizationResult,
  DeliveryStop,
  OptimizedRoute,
  DeliveryStatus,
  DeliveryMetrics,
  DriverMetrics,
} from './delivery.service';
