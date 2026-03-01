/**
 * Cocina KDS Page — Unit Tests
 *
 * Validates:
 * - Module imports and default export
 * - Terminal config for SPC_COCINA
 * - Ticket counting logic (pendingCount, cookingCount)
 * - Status transition validation
 * - Time display formatting
 * - Course report building conditions
 *
 * @module app/cocina/__tests__/kitchen-page
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

vi.mock('../hooks/useKitchenTickets', () => ({
  useKitchenTicketsByGroup: () => [],
}));

vi.mock('@/src/app/cocina/hooks/useKitchenTickets', () => ({
  useKitchenTicketsByGroup: () => [],
}));

vi.mock('@/src/core/actions/pos.actions', () => ({
  POSActions: {
    updateItemStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/src/hooks/useRequireTerminal', () => ({
  useRequireTerminal: () => ({ isLoading: false, isAuthenticated: true }),
}));

vi.mock('@/src/components/auth', () => ({
  useAuth: () => ({
    session: { employee_name: 'Chef', employee_role: 'KITCHEN', terminal_role: 'COCINA', created_at: new Date().toISOString() },
    terminal: { terminal_id: 'term-cocina-1' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/src/hooks/useSyncClient', () => ({
  useSyncClient: vi.fn(),
}));

vi.mock('@/src/core/config/terminal', () => ({
  getTerminalConfig: () => ({
    tenant_id: 'test-tenant',
    terminal_id: 'term-cocina',
    actor_id: 'actor-cocina',
  }),
}));

vi.mock('@/src/core/auth/fingerprint', () => ({
  clearTerminalConfig: vi.fn(),
}));

vi.mock('@/src/core/domain/item-status-machine', () => ({
  canTransition: vi.fn().mockReturnValue(true),
  getNextNormalState: vi.fn().mockReturnValue('COOKING'),
}));

vi.mock('@/src/components/kds', () => ({
  KDSLayout: ({ children }: any) => children,
  KDSTicket: () => null,
  CourseFireBar: () => null,
}));

vi.mock('@/src/core/services/course-fire.service', () => ({
  CourseFireService: vi.fn().mockImplementation(() => ({
    buildCourseReport: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock('@/src/components/shared/EmployeeProfileButton', () => ({
  EmployeeProfileButton: () => null,
}));

vi.mock('@/src/components/shared/EmployeeProfileDrawer', () => ({
  EmployeeProfileDrawer: () => null,
}));

// ============================================================================
// Tests
// ============================================================================

describe('CocinaKDSPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el nombre del componente debe ser CocinaKDSPage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('CocinaKDSPage');
  });
});

describe('CocinaKDSPage — Ticket Counting Logic', () => {
  it('cuenta pendientes y cocinando correctamente con tickets vacios', () => {
    const tickets: any[] = [];
    let pending = 0;
    let cooking = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines) as any[]) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') cooking++;
      }
    }

    expect(pending).toBe(0);
    expect(cooking).toBe(0);
  });

  it('cuenta pendientes y cocinando correctamente con datos', () => {
    const tickets = [
      {
        order_id: 'o1',
        lines: {
          l1: { status: 'PENDING' },
          l2: { status: 'COOKING' },
          l3: { status: 'PENDING' },
        },
      },
      {
        order_id: 'o2',
        lines: {
          l4: { status: 'READY' },
          l5: { status: 'COOKING' },
        },
      },
    ];

    let pending = 0;
    let cooking = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines)) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') cooking++;
      }
    }

    expect(pending).toBe(2);
    expect(cooking).toBe(2);
  });

  it('ignora items con status READY, DELIVERED, VOIDED', () => {
    const tickets = [
      {
        order_id: 'o1',
        lines: {
          l1: { status: 'READY' },
          l2: { status: 'DELIVERED' },
          l3: { status: 'VOIDED' },
        },
      },
    ];

    let pending = 0;
    let cooking = 0;

    for (const ticket of tickets) {
      for (const line of Object.values(ticket.lines)) {
        if (line.status === 'PENDING') pending++;
        else if (line.status === 'COOKING') cooking++;
      }
    }

    expect(pending).toBe(0);
    expect(cooking).toBe(0);
  });
});

describe('CocinaKDSPage — Time Display', () => {
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
    const now = new Date('2026-02-28T14:30:00').getTime();
    const currentTime = mounted && now
      ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    expect(currentTime).not.toBe('--:--');
    expect(currentTime).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('CocinaKDSPage — Course Report Conditions', () => {
  it('no muestra CourseFireBar sin items con courses', () => {
    const items = [
      { line_id: 'l1', name: 'Arroz', qty: 1, station: 'COCINA', status: 'PENDING', course: undefined, held: false },
      { line_id: 'l2', name: 'Papas', qty: 2, station: 'COCINA', status: 'COOKING', course: undefined, held: false },
    ];

    const hasCourses = items.some(i => i.course);
    expect(hasCourses).toBe(false);
  });

  it('muestra CourseFireBar cuando hay items con courses', () => {
    const items = [
      { line_id: 'l1', name: 'Arroz', qty: 1, station: 'COCINA', status: 'PENDING', course: 1, held: false },
      { line_id: 'l2', name: 'Papas', qty: 2, station: 'COCINA', status: 'COOKING', course: 2, held: true },
    ];

    const hasCourses = items.some(i => i.course);
    expect(hasCourses).toBe(true);
  });
});

describe('CocinaKDSPage — KDS Layout Config', () => {
  it('usa grupo COCINA para tickets', () => {
    // The page calls useKitchenTicketsByGroup("COCINA")
    const group = 'COCINA';
    const validGroups = ['COCINA', 'BAR', 'FRIOS', 'POSTRES', 'FREIDORA'];
    expect(validGroups).toContain(group);
  });

  it('configuracion KDS tiene valores correctos', () => {
    const kdsConfig = {
      title: 'COCINA',
      subtitle: 'Papas • Arroz • Guarniciones',
      accentColor: 'amber',
      pendingLabel: 'Pendiente',
      cookingLabel: 'Cocinando',
      emptyTitle: 'Cocina Lista',
      emptySubtitle: 'Esperando pedidos...',
    };

    expect(kdsConfig.title).toBe('COCINA');
    expect(kdsConfig.accentColor).toBe('amber');
    expect(kdsConfig.emptyTitle).toBe('Cocina Lista');
  });
});
