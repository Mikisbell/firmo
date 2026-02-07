/**
 * Terminal Devices API v2 - GET
 * 
 * Requirements: 3.1 (Terminal Architecture v2)
 */

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }
    
    const tenantId = authResult.user.tenantId;
    
    const devices = await prisma.terminal_devices.findMany({
      where: { tenant_id: tenantId },
      orderBy: { terminal_id: 'asc' },
      select: {
        id: true,
        terminal_id: true,
        role: true,
        status: true,
        device_name: true,
        location_id: true,
        bound_at: true,
        last_seen_at: true,
        drift_score: true,
      },
    });
    
    // También obtener códigos de activación pendientes
    const activationCodes = await prisma.activation_codes.findMany({
      where: { used: false },
      select: {
        terminal_id: true,
        code: true,
        expires_at: true,
      },
    });
    
    // Combinar datos
    const devicesWithCodes = devices.map(d => ({
      ...d,
      activation_code: activationCodes.find(c => c.terminal_id === d.terminal_id) || null,
    }));
    
    return NextResponse.json({
      devices: devicesWithCodes,
      summary: {
        total: devices.length,
        active: devices.filter(d => d.status === 'active').length,
        pending: devices.filter(d => d.status === 'pending').length,
        disabled: devices.filter(d => d.status === 'disabled').length,
      }
    });
  } catch (error) {
    console.error('Terminal Devices GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminal devices' },
      { status: 500 }
    );
  }
}
