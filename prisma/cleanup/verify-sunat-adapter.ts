/**
 * PRUEBA del ADAPTER real (SunatDirectAdapterImpl.sendInvoice) contra SUNAT BETA.
 * Valida el camino productivo: InvoiceData (centavos) -> mapToUbl -> generador UBL -> firma -> SOAP.
 * Uso: bun prisma/cleanup/verify-sunat-adapter.ts
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
      direccion: 'AV PRUEBA 123',
      ubigeo: '150101',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'LIMA',
    },
  });

  // InvoiceData en CENTAVOS. precioUnitario = bruto CON IGV por unidad.
  // 2 unidades a S/59 c/u (con IGV) -> gravado 100, IGV 18, total 118.
  const boleta: InvoiceData = {
    serie: 'B001',
    numero: '5',
    tipo: '03',
    fechaEmision: '2026-06-19',
    tipoDocumentoCliente: '1',
    numeroDocumentoCliente: '12345678',
    razonSocialCliente: 'CLIENTE DE PRUEBA',
    moneda: 'PEN',
    totalGravadas: 10000,
    totalIgv: 1800,
    totalImporte: 11800,
    items: [
      {
        codigo: 'POLLO01',
        descripcion: 'POLLO A LA BRASA',
        cantidad: 2,
        unidadMedida: 'NIU',
        precioUnitario: 5900,
        precioTotal: 11800,
        igv: 1800,
      },
    ],
  };

  console.log('>> adapter.sendInvoice() -> SUNAT BETA...');
  const result = await adapter.sendInvoice(boleta);

  if (result.success) {
    console.log('\n✅✅✅ ADAPTER OK - ACEPTADO POR SUNAT BETA');
    console.log('   responseCode:', result.data.cdrResponseCode);
    console.log('   mensaje     :', result.data.cdrResponseMessage);
    console.log('   hash        :', result.data.hash);
  } else {
    console.log('\n❌ ERROR');
    console.log('   code   :', result.error.code);
    console.log('   message:', result.error.message);
    console.log('   context:', JSON.stringify(result.error.context ?? {}));
  }
}

main().catch((e) => {
  console.error('\n💥 EXCEPCION:', e instanceof Error ? e.message : e);
  process.exit(1);
});
