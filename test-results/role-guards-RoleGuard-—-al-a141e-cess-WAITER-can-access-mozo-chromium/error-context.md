# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: role-guards.spec.ts >> RoleGuard — allowed access >> WAITER can access /mozo
- Location: e2e\role-guards.spec.ts:23:3

# Error details

```
TimeoutError: page.waitForLoadState: Timeout 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - img [ref=e8]
          - generic [ref=e11]:
            - heading "Mozo(a)T-01" [level=1] [ref=e12]
            - paragraph [ref=e13]: Toma de Pedidos • Mesas
        - generic [ref=e14]:
          - button [ref=e15]:
            - img [ref=e17]
          - generic [ref=e20]:
            - generic [ref=e21]: "0"
            - generic [ref=e22]: Ocupadas
          - generic [ref=e23]:
            - img [ref=e24]
            - generic [ref=e28]: LIVE
          - button "Menú de perfil de E2E Test User" [ref=e30]:
            - generic [ref=e32]: ET
            - generic [ref=e33]: E2E Test User
            - img [ref=e34]
          - button "Ir al inicio" [ref=e36]:
            - img [ref=e37]
      - generic [ref=e40]:
        - button "Todas" [ref=e42]: Todas
        - generic [ref=e44]:
          - img [ref=e46]
          - heading "No hay mesas configuradas" [level=3] [ref=e49]
          - paragraph [ref=e50]: El sistema está sincronizando o no se han creado mesas aún. Si eres el administrador, por favor crea tu plano de mesas desde el Panel de Administración.
        - generic [ref=e51]:
          - generic [ref=e54]: Disponible
          - generic [ref=e57]: Ocupada <20m
          - generic [ref=e60]: Cocinando
          - generic [ref=e63]: ">40m"
          - generic [ref=e66]: Pide cuenta
  - region "Notifications alt+T"
  - alert [ref=e67]
```

# Test source

```ts
  1   | /**
  2   |  * E2E Tests — RoleGuard (frontend route protection)
  3   |  *
  4   |  * Verifies that each protected route only renders for the correct role
  5   |  * and redirects unauthorized roles back to '/'.
  6   |  */
  7   | import { test, expect } from '@playwright/test';
  8   | import { setupRoleTerminal } from './helpers/test-utils';
  9   | 
  10  | // ── Allowed access ──────────────────────────────────────────────────
  11  | 
  12  | test.describe('RoleGuard — allowed access', () => {
  13  | 
  14  |   test('CASHIER can access /pos', async ({ page }) => {
  15  |     await setupRoleTerminal(page, 'CASHIER');
  16  |     await page.goto('/pos');
  17  |     await page.waitForLoadState('networkidle');
  18  |     // Should stay on /pos (not redirected)
  19  |     expect(page.url()).toContain('/pos');
  20  |     await expect(page.locator('body')).toBeVisible();
  21  |   });
  22  | 
  23  |   test('WAITER can access /mozo', async ({ page }) => {
  24  |     await setupRoleTerminal(page, 'WAITER');
  25  |     await page.goto('/mozo');
> 26  |     await page.waitForLoadState('networkidle');
      |                ^ TimeoutError: page.waitForLoadState: Timeout 60000ms exceeded.
  27  |     expect(page.url()).toContain('/mozo');
  28  |     await expect(page.locator('body')).toBeVisible();
  29  |   });
  30  | 
  31  |   test('KITCHEN can access /cocina', async ({ page }) => {
  32  |     await setupRoleTerminal(page, 'KITCHEN');
  33  |     await page.goto('/cocina');
  34  |     await page.waitForLoadState('networkidle');
  35  |     expect(page.url()).toContain('/cocina');
  36  |   });
  37  | 
  38  |   test('COOK can access /cocina', async ({ page }) => {
  39  |     await setupRoleTerminal(page, 'COOK');
  40  |     await page.goto('/cocina');
  41  |     await page.waitForLoadState('networkidle');
  42  |     expect(page.url()).toContain('/cocina');
  43  |   });
  44  | 
  45  |   test('PACKER can access /cocina', async ({ page }) => {
  46  |     await setupRoleTerminal(page, 'PACKER');
  47  |     await page.goto('/cocina');
  48  |     await page.waitForLoadState('networkidle');
  49  |     expect(page.url()).toContain('/cocina');
  50  |   });
  51  | 
  52  |   test('BAR can access /bar', async ({ page }) => {
  53  |     await setupRoleTerminal(page, 'BAR');
  54  |     await page.goto('/bar');
  55  |     await page.waitForLoadState('networkidle');
  56  |     expect(page.url()).toContain('/bar');
  57  |   });
  58  | 
  59  |   test('DRIVER can access /delivery', async ({ page }) => {
  60  |     await setupRoleTerminal(page, 'DRIVER');
  61  |     await page.goto('/delivery');
  62  |     await page.waitForLoadState('networkidle');
  63  |     expect(page.url()).toContain('/delivery');
  64  |   });
  65  | });
  66  | 
  67  | // ── Denied access (redirect to /) ──────────────────────────────────
  68  | 
  69  | test.describe('RoleGuard — denied access redirects to /', () => {
  70  | 
  71  |   test('WAITER cannot access /pos', async ({ page }) => {
  72  |     await setupRoleTerminal(page, 'WAITER');
  73  |     await page.goto('/pos');
  74  |     // RoleGuard should redirect to '/'
  75  |     await page.waitForURL('**/', { timeout: 10000 });
  76  |     expect(page.url()).not.toContain('/pos');
  77  |   });
  78  | 
  79  |   test('CASHIER cannot access /mozo', async ({ page }) => {
  80  |     await setupRoleTerminal(page, 'CASHIER');
  81  |     await page.goto('/mozo');
  82  |     await page.waitForURL('**/', { timeout: 10000 });
  83  |     expect(page.url()).not.toContain('/mozo');
  84  |   });
  85  | 
  86  |   test('WAITER cannot access /cocina', async ({ page }) => {
  87  |     await setupRoleTerminal(page, 'WAITER');
  88  |     await page.goto('/cocina');
  89  |     await page.waitForURL('**/', { timeout: 10000 });
  90  |     expect(page.url()).not.toContain('/cocina');
  91  |   });
  92  | 
  93  |   test('CASHIER cannot access /bar', async ({ page }) => {
  94  |     await setupRoleTerminal(page, 'CASHIER');
  95  |     await page.goto('/bar');
  96  |     await page.waitForURL('**/', { timeout: 10000 });
  97  |     expect(page.url()).not.toContain('/bar');
  98  |   });
  99  | 
  100 |   test('WAITER cannot access /delivery', async ({ page }) => {
  101 |     await setupRoleTerminal(page, 'WAITER');
  102 |     await page.goto('/delivery');
  103 |     await page.waitForURL('**/', { timeout: 10000 });
  104 |     expect(page.url()).not.toContain('/delivery');
  105 |   });
  106 | 
  107 |   test('KITCHEN cannot access /pos', async ({ page }) => {
  108 |     await setupRoleTerminal(page, 'KITCHEN');
  109 |     await page.goto('/pos');
  110 |     await page.waitForURL('**/', { timeout: 10000 });
  111 |     expect(page.url()).not.toContain('/pos');
  112 |   });
  113 | 
  114 |   test('BAR cannot access /mozo', async ({ page }) => {
  115 |     await setupRoleTerminal(page, 'BAR');
  116 |     await page.goto('/mozo');
  117 |     await page.waitForURL('**/', { timeout: 10000 });
  118 |     expect(page.url()).not.toContain('/mozo');
  119 |   });
  120 | 
  121 |   test('DRIVER cannot access /cocina', async ({ page }) => {
  122 |     await setupRoleTerminal(page, 'DRIVER');
  123 |     await page.goto('/cocina');
  124 |     await page.waitForURL('**/', { timeout: 10000 });
  125 |     expect(page.url()).not.toContain('/cocina');
  126 |   });
```