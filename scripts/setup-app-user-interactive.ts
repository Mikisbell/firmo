#!/usr/bin/env npx tsx

/**
 * Interactive Setup Script for app_user
 * 
 * This script helps you:
 * 1. Generate a secure password
 * 2. Create/update app_user in Supabase
 * 3. Update environment variables
 * 4. Test the connection
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function generateSecurePassword(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

function urlEncodePassword(password: string): string {
  return password
    .replace(/!/g, '%21')
    .replace(/@/g, '%40')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/%/g, '%25')
    .replace(/&/g, '%26')
    .replace(/\?/g, '%3F')
    .replace(/=/g, '%3D');
}

async function main() {
  console.log('\n🔐 Interactive Setup: app_user for Multi-Tenant RLS\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Step 1: Generate or use provided password
  console.log('Step 1: Password Setup\n');
  console.log('You have two options:');
  console.log('  1. Generate a secure random password');
  console.log('  2. Use a password you already created in Supabase\n');

  const choice = await question('Choose option (1 or 2): ');

  let password: string;

  if (choice === '1') {
    password = generateSecurePassword();
    console.log(`\n✅ Generated secure password: ${password}\n`);
    console.log('📋 IMPORTANT: Copy this password and save it somewhere safe!\n');
    console.log('Next steps in Supabase:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run this command:');
    console.log(`   CREATE USER app_user WITH PASSWORD '${password}';`);
    console.log('3. Then run:');
    console.log('   GRANT CONNECT ON DATABASE postgres TO app_user;');
    console.log('   GRANT USAGE ON SCHEMA public TO app_user;');
    console.log('   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;');
    console.log('   GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;');
    console.log('   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;\n');
    
    const confirmed = await question('Have you created app_user in Supabase? (yes/no): ');
    if (confirmed.toLowerCase() !== 'yes') {
      console.log('\n❌ Please create app_user in Supabase first, then run this script again.\n');
      rl.close();
      process.exit(1);
    }
  } else if (choice === '2') {
    password = await question('Enter the password you created for app_user: ');
    if (!password) {
      console.log('\n❌ Password cannot be empty.\n');
      rl.close();
      process.exit(1);
    }
  } else {
    console.log('\n❌ Invalid choice.\n');
    rl.close();
    process.exit(1);
  }

  // Step 2: Update environment files
  console.log('\nStep 2: Updating Environment Files\n');

  const encodedPassword = urlEncodePassword(password);
  const dbUrl = `postgresql://app_user:${encodedPassword}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20`;
  const directUrl = `postgresql://app_user:${encodedPassword}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1`;

  // Update .env.local
  const envLocalPath = path.join(process.cwd(), '.env.local');
  let envLocalContent = fs.readFileSync(envLocalPath, 'utf-8');
  
  envLocalContent = envLocalContent.replace(
    /DATABASE_URL="[^"]*"/,
    `DATABASE_URL="${dbUrl}"`
  );
  envLocalContent = envLocalContent.replace(
    /DIRECT_URL="[^"]*"/,
    `DIRECT_URL="${directUrl}"`
  );

  fs.writeFileSync(envLocalPath, envLocalContent);
  console.log('✅ Updated .env.local');

  // Update .env
  const envPath = path.join(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  envContent = envContent.replace(
    /DATABASE_URL="[^"]*"/,
    `DATABASE_URL="${dbUrl}"`
  );
  envContent = envContent.replace(
    /DIRECT_URL="[^"]*"/,
    `DIRECT_URL="${directUrl}"`
  );

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env');

  // Step 3: Test connection
  console.log('\nStep 3: Testing Connection\n');
  console.log('Run this command to test the connection:');
  console.log('  npx tsx scripts/check-rls-status.ts\n');

  console.log('Step 4: Run Integration Tests\n');
  console.log('Run this command to verify all tests pass:');
  console.log('  npx tsx scripts/test-multi-tenant-integration.ts\n');

  console.log('Step 5: Commit Changes\n');
  console.log('Run these commands to commit:');
  console.log('  git add .env .env.local');
  console.log('  git commit -m "fix: update app_user credentials for RLS"');
  console.log('  git push\n');

  console.log('════════════════════════════════════════════════════════════\n');
  console.log('✅ Setup complete!\n');

  rl.close();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});
