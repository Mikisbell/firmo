/**
 * Terminal Activation Code API
 * Generates 12-character activation codes valid for 24 hours
 * 
 * Requirements: 5.2
 */

import { NextResponse } from 'next/server';
import { createActivationCode } from '../activation-codes';

export async function POST() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    const { code, expiresAt } = createActivationCode(tenantId);
    
    return NextResponse.json({
      code,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Activation code error:', error);
    return NextResponse.json(
      { error: 'Failed to generate activation code' },
      { status: 500 }
    );
  }
}
