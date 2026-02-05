// TEMPORARY DEBUG ENDPOINT - DELETE AFTER FIXING
// This endpoint reveals the PIN_SALT configuration in Vercel
// DO NOT LEAVE THIS IN PRODUCTION

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const PIN_SALT = process.env.PIN_SALT || 'PARK_POS_2026_';
  const testPin = '1234';
  const testHash = crypto.createHash('sha256').update(PIN_SALT + testPin).digest('hex');
  
  return NextResponse.json({
    pin_salt_configured: !!process.env.PIN_SALT,
    pin_salt_value: PIN_SALT, // DANGEROUS - only for debugging
    pin_salt_length: PIN_SALT.length,
    test_pin_hash: testHash,
    node_env: process.env.NODE_ENV,
    warning: 'DELETE THIS ENDPOINT IMMEDIATELY AFTER DEBUGGING',
  });
}
