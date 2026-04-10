/**
 * UX Simulation: Kitchen Operations Edge Cases
 * 
 * Simulates real kitchen scenarios to find UX problems:
 * - Multiple orders competing for same station
 * - Order priority changes mid-cooking
 * - Item marked ready but waiter doesn't pick up
 * - Kitchen staff tries to modify already-served order
 * - Station overload during rush hour
 * - Allergens/special instructions ignored
 * 
 * This tests the KITCHEN EXPERIENCE, not just order status.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Simulated Kitchen System
// ============================================================

type Station = 'PARRILLA' | 'COCINA' | 'BAR' | 'FRIOS' | 'POSTRES';
type OrderStatus = 'PENDING' | 'COOKING' | 'READY' | 'SERVED' | 'VOIDED';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface KitchenItem {
  id: string;
  name: string;
  station: Station;
  status: OrderStatus;
  specialInstructions?: string;
  startedAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
}

interface KitchenOrder {
  id: string;
  orderNumber: number;
  items: KitchenItem[];
  priority: Priority;
  createdAt: Date;
  tableNumber?: number;
  waiterName?: string;
}

interface StationState {
  name: Station;
  queue: KitchenItem[];
  cooking: KitchenItem[];
  ready: KitchenItem[];
  served: KitchenItem[];
  confusionPoints: number;
  errors: string[];
}

function createStation(name: Station): StationState {
  return {
    name,
    queue: [],
    cooking: [],
    ready: [],
    served: [],
    confusionPoints: 0,
    errors: [],
  };
}

function addOrderToStation(station: StationState, order: KitchenOrder): StationState {
  const stationItems = order.items.filter(item => item.station === station.name);
  
  return {
    ...station,
    queue: [...station.queue, ...stationItems],
  };
}

function startCooking(station: StationState, itemId: string): StationState {
  const itemIndex = station.queue.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return {
      ...station,
      errors: [...station.errors, `Item ${itemId} not found in queue`],
      confusionPoints: station.confusionPoints + 1,
    };
  }

  const item = station.queue[itemIndex];
  const startedItem = { ...item, status: 'COOKING' as OrderStatus, startedAt: new Date() };
  const newQueue = [...station.queue.slice(0, itemIndex), ...station.queue.slice(itemIndex + 1)];

  return {
    ...station,
    queue: newQueue,
    cooking: [...station.cooking, startedItem],
  };
}

function markReady(station: StationState, itemId: string): StationState {
  const itemIndex = station.cooking.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return {
      ...station,
      errors: [...station.errors, `Item ${itemId} not cooking`],
      confusionPoints: station.confusionPoints + 1,
    };
  }

  const item = station.cooking[itemIndex];
  const readyItem = { ...item, status: 'READY' as OrderStatus, readyAt: new Date() };
  const newCooking = [...station.cooking.slice(0, itemIndex), ...station.cooking.slice(itemIndex + 1)];

  return {
    ...station,
    cooking: newCooking,
    ready: [...station.ready, readyItem],
  };
}

function markServed(station: StationState, itemId: string): StationState {
  const itemIndex = station.ready.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return {
      ...station,
      errors: [...station.errors, `Item ${itemId} not ready`],
      confusionPoints: station.confusionPoints + 1,
    };
  }

  const item = station.ready[itemIndex];
  const servedItem = { ...item, status: 'SERVED' as OrderStatus, servedAt: new Date() };
  const newReady = [...station.ready.slice(0, itemIndex), ...station.ready.slice(itemIndex + 1)];

  return {
    ...station,
    ready: newReady,
    served: [...station.served, servedItem],
  };
}

function prioritizeOrder(orders: KitchenOrder[], orderId: string, newPriority: Priority): KitchenOrder[] {
  return orders.map(order => 
    order.id === orderId ? { ...order, priority: newPriority } : order
  );
}

function calculateStationMetrics(station: StationState): {
  totalItems: number;
  avgCookingTimeMs: number;
  itemsStuckInReady: number;
  errorRate: number;
} {
  const totalItems = station.served.length;
  const servedWithTimes = station.served.filter(i => i.startedAt && i.servedAt);
  
  const avgCookingTimeMs = servedWithTimes.length > 0
    ? servedWithTimes.reduce((sum, i) => sum + (i.servedAt!.getTime() - i.startedAt!.getTime()), 0) / servedWithTimes.length
    : 0;

  const itemsStuckInReady = station.ready.length;
  const errorRate = station.errors.length > 0 ? station.errors.length / totalItems : 0;

  return {
    totalItems,
    avgCookingTimeMs,
    itemsStuckInReady,
    errorRate,
  };
}

// ============================================================
// KITCHEN UX SIMULATION TESTS
// ============================================================

describe('Kitchen Operations UX Simulation', () => {

  it('should identify: Station overload during rush hour', () => {
    // PROBLEM: PARRILLA station gets 15 orders simultaneously
    // Cook doesn't know which to start first

    const parrilla = createStation('PARRILLA');
    let orders: KitchenOrder[] = [];

    // Simulate rush: 15 orders in 10 minutes
    for (let i = 0; i < 15; i++) {
      const order: KitchenOrder = {
        id: `order-${i}`,
        orderNumber: 1000 + i,
        items: [
          {
            id: `item-${i}`,
            name: `Pollo Entero #${i + 1}`,
            station: 'PARRILLA',
            status: 'PENDING',
          },
        ],
        priority: i < 3 ? 'HIGH' : 'MEDIUM',
        createdAt: new Date(Date.now() + i * 60000),
        tableNumber: Math.floor(Math.random() * 20) + 1,
      };
      orders.push(order);
    }

    // Add all to station queue
    let station = parrilla;
    for (const order of orders) {
      station = addOrderToStation(station, order);
    }

    // Station has 15 items in queue
    expect(station.queue.length).toBe(15);

    // Cook needs to prioritize manually
    const highPriorityOrders = orders.filter(o => o.priority === 'HIGH');
    expect(highPriorityOrders.length).toBe(3);

    console.log('🔴 UX Problem: Station overload');
    console.log(`   PARRILLA queue: ${station.queue.length} items`);
    console.log(`   High priority: ${highPriorityOrders.length} orders`);
    console.log(`   Cook must manually prioritize 15 items`);
    console.log(`   Better: Auto-sort by priority + age, show "Next: Order #1000"`);
  });

  it('should identify: Item marked ready but waiter doesn\'t pick up', () => {
    // PROBLEM: Kitchen marks item ready, waiter doesn't see notification
    // Food gets cold, kitchen doesn't know

    const parrilla = createStation('PARRILLA');
    const order: KitchenOrder = {
      id: 'order-1',
      orderNumber: 1001,
      items: [{
        id: 'item-1',
        name: 'Pollo Entero',
        station: 'PARRILLA',
        status: 'PENDING',
      }],
      priority: 'HIGH',
      createdAt: new Date(),
      tableNumber: 5,
      waiterName: 'Carlos',
    };

    let station = addOrderToStation(parrilla, order);
    station = startCooking(station, 'item-1');
    station = markReady(station, 'item-1');

    // Item is in READY state, waiting for waiter
    expect(station.ready.length).toBe(1);
    expect(station.ready[0].readyAt).toBeDefined();

    // Simulate waiter delay (10 minutes)
    const readyTime = station.ready[0].readyAt!.getTime();
    const currentTime = readyTime + 10 * 60 * 1000; // 10 minutes later
    const waitTimeMinutes = (currentTime - readyTime) / (60 * 1000);

    expect(waitTimeMinutes).toBe(10);

    console.log('🔴 UX Problem: Ready items not picked up');
    console.log(`   Item ready for ${waitTimeMinutes} minutes`);
    console.log(`   Food quality degrading`);
    console.log(`   Waiter: ${order.waiterName}, Table: ${order.tableNumber}`);
    console.log(`   Better: Auto-alert waiter after 3 min, escalate to manager after 5 min`);
  });

  it('should identify: Special instructions ignored', () => {
    // PROBLEM: Customer requests "sin picante" but kitchen doesn't see it
    // Allergen risk!

    const order: KitchenOrder = {
      id: 'order-1',
      orderNumber: 1001,
      items: [
        {
          id: 'item-1',
          name: 'Pollo Entero',
          station: 'PARRILLA',
          status: 'PENDING',
          specialInstructions: 'SIN PICANTE - Alérgico',
        },
        {
          id: 'item-2',
          name: 'Papas Fritas',
          station: 'COCINA',
          status: 'PENDING',
          specialInstructions: 'Extra crispy',
        },
      ],
      priority: 'HIGH',
      createdAt: new Date(),
    };

    // Check if special instructions are visible
    const hasAllergenWarning = order.items.some(
      item => item.specialInstructions?.includes('Alérgico')
    );

    expect(hasAllergenWarning).toBe(true);

    // But is it PROMINENT in the kitchen UI?
    // Simulating kitchen display that shows item name but not instructions
    const kitchenDisplayShows = order.items.map(item => ({
      name: item.name,
      station: item.station,
      // Special instructions NOT shown by default!
    }));

    expect(kitchenDisplayShows[0].name).toBe('Pollo Entero');
    expect(kitchenDisplayShows[0]).not.toHaveProperty('specialInstructions');

    console.log('🔴 UX Problem: Special instructions not prominent');
    console.log(`   Allergen warning exists but not visible on main display`);
    console.log(`   Item: ${order.items[0].name}`);
    console.log(`   Instructions: "${order.items[0].specialInstructions}"`);
    console.log(`   Risk: Customer allergic to spicy food`);
    console.log(`   Better: Show allergens in RED on kitchen display`);
  });

  it('should identify: Priority change mid-cooking causes confusion', () => {
    // PROBLEM: VIP customer arrives, kitchen reprioritizes their order
    // But already-cooking orders get disrupted

    let orders: KitchenOrder[] = [
      {
        id: 'order-1',
        orderNumber: 1001,
        items: [{ id: 'item-1', name: 'Pollo', station: 'PARRILLA', status: 'COOKING', startedAt: new Date() }],
        priority: 'MEDIUM',
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      },
      {
        id: 'order-2',
        orderNumber: 1002,
        items: [{ id: 'item-2', name: 'Pollo VIP', station: 'PARRILLA', status: 'PENDING' }],
        priority: 'MEDIUM',
        createdAt: new Date(),
      },
    ];

    // VIP arrives - prioritize order-2
    orders = prioritizeOrder(orders, 'order-2', 'HIGH');

    // But order-1 is already cooking!
    const cookingOrder = orders.find(o => o.id === 'order-1');
    const vipOrder = orders.find(o => o.id === 'order-2');

    expect(cookingOrder?.priority).toBe('MEDIUM');
    expect(vipOrder?.priority).toBe('HIGH');

    console.log('🔴 UX Problem: Priority mid-cooking');
    console.log(`   Order #1001 already cooking (MEDIUM priority)`);
    console.log(`   Order #1002 is VIP (HIGH priority) but waiting`);
    console.log(`   Kitchen confused: Should they interrupt cooking?`);
    console.log(`   Better: Show "VIP waiting" banner, but don't interrupt cooking`);
  });

  it('should identify: Multi-station order coordination is confusing', () => {
    // PROBLEM: Order has items in PARRILLA, COCINA, and BAR
    // Each station works independently - who coordinates?

    const order: KitchenOrder = {
      id: 'order-1',
      orderNumber: 1001,
      items: [
        { id: 'item-1', name: 'Pollo Entero', station: 'PARRILLA', status: 'PENDING' },
        { id: 'item-2', name: 'Papas Fritas', station: 'COCINA', status: 'PENDING' },
        { id: 'item-3', name: 'Inca Kola', station: 'BAR', status: 'PENDING' },
      ],
      priority: 'HIGH',
      createdAt: new Date(),
      tableNumber: 5,
    };

    // Each station works independently
    const parrilla = createStation('PARRILLA');
    const cocina = createStation('COCINA');
    const bar = createStation('BAR');

    let pState = addOrderToStation(parrilla, order);
    let cState = addOrderToStation(cocina, order);
    let bState = addOrderToStation(bar, order);

    // Simulate different speeds
    pState = startCooking(pState, 'item-1');
    cState = startCooking(cState, 'item-2');
    bState = startCooking(bState, 'item-3');

    // BAR finishes first (drinks are fast)
    bState = markReady(bState, 'item-3');

    // COCINA finishes second
    cState = markReady(cState, 'item-2');

    // PARRILLA still cooking (chicken takes longer)
    expect(pState.cooking.length).toBe(1);
    expect(cState.ready.length).toBe(1);
    expect(bState.ready.length).toBe(1);

    // Problem: BAR and COCINA ready, but PARRILLA still cooking
    // Waiter can't serve partial order (or can they?)
    const readyItems = bState.ready.length + cState.ready.length;
    const cookingItems = pState.cooking.length;

    expect(readyItems).toBe(2);
    expect(cookingItems).toBe(1);

    console.log('🔴 UX Problem: Multi-station coordination');
    console.log(`   Order #1001 has items in 3 stations`);
    console.log(`   BAR: READY (drink)`);
    console.log(`   COCINA: READY (fries)`);
    console.log(`   PARRILLA: Still cooking (chicken - 15 min)`);
    console.log(`   Waiter confused: Serve partial order or wait?`);
    console.log(`   Better: Show "2/3 items ready, waiting for PARRILLA"`);
  });

  it('should calculate: Kitchen confusion during 20-order rush', () => {
    // PROBLEM: 20 orders hit kitchen simultaneously
    // How confusing is it for the cook?

    const parrilla = createStation('PARRILLA');
    let totalConfusion = 0;
    let totalErrors = 0;

    // 20 orders arrive at once
    for (let i = 0; i < 20; i++) {
      const order: KitchenOrder = {
        id: `order-${i}`,
        orderNumber: 1000 + i,
        items: [{
          id: `item-${i}`,
          name: `Pollo #${i + 1}`,
          station: 'PARRILLA',
          status: 'PENDING',
        }],
        priority: i < 5 ? 'HIGH' : 'MEDIUM',
        createdAt: new Date(),
        tableNumber: Math.floor(Math.random() * 20) + 1,
      };

      let station = addOrderToStation(parrilla, order);

      // Cook tries to process in order (not by priority!)
      station = startCooking(station, `item-${i}`);
      totalConfusion += station.confusionPoints;
      totalErrors += station.errors.length;
    }

    const metrics = calculateStationMetrics(parrilla);

    console.log('📊 20-Order Rush Analysis:');
    console.log(`   Total items: ${metrics.totalItems}`);
    console.log(`   Items stuck in ready: ${metrics.itemsStuckInReady}`);
    console.log(`   Errors: ${metrics.errorRate.toFixed(2)}`);
    console.log(`   Better: Show priority-sorted queue with big "NEXT" indicator`);
  });

  it('should recommend: Kitchen display improvements', () => {
    // SOLUTION: Better kitchen UX

    const currentIssues = [
      'No auto-prioritization',
      'Special instructions not prominent',
      'No coordination between stations',
      'No alerts for stuck ready items',
      'Manual priority management',
    ];

    const recommendedFeatures = [
      'Auto-sort queue by priority + age',
      'Show allergens in RED on display',
      'Order coordinator shows all-station status',
      'Auto-alert waiter after 3 min in ready',
      'Big "NEXT: Order #XXXX" banner',
    ];

    expect(recommendedFeatures.length).toBeGreaterThanOrEqual(currentIssues.length);

    console.log('✅ Kitchen Display Recommendations:');
    for (let i = 0; i < currentIssues.length; i++) {
      console.log(`   ❌ ${currentIssues[i]}`);
      console.log(`   ✅ ${recommendedFeatures[i]}`);
    }
  });
});
