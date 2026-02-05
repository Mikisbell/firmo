import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for Cashier (Caja) Module
 * 
 * Centralizes all UI interactions for payment terminal testing.
 * Provides high-level methods that abstract away selector details.
 */
export class CashierPOM {
  constructor(private page: Page) {}

  // ============ PAYMENT TERMINAL ============

  /**
   * Opens and waits for payment terminal modal to be visible
   * Now includes order selection step
   */
  async openPaymentTerminal() {
    await this.page.waitForLoadState('networkidle');
    
    // Click on first pending order to open payment terminal
    const firstOrder = this.page.locator('[data-testid^="order-card-"]').first();
    await firstOrder.waitFor({ state: 'visible', timeout: 10000 });
    await firstOrder.click();
    
    // Wait for modal to appear
    await this.page.waitForSelector('[data-testid="payment-terminal-modal"]', {
      state: 'visible',
      timeout: 10000
    });
  }

  /**
   * Selects a payment method
   */
  async selectPaymentMethod(method: 'cash' | 'card' | 'yape' | 'plin') {
    await this.page.click(`[data-testid="payment-method-${method}"]`);
  }

  /**
   * Enters amount in payment input
   */
  async enterAmount(amount: number) {
    const input = this.page.locator('[data-testid="payment-amount-input"]');
    await input.fill(amount.toString());
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clicks a quick amount button
   */
  async clickQuickAmount(amount: number) {
    await this.page.click(`[data-testid="quick-amount-${amount}"]`);
  }

  /**
   * Clicks exact amount button (fills with order total)
   */
  async clickExactAmount() {
    await this.page.click('[data-testid="exact-amount-btn"]');
  }

  /**
   * Submits payment and waits for completion
   */
  async submitPayment() {
    const button = this.page.locator('[data-testid="payment-submit-btn"]');
    await expect(button).toBeEnabled();
    await button.click();
    
    // Wait for payment processing to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Asserts that change is displayed with expected amount
   */
  async assertChangeDisplayed(expectedChange: number) {
    const changeAmount = this.page.locator('[data-testid="change-amount"]');
    await expect(changeAmount).toContainText(`S/${expectedChange.toFixed(2)}`);
  }

  /**
   * Asserts that error message is displayed
   */
  async assertErrorMessage(expectedError: string) {
    const errorMsg = this.page.locator('[data-testid="payment-error-message"]');
    await expect(errorMsg).toContainText(expectedError);
  }

  /**
   * Clicks retry button and waits for retry attempt
   */
  async retryPayment() {
    const retryBtn = this.page.locator('[data-testid="payment-retry-btn"]');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Closes payment terminal modal
   */
  async closePaymentTerminal() {
    await this.page.click('[data-testid="payment-terminal-close-btn"]');
    await this.page.waitForSelector('[data-testid="payment-terminal-modal"]', { state: 'hidden' });
  }

  // ============ ASSERTIONS ============

  /**
   * Asserts payment terminal modal is visible
   */
  async assertPaymentTerminalVisible() {
    const modal = this.page.locator('[data-testid="payment-terminal-modal"]');
    await expect(modal).toBeVisible();
  }

  /**
   * Asserts order total is displayed correctly
   */
  async assertOrderTotal(expectedTotal: number) {
    const total = this.page.locator('[data-testid="order-total"]');
    await expect(total).toContainText(`S/${expectedTotal.toFixed(2)}`);
  }

  /**
   * Asserts payment method is selected (has amber border)
   */
  async assertPaymentMethodSelected(method: string) {
    const methodBtn = this.page.locator(`[data-testid="payment-method-${method}"]`);
    await expect(methodBtn).toHaveClass(/border-amber-500/);
  }

  /**
   * Asserts submit button is disabled
   */
  async assertSubmitButtonDisabled() {
    const button = this.page.locator('[data-testid="payment-submit-btn"]');
    await expect(button).toBeDisabled();
  }

  /**
   * Asserts submit button is enabled
   */
  async assertSubmitButtonEnabled() {
    const button = this.page.locator('[data-testid="payment-submit-btn"]');
    await expect(button).toBeEnabled();
  }

  /**
   * Asserts no error message is displayed
   */
  async assertNoError() {
    const errorMsg = this.page.locator('[data-testid="payment-error-message"]');
    await expect(errorMsg).not.toBeVisible();
  }

  /**
   * Asserts change display is not visible (exact amount)
   */
  async assertNoChange() {
    const changeDisplay = this.page.locator('[data-testid="change-display"]');
    await expect(changeDisplay).not.toBeVisible();
  }
}
