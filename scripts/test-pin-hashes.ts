// scripts/test-pin-hashes.ts
// Test different PIN values to find what produces the hash in login attempts

import { hashPin } from '../src/core/auth/auth.service';

const targetHash = '507032afc09bf538e5e9caccd7171c45deb59f318c326312a4f8a19e331ab690';

console.log('\n🔍 TESTING PIN HASHES\n');
console.log('============================================================\n');
console.log(`Target hash from login attempts: ${targetHash}\n`);

// Test common PINs
const testPins = [
    '1234',
    '0000',
    '1111',
    '9999',
    'undefined',
    'null',
    '',
    '****',
];

console.log('Testing common PINs:\n');

for (const pin of testPins) {
    const hash = hashPin(pin);
    const match = hash === targetHash ? '✅ MATCH!' : '';
    console.log(`PIN "${pin}": ${hash.substring(0, 16)}... ${match}`);
}

// Also test if it's the hash of the hash
const pin1234 = '1234';
const hash1234 = hashPin(pin1234);
const doubleHash = hashPin(hash1234);

console.log('\n\nTesting double-hashing:\n');
console.log(`Hash of "1234": ${hash1234.substring(0, 16)}...`);
console.log(`Hash of hash: ${doubleHash.substring(0, 16)}...`);
console.log(`Match with target: ${doubleHash === targetHash ? '✅ YES' : '❌ NO'}`);

console.log('\n============================================================\n');
