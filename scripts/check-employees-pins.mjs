#!/usr/bin/env node

/**
 * Check what employees exist in the database
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking employees in database\n');

  const employees = await prisma.employees.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
    },
  });

  console.log(`Found ${employees.length} employees:\n`);

  employees.forEach((emp, i) => {
    console.log(`${i + 1}. ${emp.name}`);
    console.log(`   Role: ${emp.role}`);
    console.log(`   Active: ${emp.is_active}`);
    console.log(`   PIN Hash: ${emp.pin_hash.substring(0, 20)}...`);
    console.log('');
  });

  // Check if PIN 1234 exists
  const salt = 'PARK_POS_2026_'; // Use hardcoded value, not from env
  const pinHash = crypto.createHash('sha256').update(salt + '1234').digest('hex');
  
  console.log(`\n🔐 Checking PIN 1234 (hash: ${pinHash.substring(0, 20)}...)`);
  
  const withPin1234 = employees.filter(e => e.pin_hash === pinHash);
  if (withPin1234.length > 0) {
    console.log(`✅ Found ${withPin1234.length} employee(s) with PIN 1234:`);
    withPin1234.forEach(emp => {
      console.log(`   - ${emp.name} (${emp.role})`);
    });
  } else {
    console.log('❌ No employees found with PIN 1234');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
