/**
 * Security Alerts API - GET
 * 
 * Task 10.3 - Terminal Architecture v2
 * Requirements: 6.4
 * 
 * Supports filtering by:
 * - date range (start_date, end_date)
 * - terminal_id
 * - severity
 * - acknowledged status
 * - limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAlerts, type AlertFilters, type AlertSeverity } from '@/src/core/auth/audit-logger';

/**
 * GET /api/admin/audit/alerts
 * 
 * Query security alerts with filters
 * 
 * Query parameters:
 * - terminal_id (optional): Filter by terminal ID
 * - severity (optional): Filter by severity (low, medium, high, critical)
 * - acknowledged (optional): Filter by acknowledged status (true/false)
 * - start_date (optional): Start date (ISO 8601)
 * - end_date (optional): End date (ISO 8601)
 * - limit (optional): Maximum number of results (default: 100)
 * 
 * Example:
 * GET /api/admin/audit/alerts?severity=critical&acknowledged=false&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);

    // Build filters from query parameters
    const filters: AlertFilters = {
      tenant_id: tenantId,
    };

    // Optional filters
    const terminalId = searchParams.get('terminal_id');
    if (terminalId) {
      filters.terminal_id = terminalId;
    }

    const severity = searchParams.get('severity');
    if (severity) {
      // Validate severity
      const validSeverities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
      
      if (validSeverities.includes(severity as AlertSeverity)) {
        filters.severity = severity as AlertSeverity;
      } else {
        return NextResponse.json(
          { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const acknowledged = searchParams.get('acknowledged');
    if (acknowledged !== null) {
      if (acknowledged === 'true') {
        filters.acknowledged = true;
      } else if (acknowledged === 'false') {
        filters.acknowledged = false;
      } else {
        return NextResponse.json(
          { error: 'Invalid acknowledged value. Must be "true" or "false"' },
          { status: 400 }
        );
      }
    }

    const startDate = searchParams.get('start_date');
    if (startDate) {
      const date = new Date(startDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start_date format. Use ISO 8601 format (e.g., 2026-01-01T00:00:00Z)' },
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
          { error: 'Invalid end_date format. Use ISO 8601 format (e.g., 2026-01-01T00:00:00Z)' },
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
          { error: 'Invalid limit. Must be a number between 1 and 1000' },
          { status: 400 }
        );
      }
      filters.limit = limitNum;
    }

    // Query alerts
    const alerts = await queryAlerts(filters);

    return NextResponse.json({
      alerts,
      count: alerts.length,
      filters: {
        terminal_id: filters.terminal_id,
        severity: filters.severity,
        acknowledged: filters.acknowledged,
        start_date: filters.start_date?.toISOString(),
        end_date: filters.end_date?.toISOString(),
        limit: filters.limit ?? 100,
      },
    });
  } catch (error) {
    console.error('Security alerts GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security alerts' },
      { status: 500 }
    );
  }
}
