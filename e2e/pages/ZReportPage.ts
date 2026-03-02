/**
 * Page Object for Z-Report page (/pos/shift/z-report)
 * Handles report generation and value verification.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ZReportPage extends BasePage {
  readonly reportPage: Locator;
  readonly reportTitle: Locator;
  readonly backLink: Locator;
  readonly printBtn: Locator;
  readonly generateX: Locator;
  readonly generateZ: Locator;
  readonly grossSales: Locator;
  readonly netSales: Locator;
  readonly ordersCount: Locator;
  readonly igv: Locator;
  readonly cashOpening: Locator;
  readonly cashExpected: Locator;
  readonly cashCounted: Locator;
  readonly cashDiff: Locator;
  readonly paymentsSection: Locator;
  readonly meta: Locator;

  constructor(page: Page) {
    super(page);
    this.reportPage = page.locator('[data-testid="z-report-page"]');
    this.reportTitle = page.locator('[data-testid="z-report-title"]');
    this.backLink = page.locator('[data-testid="z-report-back-link"]');
    this.printBtn = page.locator('[data-testid="z-report-print-btn"]');
    this.generateX = page.locator('[data-testid="z-report-generate-x"]');
    this.generateZ = page.locator('[data-testid="z-report-generate-z"]');
    this.grossSales = page.locator('[data-testid="z-report-gross-sales"]');
    this.netSales = page.locator('[data-testid="z-report-net-sales"]');
    this.ordersCount = page.locator('[data-testid="z-report-orders-count"]');
    this.igv = page.locator('[data-testid="z-report-igv"]');
    this.cashOpening = page.locator('[data-testid="z-report-cash-opening"]');
    this.cashExpected = page.locator('[data-testid="z-report-cash-expected"]');
    this.cashCounted = page.locator('[data-testid="z-report-cash-counted"]');
    this.cashDiff = page.locator('[data-testid="z-report-cash-diff"]');
    this.paymentsSection = page.locator('[data-testid="z-report-payments-section"]');
    this.meta = page.locator('[data-testid="z-report-meta"]');
  }

  async navigateToZReport(shiftId: string): Promise<void> {
    await this.goto(`/pos/shift/z-report?shiftId=${shiftId}`);
    await this.reportPage.waitFor({ state: 'visible', timeout: 30000 });
  }

  async generateZReport(): Promise<void> {
    await this.generateZ.click();
    // Wait for report to generate and display
    await this.grossSales.waitFor({ state: 'visible', timeout: 30000 });
  }

  async generateXReport(): Promise<void> {
    await this.generateX.click();
    await this.grossSales.waitFor({ state: 'visible', timeout: 30000 });
  }

  async assertGrossSales(expectedText: string): Promise<void> {
    await expect(this.grossSales).toContainText(expectedText);
  }

  async assertOrdersCount(expected: string): Promise<void> {
    await expect(this.ordersCount).toContainText(expected);
  }

  async assertCashOpening(expectedText: string): Promise<void> {
    await expect(this.cashOpening).toContainText(expectedText);
  }

  async assertCashExpected(expectedText: string): Promise<void> {
    await expect(this.cashExpected).toContainText(expectedText);
  }
}
