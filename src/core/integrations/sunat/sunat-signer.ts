/**
 * Firma XAdES-BES de comprobantes SUNAT (UBL 2.1) con xml-crypto v6.
 *
 * Reemplaza la firma de nodefact, que esta rota para xml-crypto >=6 (no setea
 * canonicalizationAlgorithm/signatureAlgorithm y usa la API vieja keyInfoProvider).
 * La firma enveloped va DENTRO del nodo ext:ExtensionContent, con Reference URI=""
 * (documento completo), transforms enveloped + C14N, digest SHA1, RSA-SHA1.
 *
 * @module core/integrations/sunat/sunat-signer
 */
import { SignedXml } from 'xml-crypto';

export interface SunatSignResult {
  success: boolean;
  signedXml?: string;
  error?: string;
}

const ALG = {
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  sha1: 'http://www.w3.org/2000/09/xmldsig#sha1',
} as const;

/** Namespace UBL donde vive el nodo ExtensionContent que aloja la firma. */
const EXTENSION_CONTENT_XPATH = "//*[local-name(.)='ExtensionContent']";

/** Convierte un certificado PEM a base64 puro (sin cabeceras ni saltos) para <X509Certificate>. */
function certToBase64(certPem: string): string {
  return certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Firma un XML UBL 2.1 segun el esquema SUNAT.
 * @param xml XML sin firmar (debe contener ext:ExtensionContent)
 * @param certPem certificado en PEM
 * @param keyPem clave privada en PEM
 */
export function signXmlSunat(xml: string, certPem: string, keyPem: string): SunatSignResult {
  try {
    const certB64 = certToBase64(certPem);

    const sig = new SignedXml({
      privateKey: keyPem,
      publicCert: certPem,
      signatureAlgorithm: ALG.rsaSha1,
      canonicalizationAlgorithm: ALG.c14n,
      getKeyInfoContent: () =>
        `<X509Data><X509Certificate>${certB64}</X509Certificate></X509Data>`,
    });

    // Reference URI="" -> firma todo el documento (enveloped).
    sig.addReference({
      xpath: '/*',
      transforms: [ALG.enveloped, ALG.c14n],
      digestAlgorithm: ALG.sha1,
      isEmptyUri: true,
    });

    // La firma se inserta DENTRO de ext:ExtensionContent.
    sig.computeSignature(xml, {
      location: { reference: EXTENSION_CONTENT_XPATH, action: 'append' },
    });

    return { success: true, signedXml: sig.getSignedXml() };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
