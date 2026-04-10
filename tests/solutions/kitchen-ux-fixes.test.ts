/**
 * Kitchen UX Fixes - Implementation
 * 
 * Solves 5 critical kitchen UX problems found through simulation testing:
 * 1. Station overload without prioritization → Auto-sort by priority + age
 * 2. Ready items not picked up → Auto-alert waiter after 3 min
 * 3. Special instructions not visible → Show allergens in RED
 * 4. Multi-station coordination confusing → Show all-station status
 * 5. Priority change mid-cooking → Show "VIP waiting" banner
 * 
 * Each fix includes validation tests.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Station = 'PARRILLA' | 'COCINA' | 'BAR' | 'FRIOS' | 'POSTRES';
type OrderStatus = 'PENDING' | 'COOKING' | 'READY' | 'SERVED' | 'VOIDED';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface KitchenItem {
  id: string;
  name: string;
  station: Station;
  status: OrderStatus;
  priority: Priority;
  specialInstructions?: string;
  hasAllergen?: boolean;
  queuedAt: Date;
  startedAt?: Date;
  readyAt?: Date;
}

interface KitchenOrder {
  id: string;
  orderNumber: number;
  items: KitchenItem[];
  tableNumber?: number;
  waiterName?: string;
}

interface StationState {
  name: Station;
  queue: KitchenItem[];
  cooking: KitchenItem[];
  ready: KitchenItem[];
  alerts: string[];
}

// ============================================================
// FIX 1: Auto-prioritize station queue by priority + age
// ============================================================

function prioritizeStationQueue(station: StationState): StationState {
  const priorityWeight: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  const sortItems = (items: KitchenItem[]) => {
    return [...items].sort((a, b) => {
      // First by priority
      const prioDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (prioDiff !== 0) return prioDiff;
      // Then by age (older first)
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });
  };

  return {
    ...station,
    queue: sortItems(station.queue),
    cooking: sortItems(station.cooking),
  };
}

// ============================================================
// FIX 2: Auto-alert waiter when item ready for 3+ minutes
// ============================================================

function checkReadyItemAlerts(station: StationState, now: Date = new Date()): {
  station: StationState;
  alerts: string[];
  itemsStuck: KitchenItem[];
} {
  const alerts: string[] = [];
  const itemsStuck: KitchenItem[] = [];

  for (const item of station.ready) {
    if (!item.readyAt) continue;

    const minutesReady = (now.getTime() - item.readyAt.getTime()) / (1000 * 60);

    if (minutesReady >= 3) {
      const alert = `⚠️ ${item.name} listo hace ${minutesReady.toFixed(0)} min - Notificar waiter`;
      alerts.push(alert);
      itemsStuck.push(item);
    }
  }

  return {
    station: {
      ...station,
      alerts: [...station.alerts, ...alerts],
    },
    alerts,
    itemsStuck,
  };
}

// ============================================================
// FIX 3: Highlight allergens in special instructions
// ============================================================

function detectAndHighlightAllergens(item: KitchenItem): KitchenItem & { allergenWarning?: string } {
  const allergenKeywords = ['alérgico', 'alergia', 'intolerancia', 'celíaco', 'sin gluten', 'sin picante'];
  
  if (!item.specialInstructions) {
    return { ...item };
  }

  const instructions = item.specialInstructions.toLowerCase();
  const hasAllergen = allergenKeywords.some(keyword => instructions.includes(keyword));

  if (hasAllergen) {
    return {
      ...item,
      hasAllergen: true,
      allergenWarning: '🔴 ALÉRGENO: ' + item.specialInstructions,
    };
  }

  return { ...item, hasAllergen: false };
}

// ============================================================
// FIX 4: Show multi-station coordination status
// ============================================================

function getMultiStationStatus(order: KitchenOrder, stations: StationState[]): {
  orderNumber: number;
  totalItems: number;
  itemsByStation: Record<Station, { total: number; ready: number; cooking: number; pending: number }>;
  allReady: boolean;
  waitingForStation?: Station;
  statusMessage: string;
} {
  const itemsByStation: Record<string, any> = {};

  for (const item of order.items) {
    if (!itemsByStation[item.station]) {
      itemsByStation[item.station] = { total: 0, ready: 0, cooking: 0, pending: 0 };
    }
    itemsByStation[item.station].total++;
    if (item.status === 'READY') itemsByStation[item.station].ready++;
    else if (item.status === 'COOKING') itemsByStation[item.station].cooking++;
    else if (item.status === 'PENDING') itemsByStation[item.station].pending++;
  }

  const totalItems = order.items.length;
  const readyItems = order.items.filter(i => i.status === 'READY').length;
  const allReady = readyItems === totalItems;

  // Find first station not ready
  let waitingForStation: Station | undefined;
  for (const [station, counts] of Object.entries(itemsByStation)) {
    if (counts.ready < counts.total) {
      waitingForStation = station as Station;
      break;
    }
  }

  const statusMessage = allReady
    ? `✅ Todos los items listos para servir`
    : `${readyItems}/${totalItems} items listos, esperando ${waitingForStation}`;

  return {
    orderNumber: order.orderNumber,
    totalItems,
    itemsByStation: itemsByStation as any,
    allReady,
    waitingForStation,
    statusMessage,
  };
}

// ============================================================
// FIX 5: Show VIP banner without interrupting cooking
// ============================================================

function handlePriorityChange(
  currentCookingItem: KitchenItem | null,
  vipOrder: KitchenOrder
): {
  interruptCooking: boolean;
  showVipBanner: boolean;
  vipMessage: string;
} {
  // Don't interrupt cooking - just show VIP banner
  return {
    interruptCooking: false,
    showVipBanner: true,
    vipMessage: `🔴 VIP Esperando: Orden #${vipOrder.orderNumber} - Mesa ${vipOrder.tableNumber}`,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('Kitchen UX Fixes', () => {

  // FIX 1: Auto-prioritize queue
  it('should auto-sort station queue by priority and age', () => {
    const station: StationState = {
      name: 'PARRILLA',
      queue: [
        { id: 'item-3', name: 'Pollo #3', station: 'PARRILLA', status: 'PENDING', priority: 'LOW', queuedAt: new Date(Date.now() - 5 * 60 * 1000) },
        { id: 'item-1', name: 'Pollo #1', station: 'PARRILLA', status: 'PENDING', priority: 'HIGH', queuedAt: new Date(Date.now() - 10 * 60 * 1000) },
        { id: 'item-2', name: 'Pollo #2', station: 'PARRILLA', status: 'PENDING', priority: 'MEDIUM', queuedAt: new Date(Date.now() - 7 * 60 * 1000) },
      ],
      cooking: [],
      ready: [],
      alerts: [],
    };

    const result = prioritizeStationQueue(station);

    expect(result.queue[0].priority).toBe('HIGH');
    expect(result.queue[1].priority).toBe('MEDIUM');
    expect(result.queue[2].priority).toBe('LOW');

    console.log('✅ Fix 1: Station queue prioritization');
    console.log(`   Queue order: ${result.queue.map(i => `${i.name} (${i.priority})`).join(' → ')}`);
  });

  // FIX 2: Ready item alerts
  it('should alert when items ready for 3+ minutes', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const station: StationState = {
      name: 'PARRILLA',
      queue: [],
      cooking: [],
      ready: [
        { id: 'item-1', name: 'Pollo Entero', station: 'PARRILLA', status: 'READY', priority: 'HIGH', queuedAt: new Date(), readyAt: fiveMinutesAgo },
      ],
      alerts: [],
    };

    const result = checkReadyItemAlerts(station);

    expect(result.itemsStuck.length).toBe(1);
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0]).toContain('listo hace');

    console.log('✅ Fix 2: Ready item alerts');
    console.log(`   Alerts: ${result.alerts.join(', ')}`);
  });

  // FIX 3: Allergen highlighting
  it('should detect and highlight allergens in special instructions', () => {
    const itemWithAllergen: KitchenItem = {
      id: 'item-1',
      name: 'Pollo Entero',
      station: 'PARRILLA',
      status: 'PENDING',
      priority: 'HIGH',
      queuedAt: new Date(),
      specialInstructions: 'SIN PICANTE - Cliente alérgico',
    };

    const result = detectAndHighlightAllergens(itemWithAllergen);

    expect(result.hasAllergen).toBe(true);
    expect(result.allergenWarning).toContain('ALÉRGENO');

    const itemWithoutAllergen: KitchenItem = {
      id: 'item-2',
      name: 'Papas Fritas',
      station: 'COCINA',
      status: 'PENDING',
      priority: 'MEDIUM',
      queuedAt: new Date(),
      specialInstructions: 'Extra crispy',
    };

    const result2 = detectAndHighlightAllergens(itemWithoutAllergen);
    expect(result2.hasAllergen).toBe(false);
    expect(result2.allergenWarning).toBeUndefined();

    console.log('✅ Fix 3: Allergen highlighting');
    console.log(`   With allergen: ${result.allergenWarning}`);
    console.log(`   Without allergen: No warning`);
  });

  // FIX 4: Multi-station coordination
  it('should show all-station status for multi-station orders', () => {
    const order: KitchenOrder = {
      id: 'order-1',
      orderNumber: 1001,
      items: [
        { id: 'item-1', name: 'Pollo Entero', station: 'PARRILLA', status: 'COOKING', priority: 'HIGH', queuedAt: new Date() },
        { id: 'item-2', name: 'Papas Fritas', station: 'COCINA', status: 'READY', priority: 'HIGH', queuedAt: new Date() },
        { id: 'item-3', name: 'Inca Kola', station: 'BAR', status: 'READY', priority: 'HIGH', queuedAt: new Date() },
      ],
      tableNumber: 5,
    };

    const result = getMultiStationStatus(order, []);

    expect(result.totalItems).toBe(3);
    expect(result.allReady).toBe(false);
    expect(result.waitingForStation).toBe('PARRILLA');
    expect(result.statusMessage).toContain('2/3 items listos');

    console.log('✅ Fix 4: Multi-station coordination');
    console.log(`   Status: ${result.statusMessage}`);
  });

  // FIX 5: VIP handling without interrupting cooking
  it('should show VIP banner without interrupting cooking', () => {
    const currentCookingItem: KitchenItem = {
      id: 'item-1',
      name: 'Pollo Entero',
      station: 'PARRILLA',
      status: 'COOKING',
      priority: 'MEDIUM',
      queuedAt: new Date(),
      startedAt: new Date(),
    };

    const vipOrder: KitchenOrder = {
      id: 'vip-order',
      orderNumber: 9999,
      items: [],
      tableNumber: 1,
    };

    const result = handlePriorityChange(currentCookingItem, vipOrder);

    expect(result.interruptCooking).toBe(false);
    expect(result.showVipBanner).toBe(true);
    expect(result.vipMessage).toContain('VIP Esperando');

    console.log('✅ Fix 5: VIP handling');
    console.log(`   Interrupt cooking: ${result.interruptCooking}`);
    console.log(`   Show VIP banner: ${result.showVipBanner}`);
    console.log(`   Message: ${result.vipMessage}`);
  });
});
