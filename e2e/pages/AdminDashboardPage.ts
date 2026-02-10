/**
 * Admin Dashboard Page Object Model
 * 
 * Encapsulates all interactions with the admin dashboard page
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AdminDashboardPage extends BasePage {
  // Selectors
  private readonly totalRevenueSelector = '[data-testid="total-revenue"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard page
   */
  async navigate(): Promise<void> {
    await this.goto('/admin/dashboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for analytics data to load
   */
  async waitForAnalyticsLoad(): Promise<void> {
    await this.waitForDataLoad(this.totalRevenueSelector, 15000);
  }

  /**
   * Get total revenue value
   */
  async getTotalRevenue(): Promise<string> {
    await this.waitForAnalyticsLoad();
    const locator = this.page.locator(this.totalRevenueSelector);
    const text = await locator.textContent();
    return text?.trim() || '';
  }

  /**
   * Verify revenue is loaded (not placeholder)
   */
  async verifyRevenueLoaded(): Promise<void> {
    const revenue = await this.getTotalRevenue();
    
    if (revenue === '...' || revenue === '' || revenue === 'Loading...') {
      throw new Error('Revenue data did not load - still showing placeholder');
    }
  }

  /**
   * Verify revenue is different from another value
   */
  async verifyRevenueDifferentFrom(otherRevenue: string): Promise<void> {
    const revenue = await this.getTotalRevenue();
    
    if (revenue === otherRevenue) {
      throw new Error(`Revenue should be different but both are: ${revenue}`);
    }
  }
}
