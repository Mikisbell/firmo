/**
 * Unit Tests: Cocina KDS - Lógica de Negocio
 *
 * Valida:
 * - Priorización de pedidos (antigüedad + tipo)
 * - Flujo de estados: PENDING → COOKING → READY → DONE
 * - Tiempos de preparación y SLA
 * - Distribución por estaciones (PARRILLA, COCINA, BAR)
 * - Métricas de cocina
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Tipos y constantes
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type OrderStatus = 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED';
type OrderType = 'DINE_IN' | 'TAKE_OUT' | 'DELIVERY';
type Station = 'PARRILLA' | 'COCINA' | 'BAR' | 'HORNO' | 'FRIOS' | 'POSTRES' | 'EMPAQUE';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface OrderItem {
  lineId: string;
  name: string;
  station: Station;
  quantity: number;
  status: OrderStatus;
  startedAt?: string;
  readyAt?: string;
}

interface KitchenOrder {
  orderId: string;
  orderNumber: number;
  orderType: OrderType;
  items: OrderItem[];
  createdAt: string;
  priority: Priority;
}

interface StationMetrics {
  station: Station;
  ordersCompleted: number;
  avgCookingTimeMinutes: number;
  slaBreaches: number;
}

// ============================================================
// Funciones puras de negocio
// ============================================================

/**
 * Determina prioridad del pedido
 * TAKE_OUT > DINE_IN > DELIVERY (entregas pueden esperar)
 * Pedidos más antiguos tienen mayor prioridad
 */
function determineOrderPriority(order: KitchenOrder, now?: Date): Priority {
  const referenceDate = now || new Date();
  const ageMinutes = (referenceDate.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60);

  if (order.orderType === 'TAKE_OUT' && ageMinutes > 10) return 'HIGH';
  if (order.orderType === 'DINE_IN' && ageMinutes > 15) return 'HIGH';
  if (ageMinutes > 20) return 'HIGH';
  if (ageMinutes > 5) return 'MEDIUM';
  return 'LOW';
}

/**
 * Ordena pedidos para cocina por prioridad
 */
function prioritizeOrders(orders: KitchenOrder[], now?: Date): KitchenOrder[] {
  const priorityWeight: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  
  return [...orders].sort((a, b) => {
    const priorityA = determineOrderPriority(a, now);
    const priorityB = determineOrderPriority(b, now);
    
    // Primero por prioridad
    if (priorityWeight[priorityA] !== priorityWeight[priorityB]) {
      return priorityWeight[priorityB] - priorityWeight[priorityA];
    }
    
    // Luego por antigüedad (más antiguo primero)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Calcula tiempo de preparación de un item
 */
function calculateCookingTimeMinutes(startedAt: string, readyAt: string): number {
  const start = new Date(startedAt).getTime();
  const ready = new Date(readyAt).getTime();
  return Math.round((ready - start) / (1000 * 60));
}

/**
 * Verifica si se cumplió el SLA de preparación
 * SLA: 25 minutos máximo
 */
function checkSLACompliance(cookingTimeMinutes: number, slaMinutes: number = 25): boolean {
  return cookingTimeMinutes <= slaMinutes;
}

/**
 * Calcula métricas de estación
 */
function calculateStationMetrics(
  station: Station,
  completedOrders: Array<{ cookingTimeMinutes: number; slaBreached: boolean }>
): StationMetrics {
  const totalOrders = completedOrders.length;
  const slaBreaches = completedOrders.filter(o => o.slaBreached).length;
  const avgCookingTime = totalOrders > 0
    ? completedOrders.reduce((sum, o) => sum + o.cookingTimeMinutes, 0) / totalOrders
    : 0;

  return {
    station,
    ordersCompleted: totalOrders,
    avgCookingTimeMinutes: Math.round(avgCookingTime * 100) / 100,
    slaBreaches,
  };
}

/**
 * Transición de estado válida
 */
function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    'PENDING': ['COOKING', 'VOIDED'],
    'COOKING': ['READY', 'VOIDED'],
    'READY': ['DONE', 'VOIDED'],
    'DONE': [],
    'VOIDED': [],
  };

  return validTransitions[from]?.includes(to) || false;
}

/**
 * Agrupa items por estación
 */
function groupItemsByStation(items: OrderItem[]): Map<Station, OrderItem[]> {
  const grouped = new Map<Station, OrderItem[]>();
  
  for (const item of items) {
    const existing = grouped.get(item.station) || [];
    existing.push(item);
    grouped.set(item.station, existing);
  }

  return grouped;
}

// ============================================================
// TESTS
// ============================================================

describe('Kitchen KDS - Business Logic', () => {

  // ----------------------------------------------------------
  // determineOrderPriority
  // ----------------------------------------------------------

  describe('determineOrderPriority', () => {

    it('should return HIGH for TAKE_OUT older than 10 min', () => {
      const order: KitchenOrder = {
        orderId: '1',
        orderNumber: 101,
        orderType: 'TAKE_OUT',
        items: [],
        createdAt: '2026-04-09T12:00:00',
        priority: 'LOW',
      };

      const priority = determineOrderPriority(order, new Date('2026-04-09T12:15:00'));
      expect(priority).toBe('HIGH');
    });

    it('should return HIGH for DINE_IN older than 15 min', () => {
      const order: KitchenOrder = {
        orderId: '2',
        orderNumber: 102,
        orderType: 'DINE_IN',
        items: [],
        createdAt: '2026-04-09T12:00:00',
        priority: 'LOW',
      };

      const priority = determineOrderPriority(order, new Date('2026-04-09T12:20:00'));
      expect(priority).toBe('HIGH');
    });

    it('should return MEDIUM for orders older than 5 min', () => {
      const order: KitchenOrder = {
        orderId: '3',
        orderNumber: 103,
        orderType: 'DINE_IN',
        items: [],
        createdAt: '2026-04-09T12:00:00',
        priority: 'LOW',
      };

      const priority = determineOrderPriority(order, new Date('2026-04-09T12:08:00'));
      expect(priority).toBe('MEDIUM');
    });

    it('should return LOW for recent orders', () => {
      const order: KitchenOrder = {
        orderId: '4',
        orderNumber: 104,
        orderType: 'DINE_IN',
        items: [],
        createdAt: '2026-04-09T12:00:00',
        priority: 'LOW',
      };

      const priority = determineOrderPriority(order, new Date('2026-04-09T12:03:00'));
      expect(priority).toBe('LOW');
    });
  });

  // ----------------------------------------------------------
  // prioritizeOrders
  // ----------------------------------------------------------

  describe('prioritizeOrders', () => {

    it('should prioritize HIGH priority orders first', () => {
      const now = new Date('2026-04-09T12:30:00');
      const orders: KitchenOrder[] = [
        { orderId: '1', orderNumber: 101, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T12:25:00', priority: 'LOW' },
        { orderId: '2', orderNumber: 102, orderType: 'TAKE_OUT', items: [], createdAt: '2026-04-09T12:10:00', priority: 'LOW' },
        { orderId: '3', orderNumber: 103, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T12:20:00', priority: 'LOW' },
      ];

      const prioritized = prioritizeOrders(orders, now);

      expect(prioritized.map(o => o.orderNumber)).toEqual([102, 103, 101]);
    });

    it('should sort by age within same priority', () => {
      const now = new Date('2026-04-09T12:05:00');
      const orders: KitchenOrder[] = [
        { orderId: '1', orderNumber: 101, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T12:02:00', priority: 'LOW' },
        { orderId: '2', orderNumber: 102, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T12:00:00', priority: 'LOW' },
      ];

      const prioritized = prioritizeOrders(orders, now);

      expect(prioritized.map(o => o.orderNumber)).toEqual([102, 101]);
    });

    it('should handle empty orders', () => {
      expect(prioritizeOrders([])).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // calculateCookingTimeMinutes
  // ----------------------------------------------------------

  describe('calculateCookingTimeMinutes', () => {

    it('should calculate cooking time correctly', () => {
      const minutes = calculateCookingTimeMinutes(
        '2026-04-09T12:00:00',
        '2026-04-09T12:25:00'
      );

      expect(minutes).toBe(25);
    });

    it('should handle short cooking times', () => {
      const minutes = calculateCookingTimeMinutes(
        '2026-04-09T12:00:00',
        '2026-04-09T12:05:30'
      );

      expect(minutes).toBe(6); // 5.5 rounds to 6
    });
  });

  // ----------------------------------------------------------
  // checkSLACompliance
  // ----------------------------------------------------------

  describe('checkSLACompliance', () => {

    it('should return true for cooking time within SLA', () => {
      expect(checkSLACompliance(20)).toBe(true);
      expect(checkSLACompliance(25)).toBe(true);
    });

    it('should return false for cooking time exceeding SLA', () => {
      expect(checkSLACompliance(26)).toBe(false);
      expect(checkSLACompliance(45)).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // calculateStationMetrics
  // ----------------------------------------------------------

  describe('calculateStationMetrics', () => {

    it('should calculate correct metrics', () => {
      const completedOrders = [
        { cookingTimeMinutes: 20, slaBreached: false },
        { cookingTimeMinutes: 30, slaBreached: true },
        { cookingTimeMinutes: 25, slaBreached: false },
      ];

      const metrics = calculateStationMetrics('PARRILLA', completedOrders);

      expect(metrics.station).toBe('PARRILLA');
      expect(metrics.ordersCompleted).toBe(3);
      expect(metrics.avgCookingTimeMinutes).toBe(25); // (20+30+25)/3
      expect(metrics.slaBreaches).toBe(1);
    });

    it('should handle no completed orders', () => {
      const metrics = calculateStationMetrics('BAR', []);

      expect(metrics.ordersCompleted).toBe(0);
      expect(metrics.avgCookingTimeMinutes).toBe(0);
      expect(metrics.slaBreaches).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // isValidStatusTransition
  // ----------------------------------------------------------

  describe('isValidStatusTransition', () => {

    it('should allow valid forward transitions', () => {
      expect(isValidStatusTransition('PENDING', 'COOKING')).toBe(true);
      expect(isValidStatusTransition('COOKING', 'READY')).toBe(true);
      expect(isValidStatusTransition('READY', 'DONE')).toBe(true);
    });

    it('should allow VOIDED from any non-terminal state', () => {
      expect(isValidStatusTransition('PENDING', 'VOIDED')).toBe(true);
      expect(isValidStatusTransition('COOKING', 'VOIDED')).toBe(true);
      expect(isValidStatusTransition('READY', 'VOIDED')).toBe(true);
    });

    it('should reject backward transitions', () => {
      expect(isValidStatusTransition('DONE', 'READY')).toBe(false);
      expect(isValidStatusTransition('READY', 'COOKING')).toBe(false);
      expect(isValidStatusTransition('COOKING', 'PENDING')).toBe(false);
    });

    it('should reject transitions from terminal states', () => {
      expect(isValidStatusTransition('DONE', 'PENDING')).toBe(false);
      expect(isValidStatusTransition('VOIDED', 'PENDING')).toBe(false);
    });

    it('should reject skipping states', () => {
      expect(isValidStatusTransition('PENDING', 'READY')).toBe(false);
      expect(isValidStatusTransition('PENDING', 'DONE')).toBe(false);
      expect(isValidStatusTransition('COOKING', 'DONE')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // groupItemsByStation
  // ----------------------------------------------------------

  describe('groupItemsByStation', () => {

    it('should group items by station', () => {
      const items: OrderItem[] = [
        { lineId: '1', name: 'Pollo Entero', station: 'PARRILLA', quantity: 1, status: 'PENDING' },
        { lineId: '2', name: 'Inca Kola', station: 'BAR', quantity: 2, status: 'PENDING' },
        { lineId: '3', name: 'Papas Fritas', station: 'COCINA', quantity: 1, status: 'PENDING' },
        { lineId: '4', name: '1/2 Pollo', station: 'PARRILLA', quantity: 1, status: 'PENDING' },
      ];

      const grouped = groupItemsByStation(items);

      expect(grouped.get('PARRILLA')).toHaveLength(2);
      expect(grouped.get('BAR')).toHaveLength(1);
      expect(grouped.get('COCINA')).toHaveLength(1);
    });

    it('should handle empty items', () => {
      const grouped = groupItemsByStation([]);
      expect(grouped.size).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Escenarios reales
  // ----------------------------------------------------------

  describe('Real business scenarios', () => {

    it('should handle: Cocina recibe múltiples pedidos en hora punta', () => {
      const now = new Date('2026-04-09T20:00:00');
      const orders: KitchenOrder[] = [
        { orderId: '1', orderNumber: 101, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T19:40:00', priority: 'LOW' },
        { orderId: '2', orderNumber: 102, orderType: 'TAKE_OUT', items: [], createdAt: '2026-04-09T19:45:00', priority: 'LOW' },
        { orderId: '3', orderNumber: 103, orderType: 'DINE_IN', items: [], createdAt: '2026-04-09T19:50:00', priority: 'LOW' },
        { orderId: '4', orderNumber: 104, orderType: 'DELIVERY', items: [], createdAt: '2026-04-09T19:55:00', priority: 'LOW' },
      ];

      const prioritized = prioritizeOrders(orders, now);

      // Order #101 tiene 20 min → HIGH
      // Order #102 tiene 15 min y es TAKE_OUT → HIGH
      // Order #103 tiene 10 min → MEDIUM
      // Order #104 tiene 5 min → LOW
      expect(prioritized[0].orderNumber).toBe(101);
      expect(prioritized[1].orderNumber).toBe(102);
    });

    it('should handle: Item tarda más del SLA', () => {
      const cookingTime = calculateCookingTimeMinutes(
        '2026-04-09T12:00:00',
        '2026-04-09T12:35:00' // 35 minutos
      );

      const slaOk = checkSLACompliance(cookingTime, 25);

      expect(cookingTime).toBe(35);
      expect(slaOk).toBe(false);
    });

    it('should handle: Métricas de estación al final del turno', () => {
      // PARRILLA: 15 pedidos completados
      const parrillaOrders = [
        { cookingTimeMinutes: 20, slaBreached: false },
        { cookingTimeMinutes: 25, slaBreached: false },
        { cookingTimeMinutes: 30, slaBreached: true },
        { cookingTimeMinutes: 22, slaBreached: false },
        { cookingTimeMinutes: 28, slaBreached: true },
      ];

      const metrics = calculateStationMetrics('PARRILLA', parrillaOrders);

      expect(metrics.ordersCompleted).toBe(5);
      expect(metrics.avgCookingTimeMinutes).toBe(25); // (20+25+30+22+28)/5
      expect(metrics.slaBreaches).toBe(2);
    });

    it('should handle: Pedido con items en múltiples estaciones', () => {
      const items: OrderItem[] = [
        { lineId: '1', name: 'Pollo Entero', station: 'PARRILLA', quantity: 1, status: 'PENDING' },
        { lineId: '2', name: 'Inca Kola 1.5L', station: 'BAR', quantity: 2, status: 'PENDING' },
        { lineId: '3', name: 'Papas Fritas Grande', station: 'COCINA', quantity: 1, status: 'PENDING' },
      ];

      const grouped = groupItemsByStation(items);

      expect(grouped.size).toBe(3);
      expect(grouped.get('PARRILLA')).toHaveLength(1);
      expect(grouped.get('BAR')).toHaveLength(1);
      expect(grouped.get('COCINA')).toHaveLength(1);
    });
  });
});
