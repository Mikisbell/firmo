/**
 * PRUEBA de RESUMEN DIARIO (RC) contra SUNAT BETA: sendSummary -> ticket -> poll getStatus.
 * Uso: bun prisma/cleanup/verify-sunat-rc.ts
 */
import { readFileSync } from 'node:fs';
import { generateSummaryXml, type UblResumenDiario } from '@/src/core/integrations/sunat/sunat-ubl';
import { signXmlSunat } from '@/src/core/integrations/sunat/sunat-signer';
import { SunatSoapClient } from '@/src/core/integrations/sunat/sunat-soap';

const CERT_DIR = 'E:/tmp/sunat-test';
const BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const certificatePem = readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8');
  const privateKeyPem = readFileSync(`${CERT_DIR}/key.pem`, 'utf-8');

  const resumen: UblResumenDiario = {
    id: 'RC-20260619-1',
    fechaReferencia: '2026-06-19',
    fechaEmision: '2026-06-19',
    moneda: 'PEN',
    emisor: {
      ruc: '20000000001', razonSocial: 'EMPRESA DE PRUEBA SAC', ubigeo: '150101',
      departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA', direccion: 'AV PRUEBA 123',
    },
    boletas: [
      {
        tipoDoc: '03', serieNumero: 'B001-100', clienteTipo: '1', clienteNumero: '12345678',
        estado: '1', totalGravado: 100, totalIgv: 18, totalPrecio: 118,
      },
    ],
  };

  const xml = generateSummaryXml(resumen);
  const signed = signXmlSunat(xml, certificatePem, privateKeyPem);
  if (!signed.success || !signed.signedXml) { console.log('❌ firma:', signed.error); return; }

  const client = new SunatSoapClient(BETA, { ruc: '20000000001', solUser: 'MODDATOS', solPassword: 'moddatos' });

  console.log('>> sendSummary (RC) -> SUNAT BETA...');
  const send = await client.sendSummary('20000000001-RC-20260619-1', signed.signedXml);
  if (!send.success || !send.ticket) {
    console.log('❌ sendSummary fallo:', send.error);
    return;
  }
  console.log('   ticket:', send.ticket);

  console.log('>> consultando estado (poll)...');
  for (let i = 0; i < 12; i++) {
    await sleep(4000);
    const st = await client.getStatus(send.ticket);
    console.log(`   intento ${i + 1}: statusCode=${st.statusCode} responseCode=${st.responseCode} ${st.error ?? ''}`);
    // statusCode SUNAT: 98=en proceso, 0=procesado con CDR, 99=procesado con errores
    if (st.statusCode && st.statusCode !== '98') {
      if (st.responseCode === '0' || st.statusCode === '0') {
        console.log('\n✅✅✅ RESUMEN DIARIO ACEPTADO por SUNAT BETA (CDR responseCode', st.responseCode, ')');
      } else {
        console.log('\n⚠️ Procesado con observaciones/errores. responseCode:', st.responseCode);
      }
      return;
    }
  }
  console.log('\n⏳ Sigue en proceso tras el poll (BETA puede tardar). Ticket:', send.ticket);
}

main().catch((e) => { console.error('💥', e instanceof Error ? e.message : e); process.exit(1); });
