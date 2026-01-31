/**
 * Property 3: Table Organization by Zone
 * Validates: Requirements 2.2
 * 
 * For any table configuration, tables SHALL be correctly grouped by their 
 * zone attribute, and the zone filter SHALL return only tables belonging 
 * to that zone.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface Zone {
    id: string;
    code: string;
    name: string;
    color: string;
}

interface TableInfo {
    id: string;
    number: string;
    name: string;
    status: 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'PAID';
    zone?: Zone;
}

const zoneArb: fc.Arbitrary<Zone> = fc.record({
    id: fc.constantFrom('salon', 'terraza', 'vip', 'barra', 'patio'),
    code: fc.constantFrom('SAL', 'TER', 'VIP', 'BAR', 'PAT'),
    name: fc.constantFrom('Salon', 'Terraza', 'VIP', 'Barra', 'Patio'),
    color: fc.constantFrom('#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'),
});

function filterTablesByZone(tables: TableInfo[], zoneId: string | undefined): TableInfo[] {
    if (!zoneId) return tables;
    return tables.filter(t => t.zone?.id === zoneId);
}

function groupTablesByZone(tables: TableInfo[]): Map<string, TableInfo[]> {
    const groups = new Map<string, TableInfo[]>();
    for (const table of tables) {
        const zoneId = table.zone?.id || 'unassigned';
        const existing = groups.get(zoneId) || [];
        groups.set(zoneId, [...existing, table]);
    }
    return groups;
}

describe('Feature: waiter-module, Property 3: Table Organization by Zone', () => {
    describe('Zone Filtering', () => {
        it('should return only tables belonging to the selected zone', () => {
            fc.assert(
                fc.property(
                    zoneArb,
                    zoneArb,
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 5 }),
                    (zone1, zone2, count1, count2) => {
                        const z1 = { ...zone1, id: 'zone_a' };
                        const z2 = { ...zone2, id: 'zone_b' };
                        
                        const tables1: TableInfo[] = Array.from({ length: count1 }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone: z1,
                        }));
                        
                        const tables2: TableInfo[] = Array.from({ length: count2 }, (_, i) => ({
                            id: `M${i + 10}`,
                            number: String(i + 10),
                            name: `Mesa ${i + 10}`,
                            status: 'OCCUPIED' as const,
                            zone: z2,
                        }));
                        
                        const allTables = [...tables1, ...tables2];
                        
                        const filtered1 = filterTablesByZone(allTables, 'zone_a');
                        const filtered2 = filterTablesByZone(allTables, 'zone_b');
                        
                        expect(filtered1.length).toBe(count1);
                        expect(filtered2.length).toBe(count2);
                        expect(filtered1.every(t => t.zone?.id === 'zone_a')).toBe(true);
                        expect(filtered2.every(t => t.zone?.id === 'zone_b')).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return all tables when no zone is selected', () => {
            fc.assert(
                fc.property(
                    zoneArb,
                    fc.integer({ min: 1, max: 10 }),
                    (zone, count) => {
                        const tables: TableInfo[] = Array.from({ length: count }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone,
                        }));
                        
                        const filtered = filterTablesByZone(tables, undefined);
                        expect(filtered.length).toBe(count);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return empty array when zone has no tables', () => {
            fc.assert(
                fc.property(
                    zoneArb,
                    fc.integer({ min: 1, max: 10 }),
                    (zone, count) => {
                        const tables: TableInfo[] = Array.from({ length: count }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone,
                        }));
                        
                        const filtered = filterTablesByZone(tables, 'nonexistent_zone');
                        expect(filtered.length).toBe(0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Zone Grouping', () => {
        it('should correctly group all tables by their zone', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 5 }),
                    (count1, count2) => {
                        const zone1: Zone = { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' };
                        const zone2: Zone = { id: 'terraza', code: 'TER', name: 'Terraza', color: '#10b981' };
                        
                        const tables1: TableInfo[] = Array.from({ length: count1 }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone: zone1,
                        }));
                        
                        const tables2: TableInfo[] = Array.from({ length: count2 }, (_, i) => ({
                            id: `M${i + 20}`,
                            number: String(i + 20),
                            name: `Mesa ${i + 20}`,
                            status: 'OCCUPIED' as const,
                            zone: zone2,
                        }));
                        
                        const allTables = [...tables1, ...tables2];
                        const grouped = groupTablesByZone(allTables);
                        
                        let totalGrouped = 0;
                        grouped.forEach(tables => {
                            totalGrouped += tables.length;
                        });
                        
                        expect(totalGrouped).toBe(allTables.length);
                        expect(grouped.get('salon')?.length).toBe(count1);
                        expect(grouped.get('terraza')?.length).toBe(count2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure each table appears in exactly one zone group', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 10 }),
                    (count) => {
                        const zone: Zone = { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' };
                        
                        const tables: TableInfo[] = Array.from({ length: count }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone,
                        }));
                        
                        const grouped = groupTablesByZone(tables);
                        const seenTableIds = new Set<string>();
                        
                        grouped.forEach(zoneTables => {
                            for (const table of zoneTables) {
                                expect(seenTableIds.has(table.id)).toBe(false);
                                seenTableIds.add(table.id);
                            }
                        });
                        
                        expect(seenTableIds.size).toBe(count);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Zone Filter Consistency', () => {
        it('should maintain table properties after filtering', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 10 }),
                    (count) => {
                        const zone: Zone = { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' };
                        
                        const tables: TableInfo[] = Array.from({ length: count }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone,
                        }));
                        
                        const filtered = filterTablesByZone(tables, 'salon');
                        
                        for (const table of filtered) {
                            expect(table.id).toBeDefined();
                            expect(table.number).toBeDefined();
                            expect(table.name).toBeDefined();
                            expect(table.status).toBeDefined();
                            expect(table.zone).toBeDefined();
                            expect(table.zone?.id).toBe('salon');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should be idempotent - filtering twice gives same result', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 10 }),
                    (count) => {
                        const zone: Zone = { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' };
                        
                        const tables: TableInfo[] = Array.from({ length: count }, (_, i) => ({
                            id: `M${i + 1}`,
                            number: String(i + 1),
                            name: `Mesa ${i + 1}`,
                            status: 'FREE' as const,
                            zone,
                        }));
                        
                        const filtered1 = filterTablesByZone(tables, 'salon');
                        const filtered2 = filterTablesByZone(filtered1, 'salon');
                        
                        expect(filtered2.length).toBe(filtered1.length);
                        expect(filtered2).toEqual(filtered1);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty table list', () => {
            const emptyTables: TableInfo[] = [];
            const filtered = filterTablesByZone(emptyTables, 'any-zone');
            expect(filtered).toEqual([]);
        });

        it('should handle tables without zone assignment', () => {
            const tablesWithoutZone: TableInfo[] = [
                { id: 'M1', number: '1', name: 'Mesa 1', status: 'FREE' },
                { id: 'M2', number: '2', name: 'Mesa 2', status: 'OCCUPIED' },
            ];
            
            const filtered = filterTablesByZone(tablesWithoutZone, 'salon');
            expect(filtered).toEqual([]);
            
            const all = filterTablesByZone(tablesWithoutZone, undefined);
            expect(all.length).toBe(2);
        });

        it('should handle mixed tables (some with zone, some without)', () => {
            const zone: Zone = { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' };
            const mixedTables: TableInfo[] = [
                { id: 'M1', number: '1', name: 'Mesa 1', status: 'FREE', zone },
                { id: 'M2', number: '2', name: 'Mesa 2', status: 'OCCUPIED' },
                { id: 'M3', number: '3', name: 'Mesa 3', status: 'FREE', zone },
            ];
            
            const filtered = filterTablesByZone(mixedTables, 'salon');
            expect(filtered.length).toBe(2);
            expect(filtered.every(t => t.zone?.id === 'salon')).toBe(true);
        });
    });
});
