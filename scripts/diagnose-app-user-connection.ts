#!/usr/bin/env npx tsx

/**
 * Diagnostic Script: Check app_user Connection Status
 * 
 * This script helps diagnose why the app_user connection is failing.
 * It provides clear guidance on what needs to be fixed.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Diagnosing app_user Connection Issues\n');
console.log('════════════════════════════════════════════════════════════\n');

// 1. Check environment variables
console.log('1️⃣  Checking Environment Variables...\n');

const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envLocalPath)) {
  console.log('❌ .env.local not found');
  process.exit(1);
}

const envLocal = fs.readFileSync(envLocalPath, 'utf-8');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Extract DATABASE_URL
const dbUrlMatch = envLocal.match(/DATABASE_URL="([^"]+)"/);
if (!dbUrlMatch) {
  console.log('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const databaseUrl = dbUrlMatch[1];
console.log('✅ DATABASE_URL found in .env.local');

// Parse connection string
try {
  const url = new URL(databaseUrl);
  const username = url.username;
  const password = url.password;
  const hostname = url.hostname;
  const port = url.port;
  const database = url.pathname.split('/')[1];

  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password ? '***' + password.slice(-4) : '(empty)'}`);
  console.log(`   Host: ${hostname}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${database}`);

  // 2. Check if credentials look correct
  console.log('\n2️⃣  Validating Credentials...\n');

  if (username !== 'app_user') {
    console.log(`❌ Username is '${username}', should be 'app_user'`);
    console.log('   Fix: Update DATABASE_URL to use app_user');
  } else {
    console.log('✅ Username is correct (app_user)');
  }

  if (!password || password === 'ParkPOS2026!%40%23Secure') {
    console.log('❌ Password appears to be the example placeholder');
    console.log('   This is the issue! The password is not the actual password created in Supabase.');
    console.log('\n🔴 CRITICAL: You need to provide the actual password for app_user\n');
    console.log('   Steps to fix:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run: SELECT usename FROM pg_user WHERE usename = \'app_user\';');
    console.log('   3. If app_user exists, you need to reset its password:');
    console.log('      ALTER USER app_user WITH PASSWORD \'your-new-secure-password\';');
    console.log('   4. Copy the password');
    console.log('   5. Update DATABASE_URL in .env.local with the correct password');
    console.log('   6. URL-encode special characters (! → %21, @ → %40, # → %23, $ → %24)');
    console.log('   7. Run this script again to verify\n');
  } else {
    console.log('✅ Password is set (not the placeholder)');
  }

  // 3. Check if app_user exists in Supabase
  console.log('3️⃣  Checking if app_user exists in Supabase...\n');
  console.log('   To verify app_user exists:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Run: SELECT usename, usebypassrls FROM pg_user WHERE usename = \'app_user\';');
  console.log('   3. If no results, app_user does not exist - create it with:');
  console.log('      CREATE USER app_user WITH PASSWORD \'your-secure-password\';');
  console.log('   4. Then grant permissions:');
  console.log('      GRANT CONNECT ON DATABASE postgres TO app_user;');
  console.log('      GRANT USAGE ON SCHEMA public TO app_user;');
  console.log('      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;');
  console.log('      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;');
  console.log('      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;\n');

  // 4. Summary
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('📋 SUMMARY\n');
  console.log('Current Status:');
  console.log(`  • Username: ${username} ${username === 'app_user' ? '✅' : '❌'}`);
  console.log(`  • Password: ${password ? '✅ Set' : '❌ Empty'}`);
  console.log(`  • Host: ${hostname} ✅`);
  console.log(`  • Port: ${port} ✅`);
  console.log(`  • Database: ${database} ✅`);

  console.log('\n🎯 Next Steps:\n');
  console.log('1. Verify app_user exists in Supabase with correct password');
  console.log('2. Update DATABASE_URL in .env.local with correct password');
  console.log('3. Update DATABASE_URL in .env with correct password');
  console.log('4. Run: npx tsx scripts/test-multi-tenant-integration.ts');
  console.log('5. Verify all 10 tests pass\n');

} catch (error) {
  console.log(`❌ Error parsing DATABASE_URL: ${error}`);
  process.exit(1);
}
