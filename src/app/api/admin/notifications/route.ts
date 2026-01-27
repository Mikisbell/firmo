/**
 * Admin Notifications API
 * GET - List notifications with filters
 * POST - Create notification (for testing/manual creation)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import {
  getAdminNotifications,
  createAdminNotification,
} from '@/src/core/notifications/admin-notifier';

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
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de ADMIN u OWNER.' },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const unread = searchParams.get('unread') === 'true';
    const priority = searchParams.get('priority') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get notifications
    const result = await getAdminNotifications(session.tenantId, {
      unread,
      priority,
      category,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json(
      { error: 'Error al obtener notificaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de ADMIN u OWNER.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.priority || !body.category || !body.title || !body.message) {
      return NextResponse.json(
        { error: 'Campos requeridos: type, priority, category, title, message' },
        { status: 400 }
      );
    }

    // Create notification
    const notification = await createAdminNotification({
      tenant_id: session.tenantId,
      type: body.type,
      priority: body.priority,
      category: body.category,
      title: body.title,
      message: body.message,
      actionable: body.actionable,
      action: body.action,
      metadata: body.metadata,
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Error al crear notificación' },
      { status: 500 }
    );
  }
}
