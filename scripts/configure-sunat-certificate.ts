/**
 * Configure SUNAT Certificate in Database
 * 
 * This script reads the PEM certificate and private key files,
 * encrypts them using AES-256-GCM, and stores them in tenant_settings.
 * 
 * Usage: npx tsx scripts/configure-sunat-certificate.ts <tenant-id>
 */

import fs from 'fs';
import prisma from '../src/core/db/prisma';
import { encryptCredential } from '../src/core/integrations/sunat/credential-encryption';

const CERT_FILE = 'LLAMA-PE-CERTIFICADO-DEMO-10437086619-certificate.pem';
const KEY_FILE = 'LLAMA-PE-CERTIFICADO-DEMO-10437086619-private-key.pem';

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: npx tsx scripts/configure-sunat-certificate.ts <tenant-id>');
    console.error('Example: npx tsx scripts/configure-sunat-certificate.ts 550e8400-e29b-41d4-a716-446655440000');
    process.exit(1);
  }

  console.log('🔐 Configuring SUNAT Certificate...');
  console.log(`Tenant ID: ${tenantId}`);
  console.log('');

  // Check if files exist
  if (!fs.existsSync(CERT_FILE)) {
    console.error(`❌ Certificate file not found: ${CERT_FILE}`);
    console.error('Run: node scripts/convert-pfx-to-pem.js first');
    process.exit(1);
  }

  if (!fs.existsSync(KEY_FILE)) {
    console.error(`❌ Private key file not found: ${KEY_FILE}`);
    console.error('Run: node scripts/convert-pfx-to-pem.js first');
    process.exit(1);
  }

  // Read PEM files
  console.log('📄 Reading PEM files...');
  const certPem = fs.readFileSync(CERT_FILE, 'utf8');
  const keyPem = fs.readFileSync(KEY_FILE, 'utf8');

  // Extract only the PEM content (remove Bag Attributes)
  const certPemClean = certPem
    .split('-----BEGIN CERTIFICATE-----')[1]
    ?.split('-----END CERTIFICATE-----')[0];
  
  const keyPemClean = keyPem
    .split('-----BEGIN PRIVATE KEY-----')[1]
    ?.split('-----END PRIVATE KEY-----')[0];

  if (!certPemClean || !keyPemClean) {
    console.error('❌ Failed to extract PEM content');
    process.exit(1);
  }

  const certificatePem = `-----BEGIN CERTIFICATE-----${certPemClean}-----END CERTIFICATE-----`;
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----${keyPemClean}-----END PRIVATE KEY-----`;

  console.log(`✅ Certificate: ${certificatePem.length} bytes`);
  console.log(`✅ Private Key: ${privateKeyPem.length} bytes`);
  console.log('');

  // Encrypt credentials
  console.log('🔒 Encrypting credentials with AES-256-GCM...');
  const encryptedCert = encryptCredential(certificatePem);
  const encryptedKey = encryptCredential(privateKeyPem);
  console.log('✅ Credentials encrypted');
  console.log('');

  // Certificate expiration date (from the PEM file: 2028-03-05)
  const certExpiresAt = new Date('2028-03-05T15:50:17Z');

  // Update tenant_settings
  console.log('💾 Updating tenant_settings...');
  
  try {
    const result = await prisma.tenant_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        legal_name: 'TU EMPRESA S.A.', // From certificate
        sunat_mode: 'BETA', // Start with BETA for testing
        sunat_sol_user: 'MODDATOS', // SUNAT BETA default user
        sunat_sol_password: encryptCredential('moddatos'), // SUNAT BETA default password
        sunat_certificate_pem: encryptedCert,
        sunat_private_key_pem: encryptedKey,
        sunat_cert_expires_at: certExpiresAt,
        nubefact_token: null,
        nubefact_url: null,
      },
      update: {
        sunat_mode: 'BETA',
        sunat_sol_user: 'MODDATOS',
        sunat_sol_password: encryptCredential('moddatos'),
        sunat_certificate_pem: encryptedCert,
        sunat_private_key_pem: encryptedKey,
        sunat_cert_expires_at: certExpiresAt,
      },
    });

    console.log('✅ Configuration saved successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Tenant ID: ${result.tenant_id}`);
    console.log(`   SUNAT Mode: ${result.sunat_mode}`);
    console.log(`   SOL User: ${result.sunat_sol_user}`);
    console.log(`   Certificate expires: ${certExpiresAt.toISOString()}`);
    console.log(`   Days until expiration: ${Math.floor((certExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Test invoice emission against SUNAT BETA');
    console.log('   2. Fix 2 bugs in queue worker (items:[], razonSocialCliente:\'\')');
    console.log('   3. Switch to PRODUCTION mode when ready');
    console.log('');
    console.log('🧪 Test command:');
    console.log('   npm test -- src/core/integrations/sunat/__tests__/sunat-direct-adapter.test.ts');

  } catch (error) {
    console.error('❌ Failed to update tenant_settings:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
