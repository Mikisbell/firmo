/**
 * GET /api/notifications/vapid-key
 * Returns the VAPID public key for push subscription
 * 
 * Requirements: 4.1
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  
  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID key not configured' },
      { status: 503 }
    );
  }
  
  return NextResponse.json({ publicKey });
}
