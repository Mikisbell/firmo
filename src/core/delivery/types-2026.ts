/**
 * TypeScript Types for Delivery Module 2026 Modernization
 * 
 * Defines all domain models for:
 * - Real-time location tracking
 * - SSE events
 * - Driver assignment
 * - ETA calculation
 * - Push notifications
 * - WhatsApp messaging
 * - Analytics
 * 
 * @module delivery/types-2026
 */

// ============================================
// Branded Types for Type Safety
// ============================================

/**
 * Branded type for Location IDs
 * Prevents mixing location IDs with other string IDs
 */
export type LocationId = string & { readonly __brand: 'LocationId' };

/**
 * Branded type for Driver IDs
 * Prevents mixing driver IDs with other string IDs
 */
export type DriverId = string & { readonly __brand: 'DriverId' };

/**
 * Branded type for Order IDs
 * Prevents mixing order IDs with other string IDs
 */
export type OrderId = string & { readonly __brand: 'OrderId' };

/**
 * Branded type for Tenant IDs
 * Prevents mixing tenant IDs with other string IDs
 */
export type TenantId = string & { readonly __brand: 'TenantId' };

/**
 * Helper to create branded LocationId
 */
export function toLocationId(id: string): LocationId {
  return id as LocationId;
}

/**
 * Helper to create branded DriverId
 */
export function toDriverId(id: string): DriverId {
  return id as DriverId;
}

/**
 * Helper to create branded OrderId
 */
export function toOrderId(id: string): OrderId {
  return id as OrderId;
}

/**
 * Helper to create branded TenantId
 */
export function toTenantId(id: string): TenantId {
  return id as TenantId;
}

// ============================================
// Location Types
// ============================================

/**
 * Geographic location with metadata
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: Date;
  speed?: number; // km/h
  heading?: number; // degrees (0-360)
}

/**
 * Location update from driver
 */
export interface LocationUpdate {
  driverId: DriverId;
  location: Location;
}

/**
 * Historical location record
 */
export interface LocationHistory {
  id: LocationId;
  driverId: DriverId;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
  createdAt: Date;
}

// ============================================
// SSE Event Types
// ============================================

/**
 * Delivery event types for SSE streaming
 */
export type DeliveryEventType =
  | 'order_created'
  | 'order_assigned'
  | 'order_dispatched'
  | 'order_delivered'
  | 'order_failed'
  | 'location_update'
  | 'eta_update'
  | 'driver_status_change';

/**
 * Delivery event for SSE broadcasting
 */
export interface DeliveryEvent {
  id: string;
  type: DeliveryEventType;
  timestamp: Date;
  data: Record<string, unknown>;
  restaurantId?: TenantId;
  driverId?: DriverId;
}

/**
 * SSE client connection
 */
export interface SSEClient {
  id: string;
  response: Response;
  restaurantId?: TenantId;
  driverId?: DriverId;
  connectedAt: Date;
}

// ============================================
// Assignment Types
// ============================================

/**
 * Assignment weights configuration
 */
export interface AssignmentWeights {
  distance: number; // 0-1, default 0.4
  workload: number; // 0-1, default 0.3
  performance: number; // 0-1, default 0.3
}

/**
 * Assignment score for a driver-order pair
 */
export interface AssignmentScore {
  driverId: DriverId;
  totalScore: number;
  distanceScore: number;
  workloadScore: number;
  performanceScore: number;
  distance: number; // km
  currentOrders: number;
  performanceRating: number; // 0-5
}

/**
 * Assignment log record
 */
export interface AssignmentLog {
  id: string;
  orderId: OrderId;
  driverId: DriverId;
  assignmentScore: number;
  distanceScore: number;
  workloadScore: number;
  performanceScore: number;
  distanceKm: number;
  currentOrders: number;
  performanceRating: number;
  createdAt: Date;
}

/**
 * Driver availability status
 */
export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

/**
 * Driver with location and status
 */
export interface Driver {
  id: DriverId;
  name: string;
  phone?: string;
  location?: Location;
  activeOrders: OrderId[];
  performanceRating: number; // 0-5
  status: DriverStatus;
  isActive: boolean;
}

// ============================================
// ETA Types
// ============================================

/**
 * ETA estimate with confidence interval
 */
export interface ETAEstimate {
  estimatedMinutes: number;
  confidenceInterval: [number, number]; // [min, max]
  confidence: number; // 0-1
  factors: {
    baseTime: number;
    trafficAdjustment: number;
    weatherAdjustment: number;
    driverAdjustment: number;
  };
}

/**
 * ETA prediction record
 */
export interface ETAPrediction {
  id: string;
  orderId: OrderId;
  predictedMinutes: number;
  confidenceInterval: string; // JSON: [min, max]
  confidence: number;
  baseTime: number;
  trafficAdjustment: number;
  weatherAdjustment: number;
  driverAdjustment: number;
  actualMinutes?: number;
  createdAt: Date;
}

// ============================================
// Push Notification Types
// ============================================

/**
 * Push notification priority
 */
export type PushPriority = 'urgent' | 'normal';

/**
 * Push notification action button
 */
export interface PushAction {
  action: string;
  title: string;
}

/**
 * Push notification payload
 */
export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: PushAction[];
  priority: PushPriority;
  expiresAt?: Date;
}

/**
 * Push subscription record
 */
export interface PushSubscription {
  id: string;
  driverId: DriverId;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// WhatsApp Types
// ============================================

/**
 * WhatsApp message template names
 */
export type WhatsAppTemplateName =
  | 'ORDER_ASSIGNED'
  | 'ORDER_DISPATCHED'
  | 'ETA_UPDATE'
  | 'ORDER_DELIVERED'
  | 'ORDER_FAILED';

/**
 * WhatsApp message template
 */
export interface MessageTemplate {
  name: WhatsAppTemplateName;
  body: string;
  variables: string[];
}

/**
 * WhatsApp message status
 */
export type WhatsAppMessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

/**
 * WhatsApp message record
 */
export interface WhatsAppMessage {
  id: string;
  orderId: OrderId;
  phoneNumber: string;
  templateName: WhatsAppTemplateName;
  messageBody: string;
  status: WhatsAppMessageStatus;
  twilioSid?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

// ============================================
// Analytics Types
// ============================================

/**
 * Time period for analytics queries
 */
export interface TimePeriod {
  start: Date;
  end: Date;
}

/**
 * Heatmap point for delivery density visualization
 */
export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // delivery count
}

/**
 * Geographic bounds for heatmap queries
 */
export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Alert types for threshold monitoring
 */
export type AlertType = 'high_delivery_time' | 'low_driver_utilization' | 'high_failure_rate';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'warning' | 'critical';

/**
 * Analytics alert
 */
export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
}

/**
 * Delivery metrics record
 */
export interface DeliveryMetrics {
  id: string;
  tenantId: TenantId;
  date: Date;
  hour: number;
  activeDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTime: number;
  avgDriverUtilization: number;
  avgCustomerRating?: number;
  createdAt: Date;
}

/**
 * Real-time metrics snapshot
 */
export interface RealtimeMetrics {
  activeDeliveries: number;
  averageDeliveryTime: number; // minutes
  driverUtilization: number; // 0-1
  customerSatisfaction: number; // 0-5
}

/**
 * Analytics metrics (alias for RealtimeMetrics)
 */
export type AnalyticsMetrics = RealtimeMetrics;

/**
 * Driver performance score
 */
export interface DriverPerformanceScore {
  driverId: DriverId;
  onTimeRate: number; // 0-1
  averageRating: number; // 0-5
  averageDeliveryTime: number; // minutes
  totalDeliveries: number;
  score: number; // 0-100
}

/**
 * Demand forecast result
 */
export interface ForecastResult {
  timestamp: Date;
  predictedVolume: number;
  confidence: number; // 0-1
  historicalAverage: number;
}

// ============================================
// Delivery Order Types
// ============================================

/**
 * Delivery order status
 */
export type DeliveryOrderStatus = 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';

/**
 * Delivery order
 */
export interface DeliveryOrder {
  id: OrderId;
  tenantId: TenantId;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  driverId?: DriverId;
  status: DeliveryOrderStatus;
  estimatedDeliveryAt?: Date;
  assignedAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  deliveryTimeMins?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Configuration Types
// ============================================

/**
 * Alert thresholds configuration
 */
export interface AlertThresholds {
  AVERAGE_DELIVERY_TIME: number; // minutes
  DRIVER_UTILIZATION: number; // 0-1
  FAILURE_RATE: number; // 0-1
  ACTIVE_DELIVERIES: number; // per restaurant
}

/**
 * Default alert thresholds
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  AVERAGE_DELIVERY_TIME: 45,
  DRIVER_UTILIZATION: 0.8,
  FAILURE_RATE: 0.05,
  ACTIVE_DELIVERIES: 50,
};

/**
 * Default assignment weights
 */
export const DEFAULT_ASSIGNMENT_WEIGHTS: AssignmentWeights = {
  distance: 0.4,
  workload: 0.3,
  performance: 0.3,
};

/**
 * Average driver speed for ETA calculation
 */
export const AVERAGE_SPEED_KMH = 25;

/**
 * Location update interval (seconds)
 */
export const LOCATION_UPDATE_INTERVAL_SECONDS = 30;

/**
 * Location TTL in Redis (seconds)
 */
export const LOCATION_TTL_SECONDS = 300; // 5 minutes

/**
 * Connection lost threshold (seconds)
 */
export const CONNECTION_LOST_THRESHOLD_SECONDS = 120; // 2 minutes

/**
 * SSE heartbeat interval (seconds)
 */
export const SSE_HEARTBEAT_INTERVAL_SECONDS = 30;

/**
 * Push notification retry attempts
 */
export const PUSH_NOTIFICATION_MAX_RETRIES = 3;

/**
 * WhatsApp rate limit (messages per day per customer)
 */
export const WHATSAPP_RATE_LIMIT_PER_DAY = 10;

/**
 * ETA change notification threshold (minutes)
 */
export const ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES = 5;
