/** PRUEBA de COMUNICACION DE BAJA (RA) contra SUNAT BETA. Uso: bun prisma/cleanup/verify-sunat-ra.ts */
import { readFileSync } from 'node:fs';
import { generateVoidedXml, type UblComunicacionBaja } from '@/src/core/integrations/sunat/sunat-ubl';
import { signXmlSunat } from '@/src/core/integrations/sunat/sunat-signer';
import { SunatSoapClient } from '@/src/core/integrations/sunat/sunat-soap';

const CERT_DIR = 'E:/tmp/sunat-test';
const BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const certificatePem = readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8');
  const privateKeyPem = readFileSync(`${CERT_DIR}/key.pem`, 'utf-8');

  const baja: UblComunicacionBaja = {
    id: 'RA-20260619-1',
    fechaReferencia: '2026-06-19',
    fechaEmision: '2026-06-19',
    emisor: {
      ruc: '20000000001', razonSocial: 'EMPRESA DE PRUEBA SAC', ubigeo: '150101',
      departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA', direccion: 'AV PRUEBA 123',
    },
    documentos: [{ tipoDoc: '01', serie: 'F001', numero: '1', motivo: 'ERROR EN LOS DATOS DEL COMPROBANTE' }],
  };

  const xml = generateVoidedXml(baja);
  const signed = signXmlSunat(xml, certificatePem, privateKeyPem);
  if (!signed.success || !signed.signedXml) { console.log('❌ firma:', signed.error); return; }

  const client = new SunatSoapClient(BETA, { ruc: '20000000001', solUser: 'MODDATOS', solPassword: 'moddatos' });
  console.log('>> sendSummary (RA baja) -> SUNAT BETA...');
  const send = await client.sendSummary('20000000001-RA-20260619-1', signed.signedXml);
  if (!send.success || !send.ticket) { console.log('❌ sendSummary:', send.error); return; }
  console.log('   ticket:', send.ticket);

  for (let i = 0; i < 12; i++) {
    await sleep(4000);
    const st = await client.getStatus(send.ticket);
    console.log(`   intento ${i + 1}: statusCode=${st.statusCode} responseCode=${st.responseCode} ${st.error ?? ''}`);
    if (st.statusCode && st.statusCode !== '98') {
      if (st.responseCode === '0' || st.statusCode === '0') console.log('\n✅✅✅ COMUNICACION DE BAJA ACEPTADA por SUNAT BETA (responseCode', st.responseCode, ')');
      else console.log('\n⚠️ Procesado con observaciones. responseCode:', st.responseCode);
      return;
    }
  }
  console.log('\n⏳ Sigue en proceso. Ticket:', send.ticket);
}

main().catch((e) => { console.error('💥', e instanceof Error ? e.message : e); process.exit(1); });
