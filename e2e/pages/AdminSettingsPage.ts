/**
 * Admin Settings Page Object Model
 * 
 * Encapsulates all interactions with the admin settings page
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AdminSettingsPage extends BasePage {
  // Selectors
  private readonly tenantNameSelector = '[data-testid="tenant-name"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to settings page
   */
  async navigate(): Promise<void> {
    await this.goto('/admin/configuracion');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for tenant name to load
   */
  async waitForTenantNameLoad(): Promise<void> {
    await this.page.waitForFunction(
      (selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input && input.value && input.value.trim() !== '';
      },
      this.tenantNameSelector,
      { timeout: 10000 }
    ).catch(() => {
      console.log('⚠️ Tenant name field is empty - data may not be provisioned');
    });
  }

  /**
   * Get tenant name
   */
  async getTenantName(): Promise<string> {
    await this.waitForTenantNameLoad();
    return await this.getInputValue(this.tenantNameSelector);
  }

  /**
   * Verify tenant name is loaded (not empty)
   */
  async verifyTenantNameLoaded(): Promise<void> {
    const name = await this.getTenantName();
    
    if (name === '') {
      throw new Error('Tenant name is empty - data may not be provisioned');
    }
  }

  /**
   * Verify tenant name is different from another value
   */
  async verifyTenantNameDifferentFrom(otherName: string): Promise<void> {
    const name = await this.getTenantName();
    
    if (name === otherName) {
      throw new Error(`Tenant name should be different but both are: ${name}`);
    }
    
    if (name === '') {
      throw new Error('Tenant name is empty');
    }
  }
}
