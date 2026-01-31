#!/usr/bin/env node
/**
 * Generate Secure Secrets for Production
 * 
 * This script generates cryptographically secure secrets for:
 * - JWT_SECRET
 * - PIN_SALT
 * - PARK_API_SECRET
 * - ADMIN_API_KEY
 */

import { randomBytes } from 'crypto';

function generateSecret(length: number = 32): string {
  return randomBytes(length).toString('base64');
}

console.log('🔐 Generating Secure Secrets for Production\n');
console.log('=' .repeat(60));
console.log('\n📋 Copy these to Vercel Environment Variables:\n');

console.log('JWT_SECRET=' + generateSecret(32));
console.log('PIN_SALT=' + generateSecret(32));
console.log('PARK_API_SECRET=' + generateSecret(32));
console.log('ADMIN_API_KEY=' + generateSecret(32));

console.log('\n' + '='.repeat(60));
console.log('\n⚠️  IMPORTANT:');
console.log('1. Copy these values to Vercel Dashboard → Environment Variables');
console.log('2. DO NOT commit these values to Git');
console.log('3. Save them in a secure password manager');
console.log('4. Regenerate if compromised\n');
