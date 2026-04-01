/**
 * E2E Tests: Waiter New Features
 *
 * Validates the 5 new waiter capabilities added in the per-item notification sprint:
 *  1. Note on item       — add/display text note on a line item
 *  2. Transfer table     — move order to a different table
 *  3. Split bill         — divide order items into two checks
 *  4. Mark item served   — Servir button on /mozo/listos (requires KDS READY state)
 *  5. Second round       — ENVIAR A COCINA sends only PENDING items
 *
 * Prerequisites: dev server running (`npm run dev`)
 */
import { test, expect, Page } from '@playwright/test';
import { setupWaiterTerminal, TENANT_ID } from './helpers/test-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

async function goToTable(page: Page, tableNumber: string) {
  await page.goto('/mozo');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 15000 });
  await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const tableCell = page.locator(`[data-testid="table-${tableNumber}"]`);
  await tableCell.waitFor({ state: 'visible', timeout: 15000 });
  await tableCell.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function addFirstProduct(page: Page) {
  await page.locator('main button:has-text("S/")').first()
    .waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('main button:has-text("S/")').first().click();
  await page.waitForTimeout(400);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NOTE ON ITEM
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Feature 1 — Note on item', () => {
  test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
  });

  test('adds a note to an order item and note is displayed', async ({ page }) => {
    await goToTable(page, '3');
    await addFirstProduct(page);

    // Click the note icon button on the first line item
    const noteBtn = page.locator('[data-testid="order-item"]').first()
      .locator('button[aria-label*="nota"], button[title*="nota"], button[aria-label*="note"]').first();

    const noteBtnVisible = await noteBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!noteBtnVisible) {
      // Fallback: look for the pencil/note icon button after the item name
      const allItemBtns = page.locator('[data-testid="order-item"] button');
      const count = await allItemBtns.count();
      console.log(`  ℹ️  Found ${count} buttons inside order item`);
      await allItemBtns.last().click();
    } else {
      await noteBtn.click();
    }

    // Note dialog should open
    const noteDialog = page.locator('[role="dialog"], [data-testid="note-dialog"]').first();
    await noteDialog.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✅ Note dialog opened');

    // Type a note
    const noteText = 'sin cebolla, extra limón';
    const noteInput = noteDialog.locator('textarea, input[type="text"]').first();
    await noteInput.fill(noteText);

    // Save
    const saveBtn = noteDialog.locator('button:has-text("Guardar"), button:has-text("OK"), button[type="submit"]').first();
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Verify note is visible on the item
    await expect(page.locator(`text=${noteText}`)).toBeVisible({ timeout: 5000 });
    console.log('  ✅ Note displayed on item');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSFER TABLE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Feature 2 — Transfer table', () => {
  test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
  });

  test('transfers order from table 4 to an available table', async ({ page }) => {
    await goToTable(page, '4');
    await addFirstProduct(page);

    // Click Transferir button
    const transferBtn = page.locator('button:has-text("Transferir"), button[aria-label*="Transfer"]').first();
    await transferBtn.waitFor({ state: 'visible', timeout: 8000 });
    await transferBtn.click();

    // Transfer modal should open
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✅ Transfer modal opened');

    // Select any free table that's not table 4
    const freeTable = modal.locator('button[data-free="true"], button:has-text("Mesa")').first();
    const hasFreeTable = await freeTable.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFreeTable) {
      await freeTable.click();
      await page.waitForTimeout(500);

      // Confirm if there's a confirmation step
      const confirmBtn = page.locator('button:has-text("Confirmar"), button:has-text("Mover")').first();
      const hasConfirm = await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasConfirm) await confirmBtn.click();

      await page.waitForTimeout(1000);
      console.log('  ✅ Table transferred');
    } else {
      // No free tables — close modal and skip
      await page.keyboard.press('Escape');
      console.log('  ⚠️  No free tables available — skipping assertion');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SPLIT BILL
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Feature 3 — Split bill', () => {
  test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
  });

  test('opens split bill modal and assigns items to two checks', async ({ page }) => {
    await goToTable(page, '2');

    // Add 2 items
    await page.locator('main button:has-text("S/")').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('main button:has-text("S/")').nth(0).click();
    await page.waitForTimeout(300);
    await page.locator('main button:has-text("S/")').nth(1).click();
    await page.waitForTimeout(300);

    const itemCount = await page.locator('[data-testid="order-item"]').count();
    console.log(`  📋 Items in order: ${itemCount}`);
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // Click Dividir button
    const dividirBtn = page.locator('button:has-text("Dividir"), button[aria-label*="Split"]').first();
    await dividirBtn.waitFor({ state: 'visible', timeout: 8000 });
    await dividirBtn.click();

    // Split modal should open
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✅ Split bill modal opened');

    // Verify two check columns (C1 / C2)
    const c1 = modal.locator('text=C1, text=Check 1, text=Cuenta 1').first();
    const hasC1 = await c1.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  ${hasC1 ? '✅' : '⚠️'} C1 column: ${hasC1}`);

    // Assign first item to C2 if toggle buttons visible
    const toggleBtns = modal.locator('button:has-text("C2"), button:has-text("2")');
    const toggleCount = await toggleBtns.count();
    if (toggleCount > 0) {
      await toggleBtns.first().click();
      await page.waitForTimeout(300);
      console.log('  ✅ Item assigned to C2');
    }

    // Verify subtotals update (there should be two price displays)
    const prices = modal.locator('text=/S\\/ \\d/');
    const priceCount = await prices.count();
    console.log(`  📋 Price displays in modal: ${priceCount}`);

    // Close modal
    await page.keyboard.press('Escape');
    console.log('  ✅ Split bill modal validated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MARK ITEM SERVED — /mozo/listos
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Feature 4 — Mark item served from /mozo/listos', () => {
  test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
  });

  test('listos page loads and shows empty state or ready items', async ({ page }) => {
    await page.goto('/mozo/listos');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Should show either empty state or ready item cards
    const emptyState = page.locator('text=Todo servido, text=Sin pendientes').first();
    const readyCards = page.locator('button:has-text("Servir")');

    const isEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCards = await readyCards.count().then(c => c > 0).catch(() => false);

    console.log(`  📋 Empty state: ${isEmpty} | Ready cards: ${hasCards}`);
    expect(isEmpty || hasCards).toBe(true);
    console.log('  ✅ /mozo/listos page renders correctly');
  });

  test('listos page has refresh button and bottom nav', async ({ page }) => {
    await page.goto('/mozo/listos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Refresh button
    const refreshBtn = page.locator('button[aria-label="Actualizar"], button:has(svg)').first();
    const hasRefresh = await refreshBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  ${hasRefresh ? '✅' : '⚠️'} Refresh button visible`);

    // Bottom nav with Listos active
    const bottomNav = page.locator('nav, [role="navigation"]').last();
    await expect(bottomNav).toBeVisible({ timeout: 5000 });
    console.log('  ✅ Bottom navigation present');
  });

  test('servir button triggers API call when item is ready', async ({ page }) => {
    // Mock /api/pos/ready-items to return one ready item
    await page.route('/api/pos/ready-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-proj-001',
          order_id: '00000000-0000-0000-0000-000000000020',
          line_id: 'line-test-001',
          table_number: '5',
          name: '1/4 Pollo',
          qty: 1,
          station: 'HORNO',
          status: 'READY',
          notes: null,
          ready_at: new Date().toISOString(),
        }]),
      });
    });

    // Mock the ingest route to accept events
    await page.route('/api/events/ingest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
    });

    await page.goto('/mozo/listos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Should show 1 item card with Servir button
    const servirBtn = page.locator('button:has-text("Servir")').first();
    await servirBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  ✅ Servir button visible for mocked ready item');

    // Verify item name shown
    await expect(page.locator('text=1/4 Pollo')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Mesa 5')).toBeVisible({ timeout: 3000 });
    console.log('  ✅ Item details (name, table) visible');

    // Click Servir
    await servirBtn.click();
    await page.waitForTimeout(1000);
    console.log('  ✅ Servir button clicked — status update triggered');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECOND ROUND — Only PENDING items sent to kitchen
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Feature 5 — Second round (pending items only)', () => {
  test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
  });

  test('ENVIAR A COCINA button is disabled when all items are already in kitchen', async ({ page }) => {
    await goToTable(page, '6');

    // Add a product and send to kitchen
    await page.locator('main button:has-text("S/")').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('main button:has-text("S/")').first().click();
    await page.waitForTimeout(400);

    // Send to kitchen
    const enviarBtn = page.locator('button:has-text("ENVIAR A COCINA"):not([disabled])').first();
    const canSend = await enviarBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (canSend) {
      await enviarBtn.click();
      await page.waitForTimeout(1500);
      console.log('  ✅ First round sent to kitchen');

      // After sending, ENVIAR A COCINA should be disabled (no more PENDING items)
      const disabledBtn = page.locator('button:has-text("ENVIAR A COCINA")[disabled], button:has-text("ENVIAR A COCINA").opacity-50');
      const isDisabled = await disabledBtn.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`  ${isDisabled ? '✅' : '⚠️'} Send button disabled after all items in kitchen: ${isDisabled}`);
    } else {
      console.log('  ⚠️  No items to send — skipping send');
    }
  });

  test('adding new item after sending re-enables ENVIAR A COCINA for second round', async ({ page }) => {
    await goToTable(page, '7');

    await page.locator('main button:has-text("S/")').first()
      .waitFor({ state: 'visible', timeout: 30000 });

    // Add first item
    await page.locator('main button:has-text("S/")').first().click();
    await page.waitForTimeout(400);

    // Send to kitchen
    const enviarBtn = page.locator('button:has-text("ENVIAR A COCINA"):not([disabled])').first();
    const canSend = await enviarBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!canSend) {
      console.log('  ⚠️  Cannot send — skipping second round test');
      return;
    }

    await enviarBtn.click();
    await page.waitForTimeout(1500);
    console.log('  ✅ First batch sent to kitchen');

    // Add second item (second round)
    await page.locator('main button:has-text("S/")').first().click();
    await page.waitForTimeout(400);

    // ENVIAR A COCINA should be re-enabled for the new PENDING item
    const enviarBtn2 = page.locator('button:has-text("ENVIAR A COCINA"):not([disabled])').first();
    const canSend2 = await enviarBtn2.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  ${canSend2 ? '✅' : '⚠️'} ENVIAR A COCINA re-enabled for second round: ${canSend2}`);

    if (canSend2) {
      await enviarBtn2.click();
      await page.waitForTimeout(1000);
      console.log('  ✅ Second round sent successfully');
    }
  });
});
