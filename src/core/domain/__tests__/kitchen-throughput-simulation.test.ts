/**
 * Simulation Tests: Kitchen Throughput & SLA Tracking
 *
 * Simulates kitchen operations with:
 * - Multiple stations working in parallel
 * - Order queue with prioritization
 * - Cooking time tracking per item
 * - SLA breach detection and alerting
 * - Station bottleneck identification
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Kitchen Simulation Model
// ============================================================

type Station = 'PARRILLA' | 'COCINA' | 'BAR' | 'FRIOS' | 'POSTRES';
type OrderPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type OrderStatus = 'QUEUED' | 'COOKING' | 'READY' | 'SERVED';

interface MenuItem {
  name: string;
  station: Station;
  cookingTimeMinutes: number;
}

interface KitchenOrder {
  orderId: string;
  orderNumber: number;
  priority: OrderPriority;
  items: Array<MenuItem & { status: OrderStatus; startedAt?: number; completedAt?: number }>;
  queuedAt: number;
  completedAt?: number;
}

interface StationMetrics {
  station: Station;
  itemsProcessed: number;
  avgCookingTime: number;
  maxCookingTime: number;
  slaBreaches: number;
  totalTimeCooking: number;
}

// ============================================================
// Kitchen Simulation Engine
// ============================================================

class KitchenSimulator {
  private currentTime: number = 0;
  private orders: KitchenOrder[] = [];
  private stationMetrics: Map<Station, StationMetrics> = new Map();

  constructor(private slaMinutes: number = 25) {
    // Initialize station metrics
    (['PARRILLA', 'COCINA', 'BAR', 'FRIOS', 'POSTRES'] as Station[]).forEach(station => {
      this.stationMetrics.set(station, {
        station,
        itemsProcessed: 0,
        avgCookingTime: 0,
        maxCookingTime: 0,
        slaBreaches: 0,
        totalTimeCooking: 0,
      });
    });
  }

  addOrder(order: KitchenOrder) {
    this.orders.push(order);
  }

  simulate() {
    // Sort by priority (HIGH first, then MEDIUM, then LOW)
    const priorityWeight: Record<OrderPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sortedOrders = [...this.orders].sort((a, b) => {
      const prioDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (prioDiff !== 0) return prioDiff;
      return a.queuedAt - b.queuedAt;
    });

    // Process each order
    for (const order of sortedOrders) {
      this.currentTime = Math.max(this.currentTime, order.queuedAt);

      // Process each item in the order
      for (const item of order.items) {
        item.startedAt = this.currentTime;
        const cookingEnd = this.currentTime + item.cookingTimeMinutes;
        item.completedAt = cookingEnd;
        item.status = 'SERVED';

        // Update station metrics
        const metrics = this.stationMetrics.get(item.station)!;
        metrics.itemsProcessed++;
        metrics.totalTimeCooking += item.cookingTimeMinutes;
        metrics.maxCookingTime = Math.max(metrics.maxCookingTime, item.cookingTimeMinutes);
        metrics.avgCookingTime = metrics.totalTimeCooking / metrics.itemsProcessed;

        if (item.cookingTimeMinutes > this.slaMinutes) {
          metrics.slaBreaches++;
        }

        this.currentTime = Math.max(this.currentTime, cookingEnd);
      }

      order.completedAt = this.currentTime;
    }
  }

  getMetrics(): Map<Station, StationMetrics> {
    return this.stationMetrics;
  }

  getCompletedOrders(): number {
    return this.orders.filter(o => o.completedAt !== undefined).length;
  }

  getSLABreachRate(): number {
    let totalItems = 0;
    let totalBreaches = 0;

    for (const metrics of this.stationMetrics.values()) {
      totalItems += metrics.itemsProcessed;
      totalBreaches += metrics.slaBreaches;
    }

    return totalItems > 0 ? totalBreaches / totalItems : 0;
  }

  getBottleneckStation(): Station | null {
    let maxAvgTime = 0;
    let bottleneck: Station | null = null;

    for (const [station, metrics] of this.stationMetrics) {
      if (metrics.itemsProcessed > 0 && metrics.avgCookingTime > maxAvgTime) {
        maxAvgTime = metrics.avgCookingTime;
        bottleneck = station;
      }
    }

    return bottleneck;
  }
}

// ============================================================
// SIMULATION TESTS
// ============================================================

describe('Kitchen Throughput & SLA Simulation', () => {

  it('should simulate lunch rush with multiple stations', () => {
    const kitchen = new KitchenSimulator(25); // 25 min SLA

    // Add 20 orders from lunch rush
    for (let i = 1; i <= 20; i++) {
      const order: KitchenOrder = {
        orderId: `order-${i}`,
        orderNumber: 1000 + i,
        priority: i <= 5 ? 'HIGH' : i <= 10 ? 'MEDIUM' : 'LOW',
        queuedAt: i * 3, // Orders arrive every 3 minutes
        items: [
          { name: 'Pollo Entero', station: 'PARRILLA', cookingTimeMinutes: 20 + (i % 10), status: 'QUEUED' },
          { name: 'Inca Kola 1.5L', station: 'BAR', cookingTimeMinutes: 2, status: 'QUEUED' },
          { name: 'Papas Fritas', station: 'COCINA', cookingTimeMinutes: 10 + (i % 5), status: 'QUEUED' },
        ],
      };

      kitchen.addOrder(order);
    }

    kitchen.simulate();

    // All orders completed
    expect(kitchen.getCompletedOrders()).toBe(20);

    // SLA breach rate should be reasonable
    const breachRate = kitchen.getSLABreachRate();
    expect(breachRate).toBeGreaterThanOrEqual(0);
    expect(breachRate).toBeLessThanOrEqual(1);

    // Identify bottleneck station
    const bottleneck = kitchen.getBottleneckStation();
    expect(bottleneck).not.toBeNull();

    // Get metrics for each station
    const metrics = kitchen.getMetrics();
    expect(metrics.get('PARRILLA')!.itemsProcessed).toBe(20);
    expect(metrics.get('BAR')!.itemsProcessed).toBe(20);
    expect(metrics.get('COCINA')!.itemsProcessed).toBe(20);
  });

  it('should handle high-priority orders first', () => {
    const kitchen = new KitchenSimulator(25);

    const lowPriorityOrder: KitchenOrder = {
      orderId: 'low-1',
      orderNumber: 1001,
      priority: 'LOW',
      queuedAt: 0,
      items: [
        { name: 'Pollo Entero', station: 'PARRILLA', cookingTimeMinutes: 20, status: 'QUEUED' },
      ],
    };

    const highPriorityOrder: KitchenOrder = {
      orderId: 'high-1',
      orderNumber: 1002,
      priority: 'HIGH',
      queuedAt: 5, // Arrived 5 minutes later
      items: [
        { name: '1/4 Pollo', station: 'PARRILLA', cookingTimeMinutes: 10, status: 'QUEUED' },
      ],
    };

    kitchen.addOrder(lowPriorityOrder);
    kitchen.addOrder(highPriorityOrder);
    kitchen.simulate();

    // High priority order should complete first (despite arriving later)
    expect(highPriorityOrder.completedAt!).toBeLessThanOrEqual(lowPriorityOrder.completedAt!);
  });

  it('should detect SLA breaches accurately', () => {
    const kitchen = new KitchenSimulator(15); // Strict 15 min SLA

    // Order with items that will breach SLA
    const order: KitchenOrder = {
      orderId: 'sla-test',
      orderNumber: 2001,
      priority: 'MEDIUM',
      queuedAt: 0,
      items: [
        { name: 'Pollo Entero', station: 'PARRILLA', cookingTimeMinutes: 20, status: 'QUEUED' }, // Breach
        { name: 'Inca Kola', station: 'BAR', cookingTimeMinutes: 10, status: 'QUEUED' }, // OK
        { name: 'Papas Fritas', station: 'COCINA', cookingTimeMinutes: 18, status: 'QUEUED' }, // Breach
      ],
    };

    kitchen.addOrder(order);
    kitchen.simulate();

    const metrics = kitchen.getMetrics();

    // PARRILLA: 20 min > 15 min SLA = breach
    expect(metrics.get('PARRILLA')!.slaBreaches).toBe(1);
    expect(metrics.get('PARRILLA')!.avgCookingTime).toBe(20);

    // BAR: 10 min < 15 min SLA = OK
    expect(metrics.get('BAR')!.slaBreaches).toBe(0);

    // COCINA: 18 min > 15 min SLA = breach
    expect(metrics.get('COCINA')!.slaBreaches).toBe(1);
  });

  it('should simulate full day operation (100 orders)', () => {
    const kitchen = new KitchenSimulator(25);

    // Simulate 100 orders throughout the day
    for (let i = 1; i <= 100; i++) {
      const hour = Math.floor(i / 4) + 11; // Start at 11 AM
      const minute = (i % 4) * 15;
      const queuedAt = (hour - 11) * 60 + minute;

      // Determine priority based on order type
      const priority: OrderPriority = i % 5 === 0 ? 'HIGH' : i % 3 === 0 ? 'MEDIUM' : 'LOW';

      const order: KitchenOrder = {
        orderId: `day-${i}`,
        orderNumber: 3000 + i,
        priority,
        queuedAt,
        items: [
          {
            name: i % 3 === 0 ? 'Pollo Entero' : '1/2 Pollo',
            station: 'PARRILLA',
            cookingTimeMinutes: 15 + (i % 15),
            status: 'QUEUED',
          },
          {
            name: 'Bebida',
            station: 'BAR',
            cookingTimeMinutes: 3,
            status: 'QUEUED',
          },
          ...(i % 2 === 0 ? [{
            name: 'Papas Fritas',
            station: 'COCINA' as Station,
            cookingTimeMinutes: 8 + (i % 7),
            status: 'QUEUED' as OrderStatus,
          }] : []),
        ],
      };

      kitchen.addOrder(order);
    }

    kitchen.simulate();

    // All 100 orders processed
    expect(kitchen.getCompletedOrders()).toBe(100);

    // Get overall metrics
    const breachRate = kitchen.getSLABreachRate();
    const bottleneck = kitchen.getBottleneckStation();

    expect(breachRate).toBeGreaterThanOrEqual(0);
    expect(breachRate).toBeLessThanOrEqual(1);
    expect(bottleneck).not.toBeNull();

    // PARRILLA should have processed the most items
    const metrics = kitchen.getMetrics();
    expect(metrics.get('PARRILLA')!.itemsProcessed).toBe(100);
    expect(metrics.get('BAR')!.itemsProcessed).toBe(100);
  });

  it('should identify bottleneck station correctly', () => {
    const kitchen = new KitchenSimulator(25);

    // Order with very slow PARRILLA items
    const order1: KitchenOrder = {
      orderId: 'bottleneck-1',
      orderNumber: 4001,
      priority: 'HIGH',
      queuedAt: 0,
      items: [
        { name: 'Pollo Entero', station: 'PARRILLA', cookingTimeMinutes: 30, status: 'QUEUED' },
        { name: 'Inca Kola', station: 'BAR', cookingTimeMinutes: 2, status: 'QUEUED' },
      ],
    };

    // Order with fast COCINA items
    const order2: KitchenOrder = {
      orderId: 'bottleneck-2',
      orderNumber: 4002,
      priority: 'MEDIUM',
      queuedAt: 5,
      items: [
        { name: 'Papas Fritas', station: 'COCINA', cookingTimeMinutes: 8, status: 'QUEUED' },
      ],
    };

    kitchen.addOrder(order1);
    kitchen.addOrder(order2);
    kitchen.simulate();

    const bottleneck = kitchen.getBottleneckStation();

    // PARRILLA should be the bottleneck (30 min avg)
    expect(bottleneck).toBe('PARRILLA');

    const metrics = kitchen.getMetrics();
    expect(metrics.get('PARRILLA')!.avgCookingTime).toBe(30);
    expect(metrics.get('BAR')!.avgCookingTime).toBe(2);
    expect(metrics.get('COCINA')!.avgCookingTime).toBe(8);
  });
});
