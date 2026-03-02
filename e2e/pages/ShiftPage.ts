/**
 * Page Object for Shift Management page (/pos/shift)
 * Handles shift history viewing and Z-report navigation.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ShiftPage extends BasePage {
  readonly shiftPage: Locator;
  readonly pageTitle: Locator;
  readonly toggleBtn: Locator;
  readonly refreshBtn: Locator;
  readonly activeLabel: Locator;
  readonly summarySales: Locator;
  readonly summaryOrders: Locator;
  readonly summaryAvg: Locator;
  readonly summaryOpening: Locator;
  readonly historySection: Locator;

  constructor(page: Page) {
    super(page);
    this.shiftPage = page.locator('[data-testid="shift-page"]');
    this.pageTitle = page.locator('[data-testid="shift-page-title"]');
    this.toggleBtn = page.locator('[data-testid="shift-toggle-btn"]');
    this.refreshBtn = page.locator('[data-testid="shift-refresh-btn"]');
    this.activeLabel = page.locator('[data-testid="shift-active-label"]');
    this.summarySales = page.locator('[data-testid="shift-summary-sales"]');
    this.summaryOrders = page.locator('[data-testid="shift-summary-orders"]');
    this.summaryAvg = page.locator('[data-testid="shift-summary-avg"]');
    this.summaryOpening = page.locator('[data-testid="shift-summary-opening"]');
    this.historySection = page.locator('[data-testid="shift-history-section"]');
  }

  async navigateToShiftPage(): Promise<void> {
    await this.goto('/pos/shift');
    await this.shiftPage.waitFor({ state: 'visible', timeout: 30000 });
  }

  async getHistoryItemCount(): Promise<number> {
    return await this.page.locator('[data-testid^="shift-history-item-"]').count();
  }

  async clickFirstClosedShiftZReport(): Promise<void> {
    const zReportLinks = this.page.locator('[data-testid^="shift-z-report-link-"]');
    await zReportLinks.first().click();
  }

  async refresh(): Promise<void> {
    await this.refreshBtn.click();
    await this.page.waitForTimeout(1000);
  }
}
