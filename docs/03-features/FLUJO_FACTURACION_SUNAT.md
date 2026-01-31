# 🧾 FLUJO_FACTURACION_SUNAT — Comprobantes Electrónicos

> Facturación electrónica obligatoria en Perú, offline-first con contingencia

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | SUNAT exige comprobantes electrónicos, multas por incumplimiento |
| **Solución** | Integración con OSE + modo contingencia offline |
| **Complejidad** | Alta (regulación estricta, formatos XML específicos) |
| **Prioridad** | 🔴 CRÍTICA - Legalmente obligatorio |

---

## 🎯 Escenarios de Uso

### Escenario 1: Boleta Simple (Consumidor Final)
```
DADO que un cliente paga S/85.00 en efectivo
Y no solicita factura
CUANDO el cajero cierra la venta
ENTONCES se genera Boleta Electrónica B001-00001234
Y se envía a OSE en background
Y se imprime ticket con QR de verificación
Y cliente puede verificar en portal SUNAT
```

### Escenario 2: Factura (Cliente con RUC)
```
DADO que el cliente dice "con factura, RUC 20123456789"
CUANDO el cajero ingresa el RUC
ENTONCES se consulta API SUNAT para validar RUC
Y se autocompleta razón social "EMPRESA SAC"
Y se genera Factura Electrónica F001-00000567
Y se envía a OSE
Y se imprime comprobante A4 o ticket según config
```

### Escenario 3: Nota de Crédito (Devolución)
```
DADO que cliente devuelve 1/4 pollo de la boleta B001-00001234
CUANDO el cajero procesa la devolución
ENTONCES se genera Nota de Crédito BC01-00000089
Y referencia la boleta original
Y se envía a OSE
Y se registra el reembolso
```

### Escenario 4: Modo Contingencia (Sin Internet)
```
DADO que no hay conexión a internet
CUANDO el cajero intenta emitir boleta
ENTONCES se genera comprobante en modo contingencia
Y se asigna serie especial (ej: BC01 en vez de B001)
Y se guarda en cola local (IndexedDB)
Y se imprime con marca "CONTINGENCIA"
Y cuando vuelve internet, se envía a OSE con flag contingencia
```

### Escenario 5: Anulación de Comprobante
```
DADO que se emitió boleta B001-00001234 por error
Y no han pasado más de 7 días
CUANDO el admin solicita anulación
ENTONCES se genera Comunicación de Baja
Y se envía a SUNAT
Y se espera CDR de confirmación
Y se marca comprobante como ANULADO
```

### Escenario 6: Resumen Diario de Boletas
```
DADO que es medianoche (o 6AM según config)
CUANDO el sistema genera el cierre del día
ENTONCES se crea Resumen Diario con todas las boletas
Y se envía a SUNAT
Y se obtiene ticket de procesamiento
Y se consulta estado hasta obtener CDR
```

### Escenario 7: Reenvío de Comprobante Fallido
```
DADO que la boleta B001-00001235 falló al enviarse
Y el error fue "OSE no disponible"
CUANDO el sistema reintenta (cada 5 min, max 3 veces)
ENTONCES eventualmente se envía exitosamente
Y se actualiza estado a ACEPTADO
Y se notifica al admin si falló definitivamente
```

### Escenario 8: Consulta de Validez
```
DADO que un cliente quiere verificar su comprobante
CUANDO escanea el QR del ticket
ENTONCES se redirige a portal SUNAT
Y puede ver el comprobante original
Y confirmar que es válido
```

### Escenario 9: Factura con Detracción
```
DADO que la venta supera S/700 (umbral detracción)
Y el servicio está sujeto a detracción
CUANDO se emite la factura
ENTONCES se calcula detracción (ej: 10%)
Y se incluye en el XML
Y el cliente debe depositar detracción en Banco de la Nación
```

### Escenario 10: Exportación para Contador
```
DADO que el contador necesita los comprobantes del mes
CUANDO el admin exporta desde el panel
ENTONCES se genera ZIP con:
  - XMLs firmados de todos los comprobantes
  - CDRs de SUNAT
  - Resumen en Excel
  - PDFs de facturas
```

---

## 📊 Modelo de Datos

### Tabla: Invoice (Comprobante)
```typescript
interface Invoice {
  id: string;                    // UUID
  tenant_id: string;
  location_id: string;
  
  // Identificación SUNAT
  document_type: DocumentType;   // BOLETA | FACTURA | NC | ND
  series: string;                // B001, F001, BC01, FC01
  number: number;                // Correlativo
  full_number: string;           // "B001-00001234"
  
  // Fechas
  issue_date: Date;              // Fecha emisión
  due_date?: Date;               // Vencimiento (facturas crédito)
  
  // Cliente
  customer_doc_type: CustomerDocType; // DNI | RUC | CE | PASAPORTE
  customer_doc_number: string;   // "20123456789"
  customer_name: string;         // "EMPRESA SAC"
  customer_address?: string;
  customer_email?: string;
  
  // Montos (centavos)
  subtotal: number;              // Base imponible
  igv: number;                   // 18% IGV
  total: number;                 // subtotal + igv
  discount_total: number;        // Descuentos aplicados
  
  // Items
  items: InvoiceItem[];
  
  // Estado SUNAT
  sunat_status: SunatStatus;
  sunat_response_code?: string;  // "0" = aceptado
  sunat_response_message?: string;
  cdr_received_at?: Date;
  
  // XML y Hash
  xml_content?: string;          // XML firmado (comprimido)
  hash: string;                  // Hash para QR
  qr_code: string;               // Datos del QR
  
  // Referencias (para NC/ND)
  reference_document_type?: DocumentType;
  reference_series?: string;
  reference_number?: number;
  reference_reason?: string;     // Motivo de NC/ND
  
  // Contingencia
  is_contingency: boolean;
  contingency_sent_at?: Date;
  
  // Relación con venta
  order_id?: string;
  
  // Auditoría
  created_by: string;
  created_at: Date;
  voided_at?: Date;
  voided_by?: string;
}

type DocumentType = 
  | 'BOLETA'           // 03
  | 'FACTURA'          // 01
  | 'NOTA_CREDITO'     // 07
  | 'NOTA_DEBITO';     // 08

type CustomerDocType = 
  | 'DNI'              // 1
  | 'RUC'              // 6
  | 'CE'               // 4 (Carnet Extranjería)
  | 'PASAPORTE'        // 7
  | 'SIN_DOCUMENTO';   // 0

type SunatStatus = 
  | 'PENDING'          // Pendiente de envío
  | 'SENT'             // Enviado, esperando CDR
  | 'ACCEPTED'         // Aceptado por SUNAT
  | 'REJECTED'         // Rechazado por SUNAT
  | 'VOIDED'           // Anulado
  | 'CONTINGENCY';     // En contingencia
```

### Tabla: Invoice_Item
```typescript
interface InvoiceItem {
  id: string;
  invoice_id: string;
  
  sequence: number;              // Orden en el comprobante
  product_code: string;          // Código interno
  sunat_code?: string;           // Código SUNAT si aplica
  description: string;           // "1/4 Pollo a la Brasa"
  
  quantity: number;              // Puede ser decimal
  unit_code: string;             // "NIU" (unidad), "KGM" (kg)
  
  // Precios (centavos)
  unit_price: number;            // Precio unitario sin IGV
  unit_price_with_igv: number;   // Precio con IGV
  discount: number;              // Descuento por item
  subtotal: number;              // quantity × unit_price - discount
  igv: number;                   // 18% del subtotal
  total: number;                 // subtotal + igv
  
  // Impuestos
  igv_type: IGVType;             // GRAVADO | EXONERADO | INAFECTO
  isc?: number;                  // Impuesto selectivo (si aplica)
}

type IGVType = 
  | 'GRAVADO'          // 10 - Gravado
  | 'EXONERADO'        // 20 - Exonerado
  | 'INAFECTO'         // 30 - Inafecto
  | 'GRATUITO';        // 21 - Gratuito
```

### Tabla: Invoice_Queue (Cola de Envío)
```typescript
interface InvoiceQueue {
  id: string;
  invoice_id: string;
  
  action: QueueAction;           // SEND | VOID | SUMMARY
  priority: number;              // 1 = alta, 5 = baja
  
  attempts: number;              // Intentos realizados
  max_attempts: number;          // Máximo 3
  last_attempt_at?: Date;
  last_error?: string;
  
  scheduled_at: Date;            // Cuándo procesar
  processed_at?: Date;
  
  status: QueueStatus;
}

type QueueAction = 'SEND' | 'VOID' | 'SUMMARY' | 'QUERY_CDR';
type QueueStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

### Tabla: Daily_Summary (Resumen Diario)
```typescript
interface DailySummary {
  id: string;
  tenant_id: string;
  location_id: string;
  
  summary_date: Date;            // Fecha del resumen
  summary_number: string;        // RC-20260105-001
  
  // Totales
  boletas_count: number;
  boletas_total: number;         // centavos
  
  // Estado SUNAT
  ticket_number?: string;        // Ticket de SUNAT
  sunat_status: SunatStatus;
  cdr_received_at?: Date;
  
  created_at: Date;
}
```

---

## 📡 Eventos de Dominio

```typescript
// Comprobante emitido
interface InvoiceIssuedEvent {
  type: 'INVOICE_ISSUED';
  payload: {
    invoice_id: string;
    document_type: DocumentType;
    full_number: string;
    customer_doc_number: string;
    total: number;               // centavos
    order_id?: string;
  };
}

// Comprobante enviado a OSE
interface InvoiceSentEvent {
  type: 'INVOICE_SENT';
  payload: {
    invoice_id: string;
    sent_at: string;
    ose_response?: string;
  };
}

// CDR recibido de SUNAT
interface InvoiceCDRReceivedEvent {
  type: 'INVOICE_CDR_RECEIVED';
  payload: {
    invoice_id: string;
    response_code: string;       // "0" = OK
    response_message: string;
    hash: string;
  };
}

// Comprobante rechazado
interface InvoiceRejectedEvent {
  type: 'INVOICE_REJECTED';
  payload: {
    invoice_id: string;
    error_code: string;
    error_message: string;
    can_retry: boolean;
  };
}

// Comprobante anulado
interface InvoiceVoidedEvent {
  type: 'INVOICE_VOIDED';
  payload: {
    invoice_id: string;
    void_reason: string;
    voided_by: string;
  };
}

// Modo contingencia activado
interface ContingencyModeActivatedEvent {
  type: 'CONTINGENCY_MODE_ACTIVATED';
  payload: {
    location_id: string;
    reason: string;              // "NO_INTERNET" | "OSE_DOWN"
    activated_at: string;
  };
}

// Contingencia resuelta
interface ContingencyResolvedEvent {
  type: 'CONTINGENCY_RESOLVED';
  payload: {
    location_id: string;
    invoices_synced: number;
    resolved_at: string;
  };
}
```

---

## 🔌 API Endpoints

```typescript
// POST /api/invoicing/issue
// Emitir comprobante
interface IssueInvoiceBody {
  order_id: string;
  document_type: DocumentType;
  customer?: {
    doc_type: CustomerDocType;
    doc_number: string;
    name?: string;               // Se autocompleta si es RUC
    address?: string;
    email?: string;
  };
}

// POST /api/invoicing/void
// Anular comprobante
interface VoidInvoiceBody {
  invoice_id: string;
  reason: string;
}

// POST /api/invoicing/credit-note
// Emitir nota de crédito
interface IssueCreditNoteBody {
  reference_invoice_id: string;
  reason: string;
  items?: Array<{               // Si es parcial
    original_item_id: string;
    quantity: number;
  }>;
}

// GET /api/invoicing/validate-ruc/:ruc
// Validar RUC en SUNAT
interface ValidateRUCResponse {
  valid: boolean;
  ruc: string;
  razon_social?: string;
  direccion?: string;
  estado?: string;              // ACTIVO | BAJA
  condicion?: string;           // HABIDO | NO HABIDO
}

// GET /api/invoicing/status/:invoice_id
// Consultar estado de comprobante
interface InvoiceStatusResponse {
  invoice_id: string;
  full_number: string;
  sunat_status: SunatStatus;
  response_code?: string;
  response_message?: string;
  pdf_url?: string;
  xml_url?: string;
}

// POST /api/invoicing/resend/:invoice_id
// Reenviar comprobante fallido

// GET /api/invoicing/export
// Exportar comprobantes
interface ExportInvoicesParams {
  from_date: string;
  to_date: string;
  format: 'ZIP' | 'EXCEL';
  include_xml: boolean;
  include_pdf: boolean;
  include_cdr: boolean;
}

// GET /api/invoicing/pending
// Comprobantes pendientes de envío
interface PendingInvoicesResponse {
  pending: number;
  failed: number;
  contingency: number;
  items: Invoice[];
}
```

---

## 🖥️ UI Mockups

### Selector de Tipo de Comprobante (en POS)
```
┌─────────────────────────────────────────────────────────────┐
│  💳 PAGO - Mesa 5                              Total: S/85  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tipo de Comprobante:                                       │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │                 │  │                 │                  │
│  │   📄 BOLETA    │  │   📋 FACTURA   │                  │
│  │                 │  │                 │                  │
│  │  Sin RUC/DNI   │  │  Requiere RUC  │                  │
│  │                 │  │                 │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RUC/DNI: [20123456789        ] [🔍 Buscar]             ││
│  │                                                         ││
│  │ Razón Social: EMPRESA SAC                    ✓ ACTIVO  ││
│  │ Dirección: Av. Principal 123, Lima                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Cancelar]                              [✓ Emitir y Pagar] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Panel de Comprobantes (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  🧾 COMPROBANTES ELECTRÓNICOS                    [📤 Export]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 📄 156  │  │ 📋 23   │  │ 🔴 3    │  │ ⚠️ 2   │        │
│  │ Boletas │  │ Facturas│  │ Fallidos│  │ Conting.│        │
│  │ Hoy     │  │ Hoy     │  │         │  │         │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  🔍 [Buscar número o cliente...] [Fecha ▼] [Tipo ▼] [Estado]│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Número       │ Cliente      │ Total  │ Estado  │ Acción ││
│  ├──────────────┼──────────────┼────────┼─────────┼────────┤│
│  │ B001-0001234 │ Consumidor   │ S/85   │ ✅ OK   │ [📄]   ││
│  │ F001-0000567 │ EMPRESA SAC  │ S/450  │ ✅ OK   │ [📄]   ││
│  │ B001-0001235 │ Consumidor   │ S/120  │ 🔴 FAIL │ [🔄]   ││
│  │ BC01-0000012 │ Consumidor   │ S/65   │ ⚠️ CONT │ [📤]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [← Anterior]  Página 1 de 15  [Siguiente →]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Detalle de Comprobante
```
┌─────────────────────────────────────────────────────────────┐
│  📄 BOLETA B001-00001234                             [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Estado SUNAT: ✅ ACEPTADO                                  │
│  Código Respuesta: 0 - La factura fue aceptada              │
│  CDR Recibido: 05/01/2026 14:32:15                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Fecha Emisión: 05/01/2026                                  │
│  Cliente: CONSUMIDOR FINAL                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Descripción              │ Cant │ P.Unit  │ Total      ││
│  ├──────────────────────────┼──────┼─────────┼────────────┤│
│  │ 1/4 Pollo a la Brasa     │  2   │ S/25.00 │ S/50.00    ││
│  │ Inca Kola 500ml          │  2   │ S/5.00  │ S/10.00    ││
│  │ Porción Papas Extra      │  1   │ S/8.00  │ S/8.00     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Subtotal:     S/ 57.63                                     │
│  IGV (18%):    S/ 10.37                                     │
│  TOTAL:        S/ 68.00                                     │
│                                                             │
│  Hash: mUr7+15===                                           │
│  [QR CODE]                                                  │
│                                                             │
│  [📄 Ver PDF] [📦 Descargar XML] [🔄 Reenviar] [❌ Anular]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Alerta de Contingencia
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ MODO CONTINGENCIA ACTIVO                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  No hay conexión con el OSE desde hace 15 minutos.          │
│                                                             │
│  Los comprobantes se están emitiendo con serie de           │
│  contingencia (BC01, FC01) y se enviarán automáticamente    │
│  cuando se restablezca la conexión.                         │
│                                                             │
│  Comprobantes en cola: 12                                   │
│  Último intento: 14:45:23                                   │
│                                                             │
│  [🔄 Reintentar Ahora]  [📋 Ver Cola]  [✕ Cerrar]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Integración con OSE

### Proveedores OSE Recomendados
| OSE | Costo Aprox. | API | Notas |
|-----|--------------|-----|-------|
| Nubefact | S/0.15/doc | REST | Popular, buena doc |
| EFACT | S/0.12/doc | REST/SOAP | Económico |
| Bizlinks | S/0.18/doc | REST | Enterprise |
| PSE (SUNAT) | Gratis | SOAP | Complejo, solo grandes |

### Flujo de Envío
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  PARK   │────▶│   OSE   │────▶│  SUNAT  │────▶│   CDR   │
│   POS   │     │         │     │         │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     │  1. XML       │  2. Valida    │  3. Procesa   │
     │  firmado      │  y envía      │  y responde   │
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
                           │
                    4. CDR de vuelta
```

### Estructura XML (Simplificada)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>B001-00001234</cbc:ID>
  <cbc:IssueDate>2026-01-05</cbc:IssueDate>
  <cbc:InvoiceTypeCode>03</cbc:InvoiceTypeCode> <!-- 03=Boleta -->
  
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>20123456789</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID> <!-- RUC -->
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>POLLERIA PARK SAC</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <cac:AccountingCustomerParty>
    <cbc:CustomerAssignedAccountID>-</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>0</cbc:AdditionalAccountID>
  </cac:AccountingCustomerParty>
  
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">10.37</cbc:TaxAmount>
  </cac:TaxTotal>
  
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="PEN">68.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  
  <!-- Items... -->
</Invoice>
```

---

## 🔌 Comportamiento Offline

### Serie de Contingencia
```typescript
// Series normales (con internet)
const SERIES_NORMAL = {
  BOLETA: 'B001',
  FACTURA: 'F001',
  NC_BOLETA: 'BC01',
  NC_FACTURA: 'FC01',
};

// Series contingencia (sin internet)
const SERIES_CONTINGENCY = {
  BOLETA: 'B002',      // Serie diferente
  FACTURA: 'F002',
  NC_BOLETA: 'BC02',
  NC_FACTURA: 'FC02',
};
```

### Cola de Sincronización
```typescript
// Cuando vuelve internet:
// 1. Detectar conexión restaurada
// 2. Procesar cola FIFO
// 3. Enviar con flag is_contingency=true
// 4. SUNAT acepta hasta 7 días después
// 5. Actualizar estados locales
```

---

## 💰 Consideraciones de Costos

### Costos Típicos Mensuales
| Concepto | Cantidad | Costo Unit. | Total |
|----------|----------|-------------|-------|
| Boletas | 3,000 | S/0.15 | S/450 |
| Facturas | 200 | S/0.15 | S/30 |
| Notas Crédito | 50 | S/0.15 | S/7.50 |
| **Total** | | | **~S/500/mes** |

### Optimizaciones
- Agrupar boletas menores a S/5 en resumen diario
- Usar OSE con mejor precio por volumen
- Considerar PSE propio si >10,000 docs/mes

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + eventos | 2 días |
| **2** | Integración OSE (Nubefact) | 3 días |
| **3** | Generación XML + firma | 3 días |
| **4** | UI en POS (selector tipo) | 2 días |
| **5** | Modo contingencia | 2 días |
| **6** | Notas de crédito | 2 días |
| **7** | Resumen diario | 1 día |
| **8** | Panel admin + exportación | 2 días |

**Total estimado: 17 días de desarrollo**

---

## ⚠️ Consideraciones Críticas

1. **Certificado digital**: Necesario para firmar XMLs (S/200-400/año)
2. **Homologación**: Proceso con SUNAT antes de producción
3. **Correlativo**: NUNCA puede haber huecos en numeración
4. **Plazo envío**: Máximo 7 días calendario desde emisión
5. **Retención XML**: Mínimo 5 años por ley
6. **IGV**: Siempre 18%, calcular correctamente

---

*Última actualización: Enero 2026*
