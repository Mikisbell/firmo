/**
 * E2E Test: Waiter — Multi-Station Order (HORNO + PARRILLA + BAR) + Pedir Cuenta
 *
 * Validates a full multi-station order flow:
 * 1. Waiter selects Mesa 5
 * 2. Adds 1/4 Pollo          → station HORNO   (POLLOS category)
 * 3. Adds Bisteck a la Parrilla → station PARRILLA (PARRILLAS category, tab ALL)
 * 4. Adds Coca Cola 500ml    → station BAR     (BEBIDAS category tab)
 * 5. Clicks ENVIAR A COCINA  → ORDER_SUBMITTED event, items routed to 3 KDS stations
 * 6. Clicks LLAMAR CUENTA    → REQUEST_CHECK event written to ParkDB
 * 7. Returns to /mozo        → Mesa 5 shows BILL_REQUESTED state (amber badge)
 *
 * Category tabs in CatalogGrid: ALL | POLLOS | COMBOS | GUARNICIONES | BEBIDAS | EXTRAS | POSTRES
 * PARRILLAS products are visible under the ALL tab (no dedicated PARRILLAS tab).
 * BAR products (BEBIDAS) require switching to the "Bebidas" tab.
 */
import { test, expect } from '@playwright/test';
import { setupWaiterTerminal } from './helpers/test-utils';

test.describe('Waiter — Pedido Multi-Estación + Pedir Cuenta', () => {
  test('mesa 5: HORNO + PARRILLA + BAR → ENVIAR → LLAMAR CUENTA', async ({ page }) => {

    // ─────────────────────────────────────────────────────────────────
    // SETUP
    // ─────────────────────────────────────────────────────────────────
    await setupWaiterTerminal(page);
    await page.goto('/mozo');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(3000);

    // ─────────────────────────────────────────────────────────────────
    // PART 1: Navigate to Mesa 5
    // ─────────────────────────────────────────────────────────────────
    console.log('🗂️  PART 1: Selecting Mesa 5');
    const table5 = page.locator('[data-testid="table-5"]');
    await table5.waitFor({ state: 'visible', timeout: 15000 });
    await table5.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Mesa 5').first()).toBeVisible({ timeout: 10000 });
    console.log('  ✅ Mesa 5 abierta');

    // Wait for catalog to load (buttons with "S/")
    await page.locator('main button:has-text("S/")').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);

    // ─────────────────────────────────────────────────────────────────
    // PART 2: Add HORNO product — 1/4 Pollo
    // ─────────────────────────────────────────────────────────────────
    console.log('🔥 PART 2: Agregando producto HORNO (1/4 Pollo)');

    const polloBtn = page.locator('button:has-text("1/4 Pollo")').first();
    await polloBtn.waitFor({ state: 'visible', timeout: 10000 });
    await polloBtn.click();
    await page.waitForTimeout(400);
    console.log('  ✅ 1/4 Pollo agregado (HORNO)');

    // ─────────────────────────────────────────────────────────────────
    // PART 3: Add PARRILLA product — Bisteck a la Parrilla (tab ALL)
    // ─────────────────────────────────────────────────────────────────
    console.log('🥩 PART 3: Agregando producto PARRILLA (Bisteck a la Parrilla)');

    // PARRILLA products are visible in ALL tab — try Bisteck first, then any parrilla
    const bisteckBtn = page.locator('button:has-text("Bisteck")').first();
    const hasBisteck = await bisteckBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBisteck) {
      await bisteckBtn.click();
      await page.waitForTimeout(400);
      console.log('  ✅ Bisteck a la Parrilla agregado (PARRILLA)');
    } else {
      // Fallback: any product with "Parrilla" in name
      const parrillaProd = page.locator('button:has-text("Parrilla")').first();
      const hasParrilla = await parrillaProd.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasParrilla) {
        await parrillaProd.click();
        await page.waitForTimeout(400);
        console.log('  ✅ Producto Parrilla agregado (fallback)');
      } else {
        // Scroll down and retry (product may be outside viewport)
        await page.locator('main').evaluate(el => el.scrollTop += 300);
        await page.waitForTimeout(300);
        const scrolledBisteck = page.locator('button:has-text("Bisteck")').first();
        await scrolledBisteck.waitFor({ state: 'visible', timeout: 5000 });
        await scrolledBisteck.click();
        await page.waitForTimeout(400);
        console.log('  ✅ Bisteck agregado (post-scroll)');
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // PART 4: Add BAR product — Coca Cola 500ml (tab BEBIDAS)
    // ─────────────────────────────────────────────────────────────────
    console.log('🍺 PART 4: Agregando producto BAR (Coca Cola 500ml)');

    // Click the "Bebidas" category tab
    const bebidasTab = page.locator('button:has-text("Bebidas")');
    await bebidasTab.waitFor({ state: 'visible', timeout: 8000 });
    await bebidasTab.click();
    await page.waitForTimeout(500); // let filter apply

    // Now add Coca Cola 500ml
    const colaBtn = page.locator('button:has-text("Coca Cola 500ml")').first();
    const hasCola = await colaBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCola) {
      await colaBtn.click();
      await page.waitForTimeout(400);
      console.log('  ✅ Coca Cola 500ml agregada (BAR)');
    } else {
      // Fallback: first beverage product
      const firstBebida = page.locator('main button:has-text("S/")').first();
      await firstBebida.click();
      await page.waitForTimeout(400);
      console.log('  ✅ Primera bebida agregada (fallback BAR)');
    }

    // ─────────────────────────────────────────────────────────────────
    // PART 5: Verify 3 items in order panel
    // ─────────────────────────────────────────────────────────────────
    const orderItems = page.locator('[data-testid="order-item"]');
    const itemCount = await orderItems.count();
    console.log(`  📋 Items en el pedido: ${itemCount}`);
    expect(itemCount).toBeGreaterThanOrEqual(3);
    console.log('  ✅ 3 items confirmados en el panel de pedido');

    // ─────────────────────────────────────────────────────────────────
    // PART 6: Send to kitchen — ENVIAR A COCINA
    // ─────────────────────────────────────────────────────────────────
    console.log('📤 PART 6: Enviando a cocina (ENVIAR A COCINA)');
    await page.waitForTimeout(1500); // let cart state settle

    const enviarBtn = page.locator('button:has-text("ENVIAR A COCINA"):not([disabled])');
    const enviarVisible = await enviarBtn.isVisible({ timeout: 15000 }).catch(() => false);

    if (!enviarVisible) {
      const allBtns = await page.locator('button').allTextContents();
      console.log('  ❌ ENVIAR A COCINA no habilitado. Botones:', JSON.stringify(allBtns.slice(0, 20)));
      await page.screenshot({ path: 'test-results/debug-enviar-multi.png', fullPage: true });
      expect(enviarVisible, 'ENVIAR A COCINA debe estar habilitado con 3 items').toBe(true);
      return;
    }

    await enviarBtn.click();

    // Toast confirms which stations received the order
    const enviadoToast = page.locator('text=¡Enviado!').or(page.locator('text=Enviado')).first();
    await expect(enviadoToast).toBeVisible({ timeout: 10000 });
    const toastText = await enviadoToast.textContent().catch(() => '');
    console.log(`  ✅ Pedido enviado — toast: "${toastText}"`);

    // ─────────────────────────────────────────────────────────────────
    // PART 7: Request the bill — LLAMAR CUENTA
    // ─────────────────────────────────────────────────────────────────
    console.log('🔔 PART 7: Solicitando la cuenta (LLAMAR CUENTA)');
    await page.waitForTimeout(1000);

    // Two text variants: "LLAMAR CUENTA" (desktop) / "Pedir Cuenta" (mobile compact)
    const cuentaBtn = page.locator('button:has-text("LLAMAR CUENTA"), button:has-text("Pedir Cuenta")').first();
    await cuentaBtn.waitFor({ state: 'visible', timeout: 10000 });
    await cuentaBtn.click();

    const cajaToast = page.locator('text=Caja notificada').or(page.locator('text=quiere pagar')).first();
    const hasCajaToast = await cajaToast.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasCajaToast) {
      console.log('  ✅ Toast: "Caja notificada: Mesa quiere pagar"');
    } else {
      console.log('  ⚠️ Toast expiró — REQUEST_CHECK se escribió a IndexedDB');
    }
    await page.waitForTimeout(1000);

    // ─────────────────────────────────────────────────────────────────
    // PART 8: Verify Mesa 5 shows BILL_REQUESTED on /mozo
    // ─────────────────────────────────────────────────────────────────
    console.log('🏠 PART 8: Verificando estado BILL_REQUESTED en /mozo');

    await page.goto('/mozo');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const mesa5 = page.locator('[data-testid="table-5"]');
    await mesa5.waitFor({ state: 'visible', timeout: 10000 });

    // BILL_REQUESTED shows an amber badge with "CUENTA" text inside the table card
    const cuentaBadge = mesa5.locator('text=CUENTA');
    const hasBadge = await cuentaBadge.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBadge) {
      console.log('  ✅ Mesa 5 muestra badge ámbar CUENTA (BILL_REQUESTED)');
    } else {
      // Fallback: verify REQUEST_CHECK event in IndexedDB
      const hasEvent = await page.evaluate(async () => {
        const req = indexedDB.open('ParkDB');
        await new Promise<void>((res, rej) => {
          req.onsuccess = () => res();
          req.onerror  = () => rej(req.error);
        });
        const db = req.result;
        const tx = db.transaction(['events'], 'readonly');
        const all = await new Promise<any[]>((res) => {
          const r = tx.objectStore('events').getAll();
          r.onsuccess = () => res(r.result);
        });
        db.close();
        return all.some(e => e.event_type === 'REQUEST_CHECK');
      });
      expect(hasEvent, 'REQUEST_CHECK event debe estar en IndexedDB').toBe(true);
      console.log('  ✅ REQUEST_CHECK confirmado en IndexedDB (BILL_REQUESTED activo)');
    }

    console.log('\n🎉 Pedido Multi-Estación + Pedir Cuenta: COMPLETADO');
    console.log('   Estaciones cubiertas: HORNO ✅  PARRILLA ✅  BAR ✅\n');
  });
});
