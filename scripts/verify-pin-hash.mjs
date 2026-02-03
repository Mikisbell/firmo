#!/usr/bin/env node

/**
 * Verify PIN hash calculation
 */

import crypto from 'crypto';

const SALT = 'PARK_POS_2026_';
const PIN = '1234';

const hash = crypto.createHash('sha256').update(SALT + PIN).digest('hex');

console.log('🔐 PIN Hash Verification\n');
console.log(`SALT: ${SALT}`);
console.log(`PIN: ${PIN}`);
console.log(`Expected Hash: ${hash}`);
console.log(`\nDatabase Hash: 7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558`);
console.log(`\nMatch: ${hash === '7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558' ? '✅ YES' : '❌ NO'}`);

// Try different salts
console.log('\n\n🔍 Trying different salts:\n');

const salts = [
  'PARK_POS_2026_',
  'park-pos-2026-',
  'PARK_POS_',
  'park_pos_',
  '',
];

salts.forEach(salt => {
  const h = crypto.createHash('sha256').update(salt + PIN).digest('hex');
  const match = h === '7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558';
  console.log(`SALT: "${salt}" → ${h.substring(0, 20)}... ${match ? '✅' : ''}`);
});
