import { NextRequest, NextResponse } from 'next/server';

/**
 * API Endpoint para Auditoría de Autenticación
 * 
 * Retorna eventos de auditoría y estadísticas de seguridad
 * Soporta filtros por fecha, terminal, empleado y tipo de evento
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const terminal = searchParams.get('terminal');
    const employee = searchParams.get('employee');
    const eventType = searchParams.get('eventType');

    // Mock data para tests E2E
    // En producción, esto vendría de la base de datos
    const allEvents = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        event_type: 'login_success',
        terminal_id: 'CAJA-01',
        employee_id: 'EMP-001',
        status: 'success',
        details: 'Login exitoso desde terminal CAJA-01'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        event_type: 'login_failed',
        terminal_id: 'MOZO-01',
        employee_id: 'EMP-002',
        status: 'failed',
        details: 'PIN incorrecto'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        event_type: 'security_alert',
        terminal_id: 'KDS-01',
        employee_id: 'EMP-003',
        status: 'alert',
        details: 'Múltiples intentos fallidos de login'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        event_type: 'login_success',
        terminal_id: 'CAJA-01',
        employee_id: 'EMP-001',
        status: 'success',
        details: 'Login exitoso desde terminal CAJA-01'
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        event_type: 'login_success',
        terminal_id: 'MOZO-01',
        employee_id: 'EMP-002',
        status: 'success',
        details: 'Login exitoso desde terminal MOZO-01'
      }
    ];

    // Aplicar filtros
    let filteredEvents = allEvents;

    if (terminal) {
      filteredEvents = filteredEvents.filter(e => e.terminal_id === terminal);
    }

    if (employee) {
      filteredEvents = filteredEvents.filter(e => e.employee_id === employee);
    }

    if (eventType) {
      filteredEvents = filteredEvents.filter(e => e.event_type === eventType);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) <= end);
    }

    // Calcular estadísticas
    const stats = {
      total: filteredEvents.length,
      login_success: filteredEvents.filter(e => e.event_type === 'login_success').length,
      login_failed: filteredEvents.filter(e => e.event_type === 'login_failed').length,
      alerts: filteredEvents.filter(e => e.event_type === 'security_alert').length
    };

    return NextResponse.json({ 
      events: filteredEvents,
      stats 
    });
  } catch (error) {
    console.error('Error in audit-log API:', error);
    return NextResponse.json(
      { error: 'Error al cargar eventos de auditoría' },
      { status: 500 }
    );
  }
}
