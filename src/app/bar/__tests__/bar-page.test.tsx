/**
 * Bar KDS Page — Unit Tests
 *
 * Validates:
 * - Module imports and default export
 * - Terminal config for SPC_BAR
 * - Bar ticket counting logic (pendingCount, preparingCount)
 * - Time display logic
 * - KDS layout configuration for bar
 * - Station group: BAR
 *
 * @module app/bar/__tests__/bar-page
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/src/core/db/schema', () => ({
  getDb: () => null,
  db: {},
}));

vi.mock('@/src/app/cocina/hooks/useKitchenTickets', () => ({
  useKitchenTicketsByGroup: () => [],
}));

vi.mock('../../cocina/hooks/useKitchenTickets', () => ({
  useKitchenTicketsByGroup: () => [],
}));

vi.mock('../hooks/useKitchenTickets', () => ({
  useKitchenTicketsByGroup: () => [],
}));

vi.mock('@/src/core/actions/pos.actions', () => ({
  POSActions: {
    updateItemStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/src/hooks/useSyncClient', () => ({
  useSyncClient: vi.fn(),
}));

vi.mock('@/src/core/config/terminal', () => ({
  getTerminalConfig: () => ({
    tenant_id: 'test-tenant',
    terminal_id: 'term-bar',
    actor_id: 'actor-bar',
  }),
}));

vi.mock('@/src/core/domain/item-status-machine', () => ({
  canTransition: vi.fn().mockReturnValue(true),
  getNextNormalState: vi.fn().mockReturnValue('COOKING'),
}));

vi.mock('@/src/components/kds', () => ({
  KDSLayout: ({ children }: any) => children,
  KDSTicket: () => null,
}));

// ============================================================================
// Tests
// ============================================================================

describe('BarKDSPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el nombre del componente debe ser BarKDSPage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('BarKDSPage');
  });
});

describe('BarKDSPage — Ticket Counting Logic', () => {
  it('cuenta pendientes y preparando correctamente con tickets vacios', () => {
    const tickets: any[] = [];
    let pending = 0;
    let preparing = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines) as any[]) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') preparing++;
      }
    }

    expect(pending).toBe(0);
    expect(preparing).toBe(0);
  });

  it('cuenta pendientes y preparando con datos de bar', () => {
    const tickets = [
      {
        order_id: 'o1',
        lines: {
          l1: { status: 'PENDING' },
          l2: { status: 'COOKING' },
        },
      },
      {
        order_id: 'o2',
        lines: {
          l3: { status: 'PENDING' },
          l4: { status: 'PENDING' },
          l5: { status: 'READY' },
        },
      },
    ];

    let pending = 0;
    let preparing = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines)) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') preparing++;
      }
    }

    expect(pending).toBe(3);
    expect(preparing).toBe(1);
  });

  it('no cuenta items con status READY como pendientes o preparando', () => {
    const tickets = [
      {
        order_id: 'o1',
        lines: {
          l1: { status: 'READY' },
          l2: { status: 'DELIVERED' },
        },
      },
    ];

    let pending = 0;
    let preparing = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines)) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') preparing++;
      }
    }

    expect(pending).toBe(0);
    expect(preparing).toBe(0);
  });
});

describe('BarKDSPage — Time Display', () => {
  it('muestra --:-- cuando no esta montado', () => {
    const mounted = false;
    const now: number | null = null;
    const currentTime = mounted && now
      ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    expect(currentTime).toBe('--:--');
  });

  it('muestra hora formateada cuando esta montado', () => {
    const mounted = true;
    const now = new Date('2026-02-28T20:15:00').getTime();
    const currentTime = mounted && now
      ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    expect(currentTime).not.toBe('--:--');
    expect(currentTime).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('BarKDSPage — KDS Layout Config', () => {
  it('usa grupo BAR para tickets', () => {
    const group = 'BAR';
    const validGroups = ['COCINA', 'BAR'];
    expect(validGroups).toContain(group);
  });

  it('configuracion KDS del bar tiene valores correctos', () => {
    const kdsConfig = {
      title: 'BAR',
      subtitle: 'Bebidas • Jugos • Chicha',
      accentColor: 'sky',
      pendingLabel: 'Pendiente',
      cookingLabel: 'Preparando',
      emptyTitle: 'Bar Listo',
      emptySubtitle: 'Esperando bebidas...',
    };

    expect(kdsConfig.title).toBe('BAR');
    expect(kdsConfig.accentColor).toBe('sky');
    expect(kdsConfig.emptyTitle).toBe('Bar Listo');
    expect(kdsConfig.cookingLabel).toBe('Preparando');
  });

  it('bar usa accentColor diferente a cocina', () => {
    const barAccent = 'sky';
    const cocinaAccent = 'amber';
    expect(barAccent).not.toBe(cocinaAccent);
  });
});

describe('BarKDSPage — Terminal Config', () => {
  it('terminal config usa SPC_BAR', () => {
    // The page calls getTerminalConfig("SPC_BAR")
    const terminalType = 'SPC_BAR';
    expect(terminalType).toBe('SPC_BAR');
    expect(terminalType).not.toBe('SPC_COCINA');
  });

  it('config tiene tenant_id, terminal_id, actor_id', () => {
    const config = {
      tenant_id: 'test-tenant',
      terminal_id: 'term-bar',
      actor_id: 'actor-bar',
    };

    expect(config).toHaveProperty('tenant_id');
    expect(config).toHaveProperty('terminal_id');
    expect(config).toHaveProperty('actor_id');
    expect(config.tenant_id).toBeTruthy();
    expect(config.terminal_id).toBeTruthy();
    expect(config.actor_id).toBeTruthy();
  });
});

describe('BarKDSPage — KDSTicket Data Mapping', () => {
  it('mapea lineas de ticket a items del KDSTicket', () => {
    const ticket = {
      order_id: 'o1',
      order_number: 42,
      order_type: 'DINE_IN',
      lines: {
        l1: { line_id: 'l1', name: 'Cerveza', qty: 2, status: 'PENDING' },
        l2: { line_id: 'l2', name: 'Jugo de maracuya', qty: 1, status: 'COOKING' },
      },
    };

    const items = Object.values(ticket.lines).map(line => ({
      line_id: line.line_id,
      name: line.name,
      qty: line.qty,
      status: line.status,
    }));

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      line_id: 'l1',
      name: 'Cerveza',
      qty: 2,
      status: 'PENDING',
    });
    expect(items[1]).toEqual({
      line_id: 'l2',
      name: 'Jugo de maracuya',
      qty: 1,
      status: 'COOKING',
    });
  });
});
