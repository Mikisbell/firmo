/**
 * Convert PFX/PKCS12 certificate to PEM format
 * 
 * Usage: node scripts/convert-pfx-to-pem.js <pfx-file> [password]
 * 
 * Outputs:
 * - certificate.pem (public certificate)
 * - private-key.pem (private key)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Get arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/convert-pfx-to-pem.js <pfx-file> [password]');
  console.error('Example: node scripts/convert-pfx-to-pem.js LLAMA-PE-CERTIFICADO-DEMO-10437086619.pfx');
  process.exit(1);
}

const pfxFile = args[0];
const password = args[1] || ''; // Empty password if not provided

// Check if file exists
if (!fs.existsSync(pfxFile)) {
  console.error(`Error: File not found: ${pfxFile}`);
  process.exit(1);
}

const baseName = path.basename(pfxFile, path.extname(pfxFile));
const certOutput = `${baseName}-certificate.pem`;
const keyOutput = `${baseName}-private-key.pem`;

console.log('Converting PFX to PEM format...');
console.log(`Input: ${pfxFile}`);
console.log(`Output certificate: ${certOutput}`);
console.log(`Output private key: ${keyOutput}`);
console.log('');

try {
  // Read PFX file
  const pfxData = fs.readFileSync(pfxFile);
  
  // Parse PKCS12 - try to extract private key
  let privateKey;
  try {
    privateKey = crypto.createPrivateKey({
      key: pfxData,
      format: 'pkcs12',
      passphrase: password
    });
  } catch (err) {
    if (password === '') {
      console.error('Error: Certificate requires a password. Please provide it as second argument.');
      console.error('Usage: node scripts/convert-pfx-to-pem.js <pfx-file> <password>');
      process.exit(1);
    }
    throw err;
  }
  
  // Extract private key
  const privateKeyPem = privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  });
  
  // Save private key
  fs.writeFileSync(keyOutput, privateKeyPem);
  console.log(`✅ Private key saved to: ${keyOutput}`);
  
  // For certificate extraction, Node.js has limitations
  console.log('');
  console.log('⚠️  Certificate extraction requires OpenSSL');
  console.log('');
  console.log('Options to extract the certificate:');
  console.log('');
  console.log('1. Install Git for Windows (includes OpenSSL):');
  console.log('   https://git-scm.com/download/win');
  console.log('   Then open Git Bash and run:');
  console.log(`   openssl pkcs12 -in ${pfxFile} -clcerts -nokeys -out ${certOutput}`);
  console.log('');
  console.log('2. Install OpenSSL for Windows:');
  console.log('   https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   Then run in PowerShell:');
  console.log(`   openssl pkcs12 -in ${pfxFile} -clcerts -nokeys -out ${certOutput}`);
  console.log('');
  console.log('3. Use WSL (Windows Subsystem for Linux):');
  console.log(`   wsl openssl pkcs12 -in ${pfxFile} -clcerts -nokeys -out ${certOutput}`);
  
} catch (error) {
  console.error('Error converting certificate:');
  console.error(error.message);
  console.log('');
  console.log('Please install OpenSSL and run:');
  console.log(`  openssl pkcs12 -in ${pfxFile} -clcerts -nokeys -out ${certOutput}`);
  console.log(`  openssl pkcs12 -in ${pfxFile} -nocerts -nodes -out ${keyOutput}`);
  process.exit(1);
}
