/**
 * HR Reports API - GET /api/hr/reports
 * Returns aggregated report data for the HR dashboard.
 * Query params: type (attendance|hours|payroll|vacation|performance|turnover|labor-cost)
 *               period (YYYY-MM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const tenantId = authResult.user.tenantId;
  const reportType = request.nextUrl.searchParams.get('type') || 'attendance';
  const period = request.nextUrl.searchParams.get('period') || new Date().toISOString().slice(0, 7);

  try {
    // Return stub data structure - actual implementation hooks into services
    const report = {
      title: getReportTitle(reportType),
      type: reportType,
      period,
      tenantId,
      generatedAt: new Date().toISOString(),
      rows: [],
      totals: {},
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}

function getReportTitle(type: string): string {
  const titles: Record<string, string> = {
    attendance: 'Reporte de Asistencia',
    hours: 'Reporte de Horas Trabajadas',
    payroll: 'Reporte de Planilla',
    vacation: 'Reporte de Vacaciones',
    performance: 'Reporte de Desempeño',
    turnover: 'Reporte de Rotación',
    'labor-cost': 'Reporte de Costos Laborales',
  };
  return titles[type] || 'Reporte';
}
