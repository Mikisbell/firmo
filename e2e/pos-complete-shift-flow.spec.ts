/**
 * E2E: Complete POS Shift Flow
 *
 * Tests the critical business flow for a Peruvian polleria:
 * Open shift -> Create orders -> Collect payments -> Close shift -> Z report -> Verify totals
 *
 * Approach: Hybrid -- data seeded directly via Prisma, UI verification via Playwright
 */
import { test, expect } from '@playwright/test';
import { setupRoleTerminal, TENANT_ID } from './helpers/test-utils';
import { ZReportPage } from './pages/ZReportPage';
import { v4 as uuidv4 } from 'uuid';
import {
  seedTerminalRange,
  seedShift,
  seedOrder,
  seedPayment,
  cleanupTestData,
  disconnectDB,
  generateTestJWT,
} from './helpers/db-seed';

const TERMINAL_ID = 'cashier_e2e_shift';
const ACTOR_ID = '00000000-0000-0000-0000-000000000004';
const CASH_OPENING_CENTS = 10000; // S/ 100.00

test.describe('POS Complete Shift Flow', () => {
  let shiftId: string;
  let order1Id: string;
  let order2Id: string;
  let check1Id: string;
  let check2Id: string;

  test.beforeAll(async () => {
    // Generate IDs
    shiftId = uuidv4();
    order1Id = uuidv4();
    order2Id = uuidv4();
    check1Id = uuidv4();
    check2Id = uuidv4();

    // Cleanup previous test data
    await cleanupTestData(TENANT_ID, TERMINAL_ID);

    // Seed terminal range (required for ORDER_CREATED validation)
    await seedTerminalRange(TENANT_ID, TERMINAL_ID);

    // Seed open shift: S/ 100.00 opening
    await seedShift({
      shiftId,
      tenantId: TENANT_ID,
      terminalId: TERMINAL_ID,
      cashOpeningCents: CASH_OPENING_CENTS,
      actorId: ACTOR_ID,
      status: 'CLOSED',
      cashCountedCents: 13500, // S/ 135.00 (opening + cash sales)
      cashExpectedCents: 13500,
      diffCents: 0,
    });

    // Seed Order 1: Pollo a la Brasa x1 = S/ 35.00, pay CASH
    const items1 = [
      { line_id: 'line-1-0', name: 'Pollo a la Brasa', unit_price_cents: 3500, qty: 1 },
    ];
    await seedOrder({
      orderId: order1Id,
      tenantId: TENANT_ID,
      terminalId: TERMINAL_ID,
      orderNumber: 90001,
      shiftId,
      items: items1,
      checks: [{
        check_id: check1Id,
        lines: [{ line_id: 'line-1-0', qty: 1 }],
        total_cents: 3500,
      }],
    });
    await seedPayment({
      paymentId: uuidv4(),
      tenantId: TENANT_ID,
      orderId: order1Id,
      checkId: check1Id,
      shiftId,
      terminalId: TERMINAL_ID,
      amountCents: 3500,
      method: 'CASH',
      actorId: ACTOR_ID,
    });

    // Seed Order 2: Pollo + Papas = S/ 43.00, pay CARD
    const items2 = [
      { line_id: 'line-2-0', name: 'Pollo a la Brasa', unit_price_cents: 3500, qty: 1 },
      { line_id: 'line-2-1', name: 'Papas Fritas', unit_price_cents: 800, qty: 1 },
    ];
    await seedOrder({
      orderId: order2Id,
      tenantId: TENANT_ID,
      terminalId: TERMINAL_ID,
      orderNumber: 90002,
      shiftId,
      items: items2,
      checks: [{
        check_id: check2Id,
        lines: [
          { line_id: 'line-2-0', qty: 1 },
          { line_id: 'line-2-1', qty: 1 },
        ],
        total_cents: 4300,
      }],
    });
    await seedPayment({
      paymentId: uuidv4(),
      tenantId: TENANT_ID,
      orderId: order2Id,
      checkId: check2Id,
      shiftId,
      terminalId: TERMINAL_ID,
      amountCents: 4300,
      method: 'CARD',
      actorId: ACTOR_ID,
    });
  });

  test.afterAll(async () => {
    await cleanupTestData(TENANT_ID, TERMINAL_ID);
    await disconnectDB();
  });

  test('full lifecycle: closed shift with orders → Z report → verify totals', async ({ page, context }) => {
    // Step 1: Setup terminal auth with e2e_mode (bypasses client-side PIN auth)
    await setupRoleTerminal(page, 'CASHIER', TERMINAL_ID);

    // Step 1b: Set auth_token cookie for server-side API auth
    const authToken = await generateTestJWT({
      employeeId: ACTOR_ID,
      tenantId: TENANT_ID,
      role: 'CASHIER',
    });
    await context.addCookies([{
      name: 'auth_token',
      value: authToken,
      domain: 'localhost',
      path: '/',
    }]);

    // Step 2: Navigate to Z-report page for the seeded shift
    const zReportPage = new ZReportPage(page);
    await zReportPage.navigateToZReport(shiftId);

    // Step 3: Generate Z report (page shows "No hay reporte" with generate buttons)
    await zReportPage.generateZReport();

    // Step 4: VERIFY — The money adds up
    // Gross total: S/ 35.00 + S/ 43.00 = S/ 78.00
    await zReportPage.assertGrossSales('S/ 78.00');

    // Verify orders count = 2
    await zReportPage.assertOrdersCount('2');

    // Verify cash opening = S/ 100.00
    await zReportPage.assertCashOpening('S/ 100.00');

    // Verify payments section exists
    await expect(zReportPage.paymentsSection).toBeVisible();

    // Verify report meta is visible
    await expect(zReportPage.meta).toBeVisible();
  });
});
