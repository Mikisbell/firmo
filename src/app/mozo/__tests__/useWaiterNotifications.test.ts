// @vitest-environment jsdom
/**
 * useWaiterNotifications — Unit Tests
 *
 * Validates:
 * - ITEM_READY: fetched from /api/pos/ready-items (one per item, lineId always set)
 * - REQUEST_CHECK: rebuilt from Dexie events
 * - Polling on mount, cleanup on unmount
 * - markAsRead toggles read state
 * - refreshReadyItems re-fetches from server
 * - Offline fallback (fetch failure → empty ITEM_READY list)
 * - Merged notifications sorted by timestamp desc
 *
 * @module app/mozo/__tests__/useWaiterNotifications.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEvents: any[] = [];
const mockLiveQuery = vi.fn();

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => Promise<any>) => {
    mockLiveQuery(fn);
    return mockEvents;
  },
}));

vi.mock('@/src/core/db/schema', () => ({
  db: {
    events: {
      where: () => ({ equals: () => ({ toArray: async () => mockEvents }) }),
    },
  },
}));

const mockConfig = vi.fn();
vi.mock('@/src/core/auth/fingerprint', () => ({
  getStoredTerminalConfig: () => mockConfig(),
}));

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ORDER_ID  = '00000000-0000-0000-0000-000000000020';

function mockTerminal() {
  mockConfig.mockReturnValue({ tenant_id: TENANT_ID, terminal_id: 'TERM-1', actor_id: 'ACTOR-1' });
}

function readyItemsResponse(items: any[] = []) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => items,
  });
}

function makeReadyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(),
    order_id: ORDER_ID,
    line_id: `line-${Math.random().toString(36).slice(2, 8)}`,
    table_number: '5',
    name: '1/4 Pollo',
    qty: 1,
    station: 'HORNO',
    status: 'READY',
    notes: null,
    ready_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWaiterNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvents.length = 0;
    mockTerminal();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty notifications on mount when no items ready and no events', async () => {
    readyItemsResponse([]);
    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.readyItemsCount).toBe(0);
  });

  it('creates one ITEM_READY notification per server row (lineId always set)', async () => {
    const rows = [makeReadyRow({ line_id: 'line-A' }), makeReadyRow({ line_id: 'line-B', name: 'Bisteck', station: 'PARRILLA' })];
    readyItemsResponse(rows);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));

    const notifs = result.current.notifications;
    expect(notifs.every(n => n.type === 'ITEM_READY')).toBe(true);
    // lineId ALWAYS present — this was the key limitation before
    expect(notifs.every(n => n.lineId !== undefined)).toBe(true);
    expect(notifs.map(n => n.lineId)).toContain('line-A');
    expect(notifs.map(n => n.lineId)).toContain('line-B');
  });

  it('markAsRead toggles read flag without re-fetching', async () => {
    const row = makeReadyRow({ line_id: 'line-X' });
    readyItemsResponse([row]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(1));
    const notifId = result.current.notifications[0].id;
    expect(result.current.notifications[0].read).toBe(false);

    act(() => result.current.markAsRead(notifId));
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('readyItemsCount counts only unread ITEM_READY notifications', async () => {
    const rows = [makeReadyRow({ line_id: 'a' }), makeReadyRow({ line_id: 'b' }), makeReadyRow({ line_id: 'c' })];
    readyItemsResponse(rows);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.readyItemsCount).toBe(3));

    act(() => result.current.markAsRead(result.current.notifications[0].id));
    expect(result.current.readyItemsCount).toBe(2);
  });

  it('refreshReadyItems re-fetches from server', async () => {
    readyItemsResponse([makeReadyRow({ line_id: 'first' })]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(1));
    expect(mockFetch).toHaveBeenCalledOnce();

    readyItemsResponse([makeReadyRow({ line_id: 'updated-1' }), makeReadyRow({ line_id: 'updated-2' })]);
    await act(() => result.current.refreshReadyItems());

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.notifications.length).toBe(2);
  });

  it('falls back to empty ITEM_READY list when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // Should not crash — ITEM_READY is empty, no throw
    const itemReadyNotifs = result.current.notifications.filter(n => n.type === 'ITEM_READY');
    expect(itemReadyNotifs).toHaveLength(0);
  });

  it('sends x-tenant-id header in fetch request', async () => {
    readyItemsResponse([]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/pos/ready-items');
    expect((options as RequestInit).headers).toMatchObject({ 'x-tenant-id': TENANT_ID });
  });

  it('polls every 10 seconds', async () => {
    vi.useFakeTimers();
    readyItemsResponse([]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    renderHook(() => useWaiterNotifications());

    // Flush the initial fetch (microtask)
    await act(async () => { await Promise.resolve(); });
    expect(mockFetch).toHaveBeenCalledOnce();

    // Advance 10s — second poll
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await act(async () => { await Promise.resolve(); });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance another 10s — third poll
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await act(async () => { await Promise.resolve(); });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('does not fetch when terminal config is missing', async () => {
    mockConfig.mockReturnValue(null);
    readyItemsResponse([]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    renderHook(() => useWaiterNotifications());

    // Wait a tick — should not call fetch
    await act(async () => { await Promise.resolve(); });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('notifications sorted by timestamp descending', async () => {
    const now = Date.now();
    const rows = [
      makeReadyRow({ line_id: 'old', ready_at: new Date(now - 5000).toISOString() }),
      makeReadyRow({ line_id: 'new', ready_at: new Date(now - 1000).toISOString() }),
    ];
    readyItemsResponse(rows);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));
    const timestamps = result.current.notifications.map(n => n.timestamp.getTime());
    expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
  });

  it('markAllAsRead marks all notifications as read', async () => {
    readyItemsResponse([makeReadyRow({ line_id: 'a' }), makeReadyRow({ line_id: 'b' })]);

    const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
    const { result } = renderHook(() => useWaiterNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));
    act(() => result.current.markAllAsRead());
    expect(result.current.notifications.every(n => n.read)).toBe(true);
    expect(result.current.readyItemsCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('useWaiterNotifications property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminal();
  });

  it('invariant: readyItemsCount === unread ITEM_READY notifications count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            line_id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            station: fc.constantFrom('HORNO', 'PARRILLA', 'BAR', 'COCINA'),
          }),
          { minLength: 0, maxLength: 8 },
        ),
        async (items) => {
          const rows = items.map((item, i) => makeReadyRow({
            line_id: `prop-${i}-${item.line_id}`,
            name: item.name,
            station: item.station,
          }));
          mockFetch.mockResolvedValue({ ok: true, json: async () => rows });

          const { useWaiterNotifications } = await import('../hooks/useWaiterNotifications');
          const { result } = renderHook(() => useWaiterNotifications());

          await waitFor(() => expect(result.current.notifications.length).toBe(rows.length));

          const manualCount = result.current.notifications.filter(n => n.type === 'ITEM_READY' && !n.read).length;
          expect(result.current.readyItemsCount).toBe(manualCount);
        },
      ),
      { numRuns: 30 },
    );
  });
});
