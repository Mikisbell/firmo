/**
 * Setup app_user for RLS Testing
 * 
 * Crea el usuario app_user en Supabase si no existe
 * Este usuario tiene RLS habilitado (no bypassa RLS)
 * 
 * Ejecutar: npx ts-node scripts/setup-app-user-rls.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ncwdmdjnelopikpgrhty.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAppUser() {
  console.log('🔧 Setting up app_user for RLS Testing\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Create app_user if it doesn't exist
    console.log('\n1️⃣  Creating app_user...');
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'app_user@parkpos.local',
      password: 'AppUser123!@#',
      email_confirm: true,
    });

    if (error && !error.message.includes('already exists')) {
      throw error;
    }

    if (data?.user) {
      console.log(`   ✅ Created app_user: ${data.user.id}`);
    } else {
      console.log(`   ℹ️  app_user already exists`);
    }

    // Step 2: Get app_user credentials
    console.log('\n2️⃣  Getting app_user credentials...');
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'app_user@parkpos.local',
      password: 'AppUser123!@#',
    });

    if (signInError) {
      throw signInError;
    }

    const appUserToken = signInData?.session?.access_token;
    if (!appUserToken) {
      throw new Error('Failed to get app_user token');
    }

    console.log(`   ✅ Got app_user token`);

    // Step 3: Create DATABASE_URL_APP_USER
    console.log('\n3️⃣  Creating DATABASE_URL_APP_USER...');
    
    const dbUrl = process.env.DATABASE_URL || '';
    const dbUrlAppUser = dbUrl.replace(
      /postgresql:\/\/[^:]+:[^@]+@/,
      `postgresql://app_user:${appUserToken}@`
    );

    console.log(`   ✅ DATABASE_URL_APP_USER created`);

    // Step 4: Update .env file
    console.log('\n4️⃣  Updating .env file...');
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Add or update DATABASE_URL_APP_USER
    if (envContent.includes('DATABASE_URL_APP_USER')) {
      envContent = envContent.replace(
        /DATABASE_URL_APP_USER=.*/,
        `DATABASE_URL_APP_USER="${dbUrlAppUser}"`
      );
    } else {
      envContent += `\n# App User for RLS Testing (has RLS enabled)\nDATABASE_URL_APP_USER="${dbUrlAppUser}"\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`   ✅ Updated .env file`);

    // Step 5: Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Setup Complete!\n');
    console.log('Next steps:');
    console.log('1. Reload your environment: source .env');
    console.log('2. Run RLS tests: npx ts-node scripts/test-rls-isolation-real.ts');
    console.log('\n' + '═'.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

setupAppUser();
