/**
 * Audit Events API - GET
 * 
 * Task 10.3 - Terminal Architecture v2
 * Requirements: 6.4
 * 
 * Supports filtering by:
 * - date range (start_date, end_date)
 * - terminal_id
 * - employee_id
 * - event_type
 * - limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryEvents, type EventFilters, type AuthEventType } from '@/src/core/auth/audit-logger';

/**
 * GET /api/admin/audit/events
 * 
 * Query authentication events with filters
 * 
 * Query parameters:
 * - terminal_id (optional): Filter by terminal ID
 * - employee_id (optional): Filter by employee ID
 * - event_type (optional): Filter by event type
 * - start_date (optional): Start date (ISO 8601)
 * - end_date (optional): End date (ISO 8601)
 * - limit (optional): Maximum number of results (default: 100)
 * 
 * Example:
 * GET /api/admin/audit/events?terminal_id=CAJA_01&start_date=2026-01-01T00:00:00Z&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);

    // Build filters from query parameters
    const filters: EventFilters = {
      tenant_id: tenantId,
    };

    // Optional filters
    const terminalId = searchParams.get('terminal_id');
    if (terminalId) {
      filters.terminal_id = terminalId;
    }

    const employeeId = searchParams.get('employee_id');
    if (employeeId) {
      filters.employee_id = employeeId;
    }

    const eventType = searchParams.get('event_type');
    if (eventType) {
      // Validate event type
      const validEventTypes: AuthEventType[] = [
        'terminal_created',
        'activation_code_generated',
        'device_activated',
        'login_success',
        'login_failed',
        'logout',
        'session_expired',
        'fingerprint_drift_detected',
        'step_up_auth_required',
        'terminal_disabled',
        'security_alert',
      ];
      
      if (validEventTypes.includes(eventType as AuthEventType)) {
        filters.event_type = eventType as AuthEventType;
      } else {
        return NextResponse.json(
          { error: `Tipo de evento inválido. Debe ser uno de: ${validEventTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const startDate = searchParams.get('start_date');
    if (startDate) {
      const date = new Date(startDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Formato de start_date inválido. Use formato ISO 8601 (ej: 2026-01-01T00:00:00Z)' },
          { status: 400 }
        );
      }
      filters.start_date = date;
    }

    const endDate = searchParams.get('end_date');
    if (endDate) {
      const date = new Date(endDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Formato de end_date inválido. Use formato ISO 8601 (ej: 2026-01-01T00:00:00Z)' },
          { status: 400 }
        );
      }
      filters.end_date = date;
    }

    const limit = searchParams.get('limit');
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return NextResponse.json(
          { error: 'Límite inválido. Debe ser un número entre 1 y 1000' },
          { status: 400 }
        );
      }
      filters.limit = limitNum;
    }

    // Query events
    const events = await queryEvents(filters);

    return NextResponse.json({
      events,
      count: events.length,
      filters: {
        terminal_id: filters.terminal_id,
        employee_id: filters.employee_id,
        event_type: filters.event_type,
        start_date: filters.start_date?.toISOString(),
        end_date: filters.end_date?.toISOString(),
        limit: filters.limit ?? 100,
      },
    });
  } catch (error) {
    console.error('Audit events GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener eventos de auditoría' },
      { status: 500 }
    );
  }
}
