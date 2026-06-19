/**
 * PRUEBA de FACTURA (01) contra SUNAT BETA con el generador propio (receptor RUC).
 * Uso: bun prisma/cleanup/verify-sunat-factura.ts
 */
import { readFileSync } from 'node:fs';
import { generateComprobanteXml, type UblComprobante } from '@/src/core/integrations/sunat/sunat-ubl';
import { signXmlSunat } from '@/src/core/integrations/sunat/sunat-signer';
import { SunatSoapClient } from '@/src/core/integrations/sunat/sunat-soap';

const CERT_DIR = 'E:/tmp/sunat-test';
const BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';

async function main() {
  const certificatePem = readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8');
  const privateKeyPem = readFileSync(`${CERT_DIR}/key.pem`, 'utf-8');

  const factura: UblComprobante = {
    tipoDoc: '01',
    serie: 'F001',
    numero: '1',
    fechaEmision: '2026-06-19',
    horaEmision: '10:00:00',
    moneda: 'PEN',
    emisor: {
      ruc: '20000000001',
      razonSocial: 'EMPRESA DE PRUEBA SAC',
      ubigeo: '150101',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'LIMA',
      direccion: 'AV PRUEBA 123',
    },
    // Factura -> receptor RUC (tipoDoc '6')
    cliente: { tipoDoc: '6', numDoc: '20123456789', razonSocial: 'CLIENTE EMPRESA SAC' },
    items: [
      {
        cantidad: 2,
        unidad: 'NIU',
        descripcion: 'POLLO A LA BRASA',
        codigo: 'POLLO01',
        valorUnitario: 50,
        precioUnitarioConIgv: 59,
        valorVenta: 100,
        igv: 18,
      },
    ],
    totalGravado: 100,
    totalIgv: 18,
    totalPrecio: 118,
  };

  const xml = generateComprobanteXml(factura);
  const signed = signXmlSunat(xml, certificatePem, privateKeyPem);
  if (!signed.success || !signed.signedXml) {
    console.log('❌ Error firmando:', signed.error);
    return;
  }

  const client = new SunatSoapClient(BETA, { ruc: '20000000001', solUser: 'MODDATOS', solPassword: 'moddatos' });
  const res = await client.sendBill('20000000001-01-F001-1', signed.signedXml);

  if (res.accepted) {
    console.log('\n✅✅✅ FACTURA ACEPTADA POR SUNAT BETA');
    console.log('   responseCode:', res.responseCode);
    console.log('   description :', res.description);
  } else {
    console.log('\n❌ NO aceptada');
    console.log('   responseCode:', res.responseCode, '| description:', res.description, '| error:', res.error);
  }
}

main().catch((e) => {
  console.error('\n💥 EXCEPCION:', e instanceof Error ? e.message : e);
  process.exit(1);
});
