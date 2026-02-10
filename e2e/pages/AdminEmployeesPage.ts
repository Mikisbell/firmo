/**
 * Admin Employees Page Object Model
 * 
 * Encapsulates all interactions with the admin employees page
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AdminEmployeesPage extends BasePage {
  // Selectors
  private readonly employeeRowSelector = 'table tbody tr:not(:has-text("Cargando..."))';
  private readonly employeeNameSelector = '[data-testid="employee-name"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to employees page
   */
  async navigate(): Promise<void> {
    await this.goto('/admin/empleados');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for employees to load
   */
  async waitForEmployeesLoad(): Promise<void> {
    // Wait for table to appear
    await this.waitForElement('table', 10000).catch(() => {
      console.log('⚠️ Table not found');
    });
    
    // Wait for loading state to disappear and data to appear
    await this.page.waitForFunction(() => {
      const table = document.querySelector('table tbody');
      if (!table) return false;
      
      // Check if loading cell exists
      const loadingCell = table.querySelector('td');
      const loadingText = loadingCell?.textContent || '';
      
      if (loadingText.includes('Cargando')) {
        return false;
      }
      
      // Check if there are actual data rows
      const allRows = table.querySelectorAll('tr');
      return allRows.length > 0 && !loadingText.includes('Cargando');
    }, { timeout: 15000 }).catch(() => {
      console.log('⚠️ Data did not load within 15 seconds');
      return false;
    });
  }

  /**
   * Get all employee names
   */
  async getEmployeeNames(): Promise<string[]> {
    await this.waitForEmployeesLoad();
    const names = await this.getTextContents(this.employeeNameSelector);
    // Remove duplicates (in case selector captures multiple elements per row)
    return [...new Set(names)];
  }

  /**
   * Get employee count
   */
  async getEmployeeCount(): Promise<number> {
    await this.waitForEmployeesLoad();
    const locator = this.page.locator(this.employeeRowSelector);
    return await locator.count();
  }

  /**
   * Check if employees exist
   */
  async hasEmployees(): Promise<boolean> {
    const count = await this.getEmployeeCount();
    return count > 0;
  }

  /**
   * Verify employee names do not contain specific names
   */
  async verifyEmployeeNamesDoNotContain(names: string[]): Promise<void> {
    const employeeNames = await this.getEmployeeNames();
    
    for (const name of names) {
      if (employeeNames.includes(name)) {
        throw new Error(`Employee name "${name}" should not be visible but was found`);
      }
    }
  }
}
