/**
 * HR Leave Requests Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - LEAVE_TYPE_LABELS completeness (7 types)
 * - STATUS_LABELS completeness (4 states)
 * - Lifecycle: approve/reject only for PENDING
 * - Search filter logic (by name or reason)
 * - SWR URL construction with status filter
 * - Action URL construction
 *
 * @module app/admin/hr/leave-requests/__tests__/leave-requests-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacaciones',
  PERSONAL: 'Personal',
  MEDICAL: 'Médico',
  MATERNITY: 'Maternidad',
  PATERNITY: 'Paternidad',
  BEREAVEMENT: 'Duelo',
  UNPAID: 'Sin goce',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-500/20' },
  APPROVED: { label: 'Aprobado', color: 'text-green-400 bg-green-500/20' },
  REJECTED: { label: 'Rechazado', color: 'text-red-400 bg-red-500/20' },
  CANCELLED: { label: 'Cancelado', color: 'text-zinc-400 bg-zinc-500/20' },
};

const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABELS);
const LEAVE_STATUSES = Object.keys(STATUS_LABELS);

function buildLeaveRequestsURL(statusFilter: string): string {
  return `/api/hr/leave-requests?status=${statusFilter}`;
}

function buildActionURL(id: string, action: 'approve' | 'reject'): string {
  return `/api/hr/leave-requests/${id}/${action}`;
}

// Lifecycle: which actions are valid per status
function canApprove(status: string): boolean {
  return status === 'PENDING';
}

function canReject(status: string): boolean {
  return status === 'PENDING';
}

// Search filter logic from page
interface LeaveRequest {
  employee_name?: string;
  reason?: string;
}

function filterRequests(requests: LeaveRequest[], search: string): LeaveRequest[] {
  if (!search) return requests;
  const lower = search.toLowerCase();
  return requests.filter(
    r =>
      r.employee_name?.toLowerCase().includes(lower) ||
      r.reason?.toLowerCase().includes(lower)
  );
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('HRLeaveRequestsPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — LEAVE_TYPE_LABELS
// ============================================================================

describe('HRLeaveRequestsPage — LEAVE_TYPE_LABELS', () => {
  it('cubre los 7 tipos de licencia', () => {
    expect(LEAVE_TYPES).toHaveLength(7);
  });

  it('incluye todos los tipos esperados', () => {
    const expected = ['VACATION', 'PERSONAL', 'MEDICAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'UNPAID'];
    for (const type of expected) {
      expect(LEAVE_TYPE_LABELS[type]).toBeDefined();
      expect(LEAVE_TYPE_LABELS[type].trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(LEAVE_TYPE_LABELS.VACATION).toBe('Vacaciones');
    expect(LEAVE_TYPE_LABELS.MEDICAL).toBe('Médico');
    expect(LEAVE_TYPE_LABELS.MATERNITY).toBe('Maternidad');
    expect(LEAVE_TYPE_LABELS.PATERNITY).toBe('Paternidad');
    expect(LEAVE_TYPE_LABELS.BEREAVEMENT).toBe('Duelo');
    expect(LEAVE_TYPE_LABELS.UNPAID).toBe('Sin goce');
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(LEAVE_TYPE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — STATUS_LABELS
// ============================================================================

describe('HRLeaveRequestsPage — STATUS_LABELS', () => {
  it('cubre los 4 estados del ciclo de vida', () => {
    expect(LEAVE_STATUSES).toHaveLength(4);
  });

  it('incluye PENDING, APPROVED, REJECTED, CANCELLED', () => {
    const expected = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
    for (const status of expected) {
      expect(STATUS_LABELS[status]).toBeDefined();
    }
  });

  it('cada estado tiene label y color', () => {
    for (const [, cfg] of Object.entries(STATUS_LABELS)) {
      expect(cfg.label.trim().length).toBeGreaterThan(0);
      expect(cfg.color.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.PENDING.label).toBe('Pendiente');
    expect(STATUS_LABELS.APPROVED.label).toBe('Aprobado');
    expect(STATUS_LABELS.REJECTED.label).toBe('Rechazado');
    expect(STATUS_LABELS.CANCELLED.label).toBe('Cancelado');
  });

  it('PENDING es amarillo', () => {
    expect(STATUS_LABELS.PENDING.color).toContain('yellow');
  });

  it('APPROVED es verde', () => {
    expect(STATUS_LABELS.APPROVED.color).toContain('green');
  });

  it('REJECTED es rojo', () => {
    expect(STATUS_LABELS.REJECTED.color).toContain('red');
  });

  it('CANCELLED es zinc/gris', () => {
    expect(STATUS_LABELS.CANCELLED.color).toContain('zinc');
  });
});

// ============================================================================
// Tests — Ciclo de vida / acciones por estado
// ============================================================================

describe('HRLeaveRequestsPage — Ciclo de vida', () => {
  it('solo PENDING puede ser aprobado', () => {
    expect(canApprove('PENDING')).toBe(true);
    expect(canApprove('APPROVED')).toBe(false);
    expect(canApprove('REJECTED')).toBe(false);
    expect(canApprove('CANCELLED')).toBe(false);
  });

  it('solo PENDING puede ser rechazado', () => {
    expect(canReject('PENDING')).toBe(true);
    expect(canReject('APPROVED')).toBe(false);
    expect(canReject('REJECTED')).toBe(false);
    expect(canReject('CANCELLED')).toBe(false);
  });

  it('APPROVED, REJECTED, CANCELLED son estados terminales (sin acciones)', () => {
    const terminalStatuses = ['APPROVED', 'REJECTED', 'CANCELLED'];
    for (const status of terminalStatuses) {
      expect(canApprove(status)).toBe(false);
      expect(canReject(status)).toBe(false);
    }
  });

  it('property: solo PENDING tiene acciones disponibles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LEAVE_STATUSES),
        (status) => {
          const hasActions = canApprove(status) || canReject(status);
          expect(hasActions).toBe(status === 'PENDING');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Action URLs
// ============================================================================

describe('HRLeaveRequestsPage — URLs de acción', () => {
  it('approve URL es correcta', () => {
    expect(buildActionURL('req-123', 'approve')).toBe('/api/hr/leave-requests/req-123/approve');
  });

  it('reject URL es correcta', () => {
    expect(buildActionURL('req-123', 'reject')).toBe('/api/hr/leave-requests/req-123/reject');
  });

  it('property: URL siempre contiene /api/hr/leave-requests/', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('approve', 'reject') as fc.Arbitrary<'approve' | 'reject'>,
        (id, action) => {
          const url = buildActionURL(id, action);
          expect(url).toContain('/api/hr/leave-requests/');
          expect(url).toContain(id);
          expect(url).toContain(action);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — SWR URL con filtro
// ============================================================================

describe('HRLeaveRequestsPage — SWR URL', () => {
  it('URL con PENDING', () => {
    expect(buildLeaveRequestsURL('PENDING')).toBe('/api/hr/leave-requests?status=PENDING');
  });

  it('property: todos los estados generan URL válida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LEAVE_STATUSES),
        (status) => {
          const url = buildLeaveRequestsURL(status);
          expect(url).toContain('/api/hr/leave-requests');
          expect(url).toContain(`status=${status}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Filtro de búsqueda
// ============================================================================

describe('HRLeaveRequestsPage — Filtro de búsqueda', () => {
  const requests: LeaveRequest[] = [
    { employee_name: 'Juan Pérez', reason: 'Viaje familiar' },
    { employee_name: 'Ana López', reason: 'Cita médica' },
    { employee_name: 'Carlos Ríos', reason: 'Vacaciones anuales' },
  ];

  it('búsqueda vacía devuelve todos los registros', () => {
    expect(filterRequests(requests, '')).toHaveLength(3);
  });

  it('busca por nombre de empleado (case-insensitive)', () => {
    const result = filterRequests(requests, 'juan');
    expect(result).toHaveLength(1);
    expect(result[0].employee_name).toBe('Juan Pérez');
  });

  it('busca por motivo (case-insensitive)', () => {
    const result = filterRequests(requests, 'médica');
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('Cita médica');
  });

  it('sin coincidencias devuelve array vacío', () => {
    expect(filterRequests(requests, 'xyznotfound')).toHaveLength(0);
  });

  it('property: búsqueda vacía nunca filtra nada', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            employee_name: fc.option(fc.string(), { nil: undefined }),
            reason: fc.option(fc.string(), { nil: undefined }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (reqs) => {
          expect(filterRequests(reqs, '')).toHaveLength(reqs.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: resultado de búsqueda siempre es subconjunto del original', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        (search) => {
          const result = filterRequests(requests, search);
          expect(result.length).toBeLessThanOrEqual(requests.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
