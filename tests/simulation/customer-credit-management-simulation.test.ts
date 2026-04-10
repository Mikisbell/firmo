/**
 * UX Simulation: Customer Credit Management
 * 
 * Simulates real credit scenarios for regular customers:
 * - Customer buys on credit (fiado), partial payments over time
 * - Credit limit enforcement (max S/. 500)
 * - Payment history tracking
 * - Collections after 30 days overdue
 * - Customer asks for more credit while owing
 * - Multiple customers with credit accounts
 * 
 * This tests CREDIT MANAGEMENT, not just cash sales.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface Customer {
  id: string;
  name: string;
  dni: string;
  phone: string;
  address: string;
  creditLimitCents: Centavos;
  createdAt: Date;
  isActive: boolean;
}

interface CreditSale {
  saleId: string;
  customerId: string;
  orderNumber: number;
  totalCents: Centavos;
  paidCents: Centavos;
  balanceCents: Centavos;
  dueDate: Date;
  createdAt: Date;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'COLLECTED';
}

interface CreditPayment {
  paymentId: string;
  saleId: string;
  customerId: string;
  amountCents: Centavos;
  paidAt: Date;
  method: 'CASH' | 'CARD' | 'YAPE';
}

interface CreditAccount {
  customerId: string;
  totalCreditUsedCents: Centavos;
  totalCreditLimitCents: Centavos;
  availableCreditCents: Centavos;
  overdueBalanceCents: Centavos;
  paymentHistory: CreditPayment[];
  salesHistory: CreditSale[];
}

function createCustomer(name: string, dni: string, phone: string, creditLimitCents: Centavos): Customer {
  return {
    id: `cust-${Date.now()}-${name}`,
    name,
    dni,
    phone,
    address: 'Av. Principal 123',
    creditLimitCents,
    createdAt: new Date(),
    isActive: true,
  };
}

function createCreditSale(customerId: string, orderNumber: number, totalCents: Centavos, daysToPay: number = 7): CreditSale {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysToPay);

  return {
    saleId: `sale-${Date.now()}-${orderNumber}`,
    customerId,
    orderNumber,
    totalCents,
    paidCents: 0 as Centavos,
    balanceCents: totalCents,
    dueDate,
    createdAt: new Date(),
    status: 'PENDING',
  };
}

function makePayment(sale: CreditSale, payment: CreditPayment): {
  sale: CreditSale;
  payment: CreditPayment;
  isFullyPaid: boolean;
  changeCents: Centavos;
} {
  const newPaidCents = Math.min(sale.paidCents + payment.amountCents, sale.totalCents) as Centavos;
  const newBalanceCents = Math.max(sale.totalCents - newPaidCents, 0) as Centavos;
  const changeCents = payment.amountCents > sale.balanceCents 
    ? centavos(payment.amountCents - sale.balanceCents) 
    : 0 as Centavos;
  const isFullyPaid = newBalanceCents === 0;

  const updatedSale: CreditSale = {
    ...sale,
    paidCents: newPaidCents,
    balanceCents: newBalanceCents,
    status: isFullyPaid ? 'PAID' as const : 'PARTIAL' as const,
  };

  return { sale: updatedSale, payment, isFullyPaid, changeCents };
}

function checkCreditAvailability(account: CreditAccount, requestedAmountCents: Centavos): {
  allowed: boolean;
  availableCents: Centavos;
  reason?: string;
} {
  const availableCents = centavos(account.totalCreditLimitCents - account.totalCreditUsedCents);

  if (account.overdueBalanceCents > 0) {
    return {
      allowed: false,
      availableCents,
      reason: `Tiene S/. ${(account.overdueBalanceCents / 100).toFixed(2)} vencido. Pague primero.`,
    };
  }

  if (requestedAmountCents > availableCents) {
    return {
      allowed: false,
      availableCents,
      reason: `Crédito insuficiente. Disponible: S/. ${(availableCents / 100).toFixed(2)}`,
    };
  }

  return { allowed: true, availableCents };
}

function calculateOverdueSales(sales: CreditSale[], now: Date = new Date()): CreditSale[] {
  return sales.filter(sale => {
    if (sale.status === 'PAID' || sale.status === 'COLLECTED') return false;
    return now > sale.dueDate;
  }).map(sale => ({ ...sale, status: 'OVERDUE' as const }));
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// CREDIT MANAGEMENT SIMULATION TESTS
// ============================================================

describe('Customer Credit Management Simulation', () => {

  it('should simulate customer buying on credit with partial payments', () => {
    // SCENARIO: Regular customer buys S/. 350 on credit, pays in installments
    const customer = createCustomer('Juan Pérez', '72345678', '987654321', 50000 as Centavos);
    const sale = createCreditSale(customer.id, 1001, 35000 as Centavos, 7); // S/. 350, 7 days

    expect(sale.status).toBe('PENDING');
    expect(sale.balanceCents).toBe(35000);

    // Payment 1: S/. 100 after 2 days
    const payment1: CreditPayment = {
      paymentId: 'pay-1',
      saleId: sale.saleId,
      customerId: customer.id,
      amountCents: 10000 as Centavos,
      paidAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      method: 'CASH',
    };

    const result1 = makePayment(sale, payment1);
    expect(result1.sale.balanceCents).toBe(25000);
    expect(result1.sale.status).toBe('PARTIAL');
    expect(result1.isFullyPaid).toBe(false);

    // Payment 2: S/. 150 after 5 days
    const payment2: CreditPayment = {
      paymentId: 'pay-2',
      saleId: sale.saleId,
      customerId: customer.id,
      amountCents: 15000 as Centavos,
      paidAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      method: 'YAPE',
    };

    const result2 = makePayment(result1.sale, payment2);
    expect(result2.sale.balanceCents).toBe(10000);
    expect(result2.sale.status).toBe('PARTIAL');

    // Payment 3: Full balance S/. 100 after 7 days
    const payment3: CreditPayment = {
      paymentId: 'pay-3',
      saleId: sale.saleId,
      customerId: customer.id,
      amountCents: 12000 as Centavos, // Customer overpays by S/. 20
      paidAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      method: 'CASH',
    };

    const result3 = makePayment(result2.sale, payment3);
    expect(result3.sale.balanceCents).toBe(0);
    expect(result3.sale.status).toBe('PAID');
    expect(result3.isFullyPaid).toBe(true);
    expect(result3.changeCents).toBe(2000); // S/. 20 change

    console.log('💳 Credit Sale with Partial Payments:');
    console.log(`   Customer: ${customer.name}`);
    console.log(`   Total: S/. ${(sale.totalCents / 100).toFixed(2)}`);
    console.log(`   Payment 1: S/. ${(payment1.amountCents / 100).toFixed(2)}`);
    console.log(`   Payment 2: S/. ${(payment2.amountCents / 100).toFixed(2)}`);
    console.log(`   Payment 3: S/. ${(payment3.amountCents / 100).toFixed(2)} (overpaid)`);
    console.log(`   Change: S/. ${(result3.changeCents / 100).toFixed(2)}`);
    console.log(`   Status: ${result3.sale.status}`);
  });

  it('should enforce credit limit and block excessive credit', () => {
    // SCENARIO: Customer with S/. 500 limit tries to buy S/. 600 on credit
    const customer = createCustomer('María García', '72345679', '987654322', 50000 as Centavos);

    // Existing credit usage: S/. 300
    const account: CreditAccount = {
      customerId: customer.id,
      totalCreditUsedCents: 30000 as Centavos,
      totalCreditLimitCents: 50000 as Centavos,
      availableCreditCents: 20000 as Centavos,
      overdueBalanceCents: 0 as Centavos,
      paymentHistory: [],
      salesHistory: [],
    };

    // Try to buy S/. 600 on credit (exceeds limit)
    const result = checkCreditAvailability(account, 60000 as Centavos);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Crédito insuficiente');

    // Try to buy S/. 150 on credit (within limit)
    const result2 = checkCreditAvailability(account, 15000 as Centavos);
    expect(result2.allowed).toBe(true);
    expect(result2.availableCents).toBe(20000);

    console.log('🚫 Credit Limit Enforcement:');
    console.log(`   Credit Limit: S/. ${(account.totalCreditLimitCents / 100).toFixed(2)}`);
    console.log(`   Used: S/. ${(account.totalCreditUsedCents / 100).toFixed(2)}`);
    console.log(`   Available: S/. ${(account.availableCreditCents / 100).toFixed(2)}`);
    console.log(`   Request S/. 600: BLOCKED`);
    console.log(`   Request S/. 150: ALLOWED`);
  });

  it('should block credit when customer has overdue balance', () => {
    // SCENARIO: Customer owes S/. 200 overdue, tries to buy more on credit
    const customer = createCustomer('Carlos López', '72345680', '987654323', 50000 as Centavos);

    const account: CreditAccount = {
      customerId: customer.id,
      totalCreditUsedCents: 20000 as Centavos,
      totalCreditLimitCents: 50000 as Centavos,
      availableCreditCents: 30000 as Centavos,
      overdueBalanceCents: 20000 as Centavos, // OVERDUE!
      paymentHistory: [],
      salesHistory: [],
    };

    // Try to buy S/. 100 on credit (would be within limit, but has overdue)
    const result = checkCreditAvailability(account, 10000 as Centavos);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('vencido');

    console.log('⏰ Overdue Balance Blocks Credit:');
    console.log(`   Overdue: S/. ${(account.overdueBalanceCents / 100).toFixed(2)}`);
    console.log(`   Request S/. 100: BLOCKED (must pay overdue first)`);
  });

  it('should calculate collections for overdue accounts', () => {
    // SCENARIO: 5 customers with various overdue amounts
    const sales: CreditSale[] = [
      { saleId: 'sale-1', customerId: 'cust-1', orderNumber: 1001, totalCents: 15000 as Centavos, paidCents: 0 as Centavos, balanceCents: 15000 as Centavos, dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), status: 'OVERDUE' },
      { saleId: 'sale-2', customerId: 'cust-2', orderNumber: 1002, totalCents: 8500 as Centavos, paidCents: 5000 as Centavos, balanceCents: 3500 as Centavos, dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), status: 'OVERDUE' },
      { saleId: 'sale-3', customerId: 'cust-3', orderNumber: 1003, totalCents: 22000 as Centavos, paidCents: 22000 as Centavos, balanceCents: 0 as Centavos, dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: 'PAID' },
      { saleId: 'sale-4', customerId: 'cust-4', orderNumber: 1004, totalCents: 12000 as Centavos, paidCents: 0 as Centavos, balanceCents: 12000 as Centavos, dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 37 * 24 * 60 * 60 * 1000), status: 'OVERDUE' },
      { saleId: 'sale-5', customerId: 'cust-5', orderNumber: 1005, totalCents: 6500 as Centavos, paidCents: 3000 as Centavos, balanceCents: 3500 as Centavos, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'PARTIAL' },
    ];

    const overdueSales = calculateOverdueSales(sales);
    const totalOverdue = overdueSales.reduce((sum, s) => sum + s.balanceCents, 0);
    const criticalAccounts = overdueSales.filter(s => {
      const daysOverdue = (Date.now() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysOverdue > 15;
    });

    expect(overdueSales.length).toBe(3); // sale-1, sale-2, sale-4
    expect(totalOverdue).toBe(30500); // 15000 + 3500 + 12000
    expect(criticalAccounts.length).toBe(1); // sale-4 (30 days overdue)

    console.log('📊 Collections Report:');
    console.log(`   Overdue accounts: ${overdueSales.length}`);
    console.log(`   Total overdue: S/. ${(totalOverdue / 100).toFixed(2)}`);
    console.log(`   Critical (> 15 days): ${criticalAccounts.length}`);
    console.log(`   Action: Contact critical accounts immediately`);
  });

  it('should calculate monthly credit portfolio health', () => {
    // SCENARIO: Business needs to know credit portfolio health
    const totalCreditGranted = 500000; // S/. 5,000 total credit limit across customers
    const totalCreditUsed = 180000; // S/. 1,800 currently used
    const totalOverdue = 30500; // S/. 305 overdue
    const totalCollectedThisMonth = 120000; // S/. 1,200 collected

    const portfolioUtilization = (totalCreditUsed / totalCreditGranted) * 100;
    const overdueRate = (totalOverdue / totalCreditUsed) * 100;
    const collectionRate = totalCollectedThisMonth > 0 
      ? ((totalCollectedThisMonth - totalOverdue) / totalCollectedThisMonth) * 100 
      : 0;

    expect(portfolioUtilization).toBe(36);
    expect(overdueRate).toBeGreaterThan(10);
    expect(overdueRate).toBeLessThan(20);

    console.log('💼 Credit Portfolio Health:');
    console.log(`   Total Credit Granted: S/. ${(totalCreditGranted / 100).toFixed(2)}`);
    console.log(`   Total Credit Used: S/. ${(totalCreditUsed / 100).toFixed(2)} (${portfolioUtilization.toFixed(0)}%)`);
    console.log(`   Overdue: S/. ${(totalOverdue / 100).toFixed(2)} (${overdueRate.toFixed(1)}%)`);
    console.log(`   Collected This Month: S/. ${(totalCollectedThisMonth / 100).toFixed(2)}`);
    console.log(`   Collection Rate: ${collectionRate.toFixed(1)}%`);
    console.log(`   Health: ${overdueRate < 15 ? 'GOOD' : 'WARNING'}`);
  });

  it('should recommend: Credit management improvements', () => {
    const currentGaps = [
      'No automated credit limit enforcement',
      'No overdue notifications to customers',
      'No collection workflow (manual tracking)',
      'No credit score based on payment history',
      'No automatic credit block after X days overdue',
      'No portfolio health dashboard',
    ];

    const recommendations = [
      'System blocks credit sale if customer exceeds limit or has overdue balance',
      'Auto-SMS reminder 2 days before due date, 1 day after, weekly until paid',
      'Collections dashboard: sorted by days overdue, one-click contact customer',
      'Credit score: 5 payments on time = +10%, 1 late = -20%, 2+ late = block',
      'Auto-block credit after 15 days overdue, require manager approval to unblock',
      'Monthly report: utilization %, overdue rate, collection rate, risk customers',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Credit Management Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
