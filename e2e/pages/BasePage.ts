/**
 * Base Page Object Model
 * 
 * Provides common functionality for all page objects including:
 * - Navigation helpers
 * - Wait strategies
 * - Common assertions
 * - Selector utilities
 */

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page, baseURL: string = 'http://localhost:3000') {
    this.page = page;
    this.baseURL = baseURL;
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(`${this.baseURL}${path}`, {
      waitUntil: 'domcontentloaded',
    });
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, timeout: number = 5000): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * Wait for data to load (element text is not empty or placeholder)
   */
  async waitForDataLoad(selector: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        const text = element.textContent?.trim() || '';
        return text !== '' && text !== '...' && text !== 'Loading...';
      },
      selector,
      { timeout }
    ).catch(() => {
      console.log(`⚠️ Data did not load for selector: ${selector}`);
    });
  }

  /**
   * Get text content from multiple elements
   */
  async getTextContents(selector: string): Promise<string[]> {
    const locator = this.page.locator(selector);
    const count = await locator.count();
    
    if (count === 0) {
      return [];
    }
    
    return await locator.allTextContents();
  }

  /**
   * Get input value
   */
  async getInputValue(selector: string): Promise<string> {
    const locator = this.page.locator(selector);
    return await locator.inputValue();
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const locator = this.page.locator(selector);
    const count = await locator.count();
    return count > 0;
  }

  /**
   * Assert element is visible
   */
  async assertVisible(selector: string): Promise<void> {
    const locator = this.page.locator(selector);
    await expect(locator).toBeVisible();
  }

  /**
   * Assert text content
   */
  async assertTextContent(selector: string, expectedText: string): Promise<void> {
    const locator = this.page.locator(selector);
    await expect(locator).toHaveText(expectedText);
  }

  /**
   * Assert element count
   */
  async assertElementCount(selector: string, expectedCount: number): Promise<void> {
    const locator = this.page.locator(selector);
    await expect(locator).toHaveCount(expectedCount);
  }
}
