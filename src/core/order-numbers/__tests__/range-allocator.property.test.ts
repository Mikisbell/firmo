/**
 * Property-Based Tests: Range Allocator (Caja Crítico 3)
 *
 * Invariants:
 * 1. getNextOrderNumber returns strictly increasing numbers
 * 2. Two terminals never get overlapping ranges
 * 3. allocateRange is idempotent (same range on repeat calls)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";

// In-memory simulation of range allocator logic
// (Tests the invariants without needing a real DB)

interface RangeRecord {
    terminal_id: string;
    tenant_id: string;
    range_start: number;
    range_end: number;
    current_number: number;
}

const RANGE_SIZE = 10000;

class InMemoryRangeAllocator {
    private ranges: Map<string, RangeRecord> = new Map();

    private key(tenantId: string, terminalId: string) {
        return `${tenantId}:${terminalId}`;
    }

    allocateRange(tenantId: string, terminalId: string): RangeRecord {
        const k = this.key(tenantId, terminalId);
        const existing = this.ranges.get(k);
        if (existing) return existing;

        // Find max range_end for this tenant
        let maxEnd = 0;
        for (const [, r] of this.ranges) {
            if (r.tenant_id === tenantId && r.range_end > maxEnd) {
                maxEnd = r.range_end;
            }
        }

        const rangeStart = maxEnd + 1;
        const rangeEnd = rangeStart + RANGE_SIZE - 1;
        const record: RangeRecord = {
            terminal_id: terminalId,
            tenant_id: tenantId,
            range_start: rangeStart,
            range_end: rangeEnd,
            current_number: rangeStart,
        };

        this.ranges.set(k, record);
        return record;
    }

    getNextNumber(tenantId: string, terminalId: string): number {
        const k = this.key(tenantId, terminalId);
        const range = this.ranges.get(k);
        if (!range) throw new Error("No range allocated");
        if (range.current_number >= range.range_end) throw new Error("Range exhausted");
        range.current_number++;
        return range.current_number;
    }

    getAllRanges(tenantId: string): RangeRecord[] {
        return [...this.ranges.values()].filter(r => r.tenant_id === tenantId);
    }
}

describe("Range Allocator Property Tests (Caja C3)", () => {

    it("Invariant 1: getNextOrderNumber returns strictly increasing numbers (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 50 }), // how many numbers to get
                (count) => {
                    const allocator = new InMemoryRangeAllocator();
                    const tenantId = uuidv4();
                    const terminalId = "CAJA_1";

                    allocator.allocateRange(tenantId, terminalId);

                    const numbers: number[] = [];
                    for (let i = 0; i < count; i++) {
                        numbers.push(allocator.getNextNumber(tenantId, terminalId));
                    }

                    // INVARIANT: Each number is greater than the previous
                    for (let i = 1; i < numbers.length; i++) {
                        expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: Two terminals never get overlapping ranges (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 10 }), // number of terminals
                (terminalCount) => {
                    const allocator = new InMemoryRangeAllocator();
                    const tenantId = uuidv4();

                    // Allocate ranges for N terminals
                    const ranges: RangeRecord[] = [];
                    for (let i = 0; i < terminalCount; i++) {
                        ranges.push(allocator.allocateRange(tenantId, `TERM_${i}`));
                    }

                    // INVARIANT: No two ranges overlap
                    for (let i = 0; i < ranges.length; i++) {
                        for (let j = i + 1; j < ranges.length; j++) {
                            const a = ranges[i];
                            const b = ranges[j];
                            // Ranges overlap if a.start <= b.end AND b.start <= a.end
                            const overlaps = a.range_start <= b.range_end && b.range_start <= a.range_end;
                            expect(overlaps).toBe(false);
                        }
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: allocateRange is idempotent (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }), // number of calls
                (callCount) => {
                    const allocator = new InMemoryRangeAllocator();
                    const tenantId = uuidv4();
                    const terminalId = "CAJA_1";

                    // Call allocateRange multiple times
                    const results: RangeRecord[] = [];
                    for (let i = 0; i < callCount; i++) {
                        results.push(allocator.allocateRange(tenantId, terminalId));
                    }

                    // INVARIANT: All calls return the same range
                    const first = results[0];
                    for (const r of results) {
                        expect(r.range_start).toBe(first.range_start);
                        expect(r.range_end).toBe(first.range_end);
                        expect(r.terminal_id).toBe(first.terminal_id);
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 4: Numbers from different terminals never collide (100 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 5 }),  // terminals
                fc.integer({ min: 1, max: 20 }), // numbers per terminal
                (terminalCount, numbersPerTerminal) => {
                    const allocator = new InMemoryRangeAllocator();
                    const tenantId = uuidv4();

                    // Allocate ranges
                    for (let i = 0; i < terminalCount; i++) {
                        allocator.allocateRange(tenantId, `TERM_${i}`);
                    }

                    // Get numbers from each terminal
                    const allNumbers = new Set<number>();
                    let totalGenerated = 0;

                    for (let t = 0; t < terminalCount; t++) {
                        for (let n = 0; n < numbersPerTerminal; n++) {
                            const num = allocator.getNextNumber(tenantId, `TERM_${t}`);
                            allNumbers.add(num);
                            totalGenerated++;
                        }
                    }

                    // INVARIANT: All numbers are unique (no collisions)
                    expect(allNumbers.size).toBe(totalGenerated);
                }
            ),
            { numRuns: 100 }
        );
    });
});
