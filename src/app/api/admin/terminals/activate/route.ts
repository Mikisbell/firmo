/**
 * Terminal Activation Code API
 * Generates 12-character activation codes valid for 24 hours
 * 
 * Requirements: 5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createActivationCode } from '../activation-codes';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication and authorization
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    const { code, expiresAt } = createActivationCode(tenantId);
    
    return NextResponse.json({
      code,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Activation code error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to generate activation code' },
      { status: 500 }
    );
  }
}
