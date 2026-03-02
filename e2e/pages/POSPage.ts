/**
 * Page Object for POS main page (/pos)
 * Handles shift open/close via ShiftModal and shift status verification.
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class POSPage extends BasePage {
  // Shift Status
  readonly shiftStatus: Locator;
  readonly shiftOpenCloseBtn: Locator;
  readonly shiftMovementsBtn: Locator;
  readonly shiftStatusLabel: Locator;
  readonly shiftCashDisplay: Locator;

  // Shift Modal
  readonly shiftModal: Locator;
  readonly shiftModalTitle: Locator;
  readonly shiftAmountInput: Locator;
  readonly shiftNotesTextarea: Locator;
  readonly shiftSubmitBtn: Locator;
  readonly shiftCancelBtn: Locator;
  readonly shiftExpectedValue: Locator;
  readonly shiftDiffValue: Locator;
  readonly shiftDenomToggle: Locator;
  readonly shiftDirectToggle: Locator;

  // POS page
  readonly posPage: Locator;
  readonly syncStatus: Locator;
  readonly onlineStatus: Locator;

  constructor(page: Page) {
    super(page);
    this.shiftStatus = page.locator('[data-testid="shift-status"]');
    this.shiftOpenCloseBtn = page.locator('[data-testid="shift-open-close-btn"]');
    this.shiftMovementsBtn = page.locator('[data-testid="shift-movements-btn"]');
    this.shiftStatusLabel = page.locator('[data-testid="shift-status-label"]');
    this.shiftCashDisplay = page.locator('[data-testid="shift-cash-display"]');

    this.shiftModal = page.locator('[data-testid="shift-modal"]');
    this.shiftModalTitle = page.locator('[data-testid="shift-modal-title"]');
    this.shiftAmountInput = page.locator('[data-testid="shift-amount-input"]');
    this.shiftNotesTextarea = page.locator('[data-testid="shift-notes-textarea"]');
    this.shiftSubmitBtn = page.locator('[data-testid="shift-submit-btn"]');
    this.shiftCancelBtn = page.locator('[data-testid="shift-cancel-btn"]');
    this.shiftExpectedValue = page.locator('[data-testid="shift-expected-value"]');
    this.shiftDiffValue = page.locator('[data-testid="shift-diff-value"]');
    this.shiftDenomToggle = page.locator('[data-testid="shift-denom-toggle"]');
    this.shiftDirectToggle = page.locator('[data-testid="shift-direct-toggle"]');

    this.posPage = page.locator('[data-testid="pos-page"]');
    this.syncStatus = page.locator('[data-testid="pos-sync-status"]');
    this.onlineStatus = page.locator('[data-testid="pos-online-status"]');
  }

  async navigateToPOS(): Promise<void> {
    await this.goto('/pos');
    await this.posPage.waitFor({ state: 'visible', timeout: 30000 });
  }

  async openShift(amountSoles: number): Promise<void> {
    await this.shiftOpenCloseBtn.click();
    await this.shiftModal.waitFor({ state: 'visible', timeout: 5000 });
    await expect(this.shiftModalTitle).toContainText('Abrir Turno');
    await this.shiftAmountInput.fill(amountSoles.toFixed(2));
    await this.shiftSubmitBtn.click();
    await this.shiftModal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async closeShift(amountSoles: number, notes?: string): Promise<void> {
    await this.shiftOpenCloseBtn.click();
    await this.shiftModal.waitFor({ state: 'visible', timeout: 5000 });
    await expect(this.shiftModalTitle).toContainText('Cerrar Turno');
    await this.shiftAmountInput.fill(amountSoles.toFixed(2));
    if (notes) {
      await this.shiftNotesTextarea.fill(notes);
    }
    await this.shiftSubmitBtn.click();
    await this.shiftModal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async assertShiftOpen(): Promise<void> {
    await expect(this.shiftStatusLabel).toBeVisible();
  }

  async assertShiftClosed(): Promise<void> {
    await expect(this.shiftStatus).toContainText('TURNO CERRADO');
  }
}
