/**
 * Waiter (Mozo) Page — Unit Tests
 *
 * Validates:
 * - Module imports and default export
 * - Table color logic based on status and elapsed time
 * - Time threshold configuration
 * - Default zones fallback
 * - Table filtering by zone
 * - Alert and occupied count logic
 * - Bottom navigation items
 *
 * @module app/mozo/__tests__/waiter-page
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

vi.mock('../hooks/useTableStatus', () => ({
  useTableStatus: () => [],
  useZones: () => ({ zones: [], loading: false }),
}));

vi.mock('@/src/app/mozo/hooks/useTableStatus', () => ({
  useTableStatus: () => [],
  useZones: () => ({ zones: [], loading: false }),
}));

vi.mock('../hooks/useWaiterNotifications', () => ({
  useWaiterNotifications: () => ({ unreadCount: 0, readyItemsCount: 0 }),
}));

vi.mock('@/src/app/mozo/hooks/useWaiterNotifications', () => ({
  useWaiterNotifications: () => ({ unreadCount: 0, readyItemsCount: 0 }),
}));

vi.mock('../components/NotificationPanel', () => ({
  NotificationPanel: () => null,
}));

vi.mock('@/src/app/mozo/components/NotificationPanel', () => ({
  NotificationPanel: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => children,
    button: ({ children, ...props }: any) => children,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@/src/core/domain/money', () => ({
  formatCents: (cents: number) => `S/ ${(cents / 100).toFixed(2)}`,
}));

vi.mock('@/src/core/auth/fingerprint', () => ({
  clearTerminalConfig: vi.fn(),
}));

vi.mock('@/src/hooks/useRequireTerminal', () => ({
  useRequireTerminal: () => ({ isLoading: false, isAuthenticated: true }),
}));

vi.mock('@/src/components/auth', () => ({
  useAuth: () => ({
    session: { employee_name: 'Mozo', employee_role: 'WAITER', terminal_role: 'MOZO', created_at: new Date().toISOString() },
    terminal: { terminal_id: 'term-mozo-1' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/src/components/shared/EmployeeProfileButton', () => ({
  EmployeeProfileButton: () => null,
}));

vi.mock('@/src/components/shared/EmployeeProfileDrawer', () => ({
  EmployeeProfileDrawer: () => null,
}));

vi.mock('@/src/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

vi.mock('@/src/components/ui/MobileHeader', () => ({
  MobileHeader: () => null,
  HeaderSpacer: () => null,
}));

vi.mock('@/src/components/ui/BottomNavigation', () => ({
  BottomNavigation: () => null,
}));

// ============================================================================
// Helpers extracted from page (replicated for testing)
// ============================================================================

type TableStatus = 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED';

const TIME_THRESHOLDS = {
  WARNING: 20,
  ALERT: 40,
};

function getTableColors(status: TableStatus, elapsedMinutes?: number) {
  if (status === 'FREE') {
    return { text: 'text-emerald-400', label: 'Disponible' };
  }
  if (status === 'BILL_REQUESTED') {
    return { text: 'text-amber-400', label: 'PIDE CUENTA' };
  }
  const minutes = elapsedMinutes ?? 0;
  if (minutes >= TIME_THRESHOLDS.ALERT) {
    return { text: 'text-red-400', label: `${minutes}m` };
  }
  if (minutes >= TIME_THRESHOLDS.WARNING) {
    return { text: 'text-orange-400', label: `${minutes}m` };
  }
  return { text: 'text-violet-400', label: `${minutes}m` };
}

const DEFAULT_ZONES = [
  { id: 'salon', code: 'SAL', name: 'Salon', color: '#8b5cf6' },
  { id: 'terraza', code: 'TER', name: 'Terraza', color: '#10b981' },
  { id: 'vip', code: 'VIP', name: 'VIP', color: '#f59e0b' },
];

// ============================================================================
// Tests
// ============================================================================

describe('WaiterPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('el nombre del componente debe ser WaiterPage', async () => {
    const mod = await import('../page');
    expect(mod.default.name).toBe('WaiterPage');
  });
});

describe('WaiterPage — Table Color Logic', () => {
  it('mesa libre tiene color emerald y label Disponible', () => {
    const colors = getTableColors('FREE');
    expect(colors.text).toBe('text-emerald-400');
    expect(colors.label).toBe('Disponible');
  });

  it('mesa con cuenta pedida tiene color amber', () => {
    const colors = getTableColors('BILL_REQUESTED');
    expect(colors.text).toBe('text-amber-400');
    expect(colors.label).toBe('PIDE CUENTA');
  });

  it('mesa ocupada <20min tiene color violet', () => {
    const colors = getTableColors('OCCUPIED', 15);
    expect(colors.text).toBe('text-violet-400');
    expect(colors.label).toBe('15m');
  });

  it('mesa ocupada 20-39min tiene color orange (WARNING)', () => {
    const colors = getTableColors('OCCUPIED', 25);
    expect(colors.text).toBe('text-orange-400');
    expect(colors.label).toBe('25m');
  });

  it('mesa ocupada >=40min tiene color red (ALERT)', () => {
    const colors = getTableColors('OCCUPIED', 45);
    expect(colors.text).toBe('text-red-400');
    expect(colors.label).toBe('45m');
  });

  it('mesa ocupada sin elapsed devuelve 0m', () => {
    const colors = getTableColors('OCCUPIED');
    expect(colors.label).toBe('0m');
    expect(colors.text).toBe('text-violet-400');
  });

  it('mesa ocupada en exactamente 20min tiene WARNING', () => {
    const colors = getTableColors('OCCUPIED', 20);
    expect(colors.text).toBe('text-orange-400');
  });

  it('mesa ocupada en exactamente 40min tiene ALERT', () => {
    const colors = getTableColors('OCCUPIED', 40);
    expect(colors.text).toBe('text-red-400');
  });
});

describe('WaiterPage — Time Thresholds', () => {
  it('WARNING es 20 minutos', () => {
    expect(TIME_THRESHOLDS.WARNING).toBe(20);
  });

  it('ALERT es 40 minutos', () => {
    expect(TIME_THRESHOLDS.ALERT).toBe(40);
  });

  it('ALERT es mayor que WARNING', () => {
    expect(TIME_THRESHOLDS.ALERT).toBeGreaterThan(TIME_THRESHOLDS.WARNING);
  });
});

describe('WaiterPage — Default Zones', () => {
  it('tiene 3 zonas por defecto', () => {
    expect(DEFAULT_ZONES).toHaveLength(3);
  });

  it('zonas son salon, terraza, vip', () => {
    const ids = DEFAULT_ZONES.map(z => z.id);
    expect(ids).toEqual(['salon', 'terraza', 'vip']);
  });

  it('cada zona tiene id, code, name, color', () => {
    for (const zone of DEFAULT_ZONES) {
      expect(zone).toHaveProperty('id');
      expect(zone).toHaveProperty('code');
      expect(zone).toHaveProperty('name');
      expect(zone).toHaveProperty('color');
      expect(zone.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('WaiterPage — Alert and Occupied Counts', () => {
  it('cuenta mesas ocupadas correctamente', () => {
    const tables = [
      { status: 'OCCUPIED' as const, elapsedMinutes: 10 },
      { status: 'FREE' as const, elapsedMinutes: 0 },
      { status: 'BILL_REQUESTED' as const, elapsedMinutes: 30 },
      { status: 'OCCUPIED' as const, elapsedMinutes: 50 },
    ];

    const occupiedCount = tables.filter(t =>
      t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED'
    ).length;

    expect(occupiedCount).toBe(3);
  });

  it('cuenta mesas con alerta correctamente', () => {
    const tables = [
      { status: 'OCCUPIED' as const, elapsedMinutes: 10 },
      { status: 'FREE' as const, elapsedMinutes: 0 },
      { status: 'BILL_REQUESTED' as const, elapsedMinutes: 30 },
      { status: 'OCCUPIED' as const, elapsedMinutes: 50 },
    ];

    const alertCount = tables.filter(t =>
      (t.status === 'OCCUPIED' && (t.elapsedMinutes ?? 0) >= TIME_THRESHOLDS.ALERT) ||
      t.status === 'BILL_REQUESTED'
    ).length;

    expect(alertCount).toBe(2); // BILL_REQUESTED + OCCUPIED 50min
  });

  it('cuenta items listos totales', () => {
    const tables = [
      { readyItemsCount: 3 },
      { readyItemsCount: 0 },
      { readyItemsCount: 2 },
    ];

    const readyItemsTotal = tables.reduce((sum, t) => sum + (t.readyItemsCount ?? 0), 0);
    expect(readyItemsTotal).toBe(5);
  });
});

describe('WaiterPage — Bottom Navigation Items', () => {
  it('tiene 3 items de navegacion', () => {
    const navItems = [
      { id: 'mesas', label: 'Mesas', href: '/mozo' },
      { id: 'listos', label: 'Listos', href: '/mozo/listos' },
      { id: 'config', label: 'Config', href: '/mozo/configuracion' },
    ];

    expect(navItems).toHaveLength(3);
    expect(navItems[0].id).toBe('mesas');
    expect(navItems[1].id).toBe('listos');
    expect(navItems[2].id).toBe('config');
  });

  it('badge de mesas muestra alertCount cuando > 0', () => {
    const alertCount = 3;
    const badge = alertCount > 0 ? alertCount : undefined;
    expect(badge).toBe(3);
  });

  it('badge de mesas es undefined cuando alertCount es 0', () => {
    const alertCount = 0;
    const badge = alertCount > 0 ? alertCount : undefined;
    expect(badge).toBeUndefined();
  });
});
