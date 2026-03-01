/**
 * Admin Notifications Status API
 * GET - Get subscription status for all employees
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import type { EmployeeSubscriptionStatus } from '@/src/core/notifications/types';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Check role
    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de ADMIN o MANAGER.' },
        { status: 403 }
      );
    }

    // Get all employees with their subscription status
    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: session.tenantId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get all push subscriptions
    const subscriptions = await prisma.push_subscriptions.findMany({
      where: {
        tenant_id: session.tenantId,
      },
      select: {
        employee_id: true,
        last_used_at: true,
      },
    });

    // Create a map of employee_id -> last_used_at
    const subscriptionMap = new Map<string, Date>();
    for (const sub of subscriptions) {
      const existing = subscriptionMap.get(sub.employee_id);
      if (!existing || sub.last_used_at > existing) {
        subscriptionMap.set(sub.employee_id, sub.last_used_at);
      }
    }

    // Build response
    const now = new Date();
    const employeeStatuses: EmployeeSubscriptionStatus[] = employees.map((emp) => {
      const lastActive = subscriptionMap.get(emp.id);
      const daysInactive = lastActive
        ? Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        employee_id: emp.id,
        employee_name: emp.name,
        has_subscription: subscriptionMap.has(emp.id),
        last_active: lastActive ? lastActive.toISOString() : null,
        days_inactive: daysInactive,
      };
    });

    return NextResponse.json({
      employees: employeeStatuses,
    });
  } catch (error) {
    logger.error('Error al obtener estado de notificaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener estado de notificaciones' },
      { status: 500 }
    );
  }
}
