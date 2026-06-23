/**
 * Course Fire Service
 *
 * Manages course-based timing (tiempos) for kitchen orders.
 * Items with course > 1 are held until the chef fires that course.
 *
 * @module core/services/course-fire.service
 */

import type { PrismaClient } from '@prisma/client';
import type { ItemStatus, OrderLine } from '@/src/core/domain/events';
import { STATIONS, type StationCode } from '@/src/core/domain/stations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CourseItem {
  lineId: string;
  name: string;
  qty: number;
  station: string;
  status: ItemStatus;
  held: boolean;
}

export interface CourseStatus {
  course: number;
  label: string;
  items: CourseItem[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  state: 'COMPLETED' | 'ACTIVE' | 'HELD' | 'EMPTY';
}

export interface CourseStatusReport {
  orderId: string;
  courses: CourseStatus[];
  activeCourse: number | null;
  parallelItems: CourseItem[]; // Items without course (BAR, etc.)
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

// ---------------------------------------------------------------------------
// Course labels
// ---------------------------------------------------------------------------

const COURSE_LABELS: Record<number, string> = {
  1: 'Entrada',
  2: 'Fondo',
  3: 'Postre',
};

function getCourseLabel(course: number): string {
  return COURSE_LABELS[course] || `Tiempo ${course}`;
}

// ---------------------------------------------------------------------------
// Station → Course auto-assignment mapping
// ---------------------------------------------------------------------------

const STATION_COURSE_MAP: Record<string, number> = {
  [STATIONS.FRIOS]: 1,       // Entradas
  [STATIONS.COCINA]: 2,      // Fondo
  [STATIONS.HORNO]: 2,       // Fondo
  [STATIONS.PARRILLA]: 2,    // Fondo
  [STATIONS.FREIDORA]: 2,    // Fondo
  [STATIONS.POSTRES]: 3,     // Postre
  // BAR y EMPAQUE → sin course (paralelo)
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CourseFireService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Auto-assign courses based on station.
   * Pure function — does not hit DB.
   */
  autoAssignCourses(items: OrderLine[]): OrderLine[] {
    return items.map((item) => {
      const course = STATION_COURSE_MAP[item.station];
      if (course === undefined) {
        // No course for this station (BAR, EMPAQUE) → parallel
        return item;
      }
      return {
        ...item,
        course,
        held: course > 1, // Course 1 never held
      };
    });
  }

  /**
   * Assign a specific course to items in an order.
   */
  async assignCourse(
    tenantId: string,
    orderId: string,
    lineIds: string[],
    course: number,
  ): Promise<Result<{ updatedCount: number }>> {
    if (course < 1 || !Number.isInteger(course)) {
      return { success: false, error: { message: 'El course debe ser un entero positivo' } };
    }
    if (lineIds.length === 0) {
      return { success: false, error: { message: 'Debe indicar al menos un item' } };
    }

    // Fetch order
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });
    if (!order) {
      return { success: false, error: { message: 'Orden no encontrada' } };
    }

    const items = (order.items as any[]) || [];
    let updatedCount = 0;

    const updatedItems = items.map((item: any) => {
      if (lineIds.includes(item.line_id)) {
        updatedCount++;
        return {
          ...item,
          course,
          held: course > 1, // Course 1 entra directo
        };
      }
      return item;
    });

    if (updatedCount === 0) {
      return { success: false, error: { message: 'No se encontraron items con los IDs indicados' } };
    }

    await this.prisma.orders.update({
      where: { id: orderId },
      data: { items: updatedItems as any },
    });

    return { success: true, data: { updatedCount } };
  }

  /**
   * Fire a course — release held items so they can proceed to COOKING.
   */
  async fireCourse(
    tenantId: string,
    orderId: string,
    course: number,
  ): Promise<Result<{ firedCount: number }>> {
    if (course < 1 || !Number.isInteger(course)) {
      return { success: false, error: { message: 'El course debe ser un entero positivo' } };
    }

    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });
    if (!order) {
      return { success: false, error: { message: 'Orden no encontrada' } };
    }

    const items = (order.items as any[]) || [];

    // Validate: previous course must be complete (all READY or DONE)
    if (course > 1) {
      const prevCourse = course - 1;
      const prevItems = items.filter((i: any) => i.course === prevCourse);
      if (prevItems.length > 0) {
        const allComplete = prevItems.every(
          (i: any) => i.status === 'READY' || i.status === 'DONE' || i.status === 'VOIDED',
        );
        if (!allComplete) {
          return {
            success: false,
            error: { message: `El tiempo ${prevCourse} aún no está completo` },
          };
        }
      }
    }

    // Release held items for this course
    let firedCount = 0;
    const updatedItems = items.map((item: any) => {
      if (item.course === course && item.held) {
        firedCount++;
        return { ...item, held: false };
      }
      return item;
    });

    if (firedCount === 0) {
      return { success: false, error: { message: `No hay items retenidos en el tiempo ${course}` } };
    }

    await this.prisma.orders.update({
      where: { id: orderId },
      data: { items: updatedItems as any },
    });

    // Store event
    await this.prisma.events.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        terminal_id: 'SYSTEM',
        entity_type: 'ORDER',
        entity_id: orderId,
        type: 'ORDER_COURSE_FIRED',
        payload: {
          order_id: orderId,
          course,
          fired_at: new Date().toISOString(),
        },
        occurred_at: new Date(),
      },
    });

    return { success: true, data: { firedCount } };
  }

  /**
   * Get course status for an order.
   *
   * HIBRIDO (architecture/order-item-status-trap): el JSON `orders.items[].status`
   * queda CONGELADO en el valor de creacion — la verdad VIVA del status de cada
   * linea vive en `order_item_projections`. Por eso cruzamos por line_id y le
   * pasamos a buildCourseReport el status vivo. La estructura del curso (held,
   * course, name, qty, station) SOLO existe en el JSON, asi que esa sigue
   * leyendose del agregado.
   */
  async getCourseStatus(
    tenantId: string,
    orderId: string,
  ): Promise<Result<CourseStatusReport>> {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });
    if (!order) {
      return { success: false, error: { message: 'Orden no encontrada' } };
    }

    const items = (order.items as any[]) || [];

    // Status VIVO por line_id desde la proyeccion (tenant-scoped, Node puro).
    const projections = await this.prisma.order_item_projections.findMany({
      where: { tenant_id: tenantId, order_id: orderId },
      select: { line_id: true, status: true },
    });
    const liveStatusByLineId = new Map<string, ItemStatus>(
      projections.map((p) => [p.line_id, p.status as ItemStatus]),
    );

    return {
      success: true,
      data: this.buildCourseReport(orderId, items, liveStatusByLineId),
    };
  }

  /**
   * Build a course status report from items. Pure function.
   *
   * @param liveStatusByLineId Mapa line_id → status VIVO desde
   *   order_item_projections. El status del JSON `items[]` esta congelado en la
   *   creacion (trap de read-model embebido en write-model), por eso para el
   *   status preferimos la proyeccion. La estructura del curso (held, course,
   *   name, qty, station) SOLO vive en el JSON y se lee de ahi.
   *   Si una linea no esta en el mapa (ej. items aun no proyectados), cae al
   *   status del JSON o 'PENDING'.
   */
  buildCourseReport(
    orderId: string,
    items: any[],
    liveStatusByLineId?: Map<string, ItemStatus>,
  ): CourseStatusReport {
    // Separate items by course
    const courseMap = new Map<number, CourseItem[]>();
    const parallelItems: CourseItem[] = [];

    for (const item of items) {
      // status: verdad VIVA de la proyeccion cruzando por line_id; fallback al
      // status del JSON (congelado) o 'PENDING' si la linea no esta proyectada.
      const liveStatus = liveStatusByLineId?.get(item.line_id);
      const ci: CourseItem = {
        lineId: item.line_id,
        name: item.name,
        qty: item.qty,
        station: item.station,
        status: liveStatus ?? item.status ?? 'PENDING',
        held: item.held || false, // estructura del curso: solo en el JSON
      };

      if (item.course) {
        const arr = courseMap.get(item.course) || [];
        arr.push(ci);
        courseMap.set(item.course, arr);
      } else {
        parallelItems.push(ci);
      }
    }

    // Build course statuses sorted by course number
    const courseNumbers = Array.from(courseMap.keys()).sort((a, b) => a - b);
    const courses: CourseStatus[] = courseNumbers.map((courseNum) => {
      const courseItems = courseMap.get(courseNum)!;
      const totalCount = courseItems.length;
      const completedCount = courseItems.filter(
        (i) => i.status === 'READY' || i.status === 'DONE',
      ).length;
      const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Determine state
      let state: CourseStatus['state'] = 'HELD';
      if (totalCount === 0) {
        state = 'EMPTY';
      } else if (completedCount === totalCount) {
        state = 'COMPLETED';
      } else if (courseItems.some((i) => !i.held)) {
        state = 'ACTIVE';
      }

      return {
        course: courseNum,
        label: getCourseLabel(courseNum),
        items: courseItems,
        completedCount,
        totalCount,
        percentComplete,
        state,
      };
    });

    // Determine active course
    let activeCourse: number | null = null;
    for (const cs of courses) {
      if (cs.state === 'ACTIVE') {
        activeCourse = cs.course;
        break;
      }
    }

    return {
      orderId,
      courses,
      activeCourse,
      parallelItems,
    };
  }
}
