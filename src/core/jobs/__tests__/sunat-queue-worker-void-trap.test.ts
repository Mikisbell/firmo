/**
 * SunatQueueWorker — VOID billing trap (bug dinero/legal)
 *
 * Bug: resolveInvoiceItems filtraba items anulados leyendo order.items[].status,
 * pero ese JSON queda CONGELADO en la creacion: el void (ORDER_ITEM_VOIDED) hace
 * DELETE en order_item_projections y nunca escribe 'VOIDED' en el JSON. Resultado:
 * el filtro nunca filtraba -> se FACTURABAN items anulados a SUNAT.
 *
 * Fix: obtener voidedLineIds desde el event store (events.findMany WHERE
 * type='ORDER_ITEM_VOIDED' AND entity_id=order.id AND tenant_id=invoice.tenant_id)
 * y excluirlos en AMBOS caminos (check.lines y fallback).
 *
 * @module core/jobs/__tests__/sunat-queue-worker-void-trap.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SunatQueueWorker } from '../sunat-queue-worker';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const ORDER_ID = '770e8400-e29b-41d4-a716-446655440003';

/**
 * Construye un prisma minimo cuyo events.findMany devuelve los VOID indicados.
 * voidedLineIds: line_ids que tienen un evento ORDER_ITEM_VOIDED en el store.
 */
function makePrismaWithVoids(voidedLineIds: string[]) {
  return {
    events: {
      findMany: vi.fn().mockResolvedValue(
        voidedLineIds.map((line_id) => ({
          payload: { order_id: ORDER_ID, line_id, reason: 'Cliente cancelo' },
        })),
      ),
    },
  };
}

/**
 * Invoice con order.items[] que incluye un item cuyo status quedo congelado en
 * el valor de creacion (NUNCA 'VOIDED', reproduciendo el bug real).
 * withCheckLines=true incluye check.lines que referencian TODAS las lineas
 * (camino check.lines); false fuerza el fallback (sin check.lines).
 */
function makeInvoice(withCheckLines: boolean) {
  const items = [
    { line_id: 'line-valida', name: 'Pollo a la brasa', qty: 1, unit_price_cents: 1000, sku: 'POLLO-01', status: 'CONFIRMED' },
    { line_id: 'line-anulada', name: 'Gaseosa', qty: 1, unit_price_cents: 500, sku: 'GAS-01', status: 'CONFIRMED' },
  ];

  const order: any = {
    id: ORDER_ID,
    items,
    customers: null,
  };

  if (withCheckLines) {
    order.checks = [
      {
        check_id: 'check-001',
        lines: [
          { line_id: 'line-valida', qty: 1 },
          { line_id: 'line-anulada', qty: 1 },
        ],
      },
    ];
  } else {
    order.checks = [];
  }

  return {
    id: 'inv-001',
    tenant_id: TENANT_ID,
    invoice_type: 'BOLETA',
    total_cents: 1180,
    created_at: new Date('2026-06-23'),
    check_id: withCheckLines ? 'check-001' : 'no-check',
    customer: null,
    orders: order,
  };
}

// Acceso al metodo privado para tests unitarios directos.
function resolve(worker: SunatQueueWorker, invoice: any) {
  return (worker as any).resolveInvoiceItems(invoice);
}

// ============================================================================
// Tests
// ============================================================================

describe('SunatQueueWorker - VOID billing trap', () => {
  let worker: SunatQueueWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('camino check.lines', () => {
    it('NO debe facturar una linea anulada (evento ORDER_ITEM_VOIDED)', async () => {
      const prisma = makePrismaWithVoids(['line-anulada']);
      worker = new SunatQueueWorker(prisma as any, {} as any);

      const items = await resolve(worker, makeInvoice(true));
      const codigos = items.map((i: any) => i.codigo);

      expect(codigos).toContain('POLLO-01');
      expect(codigos).not.toContain('GAS-01');
      expect(items).toHaveLength(1);
    });

    it('consulta el event store con tenant_id del invoice y entity_id de la orden', async () => {
      const prisma = makePrismaWithVoids(['line-anulada']);
      worker = new SunatQueueWorker(prisma as any, {} as any);

      await resolve(worker, makeInvoice(true));

      expect(prisma.events.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            type: 'ORDER_ITEM_VOIDED',
            entity_id: ORDER_ID,
          }),
        }),
      );
    });
  });

  describe('camino fallback (sin check.lines)', () => {
    it('NO debe facturar una linea anulada (evento ORDER_ITEM_VOIDED)', async () => {
      const prisma = makePrismaWithVoids(['line-anulada']);
      worker = new SunatQueueWorker(prisma as any, {} as any);

      const items = await resolve(worker, makeInvoice(false));
      const codigos = items.map((i: any) => i.codigo);

      expect(codigos).toContain('POLLO-01');
      expect(codigos).not.toContain('GAS-01');
      expect(items).toHaveLength(1);
    });
  });

  describe('regresion: items validos SI se facturan', () => {
    it('sin eventos VOID, todas las lineas se incluyen (camino check.lines)', async () => {
      const prisma = makePrismaWithVoids([]); // ningun void
      worker = new SunatQueueWorker(prisma as any, {} as any);

      const items = await resolve(worker, makeInvoice(true));
      const codigos = items.map((i: any) => i.codigo);

      expect(codigos).toEqual(expect.arrayContaining(['POLLO-01', 'GAS-01']));
      expect(items).toHaveLength(2);
    });

    it('sin eventos VOID, todas las lineas se incluyen (fallback)', async () => {
      const prisma = makePrismaWithVoids([]);
      worker = new SunatQueueWorker(prisma as any, {} as any);

      const items = await resolve(worker, makeInvoice(false));
      expect(items).toHaveLength(2);
    });

    it('items creados via ORDER_CREATED (sin filas en order_item_projections) igual se facturan', async () => {
      // El fix NO depende de la proyeccion: events.findMany solo devuelve VOID,
      // no exige presencia en order_item_projections. Aqui no hay VOID -> todo factura.
      const prisma = makePrismaWithVoids([]);
      worker = new SunatQueueWorker(prisma as any, {} as any);

      const items = await resolve(worker, makeInvoice(false));
      const codigos = items.map((i: any) => i.codigo);

      expect(codigos).toContain('POLLO-01');
      expect(codigos).toContain('GAS-01');
    });
  });
});
