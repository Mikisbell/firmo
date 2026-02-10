/**
 * Admin Products Page Object Model
 * 
 * Encapsulates all interactions with the admin products page
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AdminProductsPage extends BasePage {
  // Selectors
  private readonly productRowSelector = '[data-testid="product-row"], table tbody tr, .product-row';
  private readonly productNameSelector = '[data-testid="product-name"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to products page
   */
  async navigate(): Promise<void> {
    await this.goto('/admin/productos');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for products to load
   */
  async waitForProductsLoad(): Promise<void> {
    await this.waitForElement(this.productRowSelector, 5000).catch(() => {
      console.log('⚠️ No product rows found - data may not be provisioned');
    });
  }

  /**
   * Get all product names
   */
  async getProductNames(): Promise<string[]> {
    await this.waitForProductsLoad();
    return await this.getTextContents(this.productNameSelector);
  }

  /**
   * Get product count
   */
  async getProductCount(): Promise<number> {
    await this.waitForProductsLoad();
    const locator = this.page.locator(this.productRowSelector);
    return await locator.count();
  }

  /**
   * Check if products exist
   */
  async hasProducts(): Promise<boolean> {
    const count = await this.getProductCount();
    return count > 0;
  }

  /**
   * Verify product names do not contain specific names
   */
  async verifyProductNamesDoNotContain(names: string[]): Promise<void> {
    const productNames = await this.getProductNames();
    
    for (const name of names) {
      if (productNames.includes(name)) {
        throw new Error(`Product name "${name}" should not be visible but was found`);
      }
    }
  }
}
