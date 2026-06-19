/**
 * WSDL/XSD de SUNAT (billService) embebidos.
 *
 * node-soap no resuelve bien los imports VIVOS del WSDL de SUNAT (intenta fetchear
 * `billService?ns1.wsdl` y recibe 401). La solucion robusta es cargar el WSDL LOCAL con sus
 * imports ya resueltos a archivos locales. Inlineamos los 3 documentos (van en el bundle, sin
 * depender de la red en runtime) y los escribimos a un dir temporal una sola vez.
 *
 * El soap:address del WSDL apunta a BETA, pero el cliente SOAP override-ea el endpoint segun
 * el modo (BETA/PRODUCTION), asi que este WSDL sirve para ambos.
 *
 * @module core/integrations/sunat/sunat-wsdl
 */
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// billService.wsdl — bindings + service. El import apunta al archivo LOCAL (no `?ns1.wsdl`).
const MAIN_WSDL = `<?xml version="1.0" encoding="UTF-8"?>

<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap11="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:http="http://schemas.xmlsoap.org/wsdl/http/" xmlns:mime="http://schemas.xmlsoap.org/wsdl/mime/" xmlns:wsp="http://www.w3.org/ns/ws-policy" xmlns:wsp200409="http://schemas.xmlsoap.org/ws/2004/09/policy" xmlns:wsp200607="http://www.w3.org/2006/07/ws-policy" xmlns:ns0="http://service.gem.factura.comppago.registro.servicio.sunat.gob.pe/" xmlns:ns1="http://service.sunat.gob.pe" targetNamespace="http://service.gem.factura.comppago.registro.servicio.sunat.gob.pe/">
<wsdl:import location="billService.ns1.wsdl" namespace="http://service.sunat.gob.pe"/>
<wsdl:binding name="BillServicePortBinding" type="ns1:billService">
<soap11:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/>
<wsdl:operation name="getStatus">
<soap11:operation soapAction="urn:getStatus" style="document"/>
<wsdl:input name="getStatusRequest">
<soap11:body use="literal"/></wsdl:input>
<wsdl:output name="getStatusResponse">
<soap11:body use="literal"/></wsdl:output></wsdl:operation>
<wsdl:operation name="sendBill">
<soap11:operation soapAction="urn:sendBill" style="document"/>
<wsdl:input name="sendBillRequest">
<soap11:body use="literal"/></wsdl:input>
<wsdl:output name="sendBillResponse">
<soap11:body use="literal"/></wsdl:output></wsdl:operation>
<wsdl:operation name="sendPack">
<soap11:operation soapAction="urn:sendPack" style="document"/>
<wsdl:input name="sendPackRequest">
<soap11:body use="literal"/></wsdl:input>
<wsdl:output name="sendPackResponse">
<soap11:body use="literal"/></wsdl:output></wsdl:operation>
<wsdl:operation name="sendSummary">
<soap11:operation soapAction="urn:sendSummary" style="document"/>
<wsdl:input name="sendSummaryRequest">
<soap11:body use="literal"/></wsdl:input>
<wsdl:output name="sendSummaryResponse">
<soap11:body use="literal"/></wsdl:output></wsdl:operation></wsdl:binding>
<wsdl:service name="billService">
<wsdl:port name="BillServicePort" binding="ns0:BillServicePortBinding">
<soap11:address location="https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService"/></wsdl:port>
<wsdl:port name="BillServicePort.1" binding="ns0:BillServicePortBinding">
<soap11:address location="https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService"/></wsdl:port></wsdl:service></wsdl:definitions>`;

// billService?ns1.wsdl — messages + portType. Importa el XSD local.
const NS1_WSDL = `<?xml version="1.0" encoding="UTF-8"?>

<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap11="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:http="http://schemas.xmlsoap.org/wsdl/http/" xmlns:mime="http://schemas.xmlsoap.org/wsdl/mime/" xmlns:wsp="http://www.w3.org/ns/ws-policy" xmlns:wsp200409="http://schemas.xmlsoap.org/ws/2004/09/policy" xmlns:wsp200607="http://www.w3.org/2006/07/ws-policy" xmlns:ns0="http://service.gem.factura.comppago.registro.servicio.sunat.gob.pe/" xmlns:ns1="http://service.sunat.gob.pe" targetNamespace="http://service.sunat.gob.pe">
<wsdl:types xmlns:xsd="http://www.w3.org/2001/XMLSchema">
<xsd:schema>
<xsd:import schemaLocation="billService.xsd2.xsd" namespace="http://service.sunat.gob.pe"/></xsd:schema></wsdl:types>
<wsdl:message name="getStatus">
<wsdl:part name="parameters" element="xsns:getStatus" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="getStatusResponse">
<wsdl:part name="parameters" element="xsns:getStatusResponse" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendBill">
<wsdl:part name="parameters" element="xsns:sendBill" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendBillResponse">
<wsdl:part name="parameters" element="xsns:sendBillResponse" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendPack">
<wsdl:part name="parameters" element="xsns:sendPack" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendPackResponse">
<wsdl:part name="parameters" element="xsns:sendPackResponse" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendSummary">
<wsdl:part name="parameters" element="xsns:sendSummary" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:message name="sendSummaryResponse">
<wsdl:part name="parameters" element="xsns:sendSummaryResponse" xmlns:xsns="http://service.sunat.gob.pe"/></wsdl:message>
<wsdl:portType name="billService">
<wsdl:operation name="getStatus">
<wsdl:input name="getStatusRequest" message="ns1:getStatus"/>
<wsdl:output name="getStatusResponse" message="ns1:getStatusResponse"/></wsdl:operation>
<wsdl:operation name="sendBill">
<wsdl:input name="sendBillRequest" message="ns1:sendBill"/>
<wsdl:output name="sendBillResponse" message="ns1:sendBillResponse"/></wsdl:operation>
<wsdl:operation name="sendPack">
<wsdl:input name="sendPackRequest" message="ns1:sendPack"/>
<wsdl:output name="sendPackResponse" message="ns1:sendPackResponse"/></wsdl:operation>
<wsdl:operation name="sendSummary">
<wsdl:input name="sendSummaryRequest" message="ns1:sendSummary"/>
<wsdl:output name="sendSummaryResponse" message="ns1:sendSummaryResponse"/></wsdl:operation></wsdl:portType></wsdl:definitions>`;

// billService.xsd2.xsd — tipos (sendBill/getStatus/sendSummary...).
const XSD2 = `<?xml version="1.0" encoding="UTF-8"?>

<xs:schema xmlns:tns="http://service.sunat.gob.pe" xmlns:xs="http://www.w3.org/2001/XMLSchema" version="1.0" targetNamespace="http://service.sunat.gob.pe">
<xs:element name="getStatus" type="tns:getStatus"/>
<xs:element name="getStatusResponse" type="tns:getStatusResponse"/>
<xs:element name="sendBill" type="tns:sendBill"/>
<xs:element name="sendBillResponse" type="tns:sendBillResponse"/>
<xs:element name="sendPack" type="tns:sendPack"/>
<xs:element name="sendPackResponse" type="tns:sendPackResponse"/>
<xs:element name="sendSummary" type="tns:sendSummary"/>
<xs:element name="sendSummaryResponse" type="tns:sendSummaryResponse"/>
<xs:complexType name="sendSummary">
<xs:sequence>
<xs:element name="fileName" type="xs:string" minOccurs="0"/>
<xs:element xmlns:ns1="http://www.w3.org/2005/05/xmlmime" name="contentFile" ns1:expectedContentTypes="application/octet-stream" type="xs:base64Binary" minOccurs="0"/>
<xs:element name="partyType" type="xs:string" maxOccurs="1" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="sendSummaryResponse">
<xs:sequence>
<xs:element name="ticket" type="xs:string" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="getStatus">
<xs:sequence>
<xs:element name="ticket" type="xs:string" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="getStatusResponse">
<xs:sequence>
<xs:element name="status" type="tns:statusResponse" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="statusResponse">
<xs:sequence>
<xs:element name="content" type="xs:base64Binary" minOccurs="0"/>
<xs:element name="statusCode" type="xs:string" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="sendPack">
<xs:sequence>
<xs:element name="fileName" type="xs:string" minOccurs="0"/>
<xs:element xmlns:ns2="http://www.w3.org/2005/05/xmlmime" name="contentFile" ns2:expectedContentTypes="application/octet-stream" type="xs:base64Binary" minOccurs="0"/>
<xs:element name="partyType" type="xs:string" maxOccurs="1" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="sendPackResponse">
<xs:sequence>
<xs:element name="ticket" type="xs:string" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="sendBill">
<xs:sequence>
<xs:element name="fileName" type="xs:string" minOccurs="0"/>
<xs:element xmlns:ns3="http://www.w3.org/2005/05/xmlmime" name="contentFile" ns3:expectedContentTypes="application/octet-stream" type="xs:base64Binary" minOccurs="0"/>
<xs:element name="partyType" type="xs:string" maxOccurs="1" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
<xs:complexType name="sendBillResponse">
<xs:sequence>
<xs:element name="applicationResponse" type="xs:base64Binary" minOccurs="0"/>
</xs:sequence>
</xs:complexType>
</xs:schema>`;

let cachedWsdlPath: string | null = null;

/**
 * Escribe los 3 documentos a un dir temporal (una sola vez por proceso) y devuelve la ruta del
 * WSDL principal, lista para `soap.createClientAsync(path, ...)`. Los imports se resuelven entre
 * los archivos locales (sin red).
 */
export function getSunatWsdlPath(): string {
  if (cachedWsdlPath && existsSync(cachedWsdlPath)) return cachedWsdlPath;
  const dir = mkdtempSync(join(tmpdir(), 'park-sunat-wsdl-'));
  writeFileSync(join(dir, 'billService.ns1.wsdl'), NS1_WSDL, 'utf-8');
  writeFileSync(join(dir, 'billService.xsd2.xsd'), XSD2, 'utf-8');
  const mainPath = join(dir, 'billService.wsdl');
  writeFileSync(mainPath, MAIN_WSDL, 'utf-8');
  cachedWsdlPath = mainPath;
  return mainPath;
}
