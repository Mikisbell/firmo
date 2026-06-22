/** PRUEBA de NOTA DE DEBITO (08) contra SUNAT BETA. Uso: bun prisma/cleanup/verify-sunat-nd.ts */
import { readFileSync } from 'node:fs';
import { generateDebitNoteXml, type UblNotaDebito } from '@/src/core/integrations/sunat/sunat-ubl';
import { signXmlSunat } from '@/src/core/integrations/sunat/sunat-signer';
import { SunatSoapClient } from '@/src/core/integrations/sunat/sunat-soap';

const CERT_DIR = 'E:/tmp/sunat-test';
const BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';

async function main() {
  const certificatePem = readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8');
  const privateKeyPem = readFileSync(`${CERT_DIR}/key.pem`, 'utf-8');

  const nd: UblNotaDebito = {
    serie: 'FD01',
    numero: '1',
    fechaEmision: '2026-06-19',
    horaEmision: '11:30:00',
    moneda: 'PEN',
    docModificado: { serie: 'F001', numero: '1', tipo: '01' },
    motivoCodigo: '02', // Catalogo 10: aumento en el valor
    motivoDescripcion: 'AUMENTO EN EL VALOR',
    emisor: {
      ruc: '20000000001', razonSocial: 'EMPRESA DE PRUEBA SAC', ubigeo: '150101',
      departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA', direccion: 'AV PRUEBA 123',
    },
    cliente: { tipoDoc: '6', numDoc: '20123456789', razonSocial: 'CLIENTE EMPRESA SAC' },
    items: [{
      cantidad: 2, unidad: 'NIU', descripcion: 'RECARGO POLLO A LA BRASA', codigo: 'POLLO01',
      valorUnitario: 50, precioUnitarioConIgv: 59, valorVenta: 100, igv: 18,
    }],
    totalGravado: 100, totalIgv: 18, totalPrecio: 118,
  };

  const xml = generateDebitNoteXml(nd);
  const signed = signXmlSunat(xml, certificatePem, privateKeyPem);
  if (!signed.success || !signed.signedXml) { console.log('❌ firma:', signed.error); return; }

  const client = new SunatSoapClient(BETA, { ruc: '20000000001', solUser: 'MODDATOS', solPassword: 'moddatos' });
  const res = await client.sendBill('20000000001-08-FD01-1', signed.signedXml);

  if (res.accepted) console.log('\n✅✅✅ NOTA DE DEBITO ACEPTADA:', res.responseCode, '|', res.description);
  else console.log('\n❌ NO aceptada:', res.responseCode, '|', res.description, '|', res.error);
}

main().catch((e) => { console.error('💥', e instanceof Error ? e.message : e); process.exit(1); });
