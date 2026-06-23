/**
 * Course Fire Service Tests
 *
 * @module core/services/__tests__/course-fire.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CourseFireService } from '../course-fire.service';
import { seededMathRandom } from '@/src/test-utils/seeded-random';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { random } = seededMathRandom(42);

function makeItem(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    line_id: overrides.line_id || `line-${random().toString(36).slice(2, 8)}`,
    product_id: 'prod-1',
    sku: 'SKU-001',
    name: overrides.name || 'Pollo a la brasa',
    qty: overrides.qty || 1,
    unit_price_cents: 4500,
    station: overrides.station || 'COCINA',
    status: overrides.status || 'PENDING',
    mods: [],
    notes: '',
  };
  if ('course' in overrides) base.course = overrides.course;
  if ('held' in overrides) base.held = overrides.held;
  return base;
}

function makeOrder(items: any[], orderId = 'order-1', tenantId = 'tenant-1') {
  return {
    id: orderId,
    tenant_id: tenantId,
    order_number: 1,
    order_type: 'DINE_IN',
    items,
    checks: [],
  };
}

function createMockPrisma() {
  return {
    orders: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    events: {
      create: vi.fn(),
    },
    // Proyeccion order_item_projections: verdad VIVA del status por line_id.
    // Por defecto retorna [] → buildCourseReport cae al fallback (status del JSON).
    order_item_projections: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CourseFireService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: CourseFireService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new CourseFireService(prisma);
  });

  // =========================================================================
  // autoAssignCourses
  // =========================================================================

  describe('autoAssignCourses', () => {
    it('debe asignar FRIOS → course 1 (entrada)', () => {
      const items = [makeItem({ station: 'FRIOS', name: 'Ceviche' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(1);
      expect(result[0].held).toBe(false); // Course 1 never held
    });

    it('debe asignar COCINA → course 2 (fondo)', () => {
      const items = [makeItem({ station: 'COCINA' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(2);
      expect(result[0].held).toBe(true); // Course 2+ held
    });

    it('debe asignar HORNO → course 2', () => {
      const items = [makeItem({ station: 'HORNO' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(2);
      expect(result[0].held).toBe(true);
    });

    it('debe asignar PARRILLA → course 2', () => {
      const items = [makeItem({ station: 'PARRILLA' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(2);
      expect(result[0].held).toBe(true);
    });

    it('debe asignar FREIDORA → course 2', () => {
      const items = [makeItem({ station: 'FREIDORA' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(2);
      expect(result[0].held).toBe(true);
    });

    it('debe asignar POSTRES → course 3 (postre)', () => {
      const items = [makeItem({ station: 'POSTRES', name: 'Torta' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(3);
      expect(result[0].held).toBe(true);
    });

    it('debe dejar BAR sin course (paralelo)', () => {
      const items = [makeItem({ station: 'BAR', name: 'Pisco Sour' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBeUndefined();
      expect(result[0].held).toBeUndefined();
    });

    it('debe dejar EMPAQUE sin course (paralelo)', () => {
      const items = [makeItem({ station: 'EMPAQUE' })];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBeUndefined();
    });

    it('debe asignar múltiples courses correctamente', () => {
      const items = [
        makeItem({ station: 'FRIOS', name: 'Ceviche' }),
        makeItem({ station: 'COCINA', name: 'Lomo Saltado' }),
        makeItem({ station: 'POSTRES', name: 'Torta' }),
        makeItem({ station: 'BAR', name: 'Chicha' }),
      ];
      const result = service.autoAssignCourses(items as any);
      expect(result[0].course).toBe(1);
      expect(result[0].held).toBe(false);
      expect(result[1].course).toBe(2);
      expect(result[1].held).toBe(true);
      expect(result[2].course).toBe(3);
      expect(result[2].held).toBe(true);
      expect(result[3].course).toBeUndefined();
    });

    it('debe manejar lista vacía', () => {
      const result = service.autoAssignCourses([]);
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // assignCourse
  // =========================================================================

  describe('assignCourse', () => {
    it('debe asignar course a items específicos', async () => {
      const items = [
        makeItem({ line_id: 'l1' }),
        makeItem({ line_id: 'l2' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});

      const result = await service.assignCourse('tenant-1', 'order-1', ['l1'], 2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedCount).toBe(1);
      }

      const updateCall = prisma.orders.update.mock.calls[0][0];
      const updatedItems = updateCall.data.items;
      expect(updatedItems[0].course).toBe(2);
      expect(updatedItems[0].held).toBe(true);
      expect(updatedItems[1].course).toBeUndefined();
    });

    it('debe asignar course 1 sin held', async () => {
      const items = [makeItem({ line_id: 'l1' })];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});

      await service.assignCourse('tenant-1', 'order-1', ['l1'], 1);

      const updatedItems = prisma.orders.update.mock.calls[0][0].data.items;
      expect(updatedItems[0].course).toBe(1);
      expect(updatedItems[0].held).toBe(false);
    });

    it('debe rechazar course inválido (0)', async () => {
      const result = await service.assignCourse('tenant-1', 'order-1', ['l1'], 0);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('entero positivo');
    });

    it('debe rechazar course negativo', async () => {
      const result = await service.assignCourse('tenant-1', 'order-1', ['l1'], -1);
      expect(result.success).toBe(false);
    });

    it('debe rechazar lineIds vacío', async () => {
      const result = await service.assignCourse('tenant-1', 'order-1', [], 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('al menos un item');
    });

    it('debe rechazar orden inexistente', async () => {
      prisma.orders.findFirst.mockResolvedValue(null);
      const result = await service.assignCourse('tenant-1', 'order-999', ['l1'], 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no encontrada');
    });

    it('debe rechazar si ningún lineId coincide', async () => {
      const items = [makeItem({ line_id: 'l1' })];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.assignCourse('tenant-1', 'order-1', ['l999'], 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('No se encontraron');
    });
  });

  // =========================================================================
  // fireCourse
  // =========================================================================

  describe('fireCourse', () => {
    it('debe liberar items retenidos del course indicado', async () => {
      const items = [
        makeItem({ line_id: 'l1', station: 'FRIOS', course: 1, held: false, status: 'READY' }),
        makeItem({ line_id: 'l2', station: 'COCINA', course: 2, held: true }),
        makeItem({ line_id: 'l3', station: 'COCINA', course: 2, held: true }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});
      prisma.events.create.mockResolvedValue({});

      const result = await service.fireCourse('tenant-1', 'order-1', 2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firedCount).toBe(2);
      }

      const updatedItems = prisma.orders.update.mock.calls[0][0].data.items;
      expect(updatedItems[1].held).toBe(false);
      expect(updatedItems[2].held).toBe(false);
    });

    it('debe crear evento ORDER_COURSE_FIRED', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'DONE' }),
        makeItem({ line_id: 'l2', course: 2, held: true }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});
      prisma.events.create.mockResolvedValue({});

      await service.fireCourse('tenant-1', 'order-1', 2);

      expect(prisma.events.create).toHaveBeenCalledTimes(1);
      const eventData = prisma.events.create.mock.calls[0][0].data;
      expect(eventData.type).toBe('ORDER_COURSE_FIRED');
      expect(eventData.payload.course).toBe(2);
      expect(eventData.entity_type).toBe('ORDER');
    });

    it('debe disparar course 1 sin validar previo', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: true }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});
      prisma.events.create.mockResolvedValue({});

      const result = await service.fireCourse('tenant-1', 'order-1', 1);
      expect(result.success).toBe(true);
    });

    it('debe rechazar si course previo no completado', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'COOKING' }),
        makeItem({ line_id: 'l2', course: 2, held: true }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.fireCourse('tenant-1', 'order-1', 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no está completo');
    });

    it('debe permitir fire si previo tiene items VOIDED', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'VOIDED' }),
        makeItem({ line_id: 'l2', course: 2, held: true }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.orders.update.mockResolvedValue({});
      prisma.events.create.mockResolvedValue({});

      const result = await service.fireCourse('tenant-1', 'order-1', 2);
      expect(result.success).toBe(true);
    });

    it('debe rechazar si no hay items retenidos en ese course', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 2, held: false }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.fireCourse('tenant-1', 'order-1', 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('No hay items retenidos');
    });

    it('debe rechazar orden inexistente', async () => {
      prisma.orders.findFirst.mockResolvedValue(null);
      const result = await service.fireCourse('tenant-1', 'order-999', 2);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no encontrada');
    });

    it('debe rechazar course inválido', async () => {
      const result = await service.fireCourse('tenant-1', 'order-1', 0);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // getCourseStatus
  // =========================================================================

  describe('getCourseStatus', () => {
    it('debe retornar reporte de courses', async () => {
      const items = [
        makeItem({ line_id: 'l1', station: 'FRIOS', course: 1, held: false, status: 'DONE', name: 'Ceviche' }),
        makeItem({ line_id: 'l2', station: 'COCINA', course: 2, held: false, status: 'COOKING', name: 'Lomo' }),
        makeItem({ line_id: 'l3', station: 'POSTRES', course: 3, held: true, status: 'PENDING', name: 'Torta' }),
        makeItem({ line_id: 'l4', station: 'BAR', name: 'Chicha' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const report = result.data;
      expect(report.courses).toHaveLength(3);
      expect(report.parallelItems).toHaveLength(1);
      expect(report.parallelItems[0].name).toBe('Chicha');

      // Course 1: completed
      expect(report.courses[0].course).toBe(1);
      expect(report.courses[0].label).toBe('Entrada');
      expect(report.courses[0].state).toBe('COMPLETED');
      expect(report.courses[0].percentComplete).toBe(100);

      // Course 2: active
      expect(report.courses[1].course).toBe(2);
      expect(report.courses[1].label).toBe('Fondo');
      expect(report.courses[1].state).toBe('ACTIVE');

      // Course 3: held
      expect(report.courses[2].course).toBe(3);
      expect(report.courses[2].label).toBe('Postre');
      expect(report.courses[2].state).toBe('HELD');

      // Active course
      expect(report.activeCourse).toBe(2);
    });

    it('debe manejar orden sin courses', async () => {
      const items = [
        makeItem({ line_id: 'l1', station: 'BAR', name: 'Cerveza' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.courses).toHaveLength(0);
      expect(result.data.parallelItems).toHaveLength(1);
      expect(result.data.activeCourse).toBeNull();
    });

    it('debe rechazar orden inexistente', async () => {
      prisma.orders.findFirst.mockResolvedValue(null);
      const result = await service.getCourseStatus('tenant-1', 'order-999');
      expect(result.success).toBe(false);
    });

    it('debe calcular porcentaje correctamente', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 2, held: false, status: 'READY' }),
        makeItem({ line_id: 'l2', course: 2, held: false, status: 'COOKING' }),
        makeItem({ line_id: 'l3', course: 2, held: false, status: 'DONE' }),
        makeItem({ line_id: 'l4', course: 2, held: false, status: 'PENDING' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      // 2 of 4 are READY/DONE = 50%
      expect(result.data.courses[0].completedCount).toBe(2);
      expect(result.data.courses[0].totalCount).toBe(4);
      expect(result.data.courses[0].percentComplete).toBe(50);
    });

    // -----------------------------------------------------------------------
    // Trap: status del JSON congelado vs proyeccion VIVA
    // (architecture/order-item-status-trap — engram #2171)
    // -----------------------------------------------------------------------

    it('debe usar el status VIVO de order_item_projections, no el JSON congelado', async () => {
      // El JSON tiene status PENDING (congelado en la creacion), pero la
      // verdad viva en la proyeccion dice READY → el curso debe contarlo completado.
      const items = [
        makeItem({ line_id: 'l1', course: 2, held: false, status: 'PENDING' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.order_item_projections.findMany.mockResolvedValue([
        { line_id: 'l1', status: 'READY' },
      ]);

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const course = result.data.courses[0];
      expect(course.items[0].status).toBe('READY'); // status vivo, no el JSON
      expect(course.completedCount).toBe(1);
      expect(course.state).toBe('COMPLETED');
      expect(course.percentComplete).toBe(100);

      // La query debe estar scoped por tenant + order
      expect(prisma.order_item_projections.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: 'tenant-1', order_id: 'order-1' },
        }),
      );
    });

    it('debe marcar COMPLETED un curso con todos los items READY en la proyeccion', async () => {
      const items = [
        makeItem({ line_id: 'l1', course: 2, held: false, status: 'COOKING' }),
        makeItem({ line_id: 'l2', course: 2, held: false, status: 'PENDING' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.order_item_projections.findMany.mockResolvedValue([
        { line_id: 'l1', status: 'READY' },
        { line_id: 'l2', status: 'DONE' },
      ]);

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.courses[0].state).toBe('COMPLETED');
      expect(result.data.courses[0].completedCount).toBe(2);
    });

    it('debe preservar held/course del JSON aunque el status venga de la proyeccion (hibrido)', async () => {
      // held y course son estructura del curso: viven SOLO en el JSON.
      // La proyeccion no los tiene; solo aporta status.
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'PENDING', name: 'Ceviche' }),
        makeItem({ line_id: 'l2', course: 3, held: true, status: 'PENDING', name: 'Torta' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.order_item_projections.findMany.mockResolvedValue([
        { line_id: 'l1', status: 'DONE' },
        { line_id: 'l2', status: 'PENDING' },
      ]);

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Course 1: status vivo DONE → COMPLETED, held estructural false
      expect(result.data.courses[0].items[0].status).toBe('DONE');
      expect(result.data.courses[0].items[0].held).toBe(false);
      expect(result.data.courses[0].state).toBe('COMPLETED');

      // Course 3: held estructural true preservado del JSON → HELD
      expect(result.data.courses[1].items[0].held).toBe(true);
      expect(result.data.courses[1].state).toBe('HELD');
    });

    it('debe caer al status del JSON si la linea no esta en la proyeccion (fallback)', async () => {
      // Items de ORDER_CREATED pueden no estar proyectados todavia.
      const items = [
        makeItem({ line_id: 'l1', course: 2, held: false, status: 'READY' }),
      ];
      prisma.orders.findFirst.mockResolvedValue(makeOrder(items));
      prisma.order_item_projections.findMany.mockResolvedValue([]); // sin filas

      const result = await service.getCourseStatus('tenant-1', 'order-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Sin proyeccion → usa el status del JSON (READY)
      expect(result.data.courses[0].items[0].status).toBe('READY');
      expect(result.data.courses[0].state).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // buildCourseReport (pure function)
  // =========================================================================

  describe('buildCourseReport', () => {
    it('debe ordenar courses numéricamente', () => {
      const items = [
        makeItem({ line_id: 'l3', course: 3, held: true }),
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'DONE' }),
        makeItem({ line_id: 'l2', course: 2, held: true }),
      ];

      const report = service.buildCourseReport('order-1', items);
      expect(report.courses[0].course).toBe(1);
      expect(report.courses[1].course).toBe(2);
      expect(report.courses[2].course).toBe(3);
    });

    it('debe generar label personalizado para course > 3', () => {
      const items = [makeItem({ line_id: 'l1', course: 5, held: true })];
      const report = service.buildCourseReport('order-1', items);
      expect(report.courses[0].label).toBe('Tiempo 5');
    });

    it('debe manejar items sin status (default PENDING)', () => {
      const items = [{ line_id: 'l1', name: 'X', qty: 1, station: 'COCINA', course: 1 }];
      const report = service.buildCourseReport('order-1', items);
      expect(report.courses[0].items[0].status).toBe('PENDING');
    });

    it('debe manejar lista vacía', () => {
      const report = service.buildCourseReport('order-1', []);
      expect(report.courses).toHaveLength(0);
      expect(report.parallelItems).toHaveLength(0);
      expect(report.activeCourse).toBeNull();
    });

    it('debe detectar activeCourse null cuando todos completados', () => {
      const items = [
        makeItem({ line_id: 'l1', course: 1, held: false, status: 'DONE' }),
        makeItem({ line_id: 'l2', course: 2, held: false, status: 'READY' }),
      ];
      const report = service.buildCourseReport('order-1', items);
      expect(report.activeCourse).toBeNull();
      expect(report.courses[0].state).toBe('COMPLETED');
      expect(report.courses[1].state).toBe('COMPLETED');
    });
  });
});
