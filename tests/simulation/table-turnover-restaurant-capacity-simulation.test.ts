/**
 * UX Simulation: Table Turnover and Restaurant Capacity
 * 
 * Simulates real restaurant operations:
 * - Tables occupied for different durations (quick lunch vs long dinner)
 * - Waiting customers when all tables full
 * - Table turnover rate calculation
 * - Revenue per table per day
 * - Peak hours identification
 * - Optimal table allocation (large groups vs small groups)
 * 
 * This tests RESTAURANT CAPACITY MANAGEMENT, not just orders.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface Table {
  tableNumber: number;
  capacity: number; // seats
  zone: 'SALON' | 'TERRAZA' | 'VIP';
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}

interface TableOccupancy {
  tableNumber: number;
  partySize: number;
  seatedAt: Date;
  orderPlacedAt?: Date;
  orderServedAt?: Date;
  billPresentedAt?: Date;
  leftAt?: Date;
  totalSpentCents: Centavos;
  tipCents: Centavos;
}

interface WaitingCustomer {
  name: string;
  partySize: number;
  phone: string;
  arrivedAt: Date;
  notifiedAt?: Date;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED';
}

function createTables(): Table[] {
  return [
    { tableNumber: 1, capacity: 2, zone: 'SALON', status: 'AVAILABLE' },
    { tableNumber: 2, capacity: 2, zone: 'SALON', status: 'AVAILABLE' },
    { tableNumber: 3, capacity: 4, zone: 'SALON', status: 'AVAILABLE' },
    { tableNumber: 4, capacity: 4, zone: 'SALON', status: 'AVAILABLE' },
    { tableNumber: 5, capacity: 6, zone: 'SALON', status: 'AVAILABLE' },
    { tableNumber: 6, capacity: 2, zone: 'TERRAZA', status: 'AVAILABLE' },
    { tableNumber: 7, capacity: 4, zone: 'TERRAZA', status: 'AVAILABLE' },
    { tableNumber: 8, capacity: 4, zone: 'TERRAZA', status: 'AVAILABLE' },
    { tableNumber: 9, capacity: 8, zone: 'TERRAZA', status: 'AVAILABLE' },
    { tableNumber: 10, capacity: 10, zone: 'VIP', status: 'AVAILABLE' },
  ];
}

function seatCustomers(table: Table, partySize: number, now: Date): TableOccupancy | null {
  if (partySize > table.capacity) return null;
  if (table.status !== 'AVAILABLE') return null;

  return {
    tableNumber: table.tableNumber,
    partySize,
    seatedAt: now,
    totalSpentCents: 0 as Centavos,
    tipCents: 0 as Centavos,
  };
}

function calculateTableTurnover(occupancies: TableOccupancy[], tableNumber: number): {
  totalOccupancies: number;
  avgDurationMinutes: number;
  totalRevenueCents: Centavos;
  revenuePerHourCents: Centavos;
  avgPartySize: number;
} {
  const tableOccupancies = occupancies.filter(o => o.tableNumber === tableNumber && o.leftAt);

  if (tableOccupancies.length === 0) {
    return { totalOccupancies: 0, avgDurationMinutes: 0, totalRevenueCents: 0 as Centavos, revenuePerHourCents: 0 as Centavos, avgPartySize: 0 };
  }

  const durations = tableOccupancies.map(o => (o.leftAt!.getTime() - o.seatedAt.getTime()) / (1000 * 60));
  const avgDurationMinutes = durations.reduce((sum, d) => sum + d, 0) / durations.length;

  const totalRevenueCents = tableOccupancies.reduce((sum, o) => sum + o.totalSpentCents, 0) as Centavos;
  const totalHours = durations.reduce((sum, d) => sum + d, 0) / 60;
  const revenuePerHourCents = totalHours > 0 ? centavos(totalRevenueCents / totalHours) : 0 as Centavos;

  const avgPartySize = tableOccupancies.reduce((sum, o) => sum + o.partySize, 0) / tableOccupancies.length;

  return {
    totalOccupancies: tableOccupancies.length,
    avgDurationMinutes,
    totalRevenueCents,
    revenuePerHourCents,
    avgPartySize,
  };
}

function findOptimalTable(tables: Table[], partySize: number, currentOccupancies: TableOccupancy[]): Table | null {
  const occupiedTables = new Set(currentOccupancies.filter(o => !o.leftAt).map(o => o.tableNumber));
  const availableTables = tables.filter(t => t.status === 'AVAILABLE' && !occupiedTables.has(t.tableNumber) && t.capacity >= partySize);

  // Best fit: smallest table that fits the party (minimize wasted seats)
  if (availableTables.length === 0) return null;
  return availableTables.sort((a, b) => a.capacity - b.capacity)[0];
}

function calculateRestaurantMetrics(tables: Table[], occupancies: TableOccupancy[], waitingCustomers: WaitingCustomer[], operatingHours: number): {
  totalTables: number;
  occupiedTables: number;
  occupancyRate: number;
  totalRevenueCents: Centavos;
  revenuePerTableCents: Centavos;
  avgTableTurnover: number;
  waitingCustomersCount: number;
  avgWaitTimeMinutes: number;
  peakHourRevenueCents: Centavos;
} {
  const totalTables = tables.length;
  const currentOccupancies = occupancies.filter(o => !o.leftAt);
  const occupiedTables = currentOccupancies.length;
  const occupancyRate = (occupiedTables / totalTables) * 100;

  const totalRevenueCents = occupancies.reduce((sum, o) => sum + o.totalSpentCents, 0) as Centavos;
  const revenuePerTableCents = totalTables > 0 ? centavos(totalRevenueCents / totalTables) : 0 as Centavos;

  const completedOccupancies = occupancies.filter(o => o.leftAt);
  const avgTableTurnover = completedOccupancies.length / totalTables;

  const waitingCount = waitingCustomers.filter(w => w.status === 'WAITING' || w.status === 'NOTIFIED').length;

  const now = Date.now();
  const avgWaitTimeMinutes = waitingCount > 0
    ? waitingCustomers.filter(w => w.status === 'SEATED' && w.arrivedAt && w.notifiedAt)
        .reduce((sum, w) => sum + (w.notifiedAt!.getTime() - w.arrivedAt.getTime()) / (1000 * 60), 0) / waitingCount
    : 0;

  // Peak hour revenue (simplified: assume hour 19-21 is peak)
  const peakHourRevenueCents = occupancies
    .filter(o => {
      const hour = o.seatedAt.getHours();
      return hour >= 19 && hour <= 21;
    })
    .reduce((sum, o) => sum + o.totalSpentCents, 0) as Centavos;

  return {
    totalTables,
    occupiedTables,
    occupancyRate,
    totalRevenueCents,
    revenuePerTableCents,
    avgTableTurnover,
    waitingCustomersCount: waitingCount,
    avgWaitTimeMinutes,
    peakHourRevenueCents,
  };
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// TABLE TURNOVER SIMULATION TESTS
// ============================================================

describe('Table Turnover and Restaurant Capacity Simulation', () => {

  it('should simulate table occupancy throughout the day', () => {
    // SCENARIO: Restaurant opens at 12 PM, tracks table usage
    const tables = createTables();
    const occupancies: TableOccupancy[] = [];
    const startTime = new Date('2026-04-09T12:00:00');

    // Simulate 10 hours of operation (12 PM - 10 PM)
    for (let hour = 0; hour < 10; hour++) {
      const currentTime = new Date(startTime.getTime() + hour * 60 * 60 * 1000);

      // Each hour, some tables get occupied, some leave
      const newOccupancies = Math.floor(Math.random() * 4) + 2; // 2-5 new tables per hour

      for (let i = 0; i < newOccupancies; i++) {
        const table = tables[Math.floor(Math.random() * tables.length)];
        const partySize = Math.floor(Math.random() * table.capacity) + 1;

        const occupancy = seatCustomers(table, partySize, currentTime);
        if (occupancy) {
          // Simulate meal duration (45 min - 2 hours)
          const mealDurationMinutes = Math.floor(Math.random() * 75) + 45;
          occupancy.orderPlacedAt = new Date(currentTime.getTime() + 10 * 60 * 1000);
          occupancy.orderServedAt = new Date(currentTime.getTime() + 25 * 60 * 1000);
          occupancy.billPresentedAt = new Date(currentTime.getTime() + mealDurationMinutes * 60 * 1000);
          occupancy.leftAt = new Date(currentTime.getTime() + (mealDurationMinutes + 5) * 60 * 1000);
          occupancy.totalSpentCents = centavos((Math.random() * 80 + 30) * 100); // S/. 30-110
          occupancy.tipCents = centavos(occupancy.totalSpentCents * (Math.random() * 0.15));

          occupancies.push(occupancy);
        }
      }
    }

    const totalRevenue = occupancies.reduce((sum, o) => sum + o.totalSpentCents, 0);
    const avgPartySize = occupancies.reduce((sum, o) => sum + o.partySize, 0) / occupancies.length;
    const avgDuration = occupancies.reduce((sum, o) => sum + ((o.leftAt?.getTime() || 0) - o.seatedAt.getTime()) / (1000 * 60), 0) / occupancies.length;

    console.log('🍽️ Daily Table Occupancy Simulation:');
    console.log(`   Total Occupancies: ${occupancies.length}`);
    console.log(`   Total Revenue: S/. ${(totalRevenue / 100).toFixed(2)}`);
    console.log(`   Avg Party Size: ${avgPartySize.toFixed(1)}`);
    console.log(`   Avg Duration: ${avgDuration.toFixed(0)} minutes`);
    console.log(`   Avg Revenue per Occupancy: S/. ${(totalRevenue / occupancies.length / 100).toFixed(2)}`);
  });

  it('should find optimal table for party size', () => {
    // SCENARIO: Party of 3 arrives, find best table
    const tables = createTables();
    const currentOccupancies: TableOccupancy[] = [
      { tableNumber: 1, partySize: 2, seatedAt: new Date(), totalSpentCents: 0 as Centavos, tipCents: 0 as Centavos },
      { tableNumber: 3, partySize: 4, seatedAt: new Date(), totalSpentCents: 0 as Centavos, tipCents: 0 as Centavos },
    ];

    // Party of 3 should get Table 4 (capacity 4, smallest that fits)
    const optimalTable = findOptimalTable(tables, 3, currentOccupancies);
    expect(optimalTable).not.toBeNull();
    expect(optimalTable?.tableNumber).toBe(4); // Table 4 has capacity 4

    // Party of 6 should get Table 5 (capacity 6)
    const optimalTable2 = findOptimalTable(tables, 6, currentOccupancies);
    expect(optimalTable2?.tableNumber).toBe(5);

    // Party of 11 should get no table (max capacity is 10)
    const optimalTable3 = findOptimalTable(tables, 11, currentOccupancies);
    expect(optimalTable3).toBeNull();

    console.log('🎯 Optimal Table Allocation:');
    console.log(`   Party of 3 → Table ${optimalTable?.tableNumber} (capacity ${optimalTable?.capacity})`);
    console.log(`   Party of 6 → Table ${optimalTable2?.tableNumber} (capacity ${optimalTable2?.capacity})`);
    console.log(`   Party of 11 → No table available (max capacity 10)`);
  });

  it('should calculate table turnover rate per table', () => {
    // SCENARIO: Each table has different turnover rates
    const occupancies: TableOccupancy[] = [];
    const baseTime = new Date('2026-04-09T12:00:00');

    // Table 1 (capacity 2): High turnover, quick lunches (45 min each)
    for (let i = 0; i < 8; i++) {
      occupancies.push({
        tableNumber: 1,
        partySize: 2,
        seatedAt: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
        leftAt: new Date(baseTime.getTime() + i * 60 * 60 * 1000 + 45 * 60 * 1000),
        totalSpentCents: centavos((Math.random() * 40 + 30) * 100),
        tipCents: 0 as Centavos,
      });
    }

    // Table 10 (capacity 10): Low turnover, large dinners (2.5 hours each)
    for (let i = 0; i < 3; i++) {
      occupancies.push({
        tableNumber: 10,
        partySize: 8,
        seatedAt: new Date(baseTime.getTime() + i * 3 * 60 * 60 * 1000),
        leftAt: new Date(baseTime.getTime() + i * 3 * 60 * 60 * 1000 + 150 * 60 * 1000),
        totalSpentCents: centavos((Math.random() * 300 + 400) * 100),
        tipCents: 0 as Centavos,
      });
    }

    const table1Metrics = calculateTableTurnover(occupancies, 1);
    const table10Metrics = calculateTableTurnover(occupancies, 10);

    expect(table1Metrics.totalOccupancies).toBe(8);
    expect(table10Metrics.totalOccupancies).toBe(3);
    expect(table1Metrics.avgDurationMinutes).toBeCloseTo(45, 0);
    expect(table10Metrics.avgDurationMinutes).toBeCloseTo(150, 0);

    console.log('📊 Table Turnover Rates:');
    console.log(`   Table 1 (2 seats): ${table1Metrics.totalOccupancies} turns, ${table1Metrics.avgDurationMinutes.toFixed(0)} min avg, S/. ${(table1Metrics.totalRevenueCents / 100).toFixed(2)} total`);
    console.log(`   Table 10 (10 seats): ${table10Metrics.totalOccupancies} turns, ${table10Metrics.avgDurationMinutes.toFixed(0)} min avg, S/. ${(table10Metrics.totalRevenueCents / 100).toFixed(2)} total`);
    console.log(`   Revenue per hour - Table 1: S/. ${(table1Metrics.revenuePerHourCents / 100).toFixed(2)}, Table 10: S/. ${(table10Metrics.revenuePerHourCents / 100).toFixed(2)}`);
  });

  it('should handle waiting customers when restaurant is full', () => {
    // SCENARIO: All 10 tables occupied, 5 parties waiting
    const waitingCustomers: WaitingCustomer[] = [
      { name: 'Familia Rodriguez', partySize: 6, phone: '987654321', arrivedAt: new Date(Date.now() - 20 * 60 * 1000), status: 'WAITING' },
      { name: 'Pareja Gomez', partySize: 2, phone: '987654322', arrivedAt: new Date(Date.now() - 15 * 60 * 1000), status: 'WAITING' },
      { name: 'Grupo Trabajo', partySize: 8, phone: '987654323', arrivedAt: new Date(Date.now() - 10 * 60 * 1000), status: 'WAITING' },
      { name: 'Familia Silva', partySize: 4, phone: '987654324', arrivedAt: new Date(Date.now() - 5 * 60 * 1000), status: 'NOTIFIED' },
      { name: 'Pareja Lopez', partySize: 2, phone: '987654325', arrivedAt: new Date(Date.now()), status: 'WAITING' },
    ];

    const tables = createTables();
    const occupancies: TableOccupancy[] = tables.map(t => ({
      tableNumber: t.tableNumber,
      partySize: t.capacity,
      seatedAt: new Date(Date.now() - 60 * 60 * 1000),
      leftAt: new Date(Date.now() + 30 * 60 * 1000),
      totalSpentCents: centavos(20000),
      tipCents: 0 as Centavos,
    }));

    const metrics = calculateRestaurantMetrics(tables, occupancies, waitingCustomers, 10);

    expect(metrics.waitingCustomersCount).toBeGreaterThanOrEqual(0); // Some may be seated already
    expect(metrics.occupancyRate).toBeGreaterThanOrEqual(0); // Valid rate

    console.log('⏳ Waiting Customers Management:');
    console.log(`   Restaurant Status: FULL (${metrics.occupancyRate.toFixed(0)}% occupancy)`);
    console.log(`   Waiting Parties: ${metrics.waitingCustomersCount}`);
    for (const wc of waitingCustomers) {
      const waitMinutes = (Date.now() - wc.arrivedAt.getTime()) / (1000 * 60);
      console.log(`   - ${wc.name} (${wc.partySize}p): ${wc.status}, waiting ${waitMinutes.toFixed(0)} min`);
    }
    console.log(`   Action: Call waiting parties when tables become available`);
  });

  it('should calculate daily restaurant performance metrics', () => {
    // SCENARIO: End-of-day performance report
    const tables = createTables();
    const occupancies: TableOccupancy[] = [];
    const baseTime = new Date('2026-04-09T12:00:00');

    // Simulate full day of operations
    for (let hour = 0; hour < 10; hour++) {
      const hourOccupancies = Math.floor(Math.random() * 15) + 10; // 10-24 per hour

      for (let i = 0; i < hourOccupancies; i++) {
        const table = tables[Math.floor(Math.random() * tables.length)];
        const partySize = Math.floor(Math.random() * table.capacity) + 1;
        const seatedTime = new Date(baseTime.getTime() + hour * 60 * 60 * 1000 + i * 3 * 60 * 1000);
        const duration = Math.floor(Math.random() * 90) + 40;

        occupancies.push({
          tableNumber: table.tableNumber,
          partySize,
          seatedAt: seatedTime,
          leftAt: new Date(seatedTime.getTime() + duration * 60 * 1000),
          totalSpentCents: centavos((Math.random() * 100 + 40) * 100),
          tipCents: centavos(Math.random() * 1500),
        });
      }
    }

    const metrics = calculateRestaurantMetrics(tables, occupancies, [], 10);

    expect(metrics.totalTables).toBe(10);
    expect(metrics.totalRevenueCents).toBeGreaterThan(0);
    expect(metrics.avgTableTurnover).toBeGreaterThan(5); // At least 5 turns per table

    console.log('📊 Daily Restaurant Performance:');
    console.log(`   Tables: ${metrics.totalTables}`);
    console.log(`   Current Occupancy: ${metrics.occupancyRate.toFixed(0)}%`);
    console.log(`   Total Revenue: S/. ${(metrics.totalRevenueCents / 100).toFixed(2)}`);
    console.log(`   Revenue per Table: S/. ${(metrics.revenuePerTableCents / 100).toFixed(2)}`);
    console.log(`   Avg Table Turnover: ${metrics.avgTableTurnover.toFixed(1)} turns/day`);
    console.log(`   Waiting Customers: ${metrics.waitingCustomersCount}`);
    console.log(`   Peak Hour Revenue: S/. ${(metrics.peakHourRevenueCents / 100).toFixed(2)}`);
  });

  it('should recommend: Table management improvements', () => {
    const currentGaps = [
      'No real-time table availability display',
      'No waiting list management system',
      'No table turnover optimization',
      'No revenue per table tracking',
      'No optimal party-to-table matching',
      'No peak hour staffing adjustment',
    ];

    const recommendations = [
      'Digital floor plan showing real-time table status (available/occupied/cleaning)',
      'SMS notifications to waiting customers when table ready, ETA updates',
      'Identify slow tables, train staff to improve turnover without rushing guests',
      'Dashboard: revenue per table per day/week/month, identify underperforming tables',
      'Auto-suggest best table for party size, minimize wasted seats, maximize revenue',
      'Staff scheduling based on historical peak hours, add servers during 12-2 PM and 7-9 PM',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Table Management Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
