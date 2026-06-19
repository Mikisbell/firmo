/**
 * PRUEBA REAL contra SUNAT BETA con el generador UBL PROPIO (sunat-ubl) + firma propia
 * (sunat-signer) + SOAP propio (sunat-soap). Boleta con los montos del ejemplo aceptado.
 * Uso: bun prisma/cleanup/verify-sunat-beta2.ts
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

  const comprobante: UblComprobante = {
    tipoDoc: '03',
    serie: 'B001',
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
    cliente: { tipoDoc: '1', numDoc: '12345678', razonSocial: 'CLIENTE DE PRUEBA' },
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

  const xml = generateComprobanteXml(comprobante);
  console.log('>> XML generado:', xml.length, 'bytes. Leyenda incluida:', xml.includes('SON CIENTO'));

  const signed = signXmlSunat(xml, certificatePem, privateKeyPem);
  if (!signed.success || !signed.signedXml) {
    console.log('❌ Error firmando:', signed.error);
    return;
  }
  console.log('>> Firmado OK. Enviando a SUNAT BETA...');

  const client = new SunatSoapClient(BETA, { ruc: '20000000001', solUser: 'MODDATOS', solPassword: 'moddatos' });
  const res = await client.sendBill('20000000001-03-B001-1', signed.signedXml);

  if (res.accepted) {
    console.log('\n✅✅✅ ACEPTADO POR SUNAT BETA');
    console.log('   responseCode:', res.responseCode);
    console.log('   description :', res.description);
  } else {
    console.log('\n❌ NO aceptado');
    console.log('   success     :', res.success);
    console.log('   responseCode:', res.responseCode);
    console.log('   description :', res.description);
    console.log('   error       :', res.error);
  }
}

main().catch((e) => {
  console.error('\n💥 EXCEPCION:', e instanceof Error ? e.message : e);
  process.exit(1);
});
