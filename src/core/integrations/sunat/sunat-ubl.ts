/**
 * Generador de XML UBL 2.1 para comprobantes SUNAT: factura (01), boleta (03) y nota de
 * credito (07).
 *
 * Reemplaza el generateXML de nodefact, que es un stub vacio. La estructura sigue la guia
 * oficial SUNAT UBL 2.1 y XML de referencia aceptados (greenter). Montos en SOLES (no centavos)
 * con 2 decimales. La firma (ds:Signature) la inserta el firmador en ext:ExtensionContent.
 * Validado contra SUNAT BETA: boleta, factura y nota de credito aceptadas (responseCode 0).
 *
 * @module core/integrations/sunat/sunat-ubl
 */

export interface UblEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  /** Codigo de local anexo (0000 = principal). */
  codigoLocal?: string;
}

export interface UblCliente {
  /** Catalogo 06: 1=DNI, 6=RUC, 0=sin doc, 4=CE, 7=Pasaporte. */
  tipoDoc: string;
  numDoc: string;
  razonSocial: string;
}

export interface UblItem {
  cantidad: number;
  /** Unidad de medida (catalogo 03), p.ej. NIU, ZZ, KGM. */
  unidad: string;
  descripcion: string;
  codigo?: string;
  /** Valor unitario SIN IGV. */
  valorUnitario: number;
  /** Precio unitario CON IGV (referencial, PriceTypeCode 01). */
  precioUnitarioConIgv: number;
  /** Valor de venta de la linea (cantidad * valorUnitario, sin IGV). */
  valorVenta: number;
  /** IGV de la linea. */
  igv: number;
}

export interface UblComprobante {
  /** '01' = factura, '03' = boleta. */
  tipoDoc: '01' | '03';
  serie: string;
  numero: string;
  /** YYYY-MM-DD */
  fechaEmision: string;
  /** HH:MM:SS */
  horaEmision: string;
  /** Catalogo 02: PEN, USD. */
  moneda: string;
  emisor: UblEmisor;
  cliente: UblCliente;
  items: UblItem[];
  /** Total operaciones gravadas (sin IGV). */
  totalGravado: number;
  /** Total IGV. */
  totalIgv: number;
  /** Importe total (con IGV). */
  totalPrecio: number;
}

export interface UblNotaCredito {
  serie: string;
  numero: string;
  fechaEmision: string;
  horaEmision: string;
  moneda: string;
  /** Comprobante que se modifica. */
  docModificado: { serie: string; numero: string; tipo: '01' | '03' };
  /** Catalogo 09: 01=Anulacion de la operacion, 02=Anulacion por error RUC, 07=Devolucion total... */
  motivoCodigo: string;
  motivoDescripcion: string;
  emisor: UblEmisor;
  cliente: UblCliente;
  items: UblItem[];
  totalGravado: number;
  totalIgv: number;
  totalPrecio: number;
}

/**
 * Nota de debito (08). Mismo shape que la nota de credito; la diferencia es que motivoCodigo
 * usa el Catalogo 10 (01=Intereses por mora, 02=Aumento en el valor, 03=Penalidades/otros).
 */
export type UblNotaDebito = UblNotaCredito;

const MONEDA_NOMBRE: Record<string, string> = { PEN: 'SOLES', USD: 'DOLARES AMERICANOS' };

/** Formatea a 2 decimales (lo que exige SUNAT para montos). */
function n2(v: number): string {
  return v.toFixed(2);
}

/** Escapa texto para CDATA (corta secuencias `]]>`). */
function cdata(text: string): string {
  return `<![CDATA[${String(text).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

// ── Numero a letras (es-PE) ──────────────────────────────────────────────────
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_DIECINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function centenasALetras(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'CIEN';
  const c = Math.floor(num / 100);
  const resto = num % 100;
  let txt = CENTENAS[c];
  if (resto > 0) {
    let r: string;
    if (resto < 10) r = UNIDADES[resto];
    else if (resto < 20) r = DIEZ_DIECINUEVE[resto - 10];
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      r = d === 2 && u > 0 ? 'VEINTI' + UNIDADES[u] : DECENAS[d] + (u > 0 ? ' Y ' + UNIDADES[u] : '');
    }
    txt = (txt ? txt + ' ' : '') + r;
  }
  return txt;
}

function enteroALetras(num: number): string {
  if (num === 0) return 'CERO';
  const millones = Math.floor(num / 1_000_000);
  const miles = Math.floor((num % 1_000_000) / 1000);
  const cientos = num % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? 'UN MILLON' : `${centenasALetras(millones)} MILLONES`);
  if (miles > 0) partes.push(miles === 1 ? 'MIL' : `${centenasALetras(miles)} MIL`);
  if (cientos > 0) partes.push(centenasALetras(cientos));
  return partes.join(' ').trim();
}

/** Leyenda de monto en letras: "SON CIENTO DIECIOCHO CON 00/100 SOLES". */
export function numeroALetras(monto: number, moneda = 'PEN'): string {
  const entero = Math.floor(monto + 1e-9);
  const decimal = Math.round((monto - entero) * 100);
  const dd = String(decimal).padStart(2, '0');
  return `SON ${enteroALetras(entero)} CON ${dd}/100 ${MONEDA_NOMBRE[moneda] ?? moneda}`;
}

// ── Bloques XML compartidos ──────────────────────────────────────────────────

/** Header comun: UBLExtensions (firma) + version + id + fecha/hora + leyenda + moneda. */
function headerXml(id: string, fecha: string, hora: string, leyenda: string, moneda: string, tipoDocLine: string): string {
  return `  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${id}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>${tipoDocLine}
  <cbc:Note languageLocaleID="1000">${cdata(leyenda)}</cbc:Note>
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>`;
}

function signatureXml(emisor: UblEmisor): string {
  const signId = `SIGN-${emisor.ruc}`;
  return `  <cac:Signature>
    <cbc:ID>${signId}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisor.razonSocial)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#${signId}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;
}

function supplierXml(emisor: UblEmisor): string {
  return `  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisor.nombreComercial ?? emisor.razonSocial)}</cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emisor.razonSocial)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${emisor.ubigeo}</cbc:ID>
          <cbc:AddressTypeCode>${emisor.codigoLocal ?? '0000'}</cbc:AddressTypeCode>
          <cbc:CityName>${cdata(emisor.provincia)}</cbc:CityName>
          <cbc:CountrySubentity>${cdata(emisor.departamento)}</cbc:CountrySubentity>
          <cbc:District>${cdata(emisor.distrito)}</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${cdata(emisor.direccion)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function customerXml(cliente: UblCliente): string {
  return `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cliente.tipoDoc}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${cliente.numDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(cliente.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function taxTotalDocXml(totalGravado: number, totalIgv: number, moneda: string): string {
  return `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${n2(totalIgv)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${n2(totalGravado)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${n2(totalIgv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
}

/** Totales monetarios. La factura/boleta/NC usan 'LegalMonetaryTotal'; la ND 'RequestedMonetaryTotal'. */
function montoTotalXml(totalGravado: number, totalPrecio: number, moneda: string, elemento = 'LegalMonetaryTotal'): string {
  return `  <cac:${elemento}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${n2(totalGravado)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${n2(totalPrecio)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${n2(totalPrecio)}</cbc:PayableAmount>
  </cac:${elemento}>`;
}

/** Cuerpo de una linea (compartido entre InvoiceLine y CreditNoteLine): monto, precio, IGV, item. */
function lineBodyXml(item: UblItem, moneda: string): string {
  return `    <cbc:LineExtensionAmount currencyID="${moneda}">${n2(item.valorVenta)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${n2(item.precioUnitarioConIgv)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${n2(item.igv)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${n2(item.valorVenta)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${n2(item.igv)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18.00</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${cdata(item.descripcion)}</cbc:Description>${item.codigo ? `
      <cac:SellersItemIdentification>
        <cbc:ID>${cdata(item.codigo)}</cbc:ID>
      </cac:SellersItemIdentification>` : ''}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${n2(item.valorUnitario)}</cbc:PriceAmount>
    </cac:Price>`;
}

function invoiceLineXml(item: UblItem, index: number, moneda: string): string {
  return `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${item.unidad}">${item.cantidad}</cbc:InvoicedQuantity>
${lineBodyXml(item, moneda)}
  </cac:InvoiceLine>`;
}

function creditNoteLineXml(item: UblItem, index: number, moneda: string): string {
  return `  <cac:CreditNoteLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:CreditedQuantity unitCode="${item.unidad}">${item.cantidad}</cbc:CreditedQuantity>
${lineBodyXml(item, moneda)}
  </cac:CreditNoteLine>`;
}

function debitNoteLineXml(item: UblItem, index: number, moneda: string): string {
  return `  <cac:DebitNoteLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:DebitedQuantity unitCode="${item.unidad}">${item.cantidad}</cbc:DebitedQuantity>
${lineBodyXml(item, moneda)}
  </cac:DebitNoteLine>`;
}

/** Bloque DiscrepancyResponse + BillingReference (compartido por NC y ND). */
function discrepanciaXml(docModificado: { serie: string; numero: string; tipo: '01' | '03' }, motivoCodigo: string, motivoDescripcion: string): string {
  const refId = `${docModificado.serie}-${docModificado.numero}`;
  return `  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${refId}</cbc:ReferenceID>
    <cbc:ResponseCode>${motivoCodigo}</cbc:ResponseCode>
    <cbc:Description>${cdata(motivoDescripcion)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${refId}</cbc:ID>
      <cbc:DocumentTypeCode>${docModificado.tipo}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

// ── Generadores ──────────────────────────────────────────────────────────────

/** Genera el XML UBL 2.1 de una factura (01) o boleta (03), SIN firmar. */
export function generateComprobanteXml(c: UblComprobante): string {
  const id = `${c.serie}-${c.numero}`;
  const leyenda = numeroALetras(c.totalPrecio, c.moneda);
  const tipoDocLine = `\n  <cbc:InvoiceTypeCode listID="0101">${c.tipoDoc}</cbc:InvoiceTypeCode>`;
  const lineas = c.items.map((it, i) => invoiceLineXml(it, i, c.moneda)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
${headerXml(id, c.fechaEmision, c.horaEmision, leyenda, c.moneda, tipoDocLine)}
${signatureXml(c.emisor)}
${supplierXml(c.emisor)}
${customerXml(c.cliente)}
  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>
${taxTotalDocXml(c.totalGravado, c.totalIgv, c.moneda)}
${montoTotalXml(c.totalGravado, c.totalPrecio, c.moneda)}
${lineas}
</Invoice>`;
}

/** Genera el XML UBL 2.1 de una nota de credito (07), SIN firmar. */
export function generateCreditNoteXml(nc: UblNotaCredito): string {
  const id = `${nc.serie}-${nc.numero}`;
  const leyenda = numeroALetras(nc.totalPrecio, nc.moneda);
  const lineas = nc.items.map((it, i) => creditNoteLineXml(it, i, nc.moneda)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
${headerXml(id, nc.fechaEmision, nc.horaEmision, leyenda, nc.moneda, '')}
${discrepanciaXml(nc.docModificado, nc.motivoCodigo, nc.motivoDescripcion)}
${signatureXml(nc.emisor)}
${supplierXml(nc.emisor)}
${customerXml(nc.cliente)}
${taxTotalDocXml(nc.totalGravado, nc.totalIgv, nc.moneda)}
${montoTotalXml(nc.totalGravado, nc.totalPrecio, nc.moneda)}
${lineas}
</CreditNote>`;
}

export interface UblResumenBoleta {
  /** Catalogo 01: 03=boleta, 07/08=nota de la boleta. */
  tipoDoc: string;
  /** Serie-numero, p.ej. B001-1. */
  serieNumero: string;
  /** Catalogo 06 del cliente: 1=DNI, 6=RUC, 0=sin doc. */
  clienteTipo: string;
  clienteNumero: string;
  /** Catalogo 19: 1=Adicionar/registrar, 2=Modificar, 3=Anular. */
  estado: string;
  totalGravado: number;
  totalIgv: number;
  totalPrecio: number;
}

export interface UblResumenDiario {
  /** RC-YYYYMMDD-N */
  id: string;
  /** Fecha de generacion = dia en que se emitieron las boletas (YYYY-MM-DD). */
  fechaReferencia: string;
  /** Fecha de emision del resumen (YYYY-MM-DD). */
  fechaEmision: string;
  moneda: string;
  emisor: UblEmisor;
  boletas: UblResumenBoleta[];
}

function resumenLineaXml(b: UblResumenBoleta, index: number, moneda: string): string {
  return `  <sac:SummaryDocumentsLine>
    <cbc:LineID>${index + 1}</cbc:LineID>
    <cbc:DocumentTypeCode>${b.tipoDoc}</cbc:DocumentTypeCode>
    <cbc:ID>${b.serieNumero}</cbc:ID>
    <cac:AccountingCustomerParty>
      <cbc:CustomerAssignedAccountID>${b.clienteNumero}</cbc:CustomerAssignedAccountID>
      <cbc:AdditionalAccountID>${b.clienteTipo}</cbc:AdditionalAccountID>
    </cac:AccountingCustomerParty>
    <cac:Status>
      <cbc:ConditionCode>${b.estado}</cbc:ConditionCode>
    </cac:Status>
    <sac:TotalAmount currencyID="${moneda}">${n2(b.totalPrecio)}</sac:TotalAmount>
    <sac:BillingPayment>
      <cbc:PaidAmount currencyID="${moneda}">${n2(b.totalGravado)}</cbc:PaidAmount>
      <cbc:InstructionID>01</cbc:InstructionID>
    </sac:BillingPayment>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${n2(b.totalIgv)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxAmount currencyID="${moneda}">${n2(b.totalIgv)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
  </sac:SummaryDocumentsLine>`;
}

/**
 * Genera el XML UBL del Resumen Diario de boletas (RC), SIN firmar. Es UBL 2.0 / Customization 1.1
 * y usa el namespace sac:. Se envia ASINCRONO (sendSummary -> ticket -> getStatus).
 */
export function generateSummaryXml(r: UblResumenDiario): string {
  const lineas = r.boletas.map((b, i) => resumenLineaXml(b, i, r.moneda)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>${r.id}</cbc:ID>
  <cbc:ReferenceDate>${r.fechaReferencia}</cbc:ReferenceDate>
  <cbc:IssueDate>${r.fechaEmision}</cbc:IssueDate>
${signatureXml(r.emisor)}
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${r.emisor.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(r.emisor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${lineas}
</SummaryDocuments>`;
}

/** Genera el XML UBL 2.1 de una nota de debito (08), SIN firmar. motivoCodigo = Catalogo 10. */
export function generateDebitNoteXml(nd: UblNotaDebito): string {
  const id = `${nd.serie}-${nd.numero}`;
  const leyenda = numeroALetras(nd.totalPrecio, nd.moneda);
  const lineas = nd.items.map((it, i) => debitNoteLineXml(it, i, nd.moneda)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
${headerXml(id, nd.fechaEmision, nd.horaEmision, leyenda, nd.moneda, '')}
${discrepanciaXml(nd.docModificado, nd.motivoCodigo, nd.motivoDescripcion)}
${signatureXml(nd.emisor)}
${supplierXml(nd.emisor)}
${customerXml(nd.cliente)}
${taxTotalDocXml(nd.totalGravado, nd.totalIgv, nd.moneda)}
${montoTotalXml(nd.totalGravado, nd.totalPrecio, nd.moneda, 'RequestedMonetaryTotal')}
${lineas}
</DebitNote>`;
}
