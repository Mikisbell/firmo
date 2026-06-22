/**
 * PRUEBA REAL contra SUNAT BETA (ambiente de pruebas, gratis, sin identidad real).
 * Emite una boleta de prueba con las credenciales publicas de SUNAT y un certificado
 * autofirmado. Exito = CDR responseCode '0' (ACEPTADO).
 *
 * Uso: bun prisma/cleanup/verify-sunat-beta.ts
 *   (requiere cert/key de prueba en E:/tmp/sunat-test/ — generados con openssl)
 */
import { readFileSync } from 'node:fs';
import { SunatDirectAdapterImpl } from '@/src/core/integrations/sunat/sunat-direct-adapter';
import type { InvoiceData } from '@/src/core/integrations/sunat/client';

const CERT_DIR = 'E:/tmp/sunat-test';

async function main() {
  const certificatePem = readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8');
  const privateKeyPem = readFileSync(`${CERT_DIR}/key.pem`, 'utf-8');

  const adapter = new SunatDirectAdapterImpl({
    ruc: '20000000001',
    solUser: 'MODDATOS',
    solPassword: 'moddatos',
    certificatePem,
    privateKeyPem,
    mode: 'BETA',
    emisor: {
      ruc: '20000000001',
      razonSocial: 'EMPRESA DE PRUEBA SAC',
      ubigeo: '150101',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'LIMA',
      direccion: 'AV PRUEBA 123',
    },
  });

  // Boleta de prueba: 1 pollo a S/25.00 (bruto, con IGV). Montos en CENTAVOS.
  // gravada = 2500/1.18 = 2119 ; igv = 381 ; total = 2500.
  const boleta: InvoiceData = {
    serie: 'B001',
    numero: '1',
    tipo: '03',
    fechaEmision: '2026-06-19',
    tipoDocumentoCliente: '1',
    numeroDocumentoCliente: '12345678',
    razonSocialCliente: 'CLIENTE DE PRUEBA',
    moneda: 'PEN',
    totalGravadas: 2119,
    totalIgv: 381,
    totalImporte: 2500,
    items: [
      {
        codigo: 'POLLO01',
        descripcion: 'POLLO A LA BRASA',
        cantidad: 1,
        unidadMedida: 'NIU',
        precioUnitario: 2500,
        precioTotal: 2500,
        igv: 381,
      },
    ],
  };

  console.log('>> Enviando boleta de prueba a SUNAT BETA (RUC 20000000001)...');
  const result = await adapter.sendInvoice(boleta);

  if (result.success) {
    console.log('\n✅ ACEPTADO POR SUNAT BETA');
    console.log('   responseCode:', result.data.cdrResponseCode);
    console.log('   mensaje     :', result.data.cdrResponseMessage);
    console.log('   hash        :', result.data.hash);
    console.log('   PDF generado:', result.data.pdfBase64 ? 'si' : 'no');
  } else {
    console.log('\n❌ RECHAZADO / ERROR');
    console.log('   code   :', result.error.code);
    console.log('   message:', result.error.message);
    console.log('   context:', JSON.stringify(result.error.context ?? {}));
  }
}

main().catch((e) => {
  console.error('\n💥 EXCEPCION NO MANEJADA:', e instanceof Error ? e.message : e);
  console.error(e instanceof Error ? e.stack : '');
  process.exit(1);
});
