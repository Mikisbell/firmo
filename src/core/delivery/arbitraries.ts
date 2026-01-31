/**
 * Fast-check Arbitraries for Delivery Module Property-Based Testing
 * 
 * Provides generators for all delivery domain models to enable
 * property-based testing with 100+ iterations per test.
 * 
 * @module delivery/arbitraries
 */

import fc from 'fast-check';
import type {
  Location,
  LocationUpdate,
  DeliveryEvent,
  DeliveryEventType,
  AssignmentWeights,
  AssignmentScore,
  Driver,
  DriverStatus,
  ETAEstimate,
  PushNotification,
  PushPriority,
  PushAction,
  MessageTemplate,
  WhatsAppTemplateName,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  DeliveryOrder,
  DeliveryOrderStatus,
  HeatmapPoint,
  GeoBounds,
  Alert,
  AlertType,
  AlertSeverity,
  DeliveryMetrics,
  RealtimeMetrics,
  DriverId,
  OrderId,
  TenantId,
  LocationId,
} from './types-2026';
import { toDriverId, toOrderId, toTenantId, toLocationId } from './types-2026';

// ============================================
// Branded Type Arbitraries
// ============================================

/**
 * Arbitrary for DriverId
 */
export const arbitraryDriverId = (): fc.Arbitrary<DriverId> =>
  fc.uuid().map(toDriverId);

/**
 * Arbitrary for OrderId
 */
export const arbitraryOrderId = (): fc.Arbitrary<OrderId> =>
  fc.uuid().map(toOrderId);

/**
 * Arbitrary for TenantId
 */
export const arbitraryTenantId = (): fc.Arbitrary<TenantId> =>
  fc.uuid().map(toTenantId);

/**
 * Arbitrary for LocationId
 */
export const arbitraryLocationId = (): fc.Arbitrary<LocationId> =>
  fc.uuid().map(toLocationId);

// ============================================
// Location Arbitraries
// ============================================

/**
 * Arbitrary for valid latitude (-90 to 90)
 */
export const arbitraryLatitude = (): fc.Arbitrary<number> =>
  fc.float({ min: -90, max: 90 });

/**
 * Arbitrary for valid longitude (-180 to 180)
 */
export const arbitraryLongitude = (): fc.Arbitrary<number> =>
  fc.float({ min: -180, max: 180 });

/**
 * Arbitrary for Location
 */
export const arbitraryLocation = (): fc.Arbitrary<Location> =>
  fc.record({
    latitude: arbitraryLatitude(),
    longitude: arbitraryLongitude(),
    accuracy: fc.float({ min: 0, max: 100 }),
    timestamp: fc.date(),
    speed: fc.option(fc.float({ min: 0, max: 120 })),
    heading: fc.option(fc.float({ min: 0, max: 360 })),
  });

/**
 * Arbitrary for LocationUpdate
 */
export const arbitraryLocationUpdate = (): fc.Arbitrary<LocationUpdate> =>
  fc.record({
    driverId: arbitraryDriverId(),
    location: arbitraryLocation(),
  });

/**
 * Arbitrary for GeoBounds
 */
export const arbitraryGeoBounds = (): fc.Arbitrary<GeoBounds> =>
  fc.record({
    north: arbitraryLatitude(),
    south: arbitraryLatitude(),
    east: arbitraryLongitude(),
    west: arbitraryLongitude(),
  }).filter(bounds => bounds.north > bounds.south && bounds.east > bounds.west);

// ============================================
// SSE Event Arbitraries
// ============================================

/**
 * Arbitrary for DeliveryEventType
 */
export const arbitraryDeliveryEventType = (): fc.Arbitrary<DeliveryEventType> =>
  fc.constantFrom(
    'order_created',
    'order_assigned',
    'order_dispatched',
    'order_delivered',
    'order_failed',
    'location_update',
    'eta_update',
    'driver_status_change'
  );

/**
 * Arbitrary for DeliveryEvent
 */
export const arbitraryDeliveryEvent = (): fc.Arbitrary<DeliveryEvent> =>
  fc.record({
    id: fc.uuid(),
    type: arbitraryDeliveryEventType(),
    timestamp: fc.date(),
    data: fc.dictionary(fc.string(), fc.anything()),
    restaurantId: fc.option(arbitraryTenantId()),
    driverId: fc.option(arbitraryDriverId()),
  });

// ============================================
// Assignment Arbitraries
// ============================================

/**
 * Arbitrary for AssignmentWeights
 */
export const arbitraryAssignmentWeights = (): fc.Arbitrary<AssignmentWeights> =>
  fc.record({
    distance: fc.float({ min: 0, max: 1 }),
    workload: fc.float({ min: 0, max: 1 }),
    performance: fc.float({ min: 0, max: 1 }),
  }).filter(weights => {
    const sum = weights.distance + weights.workload + weights.performance;
    return Math.abs(sum - 1.0) < 0.01; // Sum should be ~1.0
  });

/**
 * Arbitrary for AssignmentScore
 */
export const arbitraryAssignmentScore = (): fc.Arbitrary<AssignmentScore> =>
  fc.record({
    driverId: arbitraryDriverId(),
    totalScore: fc.float({ min: 0, max: 100 }),
    distanceScore: fc.float({ min: 0, max: 100 }),
    workloadScore: fc.float({ min: 0, max: 100 }),
    performanceScore: fc.float({ min: 0, max: 100 }),
    distance: fc.float({ min: 0, max: 50 }), // km
    currentOrders: fc.integer({ min: 0, max: 5 }),
    performanceRating: fc.float({ min: 0, max: 5 }),
  });

/**
 * Arbitrary for DriverStatus
 */
export const arbitraryDriverStatus = (): fc.Arbitrary<DriverStatus> =>
  fc.constantFrom('AVAILABLE', 'BUSY', 'OFFLINE');

/**
 * Arbitrary for Driver
 */
export const arbitraryDriver = (): fc.Arbitrary<Driver> =>
  fc.record({
    id: arbitraryDriverId(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
    location: fc.option(arbitraryLocation()),
    activeOrders: fc.array(arbitraryOrderId(), { maxLength: 5 }),
    performanceRating: fc.float({ min: 0, max: 5 }),
    status: arbitraryDriverStatus(),
    isActive: fc.boolean(),
  });

// ============================================
// ETA Arbitraries
// ============================================

/**
 * Arbitrary for ETAEstimate
 */
export const arbitraryETAEstimate = (): fc.Arbitrary<ETAEstimate> =>
  fc.record({
    estimatedMinutes: fc.integer({ min: 5, max: 120 }),
    confidenceInterval: fc.tuple(
      fc.integer({ min: 5, max: 60 }),
      fc.integer({ min: 10, max: 120 })
    ).filter(([min, max]) => min < max) as fc.Arbitrary<[number, number]>,
    confidence: fc.float({ min: 0, max: 1 }),
    factors: fc.record({
      baseTime: fc.float({ min: 5, max: 60 }),
      trafficAdjustment: fc.float({ min: -10, max: 30 }),
      weatherAdjustment: fc.float({ min: 0, max: 15 }),
      driverAdjustment: fc.float({ min: -5, max: 10 }),
    }),
  });

// ============================================
// Push Notification Arbitraries
// ============================================

/**
 * Arbitrary for PushPriority
 */
export const arbitraryPushPriority = (): fc.Arbitrary<PushPriority> =>
  fc.constantFrom('urgent', 'normal');

/**
 * Arbitrary for PushAction
 */
export const arbitraryPushAction = (): fc.Arbitrary<PushAction> =>
  fc.record({
    action: fc.constantFrom('accept', 'reject', 'view'),
    title: fc.string({ minLength: 3, maxLength: 20 }),
  });

/**
 * Arbitrary for PushNotification
 */
export const arbitraryPushNotification = (): fc.Arbitrary<PushNotification> =>
  fc.record({
    title: fc.string({ minLength: 5, maxLength: 50 }),
    body: fc.string({ minLength: 10, maxLength: 200 }),
    icon: fc.option(fc.webUrl()),
    badge: fc.option(fc.webUrl()),
    data: fc.option(fc.dictionary(fc.string(), fc.anything())),
    actions: fc.option(fc.array(arbitraryPushAction(), { maxLength: 3 })),
    priority: arbitraryPushPriority(),
    expiresAt: fc.option(fc.date()),
  });

// ============================================
// WhatsApp Arbitraries
// ============================================

/**
 * Arbitrary for WhatsAppTemplateName
 */
export const arbitraryWhatsAppTemplateName = (): fc.Arbitrary<WhatsAppTemplateName> =>
  fc.constantFrom(
    'ORDER_ASSIGNED',
    'ORDER_DISPATCHED',
    'ETA_UPDATE',
    'ORDER_DELIVERED',
    'ORDER_FAILED'
  );

/**
 * Arbitrary for WhatsAppMessageStatus
 */
export const arbitraryWhatsAppMessageStatus = (): fc.Arbitrary<WhatsAppMessageStatus> =>
  fc.constantFrom('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

/**
 * Arbitrary for WhatsAppMessage
 */
export const arbitraryWhatsAppMessage = (): fc.Arbitrary<WhatsAppMessage> =>
  fc.record({
    id: fc.uuid(),
    orderId: arbitraryOrderId(),
    phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
    templateName: arbitraryWhatsAppTemplateName(),
    messageBody: fc.string({ minLength: 20, maxLength: 500 }),
    status: arbitraryWhatsAppMessageStatus(),
    twilioSid: fc.option(fc.string()),
    errorMessage: fc.option(fc.string()),
    sentAt: fc.option(fc.date()),
    deliveredAt: fc.option(fc.date()),
    createdAt: fc.date(),
  });

// ============================================
// Delivery Order Arbitraries
// ============================================

/**
 * Arbitrary for DeliveryOrderStatus
 */
export const arbitraryDeliveryOrderStatus = (): fc.Arbitrary<DeliveryOrderStatus> =>
  fc.constantFrom('PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED');

/**
 * Arbitrary for DeliveryOrder
 */
export const arbitraryDeliveryOrder = (): fc.Arbitrary<DeliveryOrder> =>
  fc.record({
    id: arbitraryOrderId(),
    tenantId: arbitraryTenantId(),
    orderNumber: fc.integer({ min: 1, max: 9999 }),
    customerName: fc.string({ minLength: 3, maxLength: 50 }),
    customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
    pickupLocation: arbitraryLocation(),
    deliveryLocation: arbitraryLocation(),
    driverId: fc.option(arbitraryDriverId()),
    status: arbitraryDeliveryOrderStatus(),
    estimatedDeliveryAt: fc.option(fc.date()),
    assignedAt: fc.option(fc.date()),
    dispatchedAt: fc.option(fc.date()),
    deliveredAt: fc.option(fc.date()),
    failedAt: fc.option(fc.date()),
    failureReason: fc.option(fc.string()),
    deliveryTimeMins: fc.option(fc.integer({ min: 5, max: 120 })),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

// ============================================
// Analytics Arbitraries
// ============================================

/**
 * Arbitrary for HeatmapPoint
 */
export const arbitraryHeatmapPoint = (): fc.Arbitrary<HeatmapPoint> =>
  fc.record({
    latitude: arbitraryLatitude(),
    longitude: arbitraryLongitude(),
    weight: fc.integer({ min: 1, max: 100 }),
  });

/**
 * Arbitrary for AlertType
 */
export const arbitraryAlertType = (): fc.Arbitrary<AlertType> =>
  fc.constantFrom('high_delivery_time', 'low_driver_utilization', 'high_failure_rate');

/**
 * Arbitrary for AlertSeverity
 */
export const arbitraryAlertSeverity = (): fc.Arbitrary<AlertSeverity> =>
  fc.constantFrom('warning', 'critical');

/**
 * Arbitrary for Alert
 */
export const arbitraryAlert = (): fc.Arbitrary<Alert> =>
  fc.record({
    type: arbitraryAlertType(),
    severity: arbitraryAlertSeverity(),
    message: fc.string({ minLength: 10, maxLength: 200 }),
    value: fc.float({ min: 0, max: 100 }),
    threshold: fc.float({ min: 0, max: 100 }),
  });

/**
 * Arbitrary for DeliveryMetrics
 */
export const arbitraryDeliveryMetrics = (): fc.Arbitrary<DeliveryMetrics> =>
  fc.record({
    id: fc.uuid(),
    tenantId: arbitraryTenantId(),
    date: fc.date(),
    hour: fc.integer({ min: 0, max: 23 }),
    activeDeliveries: fc.integer({ min: 0, max: 100 }),
    completedDeliveries: fc.integer({ min: 0, max: 500 }),
    failedDeliveries: fc.integer({ min: 0, max: 50 }),
    avgDeliveryTime: fc.float({ min: 10, max: 120 }),
    avgDriverUtilization: fc.float({ min: 0, max: 1 }),
    avgCustomerRating: fc.option(fc.float({ min: 0, max: 5 })),
    createdAt: fc.date(),
  });

/**
 * Arbitrary for RealtimeMetrics
 */
export const arbitraryRealtimeMetrics = (): fc.Arbitrary<RealtimeMetrics> =>
  fc.record({
    activeDeliveries: fc.integer({ min: 0, max: 100 }),
    averageDeliveryTime: fc.float({ min: 10, max: 120 }),
    driverUtilization: fc.float({ min: 0, max: 1 }),
    customerSatisfaction: fc.float({ min: 0, max: 5 }),
  });

// ============================================
// Composite Arbitraries
// ============================================

/**
 * Arbitrary for a complete delivery scenario
 * (order + driver + location + ETA)
 */
export const arbitraryDeliveryScenario = () =>
  fc.record({
    order: arbitraryDeliveryOrder(),
    driver: arbitraryDriver(),
    eta: arbitraryETAEstimate(),
    events: fc.array(arbitraryDeliveryEvent(), { maxLength: 10 }),
  });

/**
 * Arbitrary for assignment scenario
 * (order + multiple drivers + weights)
 */
export const arbitraryAssignmentScenario = () =>
  fc.record({
    order: arbitraryDeliveryOrder(),
    drivers: fc.array(arbitraryDriver(), { minLength: 1, maxLength: 10 }),
    weights: arbitraryAssignmentWeights(),
  });
