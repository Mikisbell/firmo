#!/usr/bin/env node

/**
 * Debug PIN calculation
 */

import crypto from 'crypto';

const SALT = 'PARK_POS_2026_';
const PIN = '1234';

console.log('🔐 PIN Calculation Debug\n');
console.log(`SALT: "${SALT}"`);
console.log(`PIN: "${PIN}"`);
console.log(`SALT + PIN: "${SALT + PIN}"`);

const hash = crypto.createHash('sha256').update(SALT + PIN).digest('hex');

console.log(`\nCalculated Hash: ${hash}`);
console.log(`Full Hash: ${hash}`);

// Check environment variable
const envSalt = process.env.PIN_SALT;
console.log(`\nEnvironment PIN_SALT: ${envSalt || 'NOT SET'}`);

if (envSalt) {
  const envHash = crypto.createHash('sha256').update(envSalt + PIN).digest('hex');
  console.log(`Hash with ENV SALT: ${envHash}`);
}

// Check .env.local
console.log('\n\n📄 Checking .env.local...');
import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf-8');
const pinSaltLine = envContent.split('\n').find(line => line.includes('PIN_SALT'));
console.log(`PIN_SALT line: ${pinSaltLine}`);
