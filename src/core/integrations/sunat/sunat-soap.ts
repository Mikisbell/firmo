/**
 * Cliente SOAP propio para el billService de SUNAT (UBL 2.1).
 *
 * Reemplaza el cliente de nodefact, roto en varias capas: (1) pasaba el endpoint sin `?wsdl`
 * como URL del WSDL; (2) usaba HTTP Basic en vez de WS-Security UsernameToken; (3) no zipeaba
 * el XML (SUNAT exige un ZIP) ni des-zipeaba el CDR de la respuesta.
 *
 * SUNAT sendBill: recibe {fileName: RUC-tipo-serie-numero.zip, contentFile: base64(zip(xml))}.
 * La respuesta applicationResponse es base64(zip(CDR)); el CDR (R-*.xml) trae ResponseCode
 * (0 = ACEPTADO) y Description.
 *
 * @module core/integrations/sunat/sunat-soap
 */
import * as soap from 'soap';
import JSZip from 'jszip';
import { getSunatWsdlPath } from './sunat-wsdl';

export interface SunatSoapCredentials {
  ruc: string;
  solUser: string;
  solPassword: string;
}

export interface SendBillResult {
  /** El SOAP respondio sin fault. */
  success: boolean;
  /** El CDR de SUNAT acepto el comprobante (ResponseCode 0). */
  accepted: boolean;
  responseCode?: string;
  description?: string;
  /** CDR XML descomprimido. */
  cdr?: string;
  error?: string;
}

export interface SendSummaryResult {
  success: boolean;
  ticket?: string;
  error?: string;
}

export interface GetStatusResult {
  success: boolean;
  /** CDR XML descomprimido (cuando ya esta listo). */
  cdr?: string;
  responseCode?: string;
  statusCode?: string;
  error?: string;
}

/** Comprime un XML en un ZIP y devuelve el base64 (lo que espera contentFile). */
async function zipToBase64(entryName: string, xml: string): Promise<string> {
  const zip = new JSZip();
  zip.file(entryName, xml);
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

/** Descomprime el applicationResponse (base64 zip) y devuelve el primer XML que encuentre. */
async function unzipFirstXml(base64Zip: string): Promise<string | null> {
  const zip = await JSZip.loadAsync(base64Zip, { base64: true });
  const xmlFile = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.xml'));
  return xmlFile ? xmlFile.async('string') : null;
}

/** Extrae ResponseCode y Description del CDR (tolerante a prefijos de namespace). */
function parseCdr(cdrXml: string): { responseCode?: string; description?: string } {
  const code = cdrXml.match(/ResponseCode>\s*(\d+)\s*</)?.[1];
  const desc = cdrXml.match(/Description>\s*([^<]*?)\s*</)?.[1];
  return { responseCode: code, description: desc };
}

/** Saca el faultstring/mensaje de un error SOAP de SUNAT. */
function soapFault(e: unknown): string {
  const err = e as { body?: string; message?: string; root?: { Envelope?: { Body?: { Fault?: { faultstring?: string } } } } };
  return (
    err?.root?.Envelope?.Body?.Fault?.faultstring ||
    err?.body ||
    err?.message ||
    String(e)
  );
}

export class SunatSoapClient {
  private cached: soap.Client | null = null;

  constructor(
    private readonly endpoint: string,
    private readonly credentials: SunatSoapCredentials,
    private readonly timeout = 30_000,
  ) {}

  private async client(): Promise<soap.Client> {
    if (this.cached) return this.cached;
    // WSDL local (imports ya resueltos a archivos); el POST va al endpoint segun el modo.
    const c = await soap.createClientAsync(getSunatWsdlPath(), {
      endpoint: this.endpoint,
      wsdl_options: { timeout: this.timeout },
    });
    // WS-Security UsernameToken: Username = RUC + usuario SOL ; Password = clave SOL (PasswordText).
    const username = `${this.credentials.ruc}${this.credentials.solUser}`;
    c.setSecurity(
      new soap.WSSecurity(username, this.credentials.solPassword, {
        passwordType: 'PasswordText',
        hasTimeStamp: false,
        hasNonce: false,
      }),
    );
    this.cached = c;
    return c;
  }

  /** Envia una factura/boleta. fileBase = RUC-tipo-serie-numero (sin extension). */
  async sendBill(fileBase: string, signedXml: string): Promise<SendBillResult> {
    try {
      const contentFile = await zipToBase64(`${fileBase}.xml`, signedXml);
      const client = await this.client();
      const [res] = await client.sendBillAsync({ fileName: `${fileBase}.zip`, contentFile });
      const appResponse: string | undefined = res?.applicationResponse;
      if (!appResponse) {
        return { success: true, accepted: false, error: 'SUNAT no devolvio applicationResponse (CDR)' };
      }
      const cdr = await unzipFirstXml(appResponse);
      const { responseCode, description } = cdr ? parseCdr(cdr) : {};
      return {
        success: true,
        accepted: responseCode === '0',
        responseCode,
        description,
        cdr: cdr ?? undefined,
      };
    } catch (e) {
      return { success: false, accepted: false, error: soapFault(e) };
    }
  }

  /** Envia un resumen diario (RC) o comunicacion de baja (RA). Devuelve un ticket asincrono. */
  async sendSummary(fileBase: string, signedXml: string): Promise<SendSummaryResult> {
    try {
      const contentFile = await zipToBase64(`${fileBase}.xml`, signedXml);
      const client = await this.client();
      const [res] = await client.sendSummaryAsync({ fileName: `${fileBase}.zip`, contentFile });
      return { success: true, ticket: res?.ticket };
    } catch (e) {
      return { success: false, error: soapFault(e) };
    }
  }

  /** Consulta el estado de un ticket (resumen/baja). */
  async getStatus(ticket: string): Promise<GetStatusResult> {
    try {
      const client = await this.client();
      const [res] = await client.getStatusAsync({ ticket });
      const statusCode: string | undefined = res?.status?.statusCode;
      const contentZip: string | undefined = res?.status?.content;
      const cdr = contentZip ? await unzipFirstXml(contentZip) : null;
      const { responseCode } = cdr ? parseCdr(cdr) : {};
      return { success: true, statusCode, responseCode, cdr: cdr ?? undefined };
    } catch (e) {
      return { success: false, error: soapFault(e) };
    }
  }
}
