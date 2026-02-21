/**
 * Receipt Builder Tests
 *
 * @module core/printing/__tests__/receipt-builder.test
 */

import { describe, it, expect } from 'vitest';
import {
  buildThermalReceipt,
  buildKitchenTicket,
  type ReceiptData,
  type KitchenTicketData,
} from '../receipt-builder';

function decode(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

const baseReceipt: ReceiptData = {
  tenantName: 'POLLERIA EL SABOR',
  address: 'Av. Principal 123, Lima',
  ruc: '20123456789',
  invoiceType: 'BOLETA',
  invoiceSeries: 'B001',
  invoiceNumber: '000123',
  orderNumber: 42,
  tableNumber: '5',
  date: '15/12/2025 14:30',
  lines: [
    { name: '1/4 Pollo a la brasa', qty: 2, totalCents: 5000 },
    { name: 'Gaseosa 1.5L', qty: 1, totalCents: 800 },
  ],
  subtotalCents: 5800,
  totalCents: 5800,
};

describe('buildThermalReceipt', () => {
  it('debe generar receipt con todos los campos', () => {
    const result = buildThermalReceipt(baseReceipt);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(50);

    const text = decode(result);
    expect(text).toContain('POLLERIA EL SABOR');
    expect(text).toContain('Av. Principal 123');
    expect(text).toContain('20123456789');
    expect(text).toContain('BOLETA');
    expect(text).toContain('B001-000123');
    expect(text).toContain('#42');
    expect(text).toContain('Mesa: 5');
  });

  it('debe incluir items con precios', () => {
    const result = buildThermalReceipt(baseReceipt);
    const text = decode(result);
    expect(text).toContain('Pollo a la brasa');
    expect(text).toContain('S/ 50.00');
    expect(text).toContain('Gaseosa');
    expect(text).toContain('S/ 8.00');
  });

  it('debe incluir total en centavos formateado', () => {
    const result = buildThermalReceipt(baseReceipt);
    const text = decode(result);
    expect(text).toContain('S/ 58.00');
    expect(text).toContain('TOTAL');
  });

  it('debe incluir descuento cuando es > 0', () => {
    const data = { ...baseReceipt, discountCents: 500, totalCents: 5300 };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain('Descuento');
    expect(text).toContain('S/ 5.00');
  });

  it('no debe mostrar descuento cuando es 0', () => {
    const data = { ...baseReceipt, discountCents: 0 };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).not.toContain('Descuento');
  });

  it('debe incluir pagos', () => {
    const data: ReceiptData = {
      ...baseReceipt,
      payments: [
        { method: 'EFECTIVO', amountCents: 3000 },
        { method: 'YAPE', amountCents: 2800 },
      ],
    };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain('EFECTIVO');
    expect(text).toContain('YAPE');
  });

  it('debe incluir QR SUNAT cuando se proporciona', () => {
    const qrString = '20123456789|03|B001|000123|9.90|55.00|15/12/2025|1|12345678|HASH';
    const data = { ...baseReceipt, sunatQrString: qrString };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain(qrString);
  });

  it('debe generar PRE-CUENTA sin QR', () => {
    const data: ReceiptData = {
      ...baseReceipt,
      invoiceType: 'PRE-CUENTA',
      invoiceSeries: undefined,
      invoiceNumber: undefined,
      sunatQrString: undefined,
    };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain('PRE-CUENTA');
    expect(text).not.toContain('B001');
  });

  it('debe incluir info del cliente para FACTURA', () => {
    const data: ReceiptData = {
      ...baseReceipt,
      invoiceType: 'FACTURA',
      clientName: 'EMPRESA SAC',
      clientDoc: '20987654321',
    };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain('FACTURA');
    expect(text).toContain('EMPRESA SAC');
    expect(text).toContain('20987654321');
  });

  it('debe usar mensaje footer personalizado', () => {
    const data = { ...baseReceipt, footerMessage: 'Vuelva pronto!' };
    const result = buildThermalReceipt(data);
    const text = decode(result);
    expect(text).toContain('Vuelva pronto!');
  });

  it('debe usar footer por defecto', () => {
    const result = buildThermalReceipt(baseReceipt);
    const text = decode(result);
    expect(text).toContain('Gracias por su preferencia');
  });
});

describe('buildKitchenTicket', () => {
  const baseTicket: KitchenTicketData = {
    orderNumber: 42,
    orderType: 'MESA',
    tableNumber: '5',
    station: 'COCINA',
    items: [
      { name: '1/4 Pollo', qty: 2, mods: ['Sin sal'], notes: 'Bien cocido' },
      { name: 'Papas fritas', qty: 1 },
    ],
    time: '14:30',
  };

  it('debe generar ticket de cocina', () => {
    const result = buildKitchenTicket(baseTicket);
    expect(result).toBeInstanceOf(Uint8Array);
    const text = decode(result);
    expect(text).toContain('#42');
    expect(text).toContain('MESA');
    expect(text).toContain('COCINA');
  });

  it('debe incluir items con cantidades', () => {
    const result = buildKitchenTicket(baseTicket);
    const text = decode(result);
    expect(text).toContain('2x 1/4 Pollo');
    expect(text).toContain('1x Papas fritas');
  });

  it('debe incluir modificaciones', () => {
    const result = buildKitchenTicket(baseTicket);
    const text = decode(result);
    expect(text).toContain('Sin sal');
  });

  it('debe incluir notas', () => {
    const result = buildKitchenTicket(baseTicket);
    const text = decode(result);
    expect(text).toContain('Bien cocido');
  });

  it('debe incluir número de mesa', () => {
    const result = buildKitchenTicket(baseTicket);
    const text = decode(result);
    expect(text).toContain('Mesa: 5');
  });

  it('debe incluir hora', () => {
    const result = buildKitchenTicket(baseTicket);
    const text = decode(result);
    expect(text).toContain('14:30');
  });

  it('debe funcionar para DELIVERY', () => {
    const data = { ...baseTicket, orderType: 'DELIVERY' as const, tableNumber: undefined };
    const result = buildKitchenTicket(data);
    const text = decode(result);
    expect(text).toContain('DELIVERY');
    expect(text).not.toContain('Mesa:');
  });
});
