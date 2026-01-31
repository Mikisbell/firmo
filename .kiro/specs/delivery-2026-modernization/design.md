# Design Document: Delivery Module 2026 Modernization

## Overview

This design modernizes the existing Delivery Module to 2026 best practices by introducing real-time capabilities, intelligent automation, and enhanced user experience. The modernization maintains backward compatibility with the existing `delivery_orders` table while adding new services for SSE communication, geolocation tracking, smart assignment, push notifications, dynamic ETA calculation, and customer communication.

### Key Design Principles

1. **Real-Time First**: Replace polling with Server-Sent Events for instant updates
2. **Intelligent Automation**: Smart driver assignment based on multiple factors
3. **Progressive Enhancement**: Modern UI with optimistic updates and graceful degradation
4. **Performance Isolation**: Analytics and tracking don't impact core delivery operations
5. **Backward Compatibility**: Existing delivery functionality continues to work
6. **Offline Resilience**: Queue operations when offline, sync when reconnected

### Technology Stack

- **Real-Time**: Server-Sent Events (SSE) for server-to-client streaming
- **Geolocation**: Mapbox GL JS for maps, Redis for location storage
- **Notifications**: Web Push API with service workers
- **Communication**: Twilio WhatsApp API for customer messages
- **UI**: Shadcn/UI components with Tailwind CSS
- **Analytics**: Redis for real-time metrics, PostgreSQL for historical data
- **Testing**: Fast-check for property-based testing

## Architecture

### System Components

```mermaid
graph TB
    subgraph "Client Layer"
        AdminPanel[Admin Panel]
        DriverApp[Driver App]
        CustomerPortal[Customer Portal]
    end
    
    subgraph "API Layer"
        SSE[SSE Endpoint]
        DeliveryAPI[Delivery API]
        LocationAPI[Location API]
        PushAPI[Push API]
        AnalyticsAPI[Analytics API]
    end
    
    subgraph "Service Layer"
        SSEService[SSE Service]
        DeliveryService[Delivery Service]
        GeoService[Geolocation Service]
        AssignmentAlgo[Assignment Algorithm]
        ETACalc[ETA Calculator]
        PushService[Push Service]
        WhatsAppService[WhatsApp Service]
        AnalyticsEngine[Analytics Engine]
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
        EventStore[Event Store]
    end
    
    AdminPanel -->|HTTP| DeliveryAPI
    AdminPanel -->|SSE| SSE
    AdminPanel -->|HTTP| LocationAPI
    AdminPanel -->|HTTP| AnalyticsAPI
    
    DriverApp -->|HTTP| DeliveryAPI
    DriverApp -->|HTTP| LocationAPI
    DriverApp -->|Push| PushAPI
    
    CustomerPortal -->|HTTP| DeliveryAPI
    CustomerPortal -->|SSE| SSE
    
    SSE --> SSEService
    DeliveryAPI --> DeliveryService
    LocationAPI --> GeoService
    PushAPI --> PushService
    AnalyticsAPI --> AnalyticsEngine
    
    DeliveryService --> AssignmentAlgo
    DeliveryService --> ETACalc
    DeliveryService --> WhatsAppService
    DeliveryService --> PostgreSQL
    DeliveryService --> EventStore
    
    SSEService --> Redis
    SSEService --> EventStore
    
    GeoService --> Redis
    GeoService --> PostgreSQL
    
    AssignmentAlgo --> GeoService
    AssignmentAlgo --> PostgreSQL
    
    ETACalc --> GeoService
    ETACalc --> PostgreSQL
    
    PushService --> PostgreSQL
    
    WhatsAppService --> PostgreSQL
    
    AnalyticsEngine --> Redis
    AnalyticsEngine --> PostgreSQL
```

### Data Flow: Order Assignment

```mermaid
sequenceDiagram
    participant Admin as Admin Panel
    participant API as Delivery API
    participant DS as Delivery Service
    participant AA as Assignment Algorithm
    participant GS as Geolocation Service
    participant PS as Push Service
    participant WS as WhatsApp Service
    participant SSE as SSE Service
    participant Redis as Redis
    participant DB as PostgreSQL
    
    Admin->>API: POST /api/deliveries (create order)
    API->>DS: createDeliveryOrder(order)
    DS->>DB: INSERT delivery_order
    DS->>AA: assignDriver(order)
    AA->>GS: getActiveDriverLocations()
    GS->>Redis: GET driver:*:location
    Redis-->>GS: driver locations
    AA->>DB: SELECT drivers (availability, performance)
    DB-->>AA: driver data
    AA->>AA: calculateAssignmentScores()
    AA-->>DS: bestDriver
    DS->>DB: UPDATE delivery_order SET driver_id
    DS->>PS: sendPushNotification(driver, order)
    DS->>WS: sendWhatsAppMessage(customer, "assigned")
    DS->>SSE: broadcastEvent("order_assigned")
    SSE->>Redis: PUBLISH delivery:events
    Redis-->>Admin: SSE event
    Admin->>Admin: Update UI optimistically
```

### Data Flow: Real-Time Location Tracking

```mermaid
sequenceDiagram
    participant Driver as Driver App
    participant API as Location API
    participant GS as Geolocation Service
    participant ETA as ETA Calculator
    participant SSE as SSE Service
    participant Redis as Redis
    participant DB as PostgreSQL
    participant Admin as Admin Panel
    
    loop Every 30 seconds
        Driver->>API: POST /api/locations (lat, lng, timestamp)
        API->>GS: updateDriverLocation(driverId, location)
        GS->>Redis: SET driver:{id}:location EX 300
        GS->>DB: INSERT location_history (async)
        GS->>ETA: recalculateETA(driverId)
        ETA->>Redis: GET driver:{id}:active_order
        ETA->>ETA: calculateRemainingDistance()
        ETA->>ETA: applyMLModel(distance, driver, conditions)
        ETA-->>GS: newETA
        GS->>SSE: broadcastEvent("location_update")
        SSE->>Redis: PUBLISH delivery:events
        Redis-->>Admin: SSE event with location + ETA
        Admin->>Admin: Update map marker + ETA display
    end
```

## Components and Interfaces

### 1. SSE Service

**Purpose**: Manage Server-Sent Events connections and broadcast real-time updates to connected clients.

**Interface**:
```typescript
interface SSEService {
  // Connection management
  addClient(clientId: string, response: Response): void;
  removeClient(clientId: string): void;
  getActiveClients(): string[];
  
  // Event broadcasting
  broadcast(event: DeliveryEvent): Promise<void>;
  sendToClient(clientId: string, event: DeliveryEvent): Promise<void>;
  
  // Event filtering
  subscribeToRestaurant(clientId: string, restaurantId: string): void;
  subscribeToDriver(clientId: string, driverId: string): void;
}

interface DeliveryEvent {
  id: string;
  type: 'order_created' | 'order_assigned' | 'order_dispatched' | 
        'order_delivered' | 'order_failed' | 'location_update' | 
        'eta_update' | 'driver_status_change';
  timestamp: Date;
  data: Record<string, unknown>;
  restaurantId?: string;
  driverId?: string;
}
```

**Implementation Details**:
- Use Next.js Route Handlers with `ReadableStream` for SSE
- Store active connections in Redis with TTL of 5 minutes
- Implement heartbeat every 30 seconds to detect dead connections
- Use Redis Pub/Sub for broadcasting across multiple server instances
- Include event IDs for client-side deduplication
- Support reconnection with `Last-Event-ID` header

**Connection Lifecycle**:
1. Client connects to `/api/deliveries/stream`
2. Server adds client to Redis set `sse:clients:{restaurantId}`
3. Server sends initial state (all active deliveries)
4. Server sends heartbeat every 30 seconds
5. On disconnect, server removes client from Redis set
6. On reconnect, client sends `Last-Event-ID`, server sends missed events

### 2. Geolocation Service

**Purpose**: Track driver locations in real-time and provide geospatial queries.

**Interface**:
```typescript
interface GeolocationService {
  // Location updates
  updateDriverLocation(driverId: string, location: Location): Promise<void>;
  getDriverLocation(driverId: string): Promise<Location | null>;
  getActiveDriverLocations(): Promise<Map<string, Location>>;
  
  // Geospatial queries
  findNearbyDrivers(point: Location, radiusKm: number): Promise<Driver[]>;
  calculateDistance(from: Location, to: Location): number;
  
  // History
  getLocationHistory(driverId: string, startDate: Date, endDate: Date): Promise<Location[]>;
}

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: Date;
  speed?: number; // km/h
  heading?: number; // degrees
}
```

**Implementation Details**:
- Store current locations in Redis with key pattern `driver:{id}:location`
- Set TTL of 5 minutes (2x update interval) to auto-expire stale data
- Store historical locations in PostgreSQL `location_history` table
- Use PostGIS extension for geospatial queries
- Validate coordinates: latitude [-90, 90], longitude [-180, 180]
- Calculate distance using Haversine formula for accuracy
- Batch insert historical data every 5 minutes to reduce DB load

**Redis Data Structure**:
```typescript
// Key: driver:{driverId}:location
// Value: JSON
{
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: "2026-01-29T12:00:00Z",
  speed: 25,
  heading: 180
}
```

### 3. Assignment Algorithm

**Purpose**: Automatically assign delivery orders to the most suitable available driver.

**Interface**:
```typescript
interface AssignmentAlgorithm {
  // Assignment
  assignDriver(orderId: string): Promise<Driver | null>;
  calculateAssignmentScore(driver: Driver, order: DeliveryOrder): Promise<number>;
  
  // Configuration
  getWeights(): AssignmentWeights;
  updateWeights(weights: AssignmentWeights): Promise<void>;
  
  // Manual override
  manualAssign(orderId: string, driverId: string): Promise<void>;
}

interface AssignmentWeights {
  distance: number; // 0-1, default 0.4
  workload: number; // 0-1, default 0.3
  performance: number; // 0-1, default 0.3
}

interface AssignmentScore {
  driverId: string;
  totalScore: number;
  distanceScore: number;
  workloadScore: number;
  performanceScore: number;
  distance: number; // km
  currentOrders: number;
  performanceRating: number; // 0-5
}
```

**Implementation Details**:

**Score Calculation**:
```typescript
function calculateAssignmentScore(driver: Driver, order: DeliveryOrder): number {
  const weights = getWeights();
  
  // Distance score (0-100, lower distance = higher score)
  const distance = calculateDistance(driver.location, order.pickupLocation);
  const distanceScore = Math.max(0, 100 - (distance * 10)); // 10km = 0 score
  
  // Workload score (0-100, fewer orders = higher score)
  const currentOrders = driver.activeOrders.length;
  const workloadScore = Math.max(0, 100 - (currentOrders * 25)); // 4 orders = 0 score
  
  // Performance score (0-100, based on rating)
  const performanceScore = (driver.performanceRating / 5) * 100;
  
  // Weighted total
  const totalScore = 
    (distanceScore * weights.distance) +
    (workloadScore * weights.workload) +
    (performanceScore * weights.performance);
  
  return totalScore;
}
```

**Assignment Process**:
1. Get all available drivers (status = 'AVAILABLE', not at max capacity)
2. Get driver locations from Geolocation Service
3. Calculate assignment score for each driver
4. Sort drivers by score (descending)
5. If top 2 drivers have scores within 5%, choose driver with lower workload
6. Assign order to selected driver
7. Send push notification to driver
8. Log assignment decision for analysis

**Retry Logic**:
- If no drivers available, queue order in Redis `pending_assignments`
- Background job checks queue every 60 seconds
- Retry assignment for queued orders
- After 10 failed attempts, alert admin

### 4. ETA Calculator

**Purpose**: Calculate and update estimated delivery times using machine learning.

**Interface**:
```typescript
interface ETACalculator {
  // ETA calculation
  calculateInitialETA(order: DeliveryOrder, driver: Driver): Promise<ETAEstimate>;
  recalculateETA(orderId: string): Promise<ETAEstimate>;
  
  // Learning
  recordActualDeliveryTime(orderId: string, actualTime: Date): Promise<void>;
  retrainModel(): Promise<void>;
  
  // Factors
  getTrafficFactor(): Promise<number>;
  getWeatherFactor(): Promise<number>;
}

interface ETAEstimate {
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
```

**Implementation Details**:

**Initial ETA Calculation**:
```typescript
function calculateInitialETA(order: DeliveryOrder, driver: Driver): ETAEstimate {
  // Base time from distance
  const distance = calculateDistance(driver.location, order.pickupLocation) +
                   calculateDistance(order.pickupLocation, order.deliveryLocation);
  const baseTime = (distance / AVERAGE_SPEED_KMH) * 60; // minutes
  
  // Driver adjustment (based on historical performance)
  const driverFactor = getDriverSpeedFactor(driver.id); // 0.8-1.2
  const driverAdjustment = baseTime * (driverFactor - 1);
  
  // Traffic adjustment (from external API or historical data)
  const trafficFactor = getTrafficFactor(); // 1.0-2.0
  const trafficAdjustment = baseTime * (trafficFactor - 1);
  
  // Weather adjustment
  const weatherFactor = getWeatherFactor(); // 1.0-1.15
  const weatherAdjustment = baseTime * (weatherFactor - 1);
  
  // Total ETA
  const estimatedMinutes = Math.round(
    baseTime + driverAdjustment + trafficAdjustment + weatherAdjustment
  );
  
  // Confidence interval (±20% based on historical variance)
  const variance = getHistoricalVariance(distance);
  const confidenceInterval: [number, number] = [
    Math.round(estimatedMinutes * 0.8),
    Math.round(estimatedMinutes * 1.2)
  ];
  
  return {
    estimatedMinutes,
    confidenceInterval,
    confidence: 0.8,
    factors: {
      baseTime,
      trafficAdjustment,
      weatherAdjustment,
      driverAdjustment
    }
  };
}
```

**Real-Time ETA Updates**:
- Recalculate ETA every time driver location updates
- Use remaining distance instead of total distance
- If ETA changes by >5 minutes, trigger WhatsApp notification
- Store ETA history for learning

**Machine Learning Model**:
- Use simple linear regression initially: `ETA = β0 + β1*distance + β2*traffic + β3*weather + β4*driver_rating`
- Train on historical data: predicted ETA vs actual delivery time
- Retrain model weekly with new data
- Store model coefficients in database
- Fallback to rule-based calculation if model fails

### 5. Push Service

**Purpose**: Send push notifications to drivers using Web Push API.

**Interface**:
```typescript
interface PushService {
  // Subscription management
  subscribe(driverId: string, subscription: PushSubscription): Promise<void>;
  unsubscribe(driverId: string): Promise<void>;
  getSubscription(driverId: string): Promise<PushSubscription | null>;
  
  // Notification sending
  sendNotification(driverId: string, notification: PushNotification): Promise<void>;
  sendBulkNotifications(notifications: Array<{driverId: string, notification: PushNotification}>): Promise<void>;
  
  // Queue management
  queueNotification(driverId: string, notification: PushNotification): Promise<void>;
  processQueue(): Promise<void>;
}

interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{action: string, title: string}>;
  priority: 'urgent' | 'normal';
  expiresAt?: Date;
}
```

**Implementation Details**:
- Use `web-push` library for sending notifications
- Store subscriptions in `push_subscriptions` table
- Queue notifications in Redis `push:queue:{driverId}`
- Background worker processes queue every 10 seconds
- Retry failed sends up to 3 times with exponential backoff (1s, 2s, 4s)
- Remove invalid subscriptions (410 Gone response)
- Support notification actions: "Accept", "Reject", "View Details"

**Notification Types**:
1. **New Assignment**: Urgent priority, expires in 5 minutes
2. **Order Update**: Normal priority, no expiration
3. **Customer Message**: Normal priority, no expiration
4. **System Alert**: Urgent priority, no expiration

### 6. WhatsApp Service

**Purpose**: Send automated WhatsApp messages to customers using Twilio API.

**Interface**:
```typescript
interface WhatsAppService {
  // Message sending
  sendOrderAssigned(orderId: string): Promise<void>;
  sendOrderDispatched(orderId: string): Promise<void>;
  sendETAUpdate(orderId: string, newETA: number): Promise<void>;
  sendOrderDelivered(orderId: string): Promise<void>;
  sendOrderFailed(orderId: string, reason: string): Promise<void>;
  
  // Template management
  getTemplate(templateName: string): MessageTemplate;
  
  // Rate limiting
  canSendMessage(phoneNumber: string): Promise<boolean>;
}

interface MessageTemplate {
  name: string;
  body: string;
  variables: string[];
}
```

**Implementation Details**:
- Use Twilio WhatsApp API with approved templates
- Store message history in `whatsapp_messages` table
- Implement rate limiting: max 10 messages per customer per day
- Queue messages in Redis if rate limit exceeded
- Handle opt-out preferences (check `customer.whatsapp_opt_out`)
- Include tracking link in dispatched message: `https://track.parkpos.com/{orderId}`

**Message Templates**:
```typescript
const TEMPLATES = {
  ORDER_ASSIGNED: {
    name: 'order_assigned',
    body: 'Hola {{customer_name}}! Tu pedido #{{order_number}} ha sido asignado a {{driver_name}}. Tiempo estimado: {{eta}} minutos.',
    variables: ['customer_name', 'order_number', 'driver_name', 'eta']
  },
  ORDER_DISPATCHED: {
    name: 'order_dispatched',
    body: '🚗 {{driver_name}} está en camino con tu pedido #{{order_number}}. Rastrea tu pedido: {{tracking_link}}',
    variables: ['driver_name', 'order_number', 'tracking_link']
  },
  ETA_UPDATE: {
    name: 'eta_update',
    body: 'Actualización: Tu pedido #{{order_number}} llegará en {{eta}} minutos.',
    variables: ['order_number', 'eta']
  },
  ORDER_DELIVERED: {
    name: 'order_delivered',
    body: '✅ Tu pedido #{{order_number}} ha sido entregado. ¡Buen provecho! Califica tu experiencia: {{feedback_link}}',
    variables: ['order_number', 'feedback_link']
  },
  ORDER_FAILED: {
    name: 'order_failed',
    body: '❌ No pudimos entregar tu pedido #{{order_number}}. Razón: {{reason}}. Contáctanos: {{support_phone}}',
    variables: ['order_number', 'reason', 'support_phone']
  }
};
```

### 7. Analytics Engine

**Purpose**: Collect, aggregate, and analyze delivery metrics in real-time.

**Interface**:
```typescript
interface AnalyticsEngine {
  // Metrics collection
  recordDeliveryEvent(event: DeliveryEvent): Promise<void>;
  
  // Real-time metrics
  getActiveDeliveries(): Promise<number>;
  getAverageDeliveryTime(period: TimePeriod): Promise<number>;
  getDriverUtilization(): Promise<Map<string, number>>;
  getCustomerSatisfaction(period: TimePeriod): Promise<number>;
  
  // Historical analysis
  getDeliveryVolumeByHour(date: Date): Promise<number[]>;
  getDeliveryHeatmap(bounds: GeoBounds): Promise<HeatmapPoint[]>;
  
  // Predictions
  predictDeliveryVolume(hoursAhead: number): Promise<number>;
  
  // Alerts
  checkThresholds(): Promise<Alert[]>;
}

interface TimePeriod {
  start: Date;
  end: Date;
}

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // delivery count
}

interface Alert {
  type: 'high_delivery_time' | 'low_driver_utilization' | 'high_failure_rate';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}
```

**Implementation Details**:

**Real-Time Metrics (Redis)**:
- Store in Redis with TTL for fast access
- Update on every delivery event
- Keys: `metrics:active_deliveries`, `metrics:avg_delivery_time:{date}`, etc.

**Historical Metrics (PostgreSQL)**:
- Aggregate in background jobs every 5 minutes
- Store in `delivery_metrics` table
- Use materialized views for complex queries

**Prediction Model**:
- Use time series analysis (moving average)
- Consider day of week, hour of day, weather, events
- Update predictions every hour

**Alert Thresholds**:
```typescript
const THRESHOLDS = {
  AVERAGE_DELIVERY_TIME: 45, // minutes
  DRIVER_UTILIZATION: 0.8, // 80%
  FAILURE_RATE: 0.05, // 5%
  ACTIVE_DELIVERIES: 50 // per restaurant
};
```

## Data Models

### Database Schema Extensions

```prisma
// Existing table (no changes)
model delivery_orders {
  id                String   @id @default(cuid())
  tenant_id         String
  order_id          String?
  customer_name     String
  customer_phone    String
  delivery_address  String
  driver_id         String?
  status            String   // PENDING, ASSIGNED, DISPATCHED, DELIVERED, FAILED
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  driver            employees? @relation(fields: [driver_id], references: [id])
  
  @@index([tenant_id, status])
  @@index([driver_id])
}

// New tables

model location_history {
  id          String   @id @default(cuid())
  driver_id   String
  latitude    Float
  longitude   Float
  accuracy    Float
  speed       Float?
  heading     Float?
  timestamp   DateTime
  created_at  DateTime @default(now())
  
  driver      employees @relation(fields: [driver_id], references: [id])
  
  @@index([driver_id, timestamp])
  @@index([timestamp])
}

model push_subscriptions {
  id          String   @id @default(cuid())
  driver_id   String   @unique
  endpoint    String
  p256dh      String
  auth        String
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  driver      employees @relation(fields: [driver_id], references: [id])
}

model whatsapp_messages {
  id              String   @id @default(cuid())
  order_id        String
  phone_number    String
  template_name   String
  message_body    String
  status          String   // QUEUED, SENT, DELIVERED, FAILED
  twilio_sid      String?
  error_message   String?
  sent_at         DateTime?
  delivered_at    DateTime?
  created_at      DateTime @default(now())
  
  order           delivery_orders @relation(fields: [order_id], references: [id])
  
  @@index([order_id])
  @@index([phone_number, created_at])
}

model assignment_weights {
  id          String   @id @default(cuid())
  tenant_id   String   @unique
  distance    Float    @default(0.4)
  workload    Float    @default(0.3)
  performance Float    @default(0.3)
  updated_at  DateTime @updatedAt
  
  @@index([tenant_id])
}

model assignment_logs {
  id                String   @id @default(cuid())
  order_id          String
  driver_id         String
  assignment_score  Float
  distance_score    Float
  workload_score    Float
  performance_score Float
  distance_km       Float
  current_orders    Int
  performance_rating Float
  created_at        DateTime @default(now())
  
  order             delivery_orders @relation(fields: [order_id], references: [id])
  driver            employees @relation(fields: [driver_id], references: [id])
  
  @@index([order_id])
  @@index([driver_id, created_at])
}

model eta_predictions {
  id                  String   @id @default(cuid())
  order_id            String
  predicted_minutes   Int
  confidence_interval String   // JSON: [min, max]
  confidence          Float
  base_time           Float
  traffic_adjustment  Float
  weather_adjustment  Float
  driver_adjustment   Float
  actual_minutes      Int?
  created_at          DateTime @default(now())
  
  order               delivery_orders @relation(fields: [order_id], references: [id])
  
  @@index([order_id, created_at])
}

model delivery_metrics {
  id                    String   @id @default(cuid())
  tenant_id             String
  date                  DateTime
  hour                  Int
  active_deliveries     Int
  completed_deliveries  Int
  failed_deliveries     Int
  avg_delivery_time     Float
  avg_driver_utilization Float
  avg_customer_rating   Float?
  created_at            DateTime @default(now())
  
  @@unique([tenant_id, date, hour])
  @@index([tenant_id, date])
}
```

### Redis Data Structures

```typescript
// Active driver locations
// Key: driver:{driverId}:location
// TTL: 300 seconds (5 minutes)
{
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: string,
  speed?: number,
  heading?: number
}

// Active SSE clients
// Key: sse:clients:{restaurantId}
// Type: Set
// Members: clientId1, clientId2, ...

// Pending assignments queue
// Key: pending_assignments
// Type: List
// Values: orderId1, orderId2, ...

// Push notification queue
// Key: push:queue:{driverId}
// Type: List
// Values: JSON notification objects

// Real-time metrics
// Key: metrics:active_deliveries:{tenantId}
// Type: String (number)
// TTL: 3600 seconds (1 hour)

// Key: metrics:avg_delivery_time:{tenantId}:{date}
// Type: String (number)
// TTL: 86400 seconds (24 hours)

// SSE event stream
// Key: delivery:events
// Type: Pub/Sub channel
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several opportunities to consolidate redundant properties:

1. **SSE Broadcasting (1.1, 1.4, 2.4)**: All three criteria test broadcast behavior. Combined into single comprehensive property.
2. **Resource Cleanup (1.5, 2.7)**: Both test cleanup on disconnect/completion. Combined into single property.
3. **Notification Sending (3.6, 4.3)**: Both test that assignment triggers notifications. Combined into single property.
4. **ETA Calculation Factors (5.3, 5.4, 5.5)**: All test different factors affecting ETA. Combined into single comprehensive property.
5. **WhatsApp Message Sending (8.1, 8.2, 8.4, 8.5)**: All test message sending on different events. Combined into single property with event types.

### SSE Service Properties

**Property 1: SSE Broadcast Latency**
*For any* delivery event, when broadcast to connected clients, all clients should receive the event within 500ms.
**Validates: Requirements 1.1**

**Property 2: SSE Initial State Synchronization**
*For any* client connecting to the SSE endpoint, the client should receive the current state of all active deliveries immediately upon connection.
**Validates: Requirements 1.2**

**Property 3: SSE Reconnection with Exponential Backoff**
*For any* connection loss, reconnection attempts should follow exponential backoff pattern (1s, 2s, 4s, 8s, ...).
**Validates: Requirements 1.3**

**Property 4: SSE Broadcast to All Clients**
*For any* delivery event and any set of connected clients, all clients should receive the same event data simultaneously.
**Validates: Requirements 1.4, 2.4**

**Property 5: SSE Resource Cleanup**
*For any* client disconnect or delivery completion, the system should remove the connection from active clients and clear associated resources.
**Validates: Requirements 1.5, 2.7**

**Property 6: SSE Server Restart Resilience**
*For any* server restart, all previously connected clients should be able to reconnect and resume receiving updates.
**Validates: Requirements 1.6**

**Property 7: SSE Concurrent Connection Capacity**
*For any* number of concurrent connections up to 100, the SSE service should accept and maintain all connections without errors.
**Validates: Requirements 1.7**

**Property 8: SSE Event ID Uniqueness**
*For any* event sent through SSE, the event should have a unique ID that can be used for client-side deduplication.
**Validates: Requirements 1.8**

### Geolocation Service Properties

**Property 9: Location Storage with TTL**
*For any* location update received, the location should be stored in Redis with a TTL of exactly 5 minutes (300 seconds).
**Validates: Requirements 2.2**

**Property 10: Location Query Performance**
*For any* request for driver locations, the response should be returned within 100ms regardless of the number of active drivers.
**Validates: Requirements 2.3**

**Property 11: Connection Lost Detection**
*For any* driver whose location updates stop for more than 2 minutes, the system should mark the driver status as "connection lost".
**Validates: Requirements 2.6**

**Property 12: Location Coordinate Validation**
*For any* location update, coordinates outside valid ranges (latitude: -90 to 90, longitude: -180 to 180) should be rejected.
**Validates: Requirements 2.8**

### Assignment Algorithm Properties

**Property 13: Assignment Score Calculation**
*For any* new delivery order, the assignment algorithm should calculate assignment scores for all available drivers.
**Validates: Requirements 3.1**

**Property 14: Assignment Score Weights**
*For any* driver and order, the assignment score should be calculated using distance (40%), workload (30%), and performance (30%) weights.
**Validates: Requirements 3.2**

**Property 15: Assignment Tie-Breaking**
*For any* two drivers with assignment scores within 5% of each other, the driver with lower current workload should be selected.
**Validates: Requirements 3.3**

**Property 16: Assignment Queueing**
*For any* order when no drivers are available, the order should be queued and assignment retried every 60 seconds.
**Validates: Requirements 3.4**

**Property 17: Assignment Rejection Handling**
*For any* driver rejection, the order should be reassigned to the next best driver within 10 seconds.
**Validates: Requirements 3.5**

**Property 18: Assignment Notification**
*For any* driver assignment, a push notification should be sent to the assigned driver.
**Validates: Requirements 3.6, 4.3**

**Property 19: Assignment Weight Configurability**
*For any* change to assignment weights, subsequent score calculations should use the updated weights.
**Validates: Requirements 3.7**

**Property 20: Assignment Distance Calculation**
*For any* driver-order pair, initial scoring should use straight-line distance and final assignment should use route distance.
**Validates: Requirements 3.8**

### Push Service Properties

**Property 21: Push Subscription Storage**
*For any* driver granting push notification permission, the subscription should be stored in the database with the driver's ID.
**Validates: Requirements 4.2**

**Property 22: Push Notification Queueing**
*For any* notification sent to an offline driver, the notification should be queued and sent when the driver reconnects.
**Validates: Requirements 4.4**

**Property 23: Push Notification Actions**
*For any* push notification sent, the notification should include action buttons for "Accept" and "Reject".
**Validates: Requirements 4.5**

**Property 24: Push Notification Retry**
*For any* failed notification send, the system should retry up to 3 times with exponential backoff (1s, 2s, 4s).
**Validates: Requirements 4.6**

**Property 25: Push Notification Priorities**
*For any* notification, new assignments should have "urgent" priority and updates should have "normal" priority.
**Validates: Requirements 4.8**

### ETA Calculator Properties

**Property 26: Initial ETA Calculation**
*For any* order assignment, an initial ETA should be calculated based on distance and average driver speed.
**Validates: Requirements 5.1**

**Property 27: ETA Recalculation on Location Update**
*For any* driver location update, the ETA should be recalculated using current position and remaining distance.
**Validates: Requirements 5.2**

**Property 28: ETA Factor Consideration**
*For any* ETA calculation, the system should consider historical driver performance, traffic conditions, and weather conditions as adjustment factors.
**Validates: Requirements 5.3, 5.4, 5.5**

**Property 29: ETA Change Notification**
*For any* ETA change exceeding 5 minutes, a WhatsApp notification should be sent to the customer.
**Validates: Requirements 5.6**

**Property 30: ETA Confidence Intervals**
*For any* ETA calculation, the result should include a confidence interval (e.g., [15, 20] minutes) based on prediction accuracy.
**Validates: Requirements 5.7**

**Property 31: ETA Learning from Actual Times**
*For any* completed delivery, recording the actual delivery time should affect future ETA predictions for similar distances.
**Validates: Requirements 5.8**

### UI Properties

**Property 32: Optimistic UI Updates**
*For any* user action in the Admin Panel, the UI should update immediately before server confirmation.
**Validates: Requirements 6.2**

**Property 33: Table Sorting and Filtering**
*For any* delivery list, sorting by any column should reorder the list, and filtering should show only matching deliveries.
**Validates: Requirements 6.5**

**Property 34: Form Real-Time Validation**
*For any* form input, invalid values should be rejected and show validation errors in real-time.
**Validates: Requirements 6.6**

**Property 35: Loading State Disables Actions**
*For any* loading state, all interactive elements should be disabled to prevent duplicate actions.
**Validates: Requirements 6.8**

### Analytics Engine Properties

**Property 36: Real-Time Metric Updates**
*For any* delivery event, metrics should update in real-time without requiring page refresh.
**Validates: Requirements 7.1**

**Property 37: Required Metrics Display**
*For any* analytics dashboard view, the display should include active deliveries, average delivery time, driver utilization, and customer satisfaction metrics.
**Validates: Requirements 7.2**

**Property 38: Historical Data Charts**
*For any* time period, the analytics engine should provide chart data for delivery volume by hour, day, and week.
**Validates: Requirements 7.3**

**Property 39: Delivery Heatmap Generation**
*For any* geographic bounds, the analytics engine should generate heatmap data showing delivery density.
**Validates: Requirements 7.4**

**Property 40: Demand Forecasting**
*For any* current time, the analytics engine should forecast delivery volume for the next 2 hours based on historical patterns.
**Validates: Requirements 7.5**

**Property 41: Threshold Alert Triggering**
*For any* metric exceeding its configured threshold, the analytics engine should trigger an alert.
**Validates: Requirements 7.6**

**Property 42: Driver Performance Score Calculation**
*For any* driver, the performance score should be calculated using on-time delivery rate, customer ratings, and average delivery time.
**Validates: Requirements 7.7**

**Property 43: Analytics Data Export**
*For any* metric, the analytics engine should support exporting data in both CSV and JSON formats.
**Validates: Requirements 7.8**

### WhatsApp Service Properties

**Property 44: WhatsApp Event-Based Messaging**
*For any* delivery event (assigned, dispatched, completed, failed), the WhatsApp service should send the appropriate message to the customer.
**Validates: Requirements 8.1, 8.2, 8.4, 8.5**

**Property 45: WhatsApp ETA Update Messages**
*For any* ETA change exceeding 5 minutes, the WhatsApp service should send an update message to the customer.
**Validates: Requirements 8.3**

**Property 46: WhatsApp Template Compliance**
*For any* message sent, the WhatsApp service should use only approved Twilio templates.
**Validates: Requirements 8.7**

**Property 47: WhatsApp Rate Limiting**
*For any* customer, when the rate limit (10 messages per day) is exceeded, additional messages should be queued.
**Validates: Requirements 8.8**

## Error Handling

### SSE Service Error Handling

**Connection Errors**:
- Client disconnect: Clean up resources, remove from active clients
- Server error: Send error event to client, maintain connection if possible
- Network timeout: Client implements reconnection with exponential backoff

**Broadcasting Errors**:
- Failed to send to specific client: Log error, remove dead connection
- Redis Pub/Sub failure: Fallback to direct client notification
- Event serialization error: Log error, skip event, continue processing

### Geolocation Service Error Handling

**Location Update Errors**:
- Invalid coordinates: Reject update, return 400 error with validation message
- Redis connection failure: Queue updates in memory, retry with exponential backoff
- Database write failure: Log error, continue (Redis is source of truth)

**Query Errors**:
- Redis unavailable: Return empty result set, log error
- Timeout: Return partial results with warning
- Invalid query parameters: Return 400 error with validation message

### Assignment Algorithm Error Handling

**Assignment Errors**:
- No available drivers: Queue order, retry every 60 seconds
- Score calculation failure: Log error, use fallback (nearest driver)
- Database error: Retry up to 3 times, then alert admin

**Driver Rejection**:
- Reassign to next best driver within 10 seconds
- If all drivers reject: Alert admin, mark order as "needs manual assignment"
- Track rejection reasons for analysis

### Push Service Error Handling

**Notification Errors**:
- Invalid subscription: Remove from database (410 Gone)
- Send failure: Retry up to 3 times with exponential backoff
- Timeout: Queue notification, retry later
- Rate limit exceeded: Queue notification, send when limit resets

**Subscription Errors**:
- Duplicate subscription: Update existing subscription
- Invalid format: Return 400 error with validation message
- Database error: Retry up to 3 times, then return 500 error

### ETA Calculator Error Handling

**Calculation Errors**:
- Missing location data: Use last known location with warning
- ML model failure: Fallback to rule-based calculation
- Invalid input: Log error, use default values
- Timeout: Return cached ETA with stale indicator

**Learning Errors**:
- Invalid actual time: Log error, skip learning update
- Model training failure: Log error, continue using current model
- Database error: Queue learning data, retry later

### WhatsApp Service Error Handling

**Message Sending Errors**:
- Twilio API failure: Retry up to 3 times with exponential backoff
- Rate limit exceeded: Queue message, send when limit resets
- Invalid phone number: Log error, mark message as failed
- Template not found: Log error, use fallback template

**Opt-Out Handling**:
- Check opt-out status before sending
- If opted out: Skip message, log event
- Respect opt-out preferences across all message types

### Analytics Engine Error Handling

**Metric Calculation Errors**:
- Missing data: Use default values, mark as incomplete
- Database query timeout: Return cached metrics with stale indicator
- Invalid event data: Log error, skip event, continue processing

**Alert Errors**:
- Alert delivery failure: Retry up to 3 times, then log
- Invalid threshold configuration: Use default thresholds, alert admin
- Too many alerts: Implement alert throttling (max 1 per metric per hour)

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- SSE connection lifecycle (connect, disconnect, reconnect)
- Location coordinate validation edge cases
- Assignment algorithm with specific driver/order combinations
- Push notification retry logic with specific failure scenarios
- ETA calculation with specific distances and conditions
- WhatsApp message template rendering with specific data
- Analytics metric calculations with specific event sequences

**Property-Based Tests**: Verify universal properties across all inputs
- SSE broadcast latency for any event and any number of clients
- Location storage TTL for any location update
- Assignment score calculation for any driver/order combination
- Push notification queueing for any offline driver
- ETA recalculation for any location update
- WhatsApp message sending for any delivery event
- Analytics metric updates for any event stream

### Property-Based Testing Configuration

**Library**: Fast-check (TypeScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: delivery-2026-modernization, Property {N}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

describe('Feature: delivery-2026-modernization, Property 14: Assignment Score Weights', () => {
  it('should calculate assignment scores using correct weights (40% distance, 30% workload, 30% performance)', () => {
    fc.assert(
      fc.property(
        fc.record({
          driver: arbitraryDriver(),
          order: arbitraryDeliveryOrder(),
          weights: fc.constant({ distance: 0.4, workload: 0.3, performance: 0.3 })
        }),
        ({ driver, order, weights }) => {
          const score = calculateAssignmentScore(driver, order, weights);
          
          // Verify score is weighted correctly
          const distanceScore = calculateDistanceScore(driver, order);
          const workloadScore = calculateWorkloadScore(driver);
          const performanceScore = calculatePerformanceScore(driver);
          
          const expectedScore = 
            (distanceScore * weights.distance) +
            (workloadScore * weights.workload) +
            (performanceScore * weights.performance);
          
          expect(score).toBeCloseTo(expectedScore, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Arbitraries for Property-Based Testing

**Driver Arbitrary**:
```typescript
const arbitraryDriver = () => fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  location: arbitraryLocation(),
  activeOrders: fc.array(fc.uuid(), { maxLength: 5 }),
  performanceRating: fc.float({ min: 0, max: 5 }),
  status: fc.constantFrom('AVAILABLE', 'BUSY', 'OFFLINE')
});
```

**Location Arbitrary**:
```typescript
const arbitraryLocation = () => fc.record({
  latitude: fc.float({ min: -90, max: 90 }),
  longitude: fc.float({ min: -180, max: 180 }),
  accuracy: fc.float({ min: 0, max: 100 }),
  timestamp: fc.date(),
  speed: fc.option(fc.float({ min: 0, max: 120 })),
  heading: fc.option(fc.float({ min: 0, max: 360 }))
});
```

**Delivery Order Arbitrary**:
```typescript
const arbitraryDeliveryOrder = () => fc.record({
  id: fc.uuid(),
  customerName: fc.string({ minLength: 3, maxLength: 50 }),
  customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
  pickupLocation: arbitraryLocation(),
  deliveryLocation: arbitraryLocation(),
  status: fc.constantFrom('PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED'),
  createdAt: fc.date()
});
```

**Delivery Event Arbitrary**:
```typescript
const arbitraryDeliveryEvent = () => fc.record({
  id: fc.uuid(),
  type: fc.constantFrom(
    'order_created', 'order_assigned', 'order_dispatched',
    'order_delivered', 'order_failed', 'location_update',
    'eta_update', 'driver_status_change'
  ),
  timestamp: fc.date(),
  data: fc.dictionary(fc.string(), fc.anything()),
  restaurantId: fc.option(fc.uuid()),
  driverId: fc.option(fc.uuid())
});
```

### Integration Tests

**SSE Integration**:
- Test full SSE connection lifecycle with real Redis
- Test broadcasting across multiple server instances
- Test reconnection after server restart

**Geolocation Integration**:
- Test location updates with real Redis and PostgreSQL
- Test geospatial queries with PostGIS
- Test location history storage and retrieval

**Assignment Integration**:
- Test full assignment flow from order creation to driver notification
- Test queueing and retry logic
- Test manual assignment override

**Push Notification Integration**:
- Test push notification flow with mock Web Push API
- Test queueing and retry logic
- Test subscription management

**ETA Integration**:
- Test ETA calculation with real location data
- Test ETA updates as driver moves
- Test learning from actual delivery times

**WhatsApp Integration**:
- Test message sending with mock Twilio API
- Test rate limiting and queueing
- Test template rendering

**Analytics Integration**:
- Test metric collection from real events
- Test real-time updates via SSE
- Test alert triggering

### Performance Tests

**SSE Performance**:
- Test 100 concurrent connections
- Test broadcast latency with 100 clients
- Test memory usage with long-lived connections

**Geolocation Performance**:
- Test location query performance with 100 active drivers
- Test location update throughput (1000 updates/second)
- Test Redis memory usage with 1000 drivers

**Assignment Performance**:
- Test assignment calculation with 100 available drivers
- Test queueing performance with 1000 pending orders
- Test database query performance

**Analytics Performance**:
- Test metric calculation with 10,000 events
- Test query performance for historical data
- Test export performance with large datasets

### End-to-End Tests

**Complete Delivery Flow**:
1. Create delivery order
2. Verify automatic driver assignment
3. Verify push notification sent to driver
4. Verify WhatsApp message sent to customer
5. Simulate driver location updates
6. Verify ETA recalculation
7. Verify SSE updates to admin panel
8. Complete delivery
9. Verify completion messages
10. Verify analytics metrics updated

**Error Recovery Flow**:
1. Create delivery order
2. Simulate all drivers offline
3. Verify order queued
4. Bring driver online
5. Verify automatic assignment
6. Simulate driver rejection
7. Verify reassignment
8. Complete delivery

**Offline/Online Flow**:
1. Create delivery order while offline
2. Verify order queued locally
3. Go online
4. Verify order synced to server
5. Verify assignment happens
6. Go offline during delivery
7. Verify location updates queued
8. Go online
9. Verify location updates synced
10. Complete delivery

## Deployment Considerations

### Infrastructure Requirements

**Redis**:
- Minimum 2GB RAM for location data and metrics
- Persistence enabled for queue data
- Pub/Sub enabled for SSE broadcasting
- Cluster mode for high availability

**PostgreSQL**:
- PostGIS extension for geospatial queries
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Regular backups

**Server**:
- Minimum 2 CPU cores, 4GB RAM per instance
- Support for long-lived HTTP connections (SSE)
- WebSocket support for future enhancements
- Load balancer with sticky sessions

**External Services**:
- Twilio WhatsApp API account with approved templates
- Mapbox API key for maps
- VAPID keys for Web Push API
- Weather API key (optional)
- Traffic API key (optional)

### Environment Variables

```bash
# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/parkpos
DATABASE_POOL_SIZE=20

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@parkpos.com

# External APIs (optional)
WEATHER_API_KEY=
TRAFFIC_API_KEY=

# Feature Flags
ENABLE_SSE=true
ENABLE_PUSH_NOTIFICATIONS=true
ENABLE_WHATSAPP=true
ENABLE_ANALYTICS=true
ENABLE_ML_ETA=false
```

### Migration Strategy

**Phase 1: Infrastructure Setup**
- Deploy Redis instance
- Install PostGIS extension
- Configure environment variables
- Deploy SSE endpoint

**Phase 2: Core Services**
- Deploy Geolocation Service
- Deploy Assignment Algorithm
- Deploy ETA Calculator
- Test with existing delivery flow

**Phase 3: Notifications**
- Deploy Push Service
- Deploy WhatsApp Service
- Test notification delivery
- Monitor error rates

**Phase 4: UI Modernization**
- Deploy new Admin Panel with SSE
- Deploy Driver App with push notifications
- Deploy Customer Portal with tracking
- A/B test with old UI

**Phase 5: Analytics**
- Deploy Analytics Engine
- Deploy Analytics Dashboard
- Configure alerts
- Train ML models

**Phase 6: Full Rollout**
- Enable all features for all users
- Monitor performance and errors
- Collect user feedback
- Iterate on improvements

### Monitoring and Observability

**Metrics to Track**:
- SSE connection count and duration
- Location update frequency and latency
- Assignment success rate and time
- Push notification delivery rate
- ETA prediction accuracy
- WhatsApp message delivery rate
- Analytics query performance

**Alerts to Configure**:
- SSE connection failures > 5%
- Location update latency > 1s
- Assignment failures > 10%
- Push notification failures > 20%
- ETA prediction error > 30%
- WhatsApp delivery failures > 10%
- Analytics query timeout > 5s

**Logging**:
- Log all assignment decisions with scores
- Log all ETA calculations with factors
- Log all notification sends with status
- Log all WhatsApp messages with delivery status
- Log all errors with context

### Rollback Plan

**If SSE Issues**:
- Disable SSE feature flag
- Fallback to polling (existing behavior)
- Fix issues in staging
- Re-enable gradually

**If Assignment Issues**:
- Disable automatic assignment
- Fallback to manual assignment
- Fix algorithm in staging
- Re-enable with monitoring

**If Notification Issues**:
- Disable push notifications
- Fallback to in-app notifications
- Fix issues in staging
- Re-enable gradually

**If WhatsApp Issues**:
- Disable WhatsApp feature flag
- Fallback to SMS or email
- Fix issues with Twilio
- Re-enable with rate limiting

**If Analytics Issues**:
- Disable analytics dashboard
- Use existing reports
- Fix queries in staging
- Re-enable with performance testing
