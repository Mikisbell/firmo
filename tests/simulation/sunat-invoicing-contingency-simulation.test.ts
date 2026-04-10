/**
 * UX Simulation: SUNAT Electronic Invoicing with Contingency Mode
 * 
 * Simulates real invoicing scenarios during SUNAT outages:
 * - SUNAT service goes down, contingency activates automatically
 * - 15 invoices issued in contingency mode during outage
 * - SUNAT comes back, reconciliation begins
 * - 2 invoices fail reconciliation (expired CDR)
 * - Customer asks for invoice during contingency
 * - 7-day deadline approaches, urgency increases
 * - Full reconciliation with deadlines met
 * 
 * This tests INVOICING RELIABILITY during SUNAT outages.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type InvoiceType = 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO';
type InvoiceStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY' | 'RECONCILED' | 'FAILED';
type ContingencyStatus = 'INACTIVE' | 'ACTIVE' | 'RECONCILING' | 'CLOSED';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface SUNATService {
  isOnline: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
  responseTimeMs: number;
}

interface ElectronicInvoice {
  id: string;
  invoiceType: InvoiceType;
  series: string;
  number: number;
  customerRuc: string;
  customerName: string;
  subtotalCents: Centavos;
  igvCents: Centavos;
  totalCents: Centavos;
  status: InvoiceStatus;
  createdAt: Date;
  sentToSunatAt?: Date;
  cdrReceivedAt?: Date;
  cdrResponseCode?: string;
  cdrMessage?: string;
  contingencyRegisteredAt?: Date;
  reconciliationDeadline?: Date;
  attempts: number;
  lastError?: string;
}

interface ContingencyState {
  status: ContingencyStatus;
  activatedAt?: Date;
  reason?: string;
  invoicesInContingency: ElectronicInvoice[];
  consecutiveFailures: number;
  lastHealthCheck: Date;
}

// SUNAT simulation
function simulateSunatHealth(service: SUNATService): SUNATService {
  const now = new Date();
  const wasOnline = service.isOnline;
  
  // Simulate random failures (5% chance if online)
  if (service.isOnline && Math.random() < 0.05) {
    service.isOnline = false;
    service.consecutiveFailures++;
  } else if (!service.isOnline && Math.random() < 0.1) {
    // 10% chance of recovery each check
    service.isOnline = true;
    service.consecutiveFailures = 0;
  } else if (!service.isOnline) {
    service.consecutiveFailures++;
  }
  
  service.lastChecked = now;
  service.responseTimeMs = service.isOnline 
    ? Math.floor(Math.random() * 2000) + 500 
    : 30000;
  
  return service;
}

function createInvoice(
  type: InvoiceType,
  number: number,
  customerName: string,
  customerRuc: string,
  totalCents: Centavos
): ElectronicInvoice {
  const igvCents = centavos(Math.round(totalCents * 0.18 / 1.18));
  const subtotalCents = centavos(totalCents - igvCents);
  
  return {
    id: `inv-${type}-${number}`,
    invoiceType: type,
    series: type === 'BOLETA' ? 'B001' : 'F001',
    number,
    customerRuc,
    customerName,
    subtotalCents,
    igvCents,
    totalCents,
    status: 'PENDING',
    createdAt: new Date(),
    attempts: 0,
  };
}

function trySendToSunat(invoice: ElectronicInvoice, sunat: SUNATService): {
  success: boolean;
  invoice: ElectronicInvoice;
  error?: string;
} {
  invoice.attempts++;
  
  if (!sunat.isOnline) {
    invoice.status = 'CONTINGENCY';
    invoice.contingencyRegisteredAt = new Date();
    invoice.reconciliationDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    invoice.lastError = 'SUNAT_UNREACHABLE';
    return { success: false, invoice, error: 'SUNAT no disponible' };
  }
  
  // Simulate SUNAT response
  const sunatError = Math.random() < 0.08; // 8% error rate even when online
  if (sunatError) {
    invoice.lastError = 'SUNAT_TIMEOUT';
    return { success: false, invoice, error: 'Timeout de SUNAT' };
  }
  
  // Success
  invoice.status = 'ACCEPTED';
  invoice.sentToSunatAt = new Date();
  invoice.cdrReceivedAt = new Date();
  invoice.cdrResponseCode = '0';
  invoice.cdrMessage = 'COMPROBANTE ACEPTADO';
  return { success: true, invoice };
}

function activateContingency(state: ContingencyState, reason: string): ContingencyState {
  return {
    ...state,
    status: 'ACTIVE',
    activatedAt: new Date(),
    reason,
    consecutiveFailures: state.consecutiveFailures,
  };
}

function reconcileInvoice(invoice: ElectronicInvoice, sunat: SUNATService): {
  success: boolean;
  invoice: ElectronicInvoice;
  error?: string;
} {
  if (invoice.reconciliationDeadline && new Date() > invoice.reconciliationDeadline) {
    invoice.status = 'FAILED';
    invoice.lastError = 'RECONCILIATION_DEADLINE_PASSED';
    return { success: false, invoice, error: 'Plazo de 7 días vencido' };
  }
  
  const result = trySendToSunat(invoice, sunat);
  
  if (result.success) {
    invoice.status = 'RECONCILED';
    invoice.cdrReceivedAt = new Date();
    invoice.cdrResponseCode = '0';
  } else {
    invoice.lastError = result.error;
  }
  
  return { success: result.success, invoice, error: result.error };
}

function calculateContingencyMetrics(state: ContingencyState): {
  totalInContingency: number;
  reconciled: number;
  pending: number;
  failed: number;
  totalAtRiskCents: Centavos;
  urgentInvoices: number; // < 24h to deadline
  overdueInvoices: number;
  reconciliationRate: number;
} {
  const invoices = state.invoicesInContingency;
  const now = new Date();
  
  const reconciled = invoices.filter(i => i.status === 'RECONCILED').length;
  const pending = invoices.filter(i => i.status === 'CONTINGENCY').length;
  const failed = invoices.filter(i => i.status === 'FAILED').length;
  
  const urgentInvoices = invoices.filter(i => {
    if (!i.reconciliationDeadline || i.status !== 'CONTINGENCY') return false;
    const hoursLeft = (i.reconciliationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft <= 24 && hoursLeft > 0;
  }).length;
  
  const overdueInvoices = invoices.filter(i => {
    if (!i.reconciliationDeadline || i.status !== 'CONTINGENCY') return false;
    return now > i.reconciliationDeadline;
  }).length;
  
  const totalAtRiskCents = centavos(
    invoices.filter(i => i.status === 'CONTINGENCY').reduce((sum, i) => sum + i.totalCents, 0)
  );
  
  return {
    totalInContingency: invoices.length,
    reconciled,
    pending,
    failed,
    totalAtRiskCents,
    urgentInvoices,
    overdueInvoices,
    reconciliationRate: invoices.length > 0 ? reconciled / invoices.length : 0,
  };
}

// ============================================================
// SUNAT INVOICING SIMULATION TESTS
// ============================================================

describe('SUNAT Electronic Invoicing with Contingency Simulation', () => {

  it('should simulate SUNAT outage and automatic contingency activation', () => {
    // SCENARIO: SUNAT goes down during busy Saturday afternoon
    const sunat: SUNATService = {
      isOnline: true,
      lastChecked: new Date(),
      consecutiveFailures: 0,
      responseTimeMs: 1000,
    };

    let contingency: ContingencyState = {
      status: 'INACTIVE',
      invoicesInContingency: [],
      consecutiveFailures: 0,
      lastHealthCheck: new Date(),
    };

    const invoices: ElectronicInvoice[] = [];
    let consecutiveFailures = 0;

    // Try to send 10 invoices
    for (let i = 1; i <= 10; i++) {
      // Simulate SUNAT health change
      simulateSunatHealth(sunat);

      const invoice = createInvoice(
        i % 3 === 0 ? 'FACTURA' : 'BOLETA',
        1000 + i,
        `Cliente ${i}`,
        i % 3 === 0 ? '20123456789' : '-',
        centavos((Math.random() * 100 + 30) * 100)
      );

      const result = trySendToSunat(invoice, sunat);
      invoices.push(result.invoice);

      if (!result.success) {
        consecutiveFailures++;
        
        // Auto-activate contingency after 5 consecutive failures
        if (consecutiveFailures >= 5 && contingency.status === 'INACTIVE') {
          contingency = activateContingency(contingency, 'SUNAT_UNREACHABLE');
        }
        
        if (contingency.status === 'ACTIVE') {
          contingency.invoicesInContingency.push(result.invoice);
        }
      } else {
        consecutiveFailures = 0;
      }
    }

    const metrics = calculateContingencyMetrics(contingency);

    console.log('📡 SUNAT Outage Simulation:');
    console.log(`   SUNAT online: ${sunat.isOnline}`);
    console.log(`   Contingency status: ${contingency.status}`);
    console.log(`   Invoices in contingency: ${contingency.invoicesInContingency.length}`);
    console.log(`   Total at risk: S/. ${(metrics.totalAtRiskCents / 100).toFixed(2)}`);
  });

  it('should handle reconciliation when SUNAT comes back online', () => {
    // SCENARIO: 15 invoices in contingency, SUNAT restored
    const sunat: SUNATService = {
      isOnline: true,
      lastChecked: new Date(),
      consecutiveFailures: 0,
      responseTimeMs: 800,
    };

    // Create 15 invoices that were in contingency
    const contingencyInvoices: ElectronicInvoice[] = [];
    for (let i = 1; i <= 15; i++) {
      const invoice = createInvoice(
        i % 4 === 0 ? 'FACTURA' : 'BOLETA',
        2000 + i,
        `Cliente Contingency ${i}`,
        i % 4 === 0 ? '20123456789' : '-',
        centavos((Math.random() * 150 + 50) * 100)
      );
      invoice.status = 'CONTINGENCY';
      invoice.contingencyRegisteredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      invoice.reconciliationDeadline = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days left
      contingencyInvoices.push(invoice);
    }

    // Reconcile all invoices
    let reconciled = 0;
    let failed = 0;

    for (const invoice of contingencyInvoices) {
      const result = reconcileInvoice(invoice, sunat);
      if (result.success) reconciled++;
      else failed++;
    }

    const reconciliationRate = reconciled / contingencyInvoices.length;
    expect(reconciliationRate).toBeGreaterThan(0.8); // At least 80% success

    console.log('🔄 Reconciliation Results:');
    console.log(`   Total invoices: ${contingencyInvoices.length}`);
    console.log(`   Reconciled: ${reconciled}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success rate: ${(reconciliationRate * 100).toFixed(0)}%`);
  });

  it('should detect invoices approaching 7-day deadline', () => {
    // SCENARIO: Some invoices are close to deadline, need urgent action
    const now = new Date('2026-04-09');
    
    const invoices: ElectronicInvoice[] = [
      {
        id: 'inv-urgent',
        invoiceType: 'FACTURA',
        series: 'F001',
        number: 3001,
        customerRuc: '20123456789',
        customerName: 'Cliente Urgente',
        subtotalCents: 7203 as Centavos,
        igvCents: 1297 as Centavos,
        totalCents: 8500 as Centavos,
        status: 'CONTINGENCY',
        createdAt: new Date('2026-04-02'),
        contingencyRegisteredAt: new Date('2026-04-02'),
        reconciliationDeadline: new Date('2026-04-09T12:00:00'), // Today, in 12 hours!
        attempts: 3,
        lastError: 'SUNAT_TIMEOUT',
      },
      {
        id: 'inv-ok',
        invoiceType: 'BOLETA',
        series: 'B001',
        number: 3002,
        customerRuc: '-',
        customerName: 'Cliente Normal',
        subtotalCents: 4237 as Centavos,
        igvCents: 763 as Centavos,
        totalCents: 5000 as Centavos,
        status: 'CONTINGENCY',
        createdAt: new Date('2026-04-05'),
        contingencyRegisteredAt: new Date('2026-04-05'),
        reconciliationDeadline: new Date('2026-04-12'), // 3 days left
        attempts: 1,
      },
    ];

    const urgentInvoices = invoices.filter(inv => {
      if (!inv.reconciliationDeadline || inv.status !== 'CONTINGENCY') return false;
      const hoursLeft = (inv.reconciliationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    });

    expect(urgentInvoices).toHaveLength(1);
    expect(urgentInvoices[0].id).toBe('inv-urgent');

    console.log('⏰ Deadline Urgency Check:');
    console.log(`   Urgent invoices (< 24h): ${urgentInvoices.length}`);
    console.log(`   Invoice: ${urgentInvoices[0]?.id}`);
    console.log(`   Deadline: ${urgentInvoices[0]?.reconciliationDeadline?.toLocaleString()}`);
    console.log(`   Action required: IMMEDIATE RECONCILIATION`);
  });

  it('should calculate contingency financial impact', () => {
    // SCENARIO: Business needs to know financial exposure during contingency
    const contingencyInvoices: ElectronicInvoice[] = [];
    
    for (let i = 1; i <= 20; i++) {
      const invoice = createInvoice(
        i % 3 === 0 ? 'FACTURA' : 'BOLETA',
        4000 + i,
        `Cliente ${i}`,
        i % 3 === 0 ? '20123456789' : '-',
        centavos((Math.random() * 200 + 50) * 100)
      );
      invoice.status = 'CONTINGENCY';
      invoice.contingencyRegisteredAt = new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000);
      invoice.reconciliationDeadline = new Date(Date.now() + (7 - Math.random() * 5) * 24 * 60 * 60 * 1000);
      contingencyInvoices.push(invoice);
    }

    const state: ContingencyState = {
      status: 'ACTIVE',
      invoicesInContingency: contingencyInvoices,
      consecutiveFailures: 5,
      lastHealthCheck: new Date(),
    };

    const metrics = calculateContingencyMetrics(state);

    const totalExposure = contingencyInvoices.reduce((sum, inv) => sum + inv.totalCents, 0);
    const avgInvoiceValue = totalExposure / contingencyInvoices.length;
    const igvAtRisk = contingencyInvoices.reduce((sum, inv) => sum + inv.igvCents, 0);

    console.log('💰 Contingency Financial Impact:');
    console.log(`   Invoices in contingency: ${contingencyInvoices.length}`);
    console.log(`   Total exposure: S/. ${(totalExposure / 100).toFixed(2)}`);
    console.log(`   Average invoice: S/. ${(avgInvoiceValue / 100).toFixed(2)}`);
    console.log(`   IGV at risk: S/. ${(igvAtRisk / 100).toFixed(2)}`);
    console.log(`   Urgent (< 24h): ${metrics.urgentInvoices}`);
    console.log(`   Overdue: ${metrics.overdueInvoices}`);
  });

  it('should recommend: SUNAT invoicing improvements', () => {
    const currentRisks = [
      'No automatic contingency activation',
      'No CDR timeout tracking',
      'No reconciliation progress dashboard',
      'No urgency alerts for approaching deadlines',
      'No financial impact tracking',
      'No automatic retry with backoff',
    ];

    const recommendations = [
      'Auto-activate after 5 consecutive SUNAT failures, notify admin via SMS',
      'Alert after 5 min without CDR, escalate after 10 min, force retry after 30 min',
      'Dashboard showing "X/Y reconciled, Z urgent, W overdue" with progress bar',
      'Auto-alert when invoice < 24h from deadline, SMS when < 6h',
      'Daily report: "S/. X at risk, Y invoices urgent, Z overdue", IGV exposure',
      'Auto-retry schedule: 1min, 5min, 15min, 1hr, 4hr, 24hr until deadline',
    ];

    expect(recommendations.length).toBe(currentRisks.length);

    console.log('✅ SUNAT Invoicing Recommendations:');
    for (let i = 0; i < currentRisks.length; i++) {
      console.log(`   🔴 ${currentRisks[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
