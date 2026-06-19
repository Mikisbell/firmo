/** Inspecciona el XML que genera nodefact para una boleta (debug SUNAT). */
import { generateXML, TipoDocumento, TipoMoneda, TipoIGV } from 'nodefact';

const nodefactData = {
  tipoDocumento: '03',
  serie: 'B001',
  numero: '1',
  fechaEmision: '2026-06-19',
  moneda: TipoMoneda.PEN,
  emisor: { ruc: '20000000001', razonSocial: 'EMPRESA DE PRUEBA', direccion: { direccion: 'AV PRUEBA 123', ubigeo: '150101' } },
  receptor: { tipoDocumento: '1', numeroDocumento: '12345678', razonSocial: 'CLIENTE DE PRUEBA' },
  items: [
    {
      codigo: 'POLLO01', descripcion: 'POLLO A LA BRASA', unidadMedida: 'NIU', cantidad: 1,
      valorUnitario: 21.19, precioUnitario: 25, tipoIGV: TipoIGV.GRAVADO_OPERACION_ONEROSA,
      igv: 3.81, porcentajeIGV: 18, subtotal: 21.19, total: 25,
    },
  ],
  impuestos: { igv: 3.81, total: 3.81 },
  totalGravadas: 21.19, totalIgv: 3.81, totalVenta: 25,
};

const xml = generateXML(nodefactData as never, TipoDocumento.BOLETA);
console.log('=== LONGITUD:', xml.length, '===');
console.log(xml.slice(0, 1200));
console.log('...');
console.log('=== UBLVersionID presente?', xml.includes('UBLVersionID'), '===');
console.log('=== raiz:', xml.slice(0, 80).replace(/\n/g, ' '), '===');
