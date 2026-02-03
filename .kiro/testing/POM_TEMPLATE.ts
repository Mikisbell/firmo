/**
 * Page Object Model Template for PARK POS E2E Tests
 * 
 * This template provides a standardized structure for creating Page Objects
 * that abstract UI interactions and make tests more maintainable and readable.
 * 
 * Benefits:
 * - Centralized selectors (easy to update when UI changes)
 * - Reusable methods (DRY principle)
 * - Better error messages (context-aware)
 * - Easier to debug (clear method names)
 * - AI-friendly (explicit intent)
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object
 * Provides common functionality for all page objects
 */
export class BasePage {
  readonly page: Page;
  readonly baseUrl: string = 'http://localhost:3000';

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific path
   * @param path - Path relative to baseUrl
   */
  async goto(path: string) {
    await this.page.goto(`${this.baseUrl}${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element with context-aware error message
   * @param selector - CSS selector
   * @param context - Description of what we're waiting for
   */
  async waitForElement(selector: string, context: string) {
    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
    } catch (error) {
      throw new Error(
        `Failed to find element for: ${context}\n` +
        `Selector: ${selector}\n` +
        `URL: ${this.page.url()}\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Click element with context-aware error message
   * Prioritizes accessibility (getByRole) over data-testid
   * @param selector - CSS selector or role-based selector
   * @param context - Description of what we're clicking
   */
  async click(selector: string, context: string) {
    try {
      await this.waitForElement(selector, context);
      
      // Try to click and validate it's actually clickable (not just DOM-visible)
      const element = await this.page.locator(selector).first();
      
      // Check if element is actually visible and enabled
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();
      
      if (!isVisible) {
        throw new Error(`Element is not visible (may be hidden by z-index or overlay)`);
      }
      
      if (!isEnabled) {
        throw new Error(`Element is not enabled (disabled or aria-disabled)`);
      }
      
      await element.click();
    } catch (error) {
      throw new Error(
        `Failed to click: ${context}\n` +
        `Selector: ${selector}\n` +
        `Visibility check: Ensure no overlays block the element\n` +
        `Accessibility check: Ensure element is not disabled\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Fill input field with context-aware error message
   * @param selector - CSS selector
   * @param value - Value to fill
   * @param context - Description of what we're filling
   */
  async fill(selector: string, value: string, context: string) {
    try {
      await this.waitForElement(selector, context);
      await this.page.fill(selector, value);
    } catch (error) {
      throw new Error(
        `Failed to fill: ${context}\n` +
        `Selector: ${selector}\n` +
        `Value: ${value}\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Get text content with context-aware error message
   * @param selector - CSS selector
   * @param context - Description of what we're getting
   */
  async getText(selector: string, context: string): Promise<string> {
    try {
      await this.waitForElement(selector, context);
      return await this.page.textContent(selector) || '';
    } catch (error) {
      throw new Error(
        `Failed to get text: ${context}\n` +
        `Selector: ${selector}\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Click button by accessible role (PREFERRED METHOD)
   * Validates both DOM and accessibility tree
   * @param name - Button text or aria-label
   * @param context - Description of what we're clicking
   */
  async clickButton(name: string, context: string) {
    try {
      const button = this.page.getByRole('button', { name });
      
      // Validate accessibility
      const isVisible = await button.isVisible();
      const isEnabled = await button.isEnabled();
      
      if (!isVisible) {
        throw new Error(`Button not visible (may be hidden by overlay or z-index)`);
      }
      
      if (!isEnabled) {
        throw new Error(`Button is disabled (aria-disabled or disabled attribute)`);
      }
      
      await button.click();
    } catch (error) {
      throw new Error(
        `Failed to click button: ${context}\n` +
        `Button name: ${name}\n` +
        `Accessibility check: Ensure button is in accessibility tree\n` +
        `Visibility check: Ensure no overlays block the button\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Fill input by accessible label (PREFERRED METHOD)
   * Validates both DOM and accessibility tree
   * @param label - Label text or aria-label
   * @param value - Value to fill
   * @param context - Description of what we're filling
   */
  async fillByLabel(label: string, value: string, context: string) {
    try {
      const input = this.page.getByLabel(label);
      
      // Validate accessibility
      const isVisible = await input.isVisible();
      const isEnabled = await input.isEnabled();
      
      if (!isVisible) {
        throw new Error(`Input not visible (may be hidden by overlay or z-index)`);
      }
      
      if (!isEnabled) {
        throw new Error(`Input is disabled (aria-disabled or disabled attribute)`);
      }
      
      await input.fill(value);
    } catch (error) {
      throw new Error(
        `Failed to fill input: ${context}\n` +
        `Label: ${label}\n` +
        `Value: ${value}\n` +
        `Accessibility check: Ensure input has associated label\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Select option by accessible role (PREFERRED METHOD)
   * @param label - Label text or aria-label
   * @param optionName - Option text
   * @param context - Description of what we're selecting
   */
  async selectByLabel(label: string, optionName: string, context: string) {
    try {
      const select = this.page.getByLabel(label);
      await select.selectOption(optionName);
    } catch (error) {
      throw new Error(
        `Failed to select option: ${context}\n` +
        `Label: ${label}\n` +
        `Option: ${optionName}\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Assert element is hidden
   * @param selector - CSS selector
   * @param context - Description of what we're checking
   */
  async assertHidden(selector: string, context: string) {
    try {
      await expect(this.page.locator(selector)).toBeHidden();
    } catch (error) {
      throw new Error(
        `Element is visible but should be hidden: ${context}\n` +
        `Selector: ${selector}\n` +
        `Original error: ${error}`
      );
    }
  }

  /**
   * Assert text content matches
   * @param selector - CSS selector
   * @param expectedText - Expected text
   * @param context - Description of what we're checking
   */
  async assertText(selector: string, expectedText: string, context: string) {
    try {
      await expect(this.page.locator(selector)).toContainText(expectedText);
    } catch (error) {
      throw new Error(
        `Text mismatch: ${context}\n` +
        `Selector: ${selector}\n` +
        `Expected: ${expectedText}\n` +
        `Original error: ${error}`
      );
    }
  }
}

/**
 * Example: Admin Panel Page Object
 * 
 * IMPORTANTE: Este ejemplo demuestra la jerarquía de selectores:
 * 1. getByRole() - Accesibilidad primero (PREFERIDO)
 * 2. getByLabel() - Inputs con labels
 * 3. data-testid - Fallback para elementos complejos
 * 4. CSS selectors - Último recurso (EVITAR)
 * 
 * Esta jerarquía asegura que:
 * - Tests validan accesibilidad real
 * - Tests detectan overlays y z-index issues
 * - Tests son resilientes a cambios de Tailwind
 */
export class AdminPanelPage extends BasePage {
  // Selectores - Jerarquía de Accesibilidad
  private readonly selectors = {
    // ✅ PREFERIDO: Accesibilidad
    createEmployeeBtn: { role: 'button', name: /crear empleado/i },
    saveBtn: { role: 'button', name: /guardar/i },
    deleteBtn: { role: 'button', name: /eliminar|desactivar/i },
    
    // ✅ ALTERNATIVA: data-testid para elementos complejos
    employeeTable: '[data-testid="employee-table"]',
    productTable: '[data-testid="product-table"]',
    promotionTable: '[data-testid="promotion-table"]',
    
    // ❌ EVITAR: Clases CSS (frágiles)
    // saveBtn: '.bg-amber-500.hover\\:bg-amber-600',
  };

  /**
   * Navigate to admin panel
   */
  async goto() {
    await super.goto('/admin');
  }

  /**
   * Navigate to employees section
   */
  async goToEmployees() {
    await this.click(this.selectors.employeesLink, 'Employees link in sidebar');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to products section
   */
  async goToProducts() {
    await this.click(this.selectors.productsLink, 'Products link in sidebar');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to promotions section
   */
  async goToPromotions() {
    await this.click(this.selectors.promotionsLink, 'Promotions link in sidebar');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to drivers section
   */
  async goToDrivers() {
    await this.click(this.selectors.driversLink, 'Drivers link in sidebar');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new employee
   * @param data - Employee data
   */
  async createEmployee(data: {
    name: string;
    role: string;
    pin: string;
  }) {
    await this.goToEmployees();
    await this.click(this.selectors.createEmployeeBtn, 'Create Employee button');
    
    await this.fill(this.selectors.employeeNameInput, data.name, 'Employee name input');
    await this.page.selectOption(this.selectors.employeeRoleSelect, data.role);
    await this.fill(this.selectors.employeePinInput, data.pin, 'Employee PIN input');
    
    await this.click(this.selectors.saveEmployeeBtn, 'Save Employee button');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new product
   * @param data - Product data
   */
  async createProduct(data: {
    sku: string;
    name: string;
    price_cents: number;
    category: string;
    station: string;
  }) {
    await this.goToProducts();
    await this.click(this.selectors.createProductBtn, 'Create Product button');
    
    await this.fill(this.selectors.productSkuInput, data.sku, 'Product SKU input');
    await this.fill(this.selectors.productNameInput, data.name, 'Product name input');
    await this.fill(
      this.selectors.productPriceInput,
      (data.price_cents / 100).toString(),
      'Product price input'
    );
    await this.page.selectOption(this.selectors.productCategorySelect, data.category);
    await this.page.selectOption(this.selectors.productStationSelect, data.station);
    
    await this.click(this.selectors.saveProductBtn, 'Save Product button');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new promotion
   * @param data - Promotion data
   */
  async createPromotion(data: {
    name: string;
    type: string;
    value: number;
    starts_at: string;
    ends_at: string;
  }) {
    await this.goToPromotions();
    await this.click(this.selectors.createPromotionBtn, 'Create Promotion button');
    
    await this.fill(this.selectors.promotionNameInput, data.name, 'Promotion name input');
    await this.page.selectOption(this.selectors.promotionTypeSelect, data.type);
    await this.fill(
      this.selectors.promotionValueInput,
      data.value.toString(),
      'Promotion value input'
    );
    await this.fill(
      this.selectors.promotionStartsAtInput,
      data.starts_at,
      'Promotion starts at input'
    );
    await this.fill(
      this.selectors.promotionEndsAtInput,
      data.ends_at,
      'Promotion ends at input'
    );
    
    await this.click(this.selectors.savePromotionBtn, 'Save Promotion button');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert employee is in table
   * @param name - Employee name
   */
  async assertEmployeeInTable(name: string) {
    await this.assertVisible(
      `${this.selectors.employeeTable} >> text=${name}`,
      `Employee "${name}" in table`
    );
  }

  /**
   * Assert product is in table
   * @param sku - Product SKU
   */
  async assertProductInTable(sku: string) {
    await this.assertVisible(
      `${this.selectors.productTable} >> text=${sku}`,
      `Product "${sku}" in table`
    );
  }

  /**
   * Assert promotion is in table
   * @param name - Promotion name
   */
  async assertPromotionInTable(name: string) {
    await this.assertVisible(
      `${this.selectors.promotionTable} >> text=${name}`,
      `Promotion "${name}" in table`
    );
  }
}

/**
 * Example: Login Page Object
 * 
 * Demonstrates how to structure a page object for authentication.
 */
export class LoginPage extends BasePage {
  private readonly selectors = {
    pinPad: '[data-testid="pin-pad"]',
    pinButton: (digit: string) => `button:has-text("${digit}")`,
    submitBtn: '[data-testid="submit-pin-btn"]',
    errorMessage: '[data-testid="error-message"]',
  };

  /**
   * Navigate to login page
   */
  async goto() {
    await super.goto('/');
  }

  /**
   * Enter PIN and submit
   * @param pin - PIN to enter
   */
  async loginWithPin(pin: string) {
    await this.waitForElement(this.selectors.pinPad, 'PIN pad');
    
    for (const digit of pin) {
      await this.click(
        this.selectors.pinButton(digit),
        `PIN digit ${digit}`
      );
    }
    
    await this.click(this.selectors.submitBtn, 'Submit PIN button');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert login error is shown
   * @param expectedError - Expected error message
   */
  async assertLoginError(expectedError: string) {
    await this.assertText(
      this.selectors.errorMessage,
      expectedError,
      'Login error message'
    );
  }
}

/**
 * Usage Example in Tests:
 * 
 * ```typescript
 * import { test, expect } from '@playwright/test';
 * import { AdminPanelPage, LoginPage } from './POM_TEMPLATE';
 * 
 * test('should create employee', async ({ page }) => {
 *   const loginPage = new LoginPage(page);
 *   const adminPage = new AdminPanelPage(page);
 *   
 *   // Login
 *   await loginPage.goto();
 *   await loginPage.loginWithPin('1234');
 *   
 *   // Create employee
 *   await adminPage.goto();
 *   await adminPage.createEmployee({
 *     name: 'John Doe',
 *     role: 'WAITER',
 *     pin: '5678',
 *   });
 *   
 *   // Assert
 *   await adminPage.assertEmployeeInTable('John Doe');
 * });
 * ```
 */
