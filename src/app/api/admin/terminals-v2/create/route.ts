/**
 * Terminal Devices API v2 - POST (Create)
 * 
 * Requirements: 3.1 (Terminal Architecture v2)
 * Updated: 07 Febrero 2026 - Added tenant isolation from JWT
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createTerminal, type CreateTerminalInput } from '@/src/core/auth/terminal-registry';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(req: NextRequest) {
  try {
    // Validate admin authentication and get user from session
    const authResult = await requireAdminAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;

    const { user } = authResult;
    const body = await req.json();
    const { terminal_id, role, location_id, device_name } = body;

    // Validate required fields
    if (!terminal_id || !role || !location_id || !device_name) {
      return NextResponse.json(
        { error: 'Missing required fields: terminal_id, role, location_id, device_name' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['CAJA', 'MOZO', 'KDS_COCINA', 'KDS_HORNO', 'KDS_BAR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Use authenticated user's ID as created_by (from session)
    const createdBy = user.id;

    const input: CreateTerminalInput = {
      terminal_id,
      tenant_id: tenantId,
      role,
      location_id,
      device_name,
      created_by: createdBy,
    };

    const result = await createTerminal(input);

    return NextResponse.json({
      success: true,
      terminal: {
        id: result.terminal.id,
        terminal_id: result.terminal.terminal_id,
        role: result.terminal.role,
        status: result.terminal.status,
        device_name: result.terminal.device_name,
      },
      activation_code: {
        code: result.code.code,
        formatted: `${result.code.code.slice(0, 3)}-${result.code.code.slice(3)}`,
        expires_at: result.code.expires_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Terminal creation error:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe un terminal con ese ID' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create terminal' },
      { status: 500 }
    );
  }
}
