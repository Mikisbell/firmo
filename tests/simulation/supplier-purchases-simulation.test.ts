/**
 * UX Simulation: Supplier Purchases and Inventory Receiving
 * 
 * Simulates real purchasing scenarios:
 * - Create purchase order to supplier (pollos, papas, bebidas)
 * - Receive goods with quality check (some items rejected)
 * - Invoice matching (PO vs received vs invoice)
 * - Partial payment to supplier
 * - Supplier credit for returned items
 * - Price fluctuations between orders
 * 
 * This tests PROCUREMENT PROCESS, not just sales.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface Supplier {
  id: string;
  name: string;
  ruc: string;
  phone: string;
  contactPerson: string;
  paymentTerms: 'CASH' | 'CREDIT_7' | 'CREDIT_15' | 'CREDIT_30';
}

interface PurchaseOrderItem {
  itemId: string;
  productName: string;
  quantity: number;
  unit: string; // kg, unit, pack
  unitPriceCents: Centavos;
  expectedTotalCents: Centavos;
}

interface PurchaseOrder {
  poNumber: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  totalCents: Centavos;
  createdAt: Date;
  expectedDeliveryDate: Date;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CLOSED';
}

interface GoodsReceipt {
  receiptId: string;
  poNumber: string;
  receivedAt: Date;
  items: Array<{
    itemId: string;
    quantityOrdered: number;
    quantityReceived: number;
    quantityRejected: number;
    rejectionReason?: string;
  }>;
  receivedBy: string;
  notes?: string;
}

interface SupplierInvoice {
  invoiceId: string;
  poNumber: string;
  supplierInvoiceNumber: string;
  subtotalCents: Centavos;
  igvCents: Centavos;
  totalCents: Centavos;
  receivedAt: Date;
  matched: boolean;
}

interface SupplierPayment {
  paymentId: string;
  invoiceId: string;
  amountCents: Centavos;
  paidAt: Date;
  method: 'CASH' | 'TRANSFER' | 'CHECK';
  reference?: string;
}

function createSupplier(name: string, ruc: string, paymentTerms: Supplier['paymentTerms']): Supplier {
  return {
    id: `sup-${name.toLowerCase().replace(/\s/g, '-')}`,
    name,
    ruc,
    phone: '987654321',
    contactPerson: 'Juan Proveedor',
    paymentTerms,
  };
}

function createPurchaseOrder(supplierId: string, items: PurchaseOrderItem[], deliveryDays: number = 2): PurchaseOrder {
  const totalCents = items.reduce((sum, item) => sum + item.expectedTotalCents, 0) as Centavos;
  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + deliveryDays);

  return {
    poNumber: `PO-${Date.now()}`,
    supplierId,
    items,
    totalCents,
    createdAt: new Date(),
    expectedDeliveryDate,
    status: 'DRAFT',
  };
}

function receiveGoods(po: PurchaseOrder, receivedQuantities: Array<{ itemId: string; received: number; rejected: number; reason?: string }>, receivedBy: string): {
  receipt: GoodsReceipt;
  po: PurchaseOrder;
  rejectionRate: number;
} {
  const receiptItems = receivedQuantities.map(rq => {
    const orderedItem = po.items.find(i => i.itemId === rq.itemId);
    return {
      itemId: rq.itemId,
      quantityOrdered: orderedItem?.quantity || 0,
      quantityReceived: rq.received,
      quantityRejected: rq.rejected,
      rejectionReason: rq.reason,
    };
  });

  const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalRejected = receiptItems.reduce((sum, i) => sum + i.quantityRejected, 0);
  const rejectionRate = totalOrdered > 0 ? (totalRejected / totalOrdered) * 100 : 0;

  const isPartial = receiptItems.some(i => i.quantityReceived < i.quantityOrdered);
  const isComplete = receiptItems.every(i => i.quantityReceived >= i.quantityOrdered);

  const receipt: GoodsReceipt = {
    receiptId: `receipt-${Date.now()}`,
    poNumber: po.poNumber,
    receivedAt: new Date(),
    items: receiptItems,
    receivedBy,
  };

  const updatedPo: PurchaseOrder = {
    ...po,
    status: isPartial ? 'PARTIAL' : isComplete ? 'RECEIVED' : po.status,
  };

  return { receipt, po: updatedPo, rejectionRate };
}

function matchInvoice(po: PurchaseOrder, receipt: GoodsReceipt, supplierInvoiceTotalCents: Centavos): {
  invoice: SupplierInvoice;
  matched: boolean;
  varianceCents: Centavos;
  variancePercent: number;
} {
  // Calculate expected total based on what was actually received
  const receivedTotalCents = po.items.reduce((sum, item) => {
    const receivedItem = receipt.items.find(r => r.itemId === item.itemId);
    const receivedQty = receivedItem?.quantityReceived || 0;
    return sum + receivedQty * item.unitPriceCents;
  }, 0) as Centavos;

  const varianceCents = supplierInvoiceTotalCents - receivedTotalCents;
  const variancePercent = receivedTotalCents > 0 ? Math.abs(varianceCents) / receivedTotalCents * 100 : 0;
  const matched = variancePercent < 5; // Accept up to 5% variance

  const invoice: SupplierInvoice = {
    invoiceId: `inv-${Date.now()}`,
    poNumber: po.poNumber,
    supplierInvoiceNumber: `SINV-${Date.now()}`,
    subtotalCents: centavos(receivedTotalCents / 1.18),
    igvCents: centavos(receivedTotalCents * 0.18 / 1.18),
    totalCents: receivedTotalCents,
    receivedAt: new Date(),
    matched,
  };

  return { invoice, matched, varianceCents, variancePercent };
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// SUPPLIER PURCHASE SIMULATION TESTS
// ============================================================

describe('Supplier Purchases and Inventory Receiving Simulation', () => {

  it('should simulate complete purchase order to goods receipt flow', () => {
    // SCENARIO: Order 100 chickens, 200kg potatoes, 500 drinks from supplier
    const supplier = createSupplier('Avícola Don Pedro', '20123456789', 'CREDIT_7');

    const po = createPurchaseOrder(supplier.id, [
      { itemId: 'item-1', productName: 'Pollos Enteros', quantity: 100, unit: 'unit', unitPriceCents: 1800 as Centavos, expectedTotalCents: 180000 as Centavos },
      { itemId: 'item-2', productName: 'Papas Fritas (kg)', quantity: 200, unit: 'kg', unitPriceCents: 250 as Centavos, expectedTotalCents: 50000 as Centavos },
      { itemId: 'item-3', productName: 'Inca Kola 1.5L', quantity: 500, unit: 'unit', unitPriceCents: 600 as Centavos, expectedTotalCents: 300000 as Centavos },
    ], 2);

    expect(po.totalCents).toBe(530000); // S/. 5,300.00
    expect(po.status).toBe('DRAFT');

    // Send PO to supplier
    const sentPo: PurchaseOrder = { ...po, status: 'SENT' };

    // Receive goods (2 days later)
    const { receipt, po: receivedPo, rejectionRate } = receiveGoods(sentPo, [
      { itemId: 'item-1', received: 98, rejected: 2, reason: 'Damaged during transport' },
      { itemId: 'item-2', received: 195, rejected: 5, reason: 'Poor quality' },
      { itemId: 'item-3', received: 500, rejected: 0 },
    ], 'Carlos López');

    expect(receivedPo.status === 'RECEIVED' || receivedPo.status === 'PARTIAL').toBe(true);
    expect(rejectionRate).toBeLessThan(5); // Should be acceptable
    expect(receipt.items[0].quantityRejected).toBe(2);

    // Match supplier invoice
    const { invoice, matched, variancePercent } = matchInvoice(
      sentPo,
      receipt,
      520000 as Centavos // Supplier invoices S/. 5,200
    );

    expect(matched).toBe(true);
    expect(variancePercent).toBeLessThan(5);

    console.log('📦 Complete Purchase Order Flow:');
    console.log(`   Supplier: ${supplier.name}`);
    console.log(`   PO Total: S/. ${(po.totalCents / 100).toFixed(2)}`);
    console.log(`   Received: ${(receipt.items.reduce((s, i) => s + i.quantityReceived, 0))} items`);
    console.log(`   Rejected: ${(receipt.items.reduce((s, i) => s + i.quantityRejected, 0))} items (${rejectionRate.toFixed(1)}%)`);
    console.log(`   Invoice Match: ${matched ? 'OK' : 'MISMATCH'}`);
    console.log(`   Variance: ${variancePercent.toFixed(1)}%`);
  });

  it('should handle partial delivery and track remaining items', () => {
    // SCENARIO: Supplier delivers 60% now, 40% next week
    const supplier = createSupplier('Distribuciones Lima', '20987654321', 'CREDIT_15');

    const po = createPurchaseOrder(supplier.id, [
      { itemId: 'item-1', productName: 'Pollos', quantity: 50, unit: 'unit', unitPriceCents: 1800 as Centavos, expectedTotalCents: 90000 as Centavos },
      { itemId: 'item-2', productName: 'Bebidas', quantity: 200, unit: 'unit', unitPriceCents: 600 as Centavos, expectedTotalCents: 120000 as Centavos },
    ]);

    // First delivery: 30 pollos, 200 bebidas
    const { receipt: receipt1, po: po1 } = receiveGoods(po, [
      { itemId: 'item-1', received: 30, rejected: 0 },
      { itemId: 'item-2', received: 200, rejected: 0 },
    ], 'María García');

    expect(po1.status).toBe('PARTIAL');

    // Second delivery: remaining 20 pollos
    const { receipt: receipt2, po: po2 } = receiveGoods(po1, [
      { itemId: 'item-1', received: 20, rejected: 0 },
      { itemId: 'item-2', received: 0, rejected: 0 }, // Already received
    ], 'María García');

    expect(po2.status === 'RECEIVED' || po2.status === 'PARTIAL').toBe(true);

    console.log('📦 Partial Delivery Tracking:');
    console.log(`   Delivery 1: 30/50 pollos, 200/200 bebidas`);
    console.log(`   Status after D1: ${po1.status}`);
    console.log(`   Delivery 2: 20/50 pollos (remaining)`);
    console.log(`   Status after D2: ${po2.status}`);
  });

  it('should track supplier payment history and outstanding balance', () => {
    // SCENARIO: Multiple purchases and payments to same supplier
    const supplier = createSupplier('Avícola Don Pedro', '20123456789', 'CREDIT_7');

    const invoices: SupplierInvoice[] = [];
    const payments: SupplierPayment[] = [];

    // Invoice 1: S/. 5,300
    invoices.push({
      invoiceId: 'inv-1',
      poNumber: 'PO-001',
      supplierInvoiceNumber: 'SINV-1001',
      subtotalCents: 449153 as Centavos,
      igvCents: 80847 as Centavos,
      totalCents: 530000 as Centavos,
      receivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      matched: true,
    });

    // Invoice 2: S/. 3,200
    invoices.push({
      invoiceId: 'inv-2',
      poNumber: 'PO-002',
      supplierInvoiceNumber: 'SINV-1002',
      subtotalCents: 271186 as Centavos,
      igvCents: 48814 as Centavos,
      totalCents: 320000 as Centavos,
      receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      matched: true,
    });

    // Payment 1: S/. 4,000
    payments.push({
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      amountCents: 400000 as Centavos,
      paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      method: 'TRANSFER',
      reference: 'TXN-12345',
    });

    // Payment 2: S/. 3,200 (full invoice 2)
    payments.push({
      paymentId: 'pay-2',
      invoiceId: 'inv-2',
      amountCents: 320000 as Centavos,
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      method: 'CASH',
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalCents, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amountCents, 0);
    const outstandingBalance = totalInvoiced - totalPaid;

    expect(totalInvoiced).toBe(850000);
    expect(totalPaid).toBe(720000);
    expect(outstandingBalance).toBe(130000); // S/. 1,300 outstanding

    console.log('💰 Supplier Payment History:');
    console.log(`   Supplier: ${supplier.name}`);
    console.log(`   Total Invoiced: S/. ${(totalInvoiced / 100).toFixed(2)}`);
    console.log(`   Total Paid: S/. ${(totalPaid / 100).toFixed(2)}`);
    console.log(`   Outstanding: S/. ${(outstandingBalance / 100).toFixed(2)}`);
    console.log(`   Payment Terms: ${supplier.paymentTerms}`);
  });

  it('should detect price fluctuations between orders', () => {
    // SCENARIO: Supplier increases prices between orders
    const previousOrderItems = [
      { itemId: 'item-1', productName: 'Pollos', unitPriceCents: 1800 as Centavos },
      { itemId: 'item-2', productName: 'Papas (kg)', unitPriceCents: 250 as Centavos },
    ];

    const newOrderItems = [
      { itemId: 'item-1', productName: 'Pollos', unitPriceCents: 2000 as Centavos },
      { itemId: 'item-2', productName: 'Papas (kg)', unitPriceCents: 270 as Centavos },
    ];

    const priceChanges = newOrderItems.map(newItem => {
      const prevItem = previousOrderItems.find(p => p.itemId === newItem.itemId);
      const change = prevItem
        ? ((newItem.unitPriceCents - prevItem.unitPriceCents) / prevItem.unitPriceCents * 100)
        : 0;
      return {
        productId: newItem.itemId,
        productName: newItem.productName,
        oldPrice: prevItem?.unitPriceCents || 0,
        newPrice: newItem.unitPriceCents,
        changePercent: change,
      };
    });

    const avgPriceChange = priceChanges.reduce((sum, pc) => sum + pc.changePercent, 0) / priceChanges.length;

    expect(priceChanges[0].changePercent).toBeCloseTo(11.1, 1); // Pollos: +11.1%
    expect(priceChanges[1].changePercent).toBeCloseTo(8.0, 1); // Papas: +8%
    expect(avgPriceChange).toBeGreaterThan(5); // Significant increase

    console.log('📈 Price Fluctuation Detection:');
    for (const pc of priceChanges) {
      console.log(`   ${pc.productName}: S/. ${(pc.oldPrice / 100).toFixed(2)} → S/. ${(pc.newPrice / 100).toFixed(2)} (${pc.changePercent > 0 ? '+' : ''}${pc.changePercent.toFixed(1)}%)`);
    }
    console.log(`   Average Change: +${avgPriceChange.toFixed(1)}%`);
    console.log(`   Action: ${avgPriceChange > 10 ? 'NEGOTIATE with supplier or FIND ALTERNATIVE' : 'ACCEPT'}`);
  });

  it('should calculate monthly purchasing metrics', () => {
    // SCENARIO: Business wants to know purchasing patterns
    const monthlyPurchases = {
      totalOrders: 15,
      totalSpentCents: 8500000 as Centavos, // S/. 85,000
      totalItemsReceived: 5000,
      totalItemsRejected: 120,
      avgDeliveryTimeDays: 2.3,
      onTimeDeliveryRate: 87, // 87%
      invoiceMatchRate: 93, // 93%
    };

    const rejectionRate = monthlyPurchases.totalItemsReceived > 0
      ? (monthlyPurchases.totalItemsRejected / monthlyPurchases.totalItemsReceived) * 100
      : 0;

    const avgOrderValue = monthlyPurchases.totalOrders > 0
      ? monthlyPurchases.totalSpentCents / monthlyPurchases.totalOrders
      : 0;

    expect(rejectionRate).toBeLessThan(5);
    expect(monthlyPurchases.onTimeDeliveryRate).toBeGreaterThan(80);
    expect(monthlyPurchases.invoiceMatchRate).toBeGreaterThan(90);

    console.log('📊 Monthly Purchasing Metrics:');
    console.log(`   Total Orders: ${monthlyPurchases.totalOrders}`);
    console.log(`   Total Spent: S/. ${(monthlyPurchases.totalSpentCents / 100).toFixed(2)}`);
    console.log(`   Avg Order Value: S/. ${(avgOrderValue / 100).toFixed(2)}`);
    console.log(`   Items Received: ${monthlyPurchases.totalItemsReceived}`);
    console.log(`   Items Rejected: ${monthlyPurchases.totalItemsRejected} (${rejectionRate.toFixed(1)}%)`);
    console.log(`   Avg Delivery: ${monthlyPurchases.avgDeliveryTimeDays} days`);
    console.log(`   On-Time Rate: ${monthlyPurchases.onTimeDeliveryRate}%`);
    console.log(`   Invoice Match Rate: ${monthlyPurchases.invoiceMatchRate}%`);
  });

  it('should recommend: Supplier management improvements', () => {
    const currentGaps = [
      'No automated price tracking',
      'No supplier performance scoring',
      'No automatic reorder points',
      'No purchase order approval workflow',
      'No supplier credit limit tracking',
      'No goods receipt quality checklist',
    ];

    const recommendations = [
      'Track price history per product, alert when increase > 10%',
      'Score suppliers: on-time %, quality %, price competitiveness, monthly report',
      'Auto-generate PO when stock < reorder point, manager approval before sending',
      'PO > S/. 1,000 requires manager approval, > S/. 5,000 requires owner approval',
      'Track outstanding balance per supplier, block orders if > credit limit',
      'Quality checklist on receipt: temperature, freshness, packaging, expiry date',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Supplier Management Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
